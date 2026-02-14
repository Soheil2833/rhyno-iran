"use server"

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { pool } from "@/lib/db";

import { cookies } from "next/headers"

import { revalidatePath } from "next/cache"
import { withRetry, toEnglishDigits, getSafeDate, sanitizeSql } from "@/lib/utils/finance-utils"
import { syncToRahkaranSystem } from "@/lib/services/rahkaran"

import {
  detectBankInfoByNumber,
  findSmartRule,
  generateCleanDescription
} from "@/lib/services/bankIntelligence"
import {
  analyzeSinglePage,
  extractNameFromDesc
} from "@/lib/services/ai-service"


interface RahkaranAccount {
  code: string;
  title: string;
}
export type VerifyAndSettleResponse =
  | {
    success: true
    approved: boolean
    reason?: string
    docId?: string
  }
  | {
    success: false
    error: string
  }

interface PaymentRequest {
  id: string;
  created_at: string;
  supplier_name: string | null;
  amount: number | null;
  payment_date: string | null;
  tracking_code: string | null;
  receipt_image_url: string | null;
  rahkaran_doc_id: string | null;
  invoice_image_url: string | null;
  warehouse_receipt_url: string | null;
  status: 'uploaded' | 'pending' | 'completed' | string | null;
  assigned_to: string | null;
  deadline: string | null;
  created_by: string | null;
  workspace_id: string | null;
  rahkaran_id: string | null;
  invoice_url: string | null;
  receipt_url: string | null;
  description: string | null;
  type: string | null;
  counterparty: string | null;
  assigned_user_id: string | null;
  customer_group: string | null;
  ai_verification_status: string | null;
  ai_verification_reason: string | null;
  transaction_date: string | null;
  meta_data: any;
}
const PROXY_URL = process.env.RAHKARAN_PROXY_URL
const PROXY_KEY = process.env.RAHKARAN_PROXY_KEY




export interface SinglePageResult {
  success: boolean
  data?: any
  error?: string
}
// ------------------------------------------------------------------
// 1. OCR Function
// ------------------------------------------------------------------


// تابع کمکی برای استخراج نام (همان که قبلا دادم)

const s3Client = new S3Client({
  region: "ir-thr-at1", // ریجن دقیق شما طبق لینک
  endpoint: "s3.ir-thr-at1.arvanstorage.ir", // اندپوینت صحیح برای API آروان
  credentials: {
    accessKeyId: process.env.ARVAN_ACCESS_KEY!,
    secretAccessKey: process.env.ARVAN_SECRET_KEY!,
  },
  forcePathStyle: true, // برای سازگاری کامل با آروان
});


export async function savePaymentRequestAction(data: any) {
  const query = `
    INSERT INTO payment_requests 
    (workspace_id, receipt_image_url, supplier_name, description, amount, status, payment_date, type)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `;
  const values = [
    data.workspaceId, data.fileUrl, data.supplierName,
    data.description, data.amount, data.status,
    data.paymentDate, data.type
  ];
  await pool.query(query, values);
}

// ------------------------------------------------------------------
// 2. Helper Functions
// ------------------------------------------------------------------
async function findOfficerForCustomer(
  supabase: any,
  workspaceId: string,
  customerName: string
) {
  // ۱. دریافت اطلاعات از جدول مپینگ (شامل موبایل اکسل)
  const { data: mapping } = await supabase
    .from("customer_mappings")
    .select("officer_email, officer_phone, group_name") // ✅ دریافت officer_phone
    .eq("workspace_id", workspaceId)
    .ilike("customer_name", customerName)
    .maybeSingle()

  if (!mapping?.officer_email) return null

  // ۲. پیدا کردن ID کاربر از روی ایمیل
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, phone") // دریافت تلفن پروفایل هم برای احتیاط
    .eq("username", mapping.officer_email)
    .maybeSingle()

  return {
    officerId: profile?.user_id,
    groupName: mapping.group_name,
    // ✅ اولویت با شماره اکسل است، اگر نبود شماره پروفایل
    officerPhone: mapping.officer_phone || profile?.phone
  }
}

// ------------------------------------------------------------------
// 3. Submit Transactions (Fixed: returns IDs)
// ------------------------------------------------------------------

// در فایل app/actions/finance-actions.ts

// ✅ تابع جدید: ثبت کامل واریز و برداشت یک روز به صورت همزمان
// در فایل app/actions/finance-actions.ts

