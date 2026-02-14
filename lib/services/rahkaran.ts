
import {
  verifyNameMatch,
  detectFee,
  verifyWithAI,
  auditVoucherWithAI,
  INTERNAL_BANK_ACCOUNTS,
  recoverBankFromDescription,
  detectBankInfoByNumber,
  findSmartRule,
  extractCounterpartyBankWithAI
} from "./bankIntelligence"
import { geminiClient, AI_MODELS, gpt5Client, embeddingClient } from "@/lib/arvanapi";
import { batchMatchAccountsAI, batchMatchTransactionsAI } from "@/lib/services/ai-service"
import { pool } from "@/lib/db";
import jalaali from 'jalaali-js';



export interface RahkaranSyncResult {
  success: boolean
  docId?: string
  error?: string
  message?: string
  party?: string
  sl?: string
  processedTrackingCodes?: string[]
  results?: string[]
}

export interface FeeResult {
  isFee: boolean
  reason: string
}
function convertShamsiToGregorian(shamsiDate: string): string {
  try {
    if (!shamsiDate || typeof shamsiDate !== 'string') {
      throw new Error("تاریخ ورودی خالی است");
    }

    // نرمال‌سازی اعداد و جداکننده‌ها
    const cleanDate = normalizePersianNumbers(shamsiDate).replace(/[\/-]/g, '/');
    const parts = cleanDate.split('/').map(num => parseInt(num, 10));

    if (parts.length !== 3 || isNaN(parts[0])) {
      throw new Error("فرمت تاریخ نامعتبر است");
    }

    // تبدیل به میلادی با کتابخانه jalaali-js
    const { gy, gm, gd } = jalaali.toGregorian(parts[0], parts[1], parts[2]);

    // خروجی استاندارد ISO که SQL Server به راحتی می‌پذیرد: YYYY-MM-DD
    return `${gy}-${gm.toString().padStart(2, '0')}-${gd.toString().padStart(2, '0')}`;

  } catch (e) {
    console.error("❌ Date Conversion Critical Error:", shamsiDate, e);
    // بازگرداندن یک تاریخ میلادی امن (تاریخ امروز) برای جلوگیری از کرش SQL
    return new Date().toISOString().split('T')[0];
  }
}

const PROJECT_MAPPING = [
  { keywords: ["مراغه", "پهرآباد"], slCode: "111306", dlCode: "110017", title: "پروژه ۲۱۰ واحدی مراغه" },
  { keywords: ["همدان"], slCode: "111306", dlCode: "110019", title: "پروژه همدان" },
  { keywords: ["تنکابن", "بیمارستان تنکابن"], slCode: "111306", dlCode: "110025", title: "پروژه بیمارستان تنکابن" },
  { keywords: ["شریف", "دانشگاه صنعتی شریف"], slCode: "111306", dlCode: "110027", title: "پروژه دانشگاه صنعتی شریف" },
  { keywords: ["ایکاپ", "ایران خودرو", "IKAP"], slCode: "111306", dlCode: "110031", title: "پروژه ایران خودرو" },
  { keywords: ["مپنا", "MAPNA"], slCode: "111306", dlCode: "110032", title: "پروژه مپنا" },
  { keywords: ["همراه اول", "ارتباطات سیار"], slCode: "111306", dlCode: "110033", title: "پروژه همراه اول" },
  { keywords: ["اردبیل", "استادیوم", "علی دایی"], slCode: "111306", dlCode: "502010", title: "پروژه استادیوم اردبیل" },
  { keywords: ["ژیمناستیک اردبیل"], slCode: "111306", dlCode: "502011", title: "پروژه سالن ژیمناستیک اردبیل" },
  { keywords: ["چیتگر", "قضایی چیتگر"], slCode: "111306", dlCode: "503011", title: "پروژه مجتمع قضایی چیتگر" },
  { keywords: ["مرند"], slCode: "111306", dlCode: "503016", title: "پروژه مرند" }
];
const SPECIAL_OVERRIDES = [
  {
    // ✅ قانون عمومی: هر جا "حسن انجام کار" بود -> معین ۱۱۱۳۱۱
    keywords: [
      "حسن انجام کار",
      "سپرده حسن",
      "وجه نقد ضمانتنامه",
      "وجه نقد ضمان"
    ],
    slCode: "111311",
    title: "سپرده حسن انجام کار (عمومی)",
    dlCode: null // تفصیلی را نال می‌گذاریم تا بعداً شاید سیستم بتواند پروژه را پیدا کند یا دستی ست شود
  },
  {
    // قانون خاص چیتگر (اگر هنوز نیاز است تفصیلی خاصی داشته باشد)
    keywords: ["مجتمع چیتگر", "دادور"],
    slCode: "111311",
    title: "سپرده حسن انجام کار - مجتمع چیتگر",
    dlCode: null
  }
]

const PETTY_CASH_HOLDERS = [
  "امین امین نیا",
  "امین امین‌نیا", // با نیم‌فاصله
  "ایرج امین نیا",
  "ایرج امین‌نیا",
  "امین امین"
]

export const TRANSFER_TRIGGERS = [
  {
    // بانک ملی شعبه مرکزی مراغه (کد 200001)
    keywords: [
      "0104813180001", // حالت استاندارد
      "104813180001", // حالت بدون صفر اول
      "813180001", // حالت کوتاه (بخش اصلی)
      "18000101048131" // حالت معکوس احتمالی (کد شعبه در آخر)
    ],
    dl: "200001",
    title: "بانک ملی شعبه مرکزی مراغه"
  },
  {
    // بانک اقتصاد نوین شعبه مراغه (حساب جاری اصلی - کد 200002)
    keywords: [
      "1021261161111", // استاندارد
      "2611611111021", // معکوس (مشاهده شده در PDF)
      "261161111", // کوتاه (بدون کد شعبه)
      "1021261" // کد شعبه و شماره کوتاه
    ],
    dl: "200002",
    title: "بانک اقتصاد نوین شعبه مراغه (حساب جاری)"
  },
  {
    // بانک اقتصاد نوین شعبه مراغه (حساب دوم - کد 200003)
    keywords: [
      "102185061161111", // استاندارد
      "161161118501021", // معکوس (مشاهده شده در PDF)
      "16116111850", // کوتاه شده در متن
      "85061161111", // کوتاه
      "6116111850" // بخش اصلی حساب بدون شعبه
    ],
    dl: "200003",
    title: "بانک اقتصاد نوین شعبه مراغه (حساب دوم)"
  },
  {
    // بانک پاسارگاد شعبه مرکزی مراغه (کد 200004)
    keywords: [
      "16048100100425641", // استاندارد
      "100425641", // کوتاه (شماره سپرده)
      "0425641160481001" // معکوس احتمالی
    ],
    dl: "200004",
    title: "بانک پاسارگاد شعبه مرکزی مراغه"
  },
  {
    // بانک تجارت مراغه (کد 200005)
    keywords: [
      "546093999" // استاندارد
    ],
    dl: "200005",
    title: "بانک تجارت مراغه"
  },
  {
    // بانک سپه شعبه مراغه (حساب اول - کد 200006)
    keywords: [
      "1669252000", // با پسوند سیستمی
      "1669252", // کوتاه و رایج
      "92521669" // معکوس احتمالی
    ],
    dl: "200006",
    title: "بانک سپه شعبه مراغه"
  },
  {
    // بانک سپه شعبه مراغه (حساب دوم - کد 200007)
    keywords: ["540947000", "540947", "0947540"],
    dl: "200007",
    title: "بانک سپه شعبه مراغه"
  },
  {
    // بانک آینده شعبه مراغه (حساب اول - کد 200010)
    keywords: [
      "0100127174001", // استاندارد
      "100127174001", // بدون صفر
      "127174001", // کوتاه
      "7400101001271" // معکوس احتمالی
    ],
    dl: "200010",
    title: "بانک آینده شعبه مراغه"
  },
  {
    // بانک آینده شعبه مراغه (حساب دوم - کد 200019)
    keywords: [
      "0201734828005", // استاندارد
      "201734828005", // بدون صفر
      "734828005", // کوتاه
      "8280050201734" // معکوس احتمالی
    ],
    dl: "200019",
    title: "بانک آینده شعبه مراغه"
  },
  {
    // بانک ملی مراغه (کد 200026)
    keywords: [
      "0223789681001", // استاندارد
      "223789681001", // بدون صفر
      "0171056896", // شماره شبا/کارت قدیمی مرتبط
      "171056896" // کارت بدون صفر
    ],
    dl: "200026",
    title: "بانک ملی مراغه"
  },
  {
    // بانک مسکن مرکزی مراغه (کد 200033)
    keywords: [
      "14005303749",
      "5303749", // کوتاه
      "037491400530" // معکوس احتمالی
    ],
    dl: "200033",
    title: "بانک مسکن مرکزی مراغه"
  },
  {
    // بانک ملت شعبه بهشتی مراغه (کد 200034)
    keywords: [
      "9880346828" // استاندارد
    ],
    dl: "200034",
    title: "بانک ملت شعبه بهشتی مراغه"
  },
  {
    // بانک کارآفرین شهید بهشتی (کد 200035)
    keywords: [
      "0101684239601", // استاندارد
      "101684239601", // بدون صفر
      "1684239601" // کوتاه
    ],
    dl: "200035",
    title: "بانک کار آفرین شهید بهشتی"
  },
  {
    // بانک ملی مراغه (طرح مهربانی - کد 200036)
    keywords: [
      "0364507742001", // استاندارد
      "364507742001", // بدون صفر
      "64507742001", // کوتاه
      "IR4801700000000364507742001"
    ],
    dl: "200036",
    title: "بانک ملی مراغه (طرح مهربانی)"
  },
  {
    // بانک کارآفرین شهید بهشتی (حساب دیگر - کد 200037)
    keywords: [
      "3201784853609", // استاندارد
      "784853609" // کوتاه
    ],
    dl: "200037",
    title: "بانک کار آفرین شهید بهشتی (شعبه بهشتی)"
  },
  {
    // بانک ملی مراغه (حساب جدید - کد 200038)
    keywords: [
      "0233196898007", // استاندارد
      "233196898007", // بدون صفر
      "33196898007" // کوتاه
    ],
    dl: "200038",
    title: "بانک ملی مراغه - حساب جدید"
  },
  {
    // بانک اقتصاد نوین مراغه (حساب سپرده - کد 200039)
    keywords: [
      "102175061161111", // استاندارد
      "750611611111021", // معکوس احتمالی
      "75061161111" // کوتاه
    ],
    dl: "200039",
    title: "بانک اقتصاد نوین مراغه - حساب سپرده"
  },
  {
    // بانک ملت شعبه سردار جنگل مراغه (کد 200040)
    keywords: [
      "2324874267" // استاندارد
    ],
    dl: "200040",
    title: "بانک ملت شعبه سردار جنگل مراغه"
  },
  {
    // بانک کارآفرین شهید بهشتی (کد 200042)
    keywords: [
      "1102009952609", // استاندارد
      "2009952609" // کوتاه
    ],
    dl: "200042",
    title: "بانک کار آفرین شهید بهشتی"
  }
]

const STRICT_FEE_KEYWORDS = [
  "تمبر",
  "ضمانت نامه",
  "ضمانتنامه",
  "صدور ضمان",
  "کارمزد",
  "آبونمان",
  "ابونمان",
  "هزینه",
  "ابطال",
  "عودت چک",
  "دسته چک",
  "حق اشتراک",
  "ضمان"
]

const GENERIC_WORDS = new Set([
  "شرکت",
  "موسسه",
  "سازمان",
  "بازرگانی",
  "تولیدی",
  "صنعتی",
  "گروه",
  "خدمات",
  "فنی",
  "مهندسی",
  "تجاری",
  "عمومی",
  "تعاونی",
  "آقای",
  "خانم",
  "فروشگاه",
  "راه",
  "ساختمانی",
  "توسعه",
  "گسترش",
  "پیمانکاری",
  "مشاوره",
  "بین",
  "المللی",
  "سازه",
  "صنعت",
  "طرح",
  "اجرا",
  "نظارت",
  "تجهیزات",
  "مجتمع",
  "کارخانه",
  "راه و ساختمانی",
  "بانک",
  "شعبه",
  "کد",
  "نامشخص",
  "بنام",
  "به",
  "نام",
  "واریز",
  "چک",
  "بابت",
  "امور",
  "دفتر",
  "شیمیایی",
  "شیمی",
  "صنایع",
  "تولیدی",
  "پخش",
  "نوید",
  "گستر",
  "آریا",
  "برتر",
  "نوین",
  "سازه",
  "صنعت"
])
const FEE_KEYWORDS = [
  "کارمزد",
  "هزینه بانکی",
  "آبونمان",
  "ابونمان", // با و بدون کلاه
  "حق اشتراک",
  "صدور چک",
  "صدور دسته چک",
  "هزینه پیامک",
  "سرویس پیامک",
  "تمبر",
  "خدمات بانکی",
  "کارمزد ساتنا",
  "کارمزد پایا",
  "عودت کارمزد  ساتنا/پایا",
  "عودت کارمزد",
  "کارمزد",
  "هزینه بانکی",
  "آبونمان",
  "ابونمان",
  "حق اشتراک",
  "صدور چک",
  "صدور دسته چک",
  "هزینه پیامک",
  "سرویس پیامک",
  "تمبر",
  "خدمات بانکی",
  "کارمزد",
  "هزینه بانکی",
  "آبونمان",
  "ابونمان",
  "حق اشتراک",
  "صدور چک",
  "صدور دسته چک",
  "هزینه پیامک",
  "سرویس پیامک",
  "تمبر",
  "تمبرضمان",
  "تمبر ضمان",
  "ضمان",
  "خدمات بانکی",
  "ابطال چک",
  "عودت چک",
  "رفع سوء اثر",
  "کارمزد رفع سوء اثر",
  "صدور چک",
  "تمتی چک",
  "کارمزد",
  "هزینه بانکی",
  "آبونمان",
  "ابونمان",
  "حق اشتراک",
  "صدور چک",
  "صدور دسته چک",
  "هزینه پیامک",
  "سرویس پیامک",
  "تمبر",
  "خدمات بانکی",
  "کارمزد ساتنا",
  "کارمزد پایا",
  "عودت کارمزد",
  "تمبرضمان",
  "تمبر ضمان",
  "ضمان",
  "ابطال چک",
  "عودت چک",
  "رفع سوء اثر",
  "کارمزد رفع سوء اثر"
]



const PROXY_URL = process.env.RAHKARAN_PROXY_URL
const PROXY_KEY = process.env.RAHKARAN_PROXY_KEY




function escapeSql(str: string | undefined | null): string {
  if (!str) return ""
  return str.toString().replace(/'/g, "''")
}



async function executeSql(sql: string) {
  const proxyRes = await fetch(PROXY_URL!, {

    method: "POST",
    headers: { "Content-Type": "application/json", "x-proxy-key": PROXY_KEY! },
    body: JSON.stringify({ query: sql })
  });

  const responseText = await proxyRes.text();
  let proxyData;

  try {
    proxyData = JSON.parse(responseText);
  } catch (e) {
    // اگر پاسخ اصلاً JSON نبود (مثلاً ارور 502 سرور یا صفحه HTML بود)
    throw new Error(`Proxy Invalid Response (Non-JSON): ${responseText.substring(0, 200)}`);
  }

  if (!proxyRes.ok || !proxyData.success) {
    // لاگ کردن کل آبجکت در ترمینال برای دیباگ کردن
    console.error("Full Rahkaran Error Object:", proxyData);

    // استخراج پیام خطا با یک مقدار جایگزین برای جلوگیری از undefined
    const errorMessage = proxyData.error || proxyData.message || "Unknown error occurred in Proxy";
    const errorDetails = proxyData.details ? ` | Details: ${JSON.stringify(proxyData.details)}` : "";

    throw new Error(`SQL Error: ${errorMessage}${errorDetails}`);
  }

  return proxyData.recordset || [];
}

export interface SyncPayload {
  mode: "deposit" | "withdrawal"
  date: string
  // ✅ نام فیلد را به 'description' یا 'docDescription' تغییر دهید.
  description: string
  // اگر 'normalizedDesc' را هم لازم دارید، آن را اختیاری یا حذف کنید
  // normalizedDesc?: string // یا اگر لازم است
  totalAmount: number
  branchId?: number
  workspaceId: string
  bankDLCode?: string | null
  items: {
    partyName: string
    amount: number
    desc?: string
    tracking?: string
  }[]
}
// اضافه کردن کلاینت سوپابیس در بالای فایل




function calculateCosineSimilarity(vecA: number[], vecB: number[]) {
  let dotProduct = 0, mA = 0, mB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    mA += vecA[i] * vecA[i];
    mB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(mA) * Math.sqrt(mB));
}