export async function submitDayComplete(
  date: string,
  workspaceId: string,
  hostBankDL: string | null
) {
  console.log(
    `🚀 STARTING FULL PROCESS FOR DATE: ${date} | BankDL: ${hostBankDL}`
  )

  const results = { deposit: null as any, withdrawal: null as any }

  // ✅ تابع کمکی داخلی برای مدیریت تلاش مجدد (Retry Loop)
  const processWithRetry = async (type: "deposit" | "withdrawal") => {
    const maxAttempts = 5 // ۵ بار تلاش
    const delayMs = 10000 // ۱۰ ثانیه وقفه

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (attempt > 1) {
          console.log(
            `🔄 [${type}] Retrying... Attempt ${attempt}/${maxAttempts}`
          )
        }

        // فراخوانی تابع اصلی
        const result = await submitDailyVoucher(
          date,
          workspaceId,
          type,
          hostBankDL
        )

        // ۱. اگر موفق بود، سریع برگردان
        if (result.success) {
          return result
        }

        // ۲. اگر ارور "تراکنشی یافت نشد" بود، تلاش مجدد لازم نیست (چون دیتایی نیست)
        if (result.error && result.error.includes("تراکنش معتبری برای نوع")) {
          console.warn(`⚠️ [${type}] No transactions found. Skipping retry.`)
          return result
        }

        // ۳. اگر ارور دیگری بود (مثل خطای شبکه یا SQL)، پرتاب کن تا برود در catch و دوباره تلاش شود
        throw new Error(result.error || "Unknown Error")
      } catch (error: any) {
        console.error(
          `❌ [${type}] Error on attempt ${attempt}:`,
          error.message
        )

        // اگر آخرین تلاش هم شکست خورد، ارور نهایی را برگردان
        if (attempt === maxAttempts) {
          console.error(`🔥 [${type}] Failed after ${maxAttempts} attempts.`)
          return { success: false, error: error.message }
        }

        // وقفه قبل از تلاش بعدی
        console.log(`⏳ Waiting ${delayMs / 1000}s before next retry...`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }
  }

  // 1. پردازش واریزها (با مکانیزم تلاش مجدد)
  results.deposit = await processWithRetry("deposit")

  // 2. پردازش برداشت‌ها (با مکانیزم تلاش مجدد)
  results.withdrawal = await processWithRetry("withdrawal")

  return results
}
export async function submitGroupedTransactions(workspaceId: string, groupedData: any[]) {
  console.log(`🚀 [DB_SAVE] شروع فرآیند ذخیره‌سازی: ${groupedData?.length} گروه`);

  const dbClient = await pool.connect();

  try {
    await dbClient.query('BEGIN');

    // ۱. استخراج تمام تراکنش‌ها در یک آرایه واحد برای پردازش موازی
    const allTransactions = groupedData.flatMap(group => {
      const finalFileUrl = Array.isArray(group.fileUrl) ? group.fileUrl[0] : group.fileUrl;
      return (group.transactions || []).map((tx: any) => ({ ...tx, finalFileUrl }));
    });

    console.log(`📦 در حال پردازش همزمان ${allTransactions.length} تراکنش...`);

    // ۲. استفاده از Promise.all برای ارسال همزمان درخواست‌ها به دیتابیس
    const insertPromises = allTransactions.map((tx) => {
      const safeAmount = typeof tx.amount === "string"
        ? parseFloat(tx.amount.replace(/,/g, "").replace(/[^0-9.]/g, "")) || 0
        : (tx.amount || 0);

      const datePart = (tx.date || "").replace(/[\/\-]/g, "");
      const finalTrackingCode = tx.tracking_code && tx.tracking_code !== "نامشخص"
        ? `${tx.tracking_code}-${safeAmount}`
        : `AUTO-${safeAmount}-${datePart}-${Math.random().toString(36).substring(2, 7)}`;

      const query = `
        INSERT INTO payment_requests (
          workspace_id, supplier_name, amount, payment_date, 
          tracking_code, receipt_image_url, description, type, 
          counterparty, status, ai_verification_status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        ON CONFLICT (tracking_code) DO UPDATE SET
          description = EXCLUDED.description
        RETURNING id, counterparty;
      `;

      return dbClient.query(query, [
        workspaceId,
        tx.partyName || "نامشخص",
        safeAmount,
        tx.date,
        finalTrackingCode,
        tx.finalFileUrl,
        tx.description || "",
        tx.type === "deposit" ? "deposit" : "withdrawal",
        tx.partyName || "نامشخص",
        'pending',
        tx.ai_verification_status || "pending"
      ]);
    });

    // منتظر می‌مانیم تا همه Insertها انجام شوند (بسیار سریع‌تر از حلقه)
    const results = await Promise.all(insertPromises);

    results.forEach((res) => {
      if (res.rows[0]) {
        console.log(`✅ ذخیره شد: ${res.rows[0].counterparty} | ID: ${res.rows[0].id}`);
      }
    });

    await dbClient.query('COMMIT');
    console.log("🏁 [DB_SAVE] تمامی تراکنش‌ها با موفقیت Commit شدند.");
    return { success: true };

  } catch (error: any) {
    await dbClient.query('ROLLBACK');
    console.error("❌ [DB_SAVE_ERROR]:", error.message);
    return { success: false, error: error.message };
  } finally {
    dbClient.release();
  }
}