export async function findAccountCode(partyName: string): Promise<{
  dlCode?: string
  dlType?: number
  slId?: number
  foundName: string
}> {
  let cleanName = partyName.replace(/Unknown/gi, "").trim()
  if (!cleanName || cleanName.length < 2) return { foundName: "نامشخص" }

  // 1. لیست کامل کلمات عمومی که باید حذف شوند تا به "نام اصلی" برسیم
  const extendedStopWords = [
    "شرکت",
    "مهندسی",
    "تولیدی",
    "بازرگانی",
    "صنعتی",
    "گروه",
    "آقای",
    "خانم",
    "فروشگاه",
    "موسسه",
    "تعاونی",
    "خدمات",
    "تجاری",
    "نامشخص",
    "عمومی",
    "خصوصی",
    "شیمیایی",
    "شیمی",
    "صنایع",
    "پخش",
    "نوید",
    "گستر",
    "سازه",
    "صنعت",
    "توسعه",
    "مجتمع",
    "کارخانه"
  ]

  let processedName = cleanName
  // حذف کلمات زائد
  extendedStopWords.forEach(word => {
    processedName = processedName.replace(new RegExp(word, "g"), "").trim()
  })

  // اگر بعد از حذف، چیزی نماند (مثلا اسمش فقط "شرکت شیمیایی" بوده)، از همان اسم اولیه استفاده کن
  if (processedName.length < 2) processedName = cleanName

  // ---------------------------------------------------------
  // 1. جستجوی وکتور (بدون تغییر)
  // ---------------------------------------------------------
  try {
    // دریافت Embedding از آروان
    const embRes = await embeddingClient.embeddings.create({
      model: AI_MODELS.Embeddings,
      input: cleanName.replace(/\s+/g, " ")
    });

    const queryEmbedding = embRes.data[0].embedding;

    // دریافت داده‌ها از دیتابیس آروان (جایگزین RPC)
    const { rows: allEntities } = await pool.query(
      "SELECT dl_code, dl_type, title, embedding FROM rahkaran_entities"
    );

    // انجام محاسبات شباهت در لایه کد (به دلیل عدم وجود pgvector)
    const matches = allEntities
      .map(entity => {
        const entityEmbedding = typeof entity.embedding === 'string'
          ? JSON.parse(entity.embedding)
          : entity.embedding;

        return {
          ...entity,
          similarity: calculateCosineSimilarity(queryEmbedding, entityEmbedding)
        };
      })
      .filter(item => item.similarity >= 0.45)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3);

    // فرآیند تایید (Verification)
    if (matches && matches.length > 0) {
      for (const best of matches) {

        // الف) تایید با الگوریتم متنی ساده
        if (verifyNameMatch(cleanName, best.title)) {
          console.log(`✅ Algo Verified: "${cleanName}" => "${best.title}"`);
          return {
            dlCode: best.dl_code,
            dlType: best.dl_type,
            foundName: best.title
          };
        }

        // ب) اگر شباهت خیلی کم بود، بررسی AI را انجام نده
        if (best.similarity < 0.55) continue;
        const isVerified = await verifyWithAI(cleanName, best.title)
        if (isVerified) {
          console.log(
            `✅ AI Verified Vector: "${cleanName}" => "${best.title}"`
          )
          return {
            dlCode: best.dl_code,
            dlType: best.dl_type,
            foundName: best.title
          }
        }
      }
    }
  } catch (e) {
    console.error("Vector search failed:", e)
  }

  // ---------------------------------------------------------
  // 2. جستجوی SQL (اصلاح شده و دقیق)
  // ---------------------------------------------------------
  console.log(
    `⚠️ Using SQL Fallback for: ${cleanName} (Core: ${processedName})`
  )

  // جدا کردن کلمات مهم (حداقل 2 حرف)
  const words = processedName.split(/\s+/).filter(w => w.length > 1)
  const w1 = words[0] || ""
  const w2 = words[1] || ""

  // نکته: اگر w1 خالی بود، از خود cleanName استفاده کن
  const searchW1 = w1 || cleanName.split(" ")[0]

  const sqlSearch = `
    SET NOCOUNT ON;
    DECLARE @RawName nvarchar(500) = N'${escapeSql(cleanName)}';
    DECLARE @W1 nvarchar(100) = N'${escapeSql(searchW1)}';
    DECLARE @W2 nvarchar(100) = N'${escapeSql(w2)}';
    
    -- نرمال سازی حروف فارسی (ی و ک)
    SET @RawName = REPLACE(REPLACE(@RawName, N'ي', N'ی'), N'ك', N'ک');
    SET @W1 = REPLACE(REPLACE(@W1, N'ي', N'ی'), N'ك', N'ک');
    SET @W2 = REPLACE(REPLACE(@W2, N'ي', N'ی'), N'ك', N'ک');
    
    DECLARE @LikeName nvarchar(500) = REPLACE(@RawName, N' ', N'%');

    SELECT TOP 3 Code, DLTypeRef, Title, Score
    FROM (
        SELECT TOP 10 Code, DLTypeRef, Title,
            (
                (CASE WHEN CleanTitle = @RawName THEN 1000 ELSE 0 END) + -- تطابق دقیق کامل
                (CASE WHEN CleanTitle LIKE N'%'+ @LikeName +'%' THEN 500 ELSE 0 END) + -- تطابق با فاصله
                -- اگر دو کلمه داریم، هر دو باید باشند (امتیاز بسیار بالا برای چسب + پارس)
                (CASE WHEN @W1 <> '' AND @W2 <> '' AND CleanTitle LIKE N'%'+ @W1 +'%' AND CleanTitle LIKE N'%'+ @W2 +'%' THEN 800 ELSE 0 END) +
                -- امتیاز تکی
                (CASE WHEN @W1 <> '' AND CleanTitle LIKE N'%'+ @W1 +'%' THEN 50 ELSE 0 END)
            ) as Score
        FROM (
            SELECT Code, DLTypeRef, Title, 
                REPLACE(REPLACE(Title, N'ي', N'ی'), N'ك', N'ک') as CleanTitle
            FROM [FIN3].[DL]
            WHERE 
            (
                -- شرط جستجو: اگر دو کلمه مهم داریم، سعی کن هر دو را پیدا کنی، وگرنه اولی را پیدا کن
                (@W2 <> '' AND REPLACE(Title, N'ي', N'ی') LIKE N'%'+ @W1 +'%' AND REPLACE(Title, N'ي', N'ی') LIKE N'%'+ @W2 +'%')
                OR
                (@W2 = '' AND REPLACE(Title, N'ي', N'ی') LIKE N'%'+ @W1 +'%')
                OR
                -- فال‌بک نهایی: جستجوی کلی
                (REPLACE(Title, N'ي', N'ی') LIKE N'%'+ @LikeName +'%')
            )
        ) as T 
    ) as BestMatch
    WHERE Score >= 50
    ORDER BY Score DESC, LEN(Title) ASC; -- کوتاه‌ترین عنوان معمولاً دقیق‌ترین است
  `

  const res = await executeSql(sqlSearch)

  if (res && res.length > 0) {
    for (const row of res) {
      if (verifyNameMatch(cleanName, row.Title)) {
        console.log(`✅ Algo Verified SQL: "${cleanName}" => "${row.Title}"`)
        return { dlCode: row.Code, dlType: row.DLTypeRef, foundName: row.Title }
      }

      const isVerified = await verifyWithAI(cleanName, row.Title)
      if (isVerified) {
        console.log(`✅ AI Verified SQL: "${cleanName}" => "${row.Title}"`)
        return { dlCode: row.Code, dlType: row.DLTypeRef, foundName: row.Title }
      }
    }
  }

  // جستجوی معین (تلاش نهایی)
  const slSql = `
     SELECT TOP 1 SLID, Title FROM [FIN3].[SL] 
     WHERE Title LIKE N'%${escapeSql(searchW1)}%' 
     AND CAST(SLID AS VARCHAR(50)) NOT IN (N'111003', N'111005') 
     AND Code NOT LIKE '111%'
  `
  const slRes = await executeSql(slSql)
  const slRow = slRes[0] || {}

  return {
    slId: slRow.SLID,
    foundName: slRow.Title || "نامشخص"
  }
}

async function humanizenormalizedDesc(
  rawDesc: string, // این همان متن استخراج شده از OCR است
  partyName: string,
  type: "deposit" | "withdrawal"
): Promise<string> {
  try {
    if (!rawDesc) return `بابت ${partyName}`

    // پرامپت بهینه‌شده برای اصلاح متن OCR
    const prompt = `
    شما یک حسابدار خبره ایرانی هستید. متن زیر که توسط سیستم OCR از رسید بانکی استخراج شده را به یک "شرح آرتیکل حسابداری" تمیز، رسمی و انسان‌گونه تبدیل کنید.
    
    متن خام (OCR): "${rawDesc}"
    طرف حساب: "${partyName}"
    نوع تراکنش: ${type === "deposit" ? "واریز" : "برداشت"}
    
    قوانین سخت‌گیرانه:
    ۱. کلمات نامربوط، کاراکترهای عجیب ناشی از خطای OCR، و کلماتی مثل "ربات" یا "سیستمی" را کاملا حذف کن.
    ۲. از عبارات حسابداری استاندارد مثل "بابت"، "طی فیش"، یا "حواله" استفاده کن.
    ۳. اعداد مهم مثل کد پیگیری، شماره فیش یا شماره چک را حتماً و دقیقاً در متن نگه دار.
    ۴. خروجی فقط و فقط یک جمله کوتاه فارسی باشد و هیچ توضیح اضافه‌ای نده.
    `
    const response = await gpt5Client.chat.completions.create({
      model: AI_MODELS.GPT5_MINI,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3, // دمای پایین‌تر برای جلوگیری از خیال‌پردازی هوش مصنوعی و وفاداری به متن OCR
      max_tokens: 100
    })
    const content = response.choices[0].message.content as string
    return content?.trim() || rawDesc
  } catch (e) {
    return `بابت ${partyName} - ${rawDesc}`
  }
}