export async function submitDailyVoucher(
  date: string,
  workspaceId: string,
  type: "deposit" | "withdrawal",
  hostBankDL: string | null
) {
  const t0 = Date.now();
  console.log(`⏱️ [STEP 1] Starting submitDailyVoucher for ${type}`);

  const cookieStore = cookies();

  console.log("🚀 تابع submitGroupedTransactions فراخوانی شد");
  const dbClient = await pool.connect();
  console.log("✅ کانکشن برقرار شد");

  try {
    // ۱. تبدیل تاریخ و آماده‌سازی
    const searchDate = date;
    console.log(`📅 Searching for exact string in DB: "${searchDate}"`);
    const typeFarsi = type === "deposit" ? "واریز" : "برداشت";

    // ۲. دریافت داده‌ها با SQL مستقیم (بسیار سریع‌تر از Fetch برای تعداد بالا)
    // ۲. دریافت داده‌ها با SQL مستقیم - اصلاح شده
    const selectQuery = `
  SELECT 
    id, 
    amount, 
    type, 
    payment_date, 
    rahkaran_doc_id,
    description,    -- 🟢 اضافه شد
    counterparty,   -- 🟢 اضافه شد
    supplier_name,  -- 🟢 اضافه شد
    tracking_code   -- 🟢 اضافه شد
  FROM payment_requests 
  WHERE workspace_id = $1 
    AND payment_date = $2
`;
    // حذف موقت فیلتر type و rahkaran_doc_id برای دیدن اینکه اصلاً چی پیدا میشه
    const { rows: allFound } = await dbClient.query(selectQuery, [workspaceId, searchDate]);

    console.log(`🔎 [DEBUG] Total found for date ${searchDate}: ${allFound.length} items`);

    // حالا فیلتر دستی انجام میدیم تا بفهمیم کجا صفر میشه
    const validRequests = allFound.filter((r) =>
      r.type === type &&
      r.rahkaran_doc_id === null &&
      Number(r.amount) > 0
    );

    console.log(`🔎 [DEBUG] Filtered for ${type}: ${validRequests.length} items`);

    if (validRequests.length === 0) {
      if (allFound.length > 0) {
        console.log(`💡 [HINT] First record in DB has type: "${allFound[0].type}" and amount: ${allFound[0].amount}`);
      }
      console.log(`💡 [INFO] No ${type} transactions found. Skipping submit.`);
      return { success: false, error: `تراکنش معتبری برای نوع ${type} یافت نشد.` };
    }

    const totalAmount = validRequests.reduce((sum, r) => sum + Number(r.amount || 0), 0);

    // ۴. ساخت Payload برای راهکاران
    const payload = {
      description: `سند تجمیعی ${typeFarsi} - مورخ ${date}`,
      mode: type,
      totalAmount: totalAmount,
      date: searchDate,
      workspaceId: workspaceId,
      bankDLCode: hostBankDL,
      items: validRequests.map((r) => ({
        partyName: r.counterparty || r.supplier_name || "نامشخص",
        amount: Number(r.amount),
        desc: generateCleanDescription(r.description || "", r.counterparty || r.supplier_name || "", type),
        tracking: r.tracking_code || ""
      }))
    };

    // ۵. فراخوانی خروجی به راهکاران (این بخش به دلیل ماهیت API باید منتظر بماند)
    console.log(`📤 Sending ${validRequests.length} items to Rahkaran...`);
    const rahkaranRes = await syncToRahkaranSystem(payload);

    if (!rahkaranRes.success) {
      throw new Error(`خطای راهکاران: ${rahkaranRes.error}`);
    }

    // ۶. به‌روزرسانی وضعیت در دیتابیس (SQL مستقیم به جای .in())
    // استفاده از ANY($1) برای پاس دادن آرایه IDها
    const requestIds = validRequests.map((r) => r.id);
    const updateQuery = `
      UPDATE payment_requests 
      SET 
        status = 'completed', 
        rahkaran_doc_id = $1, 
        ai_verification_status = 'verified', 
        ai_verification_reason = $2,
        updated_at = NOW()
      WHERE id = ANY($3)
    `;

    await dbClient.query(updateQuery, [
      rahkaranRes.docId,
      `ثبت تجمیعی روزانه - شماره سند راهکاران: ${rahkaranRes.docId}`,
      requestIds
    ]);

    console.log(`🏁 [TOTAL] submitDailyVoucher finished in: ${Date.now() - t0}ms`);

    return {
      success: true,
      docId: rahkaranRes.docId,
      count: validRequests.length,
      totalAmount: totalAmount,
      message: `سند با موفقیت ثبت شد. شماره سند: ${rahkaranRes.docId}`
    };

  } catch (e: any) {
    console.error("💥 [CRITICAL ERROR]:", e.message);
    return { success: false, error: e.message };
  } finally {
    dbClient.release(); // آزاد کردن کانکشن از استخر (Pool)
  }
}
export async function verifyAndSettleRequest(
  requestId: string,
  workspaceId: string,
  invoiceUrl: string,
  warehouseUrl: string
): Promise<VerifyAndSettleResponse> {

  console.log(`🔄 [FINANCE_ACTION] Settle شروع شد برای: ${requestId}`);

  const cookieStore = cookies();

  const dbClient = await pool.connect(); // استفاده از Pool برای پایداری

  try {
    // ۱. دریافت اطلاعات رکورد با کوئری مستقیم (سریع و بدون Fetch)
    const getRes = await dbClient.query(
      "SELECT * FROM payment_requests WHERE id = $1 AND workspace_id = $2",
      [requestId, workspaceId]
    );

    const request = getRes.rows[0];
    if (!request) throw new Error("رکورد پیدا نشد");

    const partyName = request.counterparty || request.supplier_name || "نامشخص";
    const safeAmount = Number(request.amount) || 0;
    const typeFarsi = request.type === "deposit" ? "واریز" : "برداشت";

    // ۲. ارسال به سیستم مالی راهکاران (SQL Server داخلی)
    // با توجه به اینکه این بخش از قبل درست کار می‌کرده، منطق آن حفظ شده است
    const rahkaranRes = await withRetry(
      async () => {
        return await syncToRahkaranSystem({
          mode: request.type === "deposit" ? "deposit" : "withdrawal",
          description: `تایید مستندات - ${typeFarsi} - ${partyName}`,
          totalAmount: safeAmount,
          items: [{
            partyName,
            amount: safeAmount,
            desc: request.description || "",
            tracking: request.tracking_code || ""
          }],
          date: request.payment_date || new Date().toISOString().split("T")[0],
          workspaceId: workspaceId
        });
      },
      3,
      2000
    );

    if (!rahkaranRes.success) {
      throw new Error(`خطای راهکاران: ${rahkaranRes.error}`);
    }

    // ۳. آپدیت دیتابیس با لینک‌های آروان و کد سند راهکاران
    // استفاده از SQL مستقیم برای جلوگیری از ارورهای Socket
    const updateQuery = `
      UPDATE payment_requests 
      SET 
        invoice_url = $1, 
        warehouse_receipt_url = $2, 
        ai_verification_status = $3, 
        status = $4, 
        rahkaran_doc_id = $5, 
        ai_verification_reason = $6,
        updated_at = NOW()
      WHERE id = $7
    `;

    await dbClient.query(updateQuery, [
      invoiceUrl,
      warehouseUrl,
      "approved",
      "completed",
      rahkaranRes.docId,
      `ثبت اتوماتیک - سند راهکاران: ${rahkaranRes.docId}`,
      requestId
    ]);

    // ۴. اطلاع‌رسانی پیامکی (غیر مسدودکننده)
    if (request.assigned_user_id) {
      // اینجا می‌توانید تابع ارسال SMS خود را صدا بزنید
      // sendSettleSMS(request.assigned_user_id, rahkaranRes.docId).catch(...)
    }

    console.log(`✅ تسویه موفق: درخواست ${requestId} به سند راهکاران ${rahkaranRes.docId} متصل شد.`);

    revalidatePath(`/enterprise/${workspaceId}/finance/dashboard`);
    revalidatePath(`/enterprise/${workspaceId}/finance/requests`);

    return {
      success: true,
      approved: true,
      docId: rahkaranRes.docId,
      reason: `ثبت اتوماتیک - سند راهکاران: ${rahkaranRes.docId}`
    };


  } catch (error: any) {
    console.error("❌ Settle Error:", error.message);
    return { success: false, error: error.message };
  } finally {
    dbClient.release(); // حتماً کانکشن را آزاد کنید
  }
}

// ... (rest of the code)

export async function completeRequestDocs(
  id: string,
  workspaceId: string,
  invoiceUrl: string, // لینک مستقیم از Arvan S3
  warehouseUrl: string // لینک مستقیم از Arvan S3
) {
  console.log(`📝 شروع عملیات تکمیل مدارک برای درخواست: ${id}`);

  try {
    // ۱. اعتبارسنجی اولیه لینک‌ها
    if (!invoiceUrl.startsWith('http') || !warehouseUrl.startsWith('http')) {
      throw new Error("آدرس مدارک نامعتبر است. پروتکل HTTP/HTTPS یافت نشد.");
    }

    // ۲. بروزرسانی در دیتابیس ابر آروان با استفاده از Pool
    const query = `
      UPDATE payment_requests 
      SET 
        status = $1, 
        invoice_url = $2, 
        warehouse_receipt_url = $3, 
        ai_verification_status = $4, 
        updated_at = NOW()
      WHERE id = $5 AND workspace_id = $6
    `;

    const values = [
      "completed",
      invoiceUrl,
      warehouseUrl,
      "approved",
      id,
      workspaceId
    ];

    const result = await pool.query(query, values);

    // بررسی اینکه آیا رکوردی تغییر کرده است یا خیر
    if (result.rowCount === 0) {
      throw new Error("رکوردی با این مشخصات یافت نشد یا دسترسی محدود است.");
    }

    // ۳. پاکسازی کش (Revalidate)
    revalidatePath(`/enterprise/${workspaceId}/finance/dashboard`, "page");
    revalidatePath(`/enterprise/${workspaceId}/finance/requests`, "page");

    console.log(`✅ مدارک (فاکتور و رسید انبار) با موفقیت در دیتابیس Postgres ثبت شد.`);

    return {
      success: true,
      message: "مدارک با موفقیت ثبت و تایید شد."
    };

  } catch (error: any) {
    console.error("❌ Manual Completion Error:", error.message);
    return {
      success: false,
      error: error.message || "خطا در ثبت نهایی مدارک. لطفا مجددا تلاش کنید."
    };
  }
}