// ---------------------------------------------------------
// 2. تولید شرح هدر سند (جدید: برای حل مشکل هدر) 🧠
// ---------------------------------------------------------
async function generateHumanHeader(
  date: string,
  transactionsCount?: number,
  hostBank?: string
): Promise<string> {
  try {
    const prompt = `
Generate a short, professional accounting voucher header in Persian (Farsi) for daily bank transactions.
Date: ${date}
Transactions Count: ${transactionsCount || 0}
Bank: ${hostBank || "نامشخص"}
Rules:
- Do NOT use words like "مکانیزه", "ربات", "سیستمی", "هوش مصنوعی".
- Use varied styles like: "ثبت گردش عملیات بانکی مورخ ...", "سند روزانه بانک ...", "گردش وجوه نقد ...".
- Output ONLY the Farsi string.
`
    const response = await gpt5Client.chat.completions.create({
      model: AI_MODELS.GPT5_MINI,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 60
    })

    const content = response.choices[0]?.message?.content?.trim()
    const finalHeader = content && content.length > 5 ? content : `گردش عملیات بانکی مورخ ${date}`
    console.log("✅ Generated Header:", finalHeader)
    return finalHeader
  } catch (e) {
    const fallback = `گردش عملیات بانکی مورخ ${date}`
    console.log("⚠️ Header Generation Failed, fallback:", fallback)
    return fallback
  }
}


// این تابع را به فایل rahkaran.ts اضافه کنید
// در فایل rahkaran.ts

async function findStrictAccountBySQL(partyName: string): Promise<{
  dlCode: string
  dlType: number
  foundName: string
} | null> {
  // 1. اگر نام "نامشخص" بود، اصلا نگرد (چون فایده‌ای ندارد)
  if (partyName.includes("نامشخص") || partyName.includes("Unknown")) {
    return null
  }

  // تمیزکاری اولیه: حذف کلمات اضافه
  let clean = partyName
    .replace(/توسط|به نام|در وجه|بابت|آقای|خانم|شرکت|فروشگاه/g, " ")
    .trim()

  // کلمات را جدا کن و فقط کلمات بیشتر از 2 حرف را نگه دار
  const words = clean.split(/\s+/).filter(w => w.length > 2)

  if (words.length === 0) return null

  // ساخت کوئری داینامیک
  const likeConditions = words
    .map(w => `Title LIKE N'%${escapeSql(w)}%'`)
    .join(" AND ")

  // 🛠 اصلاح شده: حذف شرط Status = 1
  const sql = `
    SELECT TOP 1 Code, Title, DLTypeRef 
    FROM [FIN3].[DL] 
    WHERE (${likeConditions})
  `

  try {
    const res = await executeSql(sql)
    if (res && res.length > 0) {
      console.log(
        `✅ Strict SQL Match Found: "${partyName}" => "${res[0].Title}"`
      )
      return {
        dlCode: res[0].Code,
        dlType: res[0].DLTypeRef,
        foundName: res[0].Title
      }
    }
  } catch (e) {
    console.error("Strict SQL Search Error:", e)
  }
  return null
}
// تابع جدید برای پیدا کردن کد تفصیلی از روی شماره حساب موجود در متن
async function findBankDLByAccountNum(
  normalizedDesc: string
): Promise<any | null> {
  // این ریجکس اعدادی مثل 1-6116111-850-1021 یا 1021.2.611... را پیدا می‌کند
  const accountRegex = /(\d{1,4}[-.\/]\d+[-.\/]\d+[-.\/]?\d*)/g
  const matches = normalizedDesc.match(accountRegex)

  if (!matches || matches.length === 0) return null

  for (const rawNum of matches) {
    // حذف جداکننده‌ها برای جستجوی تمیز در دیتابیس
    const cleanNum = rawNum.replace(/[-.\/]/g, "")

    // جستجو در دیتابیس: آیا تفصیلی‌ای داریم که عنوانش شامل این عدد باشد؟
    // معمولا در عنوان تفصیلی بانک‌ها شماره حساب ذکر می‌شود
    const sql = `
      SELECT TOP 1 Code, Title, DLTypeRef 
      FROM [FIN3].[DL] 
      WHERE REPLACE(REPLACE(REPLACE(Title, '-', ''), '.', ''), '/', '') LIKE N'%${escapeSql(cleanNum)}%'
      AND (Title LIKE N'%بانک%' OR Title LIKE N'%سپرده%' OR Title LIKE N'%جاری%')
    `

    try {
      const res = await executeSql(sql)
      if (res && res.length > 0) {
        console.log(
          `✅ Found Bank DL from normalizedDesc: ${rawNum} => ${res[0].Code}`
        )
        return {
          Code: res[0].Code,
          Title: res[0].Title,
          DLTypeRef: res[0].DLTypeRef,
          source: "normalizedDesc Account Match"
        }
      }
    } catch (e) {
      console.error("Error finding bank DL:", e)
    }
  }
  return null
}



// --- 1. تابع پیش‌بینی هوشمند معین (Semantic AI) ---
async function predictSLWithAI(
  description: string,
  partyName: string,
  amount: number,
  isDeposit: boolean
): Promise<string | null> {
  try {
    // ۱. دریافت حساب‌های سطح معین (SL) از دیتابیس آروان
    const { rows: candidates } = await pool.query(
      "SELECT code, title FROM public.rahkaran_accounts WHERE account_type = 'SL' ORDER BY code ASC"
    );

    if (!candidates || candidates.length === 0) return null;

    // ۲. آماده‌سازی لیست حساب‌ها برای هوش مصنوعی
    const accountsList = candidates
      .map(c => `${c.code}: ${c.title}`)
      .join("\n");

    const prompt = `
    You are a Senior Financial Accountant using the Iranian Rahkaran system.
    Goal: Select the correct Subsidiary Ledger (SL) code for this transaction.

    Transaction Details:
    - Description: "${description}"
    - Counterparty: "${partyName}"
    - Amount: ${amount}
    - Type: ${isDeposit ? "DEPOSIT (Credit/بستانکار)" : "WITHDRAWAL (Debit/بدهکار)"}

    Available SL Codes:
    ${accountsList}

    Instructions:
    1. Identify nature: Expense, Income, Asset, or Liability.
    2. Context Examples: 
       - "حقوق/دستمزد" -> Personnel Expenses
       - "خرید ملزومات" -> Office Supplies
       - "کارمزد" -> Bank Fees (621105)
    3. Output JSON ONLY: { "selected_code": "code" | null }
    `;

    // ۳. فراخوانی کلاینت آروان (استفاده از مدل سریع و دقیق GPT-5-Mini)
    const aiRes = await gpt5Client.chat.completions.create({
      model: AI_MODELS.GPT5_MINI,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0
    });

    const content = aiRes.choices[0].message.content;
    const result = JSON.parse(content || "{}");

    if (result.selected_code) {
      console.log(
        `🧠 Arvan AI SL Match: "${description.substring(0, 30)}..." => ${result.selected_code}`
      );
      return result.selected_code;
    }
    return null;

  } catch (e: any) {
    console.error("❌ Arvan AI Semantic SL Prediction Error:", e.message);
    return null;
  }
}

function normalizePersianNumbers(str: string): string {
  return str
    .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d).toString())
    .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
}