export async function addRequestNote(requestId: string, noteText: string) {
  const proxyUrl = process.env.RAHKARAN_PROXY_URL
  const proxyKey = process.env.RAHKARAN_PROXY_KEY

  const sqlQuery = `
        INSERT INTO RequestNotes (
            RequestId, 
            NoteText, 
            DateAdded
        )
        VALUES (
            '${requestId}', 
            N'${noteText}', 
            GETDATE()
        )
    `

  if (!proxyUrl || !proxyKey) {
    return { success: false, error: "Proxy configuration is missing." }
  }

  try {
    const response = await withRetry(async () => {
      return await fetch(proxyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-proxy-key": proxyKey
        },
        body: JSON.stringify({ query: sqlQuery })
      })
    })

    const data = await response.json()
    if (response.ok && data.success === true)
      return { success: true, message: "Saved." }
    return { success: false, error: data.error }
  } catch (error) {
    return { success: false, error: "Connection failed." }
  }
}

export async function getRahkaranSLs() {
  // دیگر به cookieStore و supabase نیازی نیست

  try {
    // ۱. اجرای کوئری مستقیم روی دیتابیس ابر آروان
    // استفاده از NOT LIKE برای حذف کدهایی که با 111005 شروع می‌شوند
    const query = `
      SELECT code, title 
      FROM rahkaran_accounts 
      WHERE account_type = 'SL' 
        AND code NOT LIKE '111005%' 
      ORDER BY code ASC 
      LIMIT 100
    `;

    const { rows } = await pool.query(query);

    // ۲. نگاشت (Map) کردن داده‌ها به فرمت مورد نظر شما
    if (rows && rows.length > 0) {
      return rows.map((row) => ({
        code: row.code,
        title: row.title,
        fullLabel: `${row.code} - ${row.title}`
      }));
    }

    return [];
  } catch (e) {
    // تغییر لاگ خطا به Postgres
    console.error("❌ Fetch SL from Arvan Postgres Error:", e);
    return [];
  }
}

// app/actions/finance-actions.ts

export async function getRahkaranAccounts() {
  console.log("🚀 [FINANCE_ACTION] واکشی لیست حساب‌ها از دیتابیس داخلی...");

  try {
    // اجرای کوئری‌ها به صورت همزمان برای سرعت بالاتر
    const [slRes, dlRes] = await Promise.all([
      pool.query(`
        SELECT code, title FROM rahkaran_accounts 
        WHERE account_type = 'SL' AND code NOT LIKE '111005%' 
        ORDER BY code ASC LIMIT 100
      `),
      pool.query(`
        SELECT dl_code, title FROM rahkaran_entities 
        ORDER BY title ASC LIMIT 100
      `)
    ]);

    const sls = slRes.rows.map(row => ({
      code: row.code,
      title: row.title,
      type: "SL",
      fullLabel: `📘 ${row.code} - ${row.title}`
    }));

    const dls = dlRes.rows.map(row => ({
      code: row.dl_code, // در جدول شما نام فیلد dl_code است
      title: row.title,
      type: "DL",
      fullLabel: `👤 ${row.title} (${row.dl_code})`
    }));

    return [...sls, ...dls];
  } catch (e: any) {
    console.error("💥 Error in getRahkaranAccounts:", e.message);
    return [];
  }
}
// ------------------------------------------------------------------
// 2. تابع اصلی: ثبت سند در راهکاران + آپدیت دیتابیس
// ------------------------------------------------------------------


export async function approveUnspecifiedDocument(
  id: string,
  slCode: string,
  dlCode: string | null,
  description: string | null,
  workspaceId: string
) {
  try {
    // ۱. دریافت اطلاعات با SQL مستقیم
    const { rows } = await pool.query(
      "SELECT * FROM payment_requests WHERE id = $1",
      [id]
    );
    const request = rows[0];

    if (!request) throw new Error("رکورد سند یافت نشد.");

    const amount = Number(request.amount) || 0;
    const isDeposit = request.type?.toLowerCase().includes("deposit");
    const finalDesc = description || request.description || "تایید دستی";

    // ۲. ارسال به سیستم راهکاران (این تابع داخلی شماست که با پروکسی کار می‌کند)
    const rahkaranResult = await insertVoucherWithDL({
      slCode, dlCode, amount, description: finalDesc, isDeposit,
      date: request.payment_date || new Date().toISOString().split("T")[0]
    });

    if (!rahkaranResult.success) throw new Error(rahkaranResult.error);

    const finalDocId = (rahkaranResult as any).voucherNum?.toString();

    // ۳. آپدیت وضعیت در دیتابیس داخلی
    await pool.query(`
      UPDATE payment_requests 
      SET status = 'completed', 
          ai_verification_status = 'manual_verified',
          rahkaran_doc_id = $1,
          ai_verification_reason = $2,
          updated_at = NOW()
      WHERE id = $3
    `, [finalDocId, `تایید دستی - معین: ${slCode}`, id]);

    revalidatePath(`/enterprise/${workspaceId}/finance/dashboard`);
    return { success: true, docNumber: finalDocId };

  } catch (err: any) {
    console.error("❌ Error:", err.message);
    return { success: false, error: err.message };
  }
}