async function smartAccountFinder(
  partyName: string,
  description: string,
  amount: number,
  mode: "deposit" | "withdrawal",
  hostDLCode?: string | null
): Promise<{
  dlCode?: string
  dlType?: number
  slId?: number
  foundName: string
  isFee?: boolean
  reason?: string
}> {
  const cleanName = partyName.replace(/Unknown|نامشخص/gi, "").trim()
  const normalizedDesc = normalizePersianNumbers(description)
  const isSmallAmount = amount < 3000000

  for (const special of SPECIAL_OVERRIDES) {
    if (special.keywords.some(k => normalizedDesc.includes(k))) {
      return {
        foundName: special.title,
        dlCode: special.dlCode || undefined,
        isFee: false,
        reason: `SPECIAL_SL:${special.slCode}`
      }
    }
  }

  const isStrictFee = STRICT_FEE_KEYWORDS.some(k => normalizedDesc.includes(k))
  if (isStrictFee && !normalizedDesc.includes("جبران رسوب")) {
    return {
      foundName: "هزینه بانکی",
      isFee: true,
      reason: "Strict Fee Keyword"
    }
  }

  const isPettyCashHolder = PETTY_CASH_HOLDERS.some(
    h => cleanName.includes(h) || normalizedDesc.includes(h)
  )
  if (isPettyCashHolder) {
    let targetName =
      PETTY_CASH_HOLDERS.find(
        h => cleanName.includes(h) || normalizedDesc.includes(h)
      ) || cleanName
    const personAcc = await findAccountCode(targetName)
    if (personAcc.dlCode) {
      return {
        dlCode: personAcc.dlCode,
        dlType: personAcc.dlType,
        foundName: personAcc.foundName,
        isFee: false,
        reason: "SPECIAL_SL:111003"
      }
    }
  }

  const matchedBank = TRANSFER_TRIGGERS.find(bank =>
    bank.keywords.some(keyword => {
      const cleanKeyword = keyword.replace(/\D/g, "");
      const cleanDesc = normalizedDesc.replace(/\D/g, "");
      // حتماً چک کنید طول شماره حساب پیدا شده منطقی باشد (مثلاً بیش از ۵ رقم)
      return cleanKeyword.length > 5 && cleanDesc.includes(cleanKeyword);
    })
  );
  if (matchedBank) {
    // تکرار برای اطمینان (اگرچه بالا چک شد، اما در کد اصلی شما دو بار بود)
    const aiBank = await extractCounterpartyBankWithAI(
      normalizedDesc,
      hostDLCode
    )
    if (aiBank)
      return {
        dlCode: aiBank.dlCode,
        foundName: aiBank.title,
        isFee: false,
        reason: "AI Extracted Bank"
      }
    const recoveredBank = recoverBankFromDescription(normalizedDesc, hostDLCode)
    if (recoveredBank)
      return {
        dlCode: recoveredBank.code,
        foundName: recoveredBank.title,
        isFee: false,
        reason: "Regex Detected Bank"
      }
  }

  const hasFeeKeywordLegacy = FEE_KEYWORDS.some(k => normalizedDesc.includes(k))
  if (hasFeeKeywordLegacy && isSmallAmount) {
    return {
      foundName: "هزینه بانکی",
      isFee: true,
      reason: "Legacy Fee Keyword"
    }
  }

  if (matchedBank) {
    // تکرار برای اطمینان (اگرچه بالا چک شد، اما در کد اصلی شما دو بار بود)
    const aiBank = await extractCounterpartyBankWithAI(
      normalizedDesc,
      hostDLCode
    )
    if (aiBank)
      return {
        dlCode: aiBank.dlCode,
        foundName: aiBank.title,
        isFee: false,
        reason: "AI Extracted Bank"
      }
    const recoveredBank = recoverBankFromDescription(normalizedDesc, hostDLCode)
    if (recoveredBank)
      return {
        dlCode: recoveredBank.code,
        foundName: recoveredBank.title,
        isFee: false,
        reason: "Regex Detected Bank"
      }
  }

  // --- استخراج نام شرکت/شخص از متن (بخش جدید و مهم) ---
  const personMatch = normalizedDesc.match(/توسط\s+([\u0600-\u06FF\s]+)/)
  let candidates: any[] = []
  if (personMatch && personMatch[1]) {
    const extractedName = personMatch[1].trim().split(" ").slice(0, 3).join(" ")
    if (extractedName.length > 3) {
      const acc = await findAccountCode(extractedName)
      if (acc.dlCode)
        candidates.push({
          Code: acc.dlCode,
          Title: acc.foundName,
          DLTypeRef: acc.dlType,
          source: "Extracted Person Name"
        })
    }
  }

  if (cleanName.length > 2) {
    const acc = await findAccountCode(cleanName)
    if (acc.dlCode)
      candidates.push({
        Code: acc.dlCode,
        Title: acc.foundName,
        DLTypeRef: acc.dlType,
        source: "Name Match"
      })
  }

  // AI Decision Logic (عیناً از کد شما)
  const uniqueCandidates = Array.from(
    new Map(candidates.map(item => [item.Code || item.dl_code, item])).values()
  )
  const prompt = `
  You are an expert Chief Accountant. Map this transaction to the correct DL Code.
  Transaction:
  - Type: ${mode}
  - Amount: ${amount} IRR
  - Input Name: "${partyName}"
  - Description: "${normalizedDesc}"
  Candidates: ${JSON.stringify(
    uniqueCandidates.map(c => ({
      code: c.Code || c.dl_code,
      name: c.Title || c.title,
      source: c.source
    })),
    null,
    2
  )}
  Rules:
  1. Self Transfer ("آذر یورد", "خودم", "جبران رسوب") -> If no bank candidate found, return UNKNOWN.
  2. Name Match -> Select Candidate.
  Output JSON: { "decision": "SELECTED_CODE" | "IS_FEE" | "UNKNOWN", "code": "...", "name": "...", "reason": "..." }
  `
  try {
    const aiResponse = await gpt5Client.chat.completions.create({
      model: AI_MODELS.GPT5_MINI,
      messages: [
        { role: "system", content: "Output JSON only." },
        { role: "user", content: prompt }
      ],
      temperature: 0.0,
      response_format: { type: "json_object" } // camelCase اصلاح شد
    })
    const content = aiResponse.choices[0].message.content as string
    const result = JSON.parse(content || "{}")
    if (result.decision === "IS_FEE")
      return { foundName: "هزینه بانکی", isFee: true, reason: result.reason }
    if (result.decision === "SELECTED_CODE" && result.code) {
      const selectedCandidate = uniqueCandidates.find(
        c => (c.Code || c.dl_code) == result.code
      )
      return {
        dlCode: result.code,
        dlType: selectedCandidate?.DLTypeRef,
        foundName: result.name,
        isFee: false,
        reason: result.reason
      }
    }
  } catch (e) { }

  return { foundName: "نامشخص", isFee: false, reason: "عدم تشخیص قطعی" }
}

// ---------------------------------------------------------
// 🚀 بخش جدید: توابع بهینه‌سازی شده (Batch Processing)
// ---------------------------------------------------------