async function insertVoucherWithDL(params: {
  slCode: string
  dlCode: string | null
  amount: number
  description: string
  isDeposit: boolean
  date: string
}) {
  if (!PROXY_URL || !PROXY_KEY)
    return { success: false, error: "تنظیمات پروکسی موجود نیست" }

  const bankSL = "111005"
  const safeDesc = sanitizeSql(params.description)

  // اگر DL انتخاب نشده بود، NULL بفرست
  const dlCodeValue = params.dlCode ? `'${params.dlCode}'` : "NULL"

  const sql = `
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @Date NVARCHAR(20) = '${params.date}';
        DECLARE @Desc NVARCHAR(MAX) = N'${safeDesc}';
        DECLARE @SLCode NVARCHAR(50) = '${params.slCode}';
        
        DECLARE @VoucherID BIGINT, @VoucherNumber BIGINT, @VoucherLockID BIGINT;
        DECLARE @DailyNumber INT; -- متغیر جدید برای شماره روزانه
        DECLARE @SLRef BIGINT, @GLRef BIGINT, @AccountGroupRef BIGINT;
        
        -- متغیرهای تفصیلی
        DECLARE @DLRef BIGINT = NULL, @DLTypeRef BIGINT = NULL;

        -- 1. پیدا کردن معین
        SELECT TOP 1 @SLRef = SLID, @GLRef = GLRef, @AccountGroupRef = (SELECT TOP 1 AccountGroupRef FROM [FIN3].[GL] WHERE GLID = SL.GLRef)
        FROM [FIN3].[SL] SL WHERE Code = @SLCode;

        IF @SLRef IS NULL THROW 51000, 'کد معین یافت نشد', 1;

        -- 2. پیدا کردن تفصیلی
        IF ${dlCodeValue} IS NOT NULL
        BEGIN
            SELECT TOP 1 @DLRef = DLID, @DLTypeRef = DLTypeRef 
            FROM [FIN3].[DL] WHERE Code = ${dlCodeValue};
            
            IF @DLRef IS NULL THROW 51000, 'کد تفصیلی انتخاب شده نامعتبر است', 1;
        END

        -- 3. هدر سند
        DECLARE @BranchRef BIGINT = 1, @LedgerRef BIGINT = 1, @UserRef INT = 1;
        DECLARE @VoucherTypeRef BIGINT = 30;
        DECLARE @FiscalYearRef BIGINT;
        SELECT TOP 1 @FiscalYearRef = FiscalYearRef FROM [GNR3].[LedgerFiscalYear] WHERE LedgerRef = @LedgerRef ORDER BY EndDate DESC;

        -- دریافت ID جدید
        EXEC [Sys3].[spGetNextId] 'FIN3.Voucher', @Id = @VoucherID OUTPUT;
        
        -- محاسبه شماره سند (کلی در سال)
        SELECT @VoucherNumber = ISNULL(MAX(Number), 0) + 1 
        FROM [FIN3].[Voucher] WITH (UPDLOCK, HOLDLOCK) 
        WHERE FiscalYearRef = @FiscalYearRef 
          AND LedgerRef = @LedgerRef 
          AND VoucherTypeRef = @VoucherTypeRef;

        -- ✅ محاسبه صحیح شماره روزانه (مخصوص همان روز)
        SELECT @DailyNumber = ISNULL(MAX(DailyNumber), 0) + 1 
        FROM [FIN3].[Voucher] WITH (UPDLOCK, HOLDLOCK) 
        WHERE FiscalYearRef = @FiscalYearRef 
          AND LedgerRef = @LedgerRef 
          AND BranchRef = @BranchRef
          AND Date = @Date;

       INSERT INTO [FIN3].[Voucher] (
            VoucherID, LedgerRef, FiscalYearRef, BranchRef, Number, Date, VoucherTypeRef,
            Creator, CreationDate, LastModifier, LastModificationDate, IsExternal,
            Description, State, IsTemporary, IsCurrencyBased, ShowCurrencyFields, DailyNumber, Sequence
        ) VALUES (
            @VoucherID, @LedgerRef, @FiscalYearRef, @BranchRef, @VoucherNumber,
            @Date, @VoucherTypeRef, @UserRef, GETDATE(), @UserRef, GETDATE(), 0,
            @Desc, 0, 0, 0, 0, @DailyNumber, @VoucherNumber
        );
        -- نکته: DailyNumber اصلاح شد (قبلاً @VoucherNumber بود)

        EXEC [Sys3].[spGetNextId] 'FIN3.VoucherLock', @Id = @VoucherLockID OUTPUT;
        INSERT INTO [FIN3].[VoucherLock] (VoucherLockID, VoucherRef, UserRef, LastModificationDate) 
        VALUES (@VoucherLockID, @VoucherID, @UserRef, GETDATE());

        -- 4. آیتم طرف حساب
        DECLARE @ItemID1 BIGINT;
        EXEC [Sys3].[spGetNextId] 'FIN3.VoucherItem', @Id = @ItemID1 OUTPUT;
        
        INSERT INTO [FIN3].[VoucherItem] (
            VoucherItemID, VoucherRef, BranchRef, SLRef, SLCode, GLRef, AccountGroupRef,
            Debit, Credit, Description, RowNumber, IsCurrencyBased,
            DLLevel4, DLTypeRef4
        ) VALUES (
            @ItemID1, @VoucherID, @BranchRef, @SLRef, @SLCode, @GLRef, @AccountGroupRef,
            ${params.isDeposit ? 0 : params.amount}, ${params.isDeposit ? params.amount : 0}, 
            @Desc, 1, 0,
            CASE WHEN @DLRef IS NOT NULL THEN ${dlCodeValue} ELSE NULL END, 
            CASE WHEN @DLRef IS NOT NULL THEN @DLTypeRef ELSE NULL END
        );

        -- 5. آیتم بانک
        DECLARE @BankSLRef BIGINT, @BankGLRef BIGINT, @BankAG BIGINT, @ItemID2 BIGINT;
        SELECT TOP 1 @BankSLRef = SLID, @BankGLRef = GLRef, @BankAG = (SELECT TOP 1 AccountGroupRef FROM [FIN3].[GL] WHERE GLID = SL.GLRef) 
        FROM [FIN3].[SL] WHERE Code = '${bankSL}';

        EXEC [Sys3].[spGetNextId] 'FIN3.VoucherItem', @Id = @ItemID2 OUTPUT;
        INSERT INTO [FIN3].[VoucherItem] (
            VoucherItemID, VoucherRef, BranchRef, SLRef, SLCode, GLRef, AccountGroupRef,
            Debit, Credit, Description, RowNumber, IsCurrencyBased
        ) VALUES (
            @ItemID2, @VoucherID, @BranchRef, @BankSLRef, '${bankSL}', @BankGLRef, @BankAG,
            ${params.isDeposit ? params.amount : 0}, ${params.isDeposit ? 0 : params.amount},
            N'بانک - ' + @Desc, 2, 0
        );

        UPDATE [FIN3].[Voucher] SET State = 1 WHERE VoucherID = @VoucherID;
        COMMIT TRANSACTION;
        SELECT 'Success' as Status, @VoucherNumber as VoucherNum;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SELECT 'Error' as Status, ERROR_MESSAGE() as ErrMsg;
    END CATCH
  `

  try {
    const res = await fetch(PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-proxy-key": PROXY_KEY },
      body: JSON.stringify({ query: sql }),
      cache: "no-store"
    })

    const json = await res.json()
    const resultRow = json.recordset ? json.recordset[0] : null

    if (resultRow && resultRow.Status === "Success") {
      return { success: true, docNumber: resultRow.VoucherNum }
    } else {
      return {
        success: false,
        error: resultRow ? resultRow.ErrMsg : "خطای SQL"
      }
    }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}



export async function getRahkaranDLs() {
  console.log("🚀 [FINANCE_ACTION] واکشی لیست تفصیلی‌ها از دیتابیس داخلی (Arvan Postgres)...");

  try {
    // ۱. اجرای کوئری روی جدول rahkaran_entities
    // استفاده از SQL استاندارد برای مرتب‌سازی بر اساس حروف الفبا
    const query = `
      SELECT dl_code, title 
      FROM rahkaran_entities 
      ORDER BY title ASC
    `;

    const { rows } = await pool.query(query);

    // ۲. بررسی وجود داده و تبدیل به فرمت مورد نیاز فرانت‌اند
    if (rows && rows.length > 0) {
      return rows.map((row: { dl_code: string; title: string }) => ({
        code: row.dl_code,
        title: row.title,
        fullLabel: `${row.title} (${row.dl_code})`
      }));
    }

    return [];
  } catch (e: any) {
    // لاگ کردن خطا برای دیباگ راحت‌تر
    console.error("❌ [FINANCE_ACTION] getRahkaranDLs Error:", e.message);
    return [];
  }
}