// ۲. تابع جدید برای درخواست گروهی (Batch AI)
async function batchDecisionAI(
  items: any[],
  mode: string
): Promise<Record<string, { dlCode?: string; dlType?: number; foundName?: string; isFee?: boolean; reason?: string }>> {
  if (items.length === 0) return {};

  console.log(`🤖 Batch AI Processing for ${items.length} items...`);

  // خلاصه‌سازی آیتم‌ها برای کاهش توکن
  const promptList = items.map((item, index) => {
    return `ID: ${item.id}
    Desc: "${item.description}"
    Party: "${item.partyName}"
    Amt: ${item.amount}
    Candidates: ${JSON.stringify(item.candidates.map((c: any) => `${c.code}:${c.name}`))}`;
  }).join("\n---\n");

  const prompt = `
  You are an expert Chief Accountant. Analyze these ${items.length} transactions and map them to the correct DL Code.
  
  Global Context:
  - Type: ${mode}
  
  Rules:
  1. **Self Transfer** (keywords: "آذر یورد", "خودم", "جبران") -> If a bank candidate exists, select it. If not, mark as UNKNOWN (do not force a person).
  2. **Name Match** -> If a Candidate matches the Party/Desc, select it.
  3. **Fees** -> If context implies bank fee, set "isFee": true.
  
  Output JSON format:
  {
    "decisions": {
       "ID_FROM_INPUT": { "decision": "SELECTED_CODE" | "IS_FEE" | "UNKNOWN", "code": "...", "reason": "..." }
    }
  }
  `;

  try {
    const aiResponse = await gpt5Client.chat.completions.create({
      model: AI_MODELS.GPT5_MINI, // مدل سریع و ارزان
      messages: [
        { role: "system", content: "Output valid JSON object only." },
        { role: "user", content: prompt + "\n\nData List:\n" + promptList }
      ],
      temperature: 0.0,
      response_format: { type: "json_object" }
    });

    const content = aiResponse.choices[0].message.content as string;
    const result = JSON.parse(content || "{}");
    const decisions = result.decisions || {};

    // تبدیل خروجی AI به فرمت استاندارد ما
    const mappedResults: Record<string, any> = {};

    items.forEach(item => {
      const dec = decisions[item.id];
      if (!dec) return;

      if (dec.decision === "IS_FEE") {
        mappedResults[item.id] = { foundName: "هزینه بانکی", isFee: true, reason: dec.reason };
      } else if (dec.decision === "SELECTED_CODE" && dec.code) {
        // پیدا کردن آبجکت کامل کاندیدا برای گرفتن dlType
        const selectedCand = item.candidates.find((c: any) => c.code == dec.code);
        mappedResults[item.id] = {
          dlCode: dec.code,
          dlType: selectedCand?.dlType, // بازیابی dlType از کاندیداها
          foundName: selectedCand?.name || "AI Selected",
          isFee: false,
          reason: dec.reason
        };
      } else {
        mappedResults[item.id] = { foundName: "نامشخص", isFee: false, reason: "AI Unknown" };
      }
    });

    return mappedResults;

  } catch (e) {
    console.error("Batch AI Failed:", e);
    return {};
  }
}
const OCR_CORRECTIONS: Record<string, string> = {
  مرحانی: "مرجانی",
  مرحان: "مرجانی",
  "امین امین": "امین امین نیا",
  "معروف صنعت": "شرکت معروف صنعت آذربایجان شرقی",
  // هر مورد دیگری که اشتباه تشخیص داده می‌شود را اینجا اضافه کنید
  "به حساب شرکت": "به شرکت"
}
// ---------------------------------------------------------
// 🚀 جایگزین تابع اصلی syncToRahkaranSystem
// ---------------------------------------------------------
function applyOCRCorrections(text: string): string {
  let fixedText = text
  for (const [wrong, correct] of Object.entries(OCR_CORRECTIONS)) {
    if (fixedText.includes(wrong)) {
      fixedText = fixedText.replace(new RegExp(wrong, "g"), correct)
    }
  }
  return fixedText
}
async function humanizeDescription(
  rawDesc: string,
  partyName: string,
  type: "deposit" | "withdrawal"
): Promise<string> {
  try {
    if (!rawDesc) return `بابت ${partyName}`
    const prompt = `
    You are a professional Iranian accountant. Rewrite the following transaction description into a formal Farsi accounting string.
    Input: "${rawDesc}"
    Party: "${partyName}"
    Type: ${type === "deposit" ? "واریز" : "برداشت"}
    Rules: Remove "robot", "automated". Use terms like "بابت", "طی فیش", "حواله". Keep tracking codes. Output ONLY Farsi.
    `
    const response = await gpt5Client.chat.completions.create({
      model: AI_MODELS.GPT5_MINI,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      max_tokens: 100
    })
    return response.choices[0]?.message?.content?.trim() || rawDesc
  } catch (e) {
    return `بابت ${partyName} - ${rawDesc}`
  }
}
export async function syncToRahkaranSystem(
  payload: SyncPayload
): Promise<RahkaranSyncResult> {
  try {
    console.log("\n---------------------------------------------------")
    console.log("🚀 STARTING PIPELINE (ACCURATE ACCOUNTANT - PARALLEL BATCH)")
    console.log("---------------------------------------------------")
    const successfulTrackingCodes: string[] = []

    const { mode, items, bankDLCode, branchId } = payload
    const isDeposit = mode === "deposit"
    const FIXED_BANK_DL = bankDLCode

    const FIXED_LEDGER_ID = 1
    const FIXED_BANK_SL = "111005"
    const DEPOSIT_SL_CODE = "211002"
    const WITHDRAWAL_SL_CODE = "111901"

    const debugDecisions = []
    const safeDate = convertShamsiToGregorian(payload.date);
    const jalaliDate =
      payload.description?.match(/\d{4}\/\d{2}\/\d{2}/)?.[0] || safeDate

    console.log("🚩 STEP 1: Payload Received, Starting Parallel Processing")

    // =========================================================
    // 🚀 فاز اول: پردازش موازی آیتم‌ها (AI, Smart Rules, DB)
    // =========================================================
    // برای جلوگیری از فشار به سرور، پردازش را در دسته‌های موازی انجام می‌دهیم
    const BATCH_SIZE = 10;
    const processedItems: any[] = [];

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const chunk = items.slice(i, i + BATCH_SIZE);

      const chunkResults = await Promise.all(
        chunk.map(async (item) => {
          console.log(`🚩 STEP 2: Processing Item: ${item.partyName}`)

          // ✅ 1. اصلاح نام طرف حساب (OCR Corrections)
          let partyName = item.partyName || "نامشخص"
          partyName = applyOCRCorrections(partyName)

          if (!item.amount || item.amount === 0) {
            console.warn(`⚠️ Skipped item with zero amount: ${item.desc}`)
            return null; // آیتم نادیده گرفته می‌شود
          }

          const rawDesc = item.desc || ""
          const humanDesc = await humanizeDescription(rawDesc, partyName, mode as any);
          const itemHeader = await generateHumanHeader(jalaliDate, items.length, "بانک"); // یا هر عنوان دیگر

          console.log("🚩 STEP 3: AI Description Done", humanDesc)
          const safeDesc = escapeSql(humanDesc)

          // متغیرهای تصمیم‌گیری
          let finalDLCode: string | undefined = undefined
          let finalFoundName = "نامشخص"
          let finalIsFee = false
          let finalReason = ""
          let finalSL = undefined
          let decisionMade = false

          const cleanName = partyName.replace(/Unknown|نامشخص/gi, "").trim()

          // ---------------------------------------------------------
          // 🚨 گام منفی ۱: بررسی کارمزد (اولویت مطلق)
          // ---------------------------------------------------------
          const isStrictFee = STRICT_FEE_KEYWORDS.some(k => rawDesc.includes(k))

          if (isStrictFee && !rawDesc.includes("جبران رسوب")) {
            console.log(`💸 Strict Fee Detected at Start: ${rawDesc.substring(0, 30)}...`)
            finalIsFee = true
            finalFoundName = "هزینه کارمزد بانکی"
            finalSL = "621105"
            finalDLCode = undefined
            finalReason = "Strict Fee Keyword (Pre-check)"
            decisionMade = true
          }

          // ---------------------------------------------------------
          // 💎 گام 0: بررسی تنخواه‌داران (اولویت مطلق)
          // ---------------------------------------------------------
          if (!decisionMade) {
            const isPettyCashHolder =
              PETTY_CASH_HOLDERS.some(h => cleanName.includes(h) || rawDesc.includes(h)) ||
              cleanName.includes("امین نیا") ||
              cleanName.includes("امین امین")

            if (isPettyCashHolder) {
              console.log(`👤 Petty Cash Holder Detected: ${cleanName}`)
              let targetName =
                PETTY_CASH_HOLDERS.find(h => cleanName.includes(h) || rawDesc.includes(h)) || cleanName

              if (targetName.includes("امین") || targetName.includes("نیا"))
                targetName = "امین امین نیا"

              const personAcc = await findAccountCode(targetName)
              if (personAcc.dlCode) {
                finalDLCode = personAcc.dlCode
                finalFoundName = personAcc.foundName
                finalSL = "111003"
                finalReason = "Priority: Petty Cash Holder"
                decisionMade = true
              }
            }
          }
          const internalBankMatch = recoverBankFromDescription(rawDesc, bankDLCode)
          if (internalBankMatch) {
            console.log(`🏦 Internal Bank Transfer Detected: ${internalBankMatch.title}`)
            finalDLCode = internalBankMatch.code
            finalFoundName = internalBankMatch.title
            finalSL = "111005"
            decisionMade = true
          }

          // 🌟 1. بررسی Smart Rule
          if (!decisionMade) {
            const smartMatch = await findSmartRule(rawDesc, partyName)
            if (smartMatch) {
              if (["111005", "111003"].includes(smartMatch.code)) {
                console.log(`⚠️ Generic Hint Found (${smartMatch.code}). Continuing search for Vendor...`)
                finalSL = smartMatch.code
                finalReason = `Hint: ${smartMatch.code}`
              } else {
                console.log(`🔒 Smart Rule Applied: ${smartMatch.title} (${smartMatch.code})`)
                finalFoundName = smartMatch.title
                finalReason = `SMART_RULE:${smartMatch.code}`
                decisionMade = true

                if (smartMatch.type === "SL" || ["211003", "211004", "211202", "621105"].includes(smartMatch.code)) {
                  finalSL = smartMatch.code
                  finalDLCode = undefined
                } else {
                  finalDLCode = smartMatch.code
                }
              }
            }
          }

          // 🔍 2. جستجوی عمیق (Smart Finder)
          if (!decisionMade) {
            const decision = await smartAccountFinder(partyName, rawDesc, item.amount, mode, bankDLCode)

            if (decision.dlCode || decision.isFee || decision.foundName !== "نامشخص") {
              finalDLCode = decision.dlCode
              finalFoundName = decision.foundName
              finalIsFee = decision.isFee || false
              finalReason = decision.reason || "Smart Finder"
              if (decision.reason?.startsWith("SPECIAL_SL:")) {
                finalSL = decision.reason.split(":")[1]
              }
            }
          }



          // ---------------------------------------------------------
          // ⚖️ ناظر هوشمند (Audit)
          // ---------------------------------------------------------
          const audit = await auditVoucherWithAI({
            inputName: partyName,
            inputDesc: rawDesc,
            amount: item.amount,
            selectedAccountName: finalFoundName,
            selectedAccountCode: finalDLCode || null,
            isFee: finalIsFee
          })
          console.log("nazer : ====>", audit)

          if (!audit.approved) {
            const isInternalTransfer = finalDLCode?.startsWith("200") || finalSL === "111005"
            const isPettyCash = finalSL === "111003"

            if (isInternalTransfer || isPettyCash) {
              console.log(`🛡️ Audit rejected but Override active for Internal/PettyCash. Keeping: ${finalFoundName}`)
            } else {
              console.warn(`🚨 ناظر تراکنش را رد کرد: ${audit.reason}`)
              finalDLCode = undefined
              finalFoundName = "نامشخص (رد شده توسط ناظر)"
            }
          }

          // =========================================================
          // 🔧 3. اصلاحات نهایی و قوانین اجباری (Business Logic Overrides)
          // =========================================================
          if (
            cleanName.includes("امین امین") || cleanName.includes("امین نیا") ||
            rawDesc.includes("امین نیا") || rawDesc.includes("امین امین") ||
            finalDLCode === "000002"
          ) {
            console.log("🔒 Force-fixing Amin Nia to Tenkhah (111003)")
            finalDLCode = "000002"
            finalSL = "111003"
          }
          else if (mode === "withdrawal" && finalDLCode && finalDLCode.startsWith("200")) {
            console.log(`🔒 Internal Bank Transfer Detected (${finalDLCode}) -> Setting SL to 111005`)
            finalSL = "111005"
          }
          else if (
            mode === "withdrawal" && finalDLCode && finalDLCode !== "000002" &&
            !finalDLCode.startsWith("200") && !finalIsFee && finalSL !== "111005"
          ) {
            console.log(`🔒 Converting Payable (${finalDLCode}) to Prepayment for: ${partyName}`)
            finalSL = "112001"
          }

          if (finalSL === "111005" && finalDLCode && !finalDLCode.startsWith("200") && !finalIsFee) {
            if (mode === "withdrawal") finalSL = "112001"
            else finalSL = DEPOSIT_SL_CODE
          }

          if (finalIsFee || finalDLCode === "621105") {
            finalSL = "621105"
            finalDLCode = undefined
            finalFoundName = "هزینه کارمزد بانکی"
          }

          if (
            !finalDLCode && !finalIsFee && (finalFoundName === "نامشخص" || finalFoundName.includes("موجودی بانک")) &&
            (rawDesc.includes("جبران") || rawDesc.includes("انتقال") || rawDesc.includes("واریز از"))
          ) {
            const recovered = recoverBankFromDescription(rawDesc, bankDLCode)
            if (recovered) {
              console.log(`✅ FIXED: Bank Transfer Detected -> ${recovered.title}`)
              finalDLCode = recovered.code
              finalFoundName = recovered.title
              finalSL = "111005"
            }
          }

          if (!finalSL) {
            finalSL = isDeposit ? DEPOSIT_SL_CODE : WITHDRAWAL_SL_CODE
            finalReason += " | SYSTEM_FALLBACK"
          }

          // بازگرداندن مقادیر پردازش شده برای این آیتم
          return {
            item,
            partyName,
            finalDLCode,
            finalFoundName,
            finalSL,
            safeDesc: escapeSql(humanDesc),
            itemHeader: escapeSql(itemHeader), // اضافه شد
            finalReason
          };
        })
      );

      // افزودن نتایج این دسته به لیست نهایی
      processedItems.push(...chunkResults);
    }

    // =========================================================
    // 🧱 فاز دوم: ساخت متوالی کوئری SQL
    // =========================================================
    let sqlItemsBuffer = ""
    let validItemsCount = 0
    let currentRowIndex = 1
    let finalHeaderDescription = "";


    for (const res of processedItems) {
      if (!res) continue;

      const {
        item, partyName, finalDLCode, finalFoundName,
        finalSL, finalReason, safeDesc, itemHeader
      } = res;

      // ۱. تنظیم شرح هدر سند (فقط یکبار از اولین آیتم معتبر گرفته می‌شود)
      if (!finalHeaderDescription && itemHeader) {
        finalHeaderDescription = itemHeader;
      }

      debugDecisions.push({
        Name: partyName,
        Decision: finalDLCode || finalSL,
        Mapped: finalFoundName,
        Reason: finalReason
      });

      successfulTrackingCodes.push(item.tracking || "");

      const dlValue = finalDLCode ? `N'${finalDLCode}'` : "NULL";

      // ۲. اضافه کردن به بافر SQL (بدون هیچ await تکراری)
      sqlItemsBuffer += `
    -- Item: ${escapeSql(partyName)} -> ${finalFoundName}
    SET @Amount = ${item.amount};
    SET @Desc = N'${safeDesc}'; -- شرح هر ردیف (آرتیکل)
    
    SET @Str_PartySLCode = N'${finalSL}'; 
    SET @Str_PartyDLCode = ${dlValue}; 
    SET @Str_BankSLCode = N'${FIXED_BANK_SL}'; 
    SET @Str_BankDLCode = N'${FIXED_BANK_DL}';

        -- A. تنظیمات طرف حساب
        SET @Ref_SL = NULL; 
        SELECT TOP 1 @Ref_SL = SLID, @Ref_GL = GLRef FROM [FIN3].[SL] WHERE Code = @Str_PartySLCode;
        
        IF @Ref_SL IS NULL 
           SELECT TOP 1 @Ref_SL = SLID, @Ref_GL = GLRef FROM [FIN3].[SL] 
           WHERE Code = CASE WHEN ${isDeposit ? 1 : 0} = 1 THEN '${DEPOSIT_SL_CODE}' ELSE '${WITHDRAWAL_SL_CODE}' END;
           
        SELECT TOP 1 @Ref_AccountGroup = AccountGroupRef FROM [FIN3].[GL] WHERE GLID = @Ref_GL;

        SET @Ref_DL = NULL; SET @Ref_DLType = NULL; 
        SET @Var_DLLevel = 4; 
        SET @RealLevel = NULL;
        
        IF @Str_PartyDLCode IS NOT NULL
        BEGIN
             SELECT TOP 1 @Ref_DL = DLID, @Ref_DLType = DLTypeRef FROM [FIN3].[DL] WHERE Code = @Str_PartyDLCode;
             IF @Ref_DL IS NULL SET @Str_PartyDLCode = NULL; 
             ELSE
             BEGIN
                 SELECT TOP 1 @RealLevel = [Level] FROM [FIN3].[DLTypeRelation] WHERE SLRef = @Ref_SL AND DLTypeRef = @Ref_DLType;
                 IF @RealLevel IS NOT NULL SET @Var_DLLevel = @RealLevel;
             END
        END

        -- B. تنظیمات بانک
        SET @Ref_BankSL = NULL; 
        SELECT TOP 1 @Ref_BankSL = SLID, @Ref_BankGL = GLRef FROM [FIN3].[SL] WHERE Code = @Str_BankSLCode;
        SELECT TOP 1 @Ref_BankAccountGroup = AccountGroupRef FROM [FIN3].[GL] WHERE GLID = @Ref_BankGL;
        
        SET @Ref_BankDL = NULL; SET @Ref_BankDLType = NULL;
        SELECT TOP 1 @Ref_BankDL = DLID, @Ref_BankDLType = DLTypeRef FROM [FIN3].[DL] WHERE Code = @Str_BankDLCode;

        -- C. ثبت ردیف طرف حساب
        EXEC [Sys3].[spGetNextId] 'FIN3.VoucherItem', @Id = @VoucherItemID OUTPUT;
        INSERT INTO [FIN3].[VoucherItem] (
             VoucherItemID, VoucherRef, BranchRef, SLRef, SLCode, GLRef, AccountGroupRef, Debit, Credit, Description, RowNumber, IsCurrencyBased,
             DLLevel4, DLTypeRef4, DLLevel5, DLTypeRef5, DLLevel6, DLTypeRef6
        ) VALUES (
             @VoucherItemID, @VoucherID, @BranchRef, @Ref_SL, CAST(@Str_PartySLCode AS NVARCHAR(50)), @Ref_GL, @Ref_AccountGroup, ${isDeposit ? "0" : "@Amount"}, ${isDeposit ? "@Amount" : "0"}, @Desc, ${currentRowIndex}, 0,
             CASE WHEN @Var_DLLevel = 4 AND @Str_PartyDLCode IS NOT NULL THEN CAST(@Str_PartyDLCode AS NVARCHAR(50)) ELSE NULL END, CASE WHEN @Var_DLLevel = 4 AND @Str_PartyDLCode IS NOT NULL THEN @Ref_DLType ELSE NULL END,
             CASE WHEN @Var_DLLevel = 5 AND @Str_PartyDLCode IS NOT NULL THEN CAST(@Str_PartyDLCode AS NVARCHAR(50)) ELSE NULL END, CASE WHEN @Var_DLLevel = 5 AND @Str_PartyDLCode IS NOT NULL THEN @Ref_DLType ELSE NULL END,
             CASE WHEN @Var_DLLevel = 6 AND @Str_PartyDLCode IS NOT NULL THEN CAST(@Str_PartyDLCode AS NVARCHAR(50)) ELSE NULL END, CASE WHEN @Var_DLLevel = 6 AND @Str_PartyDLCode IS NOT NULL THEN @Ref_DLType ELSE NULL END
        );

        -- D. ثبت ردیف بانک
        EXEC [Sys3].[spGetNextId] 'FIN3.VoucherItem', @Id = @VoucherItemID OUTPUT;
        INSERT INTO [FIN3].[VoucherItem] (
             VoucherItemID, VoucherRef, BranchRef, SLRef, SLCode, GLRef, AccountGroupRef, Debit, Credit, Description, RowNumber, IsCurrencyBased,
             DLLevel4, DLTypeRef4, DLLevel5, DLTypeRef5, DLLevel6, DLTypeRef6
        ) VALUES (
             @VoucherItemID, @VoucherID, @BranchRef, @Ref_BankSL, CAST(@Str_BankSLCode AS NVARCHAR(50)), @Ref_BankGL, @Ref_BankAccountGroup, ${isDeposit ? "@Amount" : "0"}, ${isDeposit ? "0" : "@Amount"}, @Desc, ${currentRowIndex + 1}, 0,
             CAST(@Str_BankDLCode AS NVARCHAR(50)), @Ref_BankDLType, NULL, NULL, NULL, NULL
        );
      `
      currentRowIndex += 2
      validItemsCount++
    }

    // =========================================================
    // 🌐 فاز سوم: اجرای کوئری در دیتابیس
    // =========================================================
    if (validItemsCount > 0) {
      const safeHeaderDesc = escapeSql(finalHeaderDescription || `سند مکانیزه بانک مورخ ${jalaliDate}`);
      console.log("📋 DECISION REPORT JSON:", JSON.stringify(debugDecisions, null, 2))


      console.log("شرح سند =====> ", safeHeaderDesc)

      const finalSql = `
      SET NOCOUNT ON;
      SET XACT_ABORT ON;
      DECLARE @RetryCount INT = 0;
      DECLARE @ErrorMessage NVARCHAR(4000);
      DECLARE @RealLevel INT;
      DECLARE @VoucherID BIGINT;
      DECLARE @FiscalYearRef BIGINT;
      DECLARE @VoucherNumber BIGINT; 
      DECLARE @RefNumStr NVARCHAR(50);
      DECLARE @DailyNumber INT;
      DECLARE @Sequence BIGINT;
      DECLARE @VoucherLockID BIGINT;

      DECLARE @BranchRef BIGINT = ${branchId ? branchId : "NULL"};
      DECLARE @LedgerRef BIGINT = ${FIXED_LEDGER_ID};
      DECLARE @VoucherTypeRef BIGINT = 30;
      DECLARE @UserRef INT = 1; 
      DECLARE @Date NVARCHAR(20) = N'${safeDate}';
      
      DECLARE @Amount DECIMAL(18,0);
      DECLARE @Desc NVARCHAR(MAX);
      DECLARE @Str_PartySLCode NVARCHAR(50); 
      DECLARE @Str_PartyDLCode NVARCHAR(50);
      DECLARE @Str_BankSLCode NVARCHAR(50); 
      DECLARE @Str_BankDLCode NVARCHAR(50); 
      DECLARE @Ref_SL BIGINT, @Ref_GL BIGINT, @Ref_AccountGroup BIGINT;
      DECLARE @Ref_BankSL BIGINT, @Ref_BankGL BIGINT, @Ref_BankAccountGroup BIGINT;
      DECLARE @Ref_DL BIGINT, @Ref_DLType BIGINT, @Var_DLLevel INT;
      DECLARE @Ref_BankDL BIGINT, @Ref_BankDLType BIGINT;
      DECLARE @VoucherItemID BIGINT;

      BEGIN TRY
            BEGIN TRANSACTION;

            SELECT TOP 1 @BranchRef = BranchID FROM [GNR3].[Branch];
            IF @BranchRef IS NULL THROW 51000, 'Error: No Branch found.', 1;

            SELECT TOP 1 @FiscalYearRef = FiscalYearRef FROM [GNR3].[LedgerFiscalYear] 
            WHERE LedgerRef = @LedgerRef AND StartDate <= @Date AND EndDate >= @Date;
            IF @FiscalYearRef IS NULL 
               SELECT TOP 1 @FiscalYearRef = FiscalYearRef FROM [GNR3].[LedgerFiscalYear] WHERE LedgerRef = @LedgerRef ORDER BY EndDate DESC;

            SELECT @VoucherNumber = ISNULL(MAX(Number), 0) + 1
            FROM [FIN3].[Voucher] WITH (UPDLOCK, HOLDLOCK) 
            WHERE FiscalYearRef = @FiscalYearRef 
              AND LedgerRef = @LedgerRef 
              AND VoucherTypeRef = @VoucherTypeRef;

            IF @VoucherNumber IS NULL SET @VoucherNumber = 1;
            SET @Sequence = @VoucherNumber;
            SET @RefNumStr = CAST(@VoucherNumber AS NVARCHAR(50));

            WHILE EXISTS (
                SELECT 1 FROM [FIN3].[Voucher] 
                WHERE FiscalYearRef = @FiscalYearRef AND LedgerRef = @LedgerRef
                  AND (ReferenceNumber = @RefNumStr OR Sequence = @Sequence)
            )
            BEGIN
                SET @VoucherNumber = @VoucherNumber + 1;
                SET @Sequence = @VoucherNumber;
                SET @RefNumStr = CAST(@VoucherNumber AS NVARCHAR(50));
            END

            SELECT @DailyNumber = ISNULL(MAX(DailyNumber), 0) + 500 
            FROM [FIN3].[Voucher] WITH (UPDLOCK, SERIALIZABLE) 
            WHERE LedgerRef = @LedgerRef 
              AND BranchRef = @BranchRef 
              AND FiscalYearRef = @FiscalYearRef  
              AND Date = @Date;
            
            WHILE EXISTS (
                SELECT 1 FROM [FIN3].[Voucher] WITH (UPDLOCK, SERIALIZABLE)
                WHERE LedgerRef = @LedgerRef 
                  AND BranchRef = @BranchRef
                  AND FiscalYearRef = @FiscalYearRef 
                  AND Date = @Date 
                  AND DailyNumber = @DailyNumber
            )
            BEGIN
                SET @DailyNumber = @DailyNumber + 1;
            END

            EXEC [Sys3].[spGetNextId] 'FIN3.Voucher', @Id = @VoucherID OUTPUT;

            INSERT INTO [FIN3].[Voucher] (
                 VoucherID, LedgerRef, FiscalYearRef, BranchRef, Number, Date, VoucherTypeRef,
                 Creator, CreationDate, LastModifier, LastModificationDate, IsExternal,
                 Description, State, IsTemporary, IsCurrencyBased, ShowCurrencyFields,
                 DailyNumber, Sequence
            ) VALUES (
                 @VoucherID, @LedgerRef, @FiscalYearRef, @BranchRef, 
                 @VoucherNumber, @Date, @VoucherTypeRef, 
                 @UserRef, GETDATE(), @UserRef, GETDATE(), 0,
                 N'${safeHeaderDesc}', 0, 0, 0, 0,
                 @DailyNumber, @Sequence
            );

            EXEC [Sys3].[spGetNextId] 'FIN3.VoucherLock', @Id = @VoucherLockID OUTPUT;
            INSERT INTO [FIN3].[VoucherLock] (VoucherLockID, VoucherRef, UserRef, LastModificationDate) 
            VALUES (@VoucherLockID, @VoucherID, @UserRef, GETDATE());

            ${sqlItemsBuffer}

            UPDATE [FIN3].[Voucher] SET State = 1 WHERE VoucherID = @VoucherID;

            COMMIT TRANSACTION;
            SELECT 'Success' AS Status, 
                   @VoucherNumber AS VoucherNum,
                   @DailyNumber AS DailyNum, 
                   @RefNumStr AS RefNum;

      END TRY
      BEGIN CATCH
            IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
            SET @ErrorMessage = ERROR_MESSAGE();
            THROW 51000, @ErrorMessage, 1;
      END CATCH
      `

      console.log(`📡 [SQL_PREPARE] Query Size: ${(finalSql.length / 1024).toFixed(2)} KB`)
      console.log(`🔗 [PROXY_ATTEMPT] Connecting to Rahkaran Proxy...`)

      const startTime = Date.now()

      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 45000)

        const response = await fetch(process.env.RAHKARAN_PROXY_URL!, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-proxy-key": process.env.RAHKARAN_PROXY_KEY!,
            Connection: "keep-alive"
          },
          body: JSON.stringify({ query: finalSql }),
          signal: controller.signal
        })

        clearTimeout(timeoutId)
        const duration = Date.now() - startTime

        const sqlRes = await response.json()
        console.log("🔍 FULL DATA FROM IRAN:", JSON.stringify(sqlRes))

        if (!response.ok) {
          console.error(`❌ [PROXY_ERROR] Status: ${response.status} | Time: ${duration}ms`)
          console.error(`📄 [ERROR_DETAIL]:`, JSON.stringify(sqlRes))
          throw new Error(`Proxy returned ${response.status}`)
        }

        console.log(`✅ [PROXY_SUCCESS] Response received in ${duration}ms`)

        let result = null
        if (Array.isArray(sqlRes)) {
          result = sqlRes[0]
        } else if (sqlRes && sqlRes.recordset && Array.isArray(sqlRes.recordset)) {
          result = sqlRes.recordset.length > 0 ? sqlRes.recordset[0] : sqlRes
        } else if (sqlRes && typeof sqlRes === "object") {
          result = sqlRes
        }

        const isSuccess = result && (result.Status === "Success" || result.success === true || sqlRes.success === true || sqlRes.Status === "Success")

        if (isSuccess) {
          const voucherId = result?.VoucherNum || result?.RefNum || sqlRes?.VoucherNum || "OK"
          console.log(`🚀 SUCCESS: Document ${voucherId} synchronized.`)
          return {
            success: true,
            docId: voucherId.toString(),
            message: "OK",
            processedTrackingCodes: successfulTrackingCodes
          }
        } else {
          console.error("📋 [SQL_EXECUTION_FAILED]:", JSON.stringify(result || sqlRes))
          const errorMsg = result?.ErrMsg || result?.error || sqlRes?.error || "ساختار پاسخ سرور ایران نامعتبر است یا دیتابیس پاسخی نداد"
          throw new Error(errorMsg)
        }
      } catch (err: any) {
        const duration = Date.now() - startTime
        if (err.name === "AbortError") {
          console.error(`🔥 [TIMEOUT] Rahkaran Proxy did not respond within 45s.`)
          return { success: false, error: "زمان پاسخگویی پروکسی به پایان رسید (Timeout)" }
        }
        console.error(`🔥 [CONNECTION_FAILED] After ${duration}ms:`, err.message)
        throw err
      }
    }

    console.log("ℹ️ No valid items to process.")
    return {
      success: true,
      message: "No items were valid for sync",
      processedTrackingCodes: []
    }
  } catch (error: any) {
    console.error("🔥 FATAL SYSTEM ERROR:", error)
    return { success: false, error: error.message }
  }
}