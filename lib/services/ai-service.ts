"use server"

import {
    detectBankInfoByNumber,
    findSmartRule,
    generateCleanDescription
} from "@/lib/services/bankIntelligence"
import { findAccountCode } from "@/lib/services/rahkaran"
import OpenAI from 'openai';
import { withRetry, toEnglishDigits, getSafeDate, sanitizeSql } from "@/lib/utils/finance-utils"

import { geminiClient, AI_MODELS, gpt5Client } from "@/lib/arvanapi";
import { pool } from "@/lib/db";

const PROXY_URL = process.env.RAHKARAN_PROXY_URL
const PROXY_KEY = process.env.RAHKARAN_PROXY_KEY

export interface SinglePageResult {
    success: boolean
    data?: any
    error?: string
}
// -
export interface SmartRuleResult {
    type: "SL" | "DL"
    code: string
    title: string
    source?: "HARDCODE" | "AI_DB"
}


export interface SinglePageResult {
    success: boolean
    data?: any
    error?: string
}
//
function cleanAIJson(rawContent: string): string {
    return rawContent
        .replace(/```json/gi, "") // حذف ```json
        .replace(/```/g, "")      // حذف ``` پایانی
        .trim();                  // حذف فضاهای خالی
}

export async function analyzeSinglePage(
    fileUrl: string,

    pageNumber: number,

    pageText: string = ""
): Promise<SinglePageResult> {
    // مدل AI_MODEL باید قبلاً در فایل شما تعریف شده باشد

    try {
        console.log(
            `📡 Analyzing Bank Statement directly with AI (Conditional Logic new code)...`
        )

        // 1. دانلود فایل

        const fileRes = await fetch(fileUrl, { cache: "no-store" })

        if (!fileRes.ok) throw new Error("دانلود فایل ناموفق بود")

        const fileBuffer = await fileRes.arrayBuffer()

        const base64Data = Buffer.from(fileBuffer).toString("base64")

        const mimeType = fileUrl.toLowerCase().endsWith(".pdf")
            ? "application/pdf"
            : "image/jpeg"

        // 2. ارسال به هوش مصنوعی با دستورالعمل شرطی و مقتدر

        const aiResponse = await withRetry(
            async () => {
                return await geminiClient.chat.completions.create({
                    model: AI_MODELS.GEMINI_PRO,

                    messages: [
                        {
                            role: "system",

                            content: `You are an expert Bank Statement Auditor and Data Extractor for Persian Documents.

           

            YOUR TASK: Extract ALL transactions from the table and header information.



            CRITICAL COLUMN AUTHORITY RULES:

           

            1. **COLUMN CHECK (CONDITIONAL LOGIC):**

               a. **IF** you see separate columns named "بدهکار" (Debit) AND "بستانکار" (Credit):

                  - Use them strictly. Put amount from "بدهکار" into 'withdrawal' and "بستانکار" into 'deposit'.

               b. **IF** you see only ONE amount column (e.g., "مبلغ تراکنش"):

                  - Amounts with a MINUS sign (-) must be put into 'withdrawal'.

                  - Amounts without a minus sign (positive) must be put into 'deposit'.

           

            2. **VETO RULE (مانده):** You MUST ignore the "مانده" (Balance) column. Do NOT extract its value as a transaction amount under any circumstance.

           

            3. **HANDWRITING & METADATA:** Look closely for handwritten notes (متن‌های دست‌نویس) and faint text (e.g., payer/payee names or transfer reasons). You MUST append any such found text to the 'description' field.

           

            4. **Data Quality:** Extract "شماره سند/پیگیری" as tracking_code. Remove all separators (commas, dots, etc.) from numbers. Ensure no transaction amount is 0 unless the row is truly empty.

          CRITICAL NEW RULE (HANDWRITING):
- Look specifically for HANDWRITTEN notes on the statement row (usually describing the nature of transaction).
- Extract this text into a separate field called "handwritten_text".
- Set "is_handwritten": true if such text exists.

            OUTPUT JSON FORMAT:"Return ONLY the raw JSON object. Do NOT wrap the response in markdown code blocks like json."

            {

              "header": { "account_number": "string (digits only)", "owner_name": "string" },

              "transactions": [

                {

                 "date": "YYYY/MM/DD (Extract exactly as printed on the doc. If it is Jalali e.g. 1403/09/29, keep it as 1403. Do NOT convert year to Gregorian)",

                  "time": "HH:MM",

                  "description": "string (full description + appended handwritten text)",
                  "handwritten_text": "string (extracted handwriting)", 
                  "is_handwritten": boolean,

                  "tracking_code": "string (from 'شماره سند/پیگیری', digits only)",

                  "withdrawal": number (amount from Bedekhar column, or negative amount from single column),

                  "deposit": number (amount from Bestankar column, or positive amount from single column)
                  

                }

              ]

            }`
                        },

                        {
                            role: "user",

                            content: [
                                {
                                    type: "text",
                                    text: "Extract table data accurately. Trust the column position and the conditional logic."
                                },

                                {
                                    type: "image_url",
                                    // اصلاح شده: به جای imageUrl باید از image_url (با underscore) استفاده کنید
                                    image_url: {
                                        url: `data:${mimeType};base64,${base64Data}`
                                    }
                                }
                            ]
                        }
                    ],

                    response_format: { type: "json_object" },

                    temperature: 0
                })
            },
            2,
            2000
        )

        const content = aiResponse.choices[0].message.content as string
        const sanitizedContent = cleanAIJson(content || "{}");
        const aiJson = JSON.parse(sanitizedContent);

        if (!aiJson.transactions) {
            throw new Error("AI could not extract transactions structure.")
        }

        // 3. پردازش هدر و تشخیص بانک میزبان

        const headerFromAI = aiJson.header || {}

        const extractedAccNum = headerFromAI.account_number
            ? headerFromAI.account_number.replace(/[^0-9]/g, "")
            : ""

        console.log(`🔍 AI Detected Header Account: ${extractedAccNum}`)

        // تشخیص بانک میزبان (نیاز به detectBankInfoByNumber در bankIntelligence.ts)

        let bankDetails = detectBankInfoByNumber(extractedAccNum)

        if (bankDetails.dlCode !== "200001") {
            console.log(
                `🎯 Host Bank Resolved: ${bankDetails.bankName} (DL: ${bankDetails.dlCode})`
            )
        } else {
            console.warn(`⚠️ Host Bank NOT resolved from header: ${extractedAccNum}`)
        }

        const rawTransactions = aiJson.transactions || []

        console.log(`✅ AI Extracted ${rawTransactions.length} items.`)

        // 4. حلقه غنی‌سازی (فقط از خروجی AI استفاده می‌کند)

        const enrichedTransactions = await Promise.all(
            rawTransactions.map(async (tx: any) => {
                // ادغام دست‌نویس با شرح (دست‌نویس اولویت دارد و اول می‌آید)
                let fullDescription = tx.description || ""
                if (tx.is_handwritten && tx.handwritten_text) {
                    fullDescription = `${tx.handwritten_text} - ${fullDescription}`
                }

                // منطق تعیین نوع و مبلغ دقیق

                let type: "deposit" | "withdrawal" = "withdrawal"

                let amount = 0

                // چون AI حالا تمام حالت‌ها را در دو فیلد deposit و withdrawal جمع‌آوری کرده، فقط کافی است یکی را انتخاب کنیم

                if (tx.deposit && Number(tx.deposit) > 0) {
                    type = "deposit"

                    amount = Number(tx.deposit)
                } else if (tx.withdrawal && Number(tx.withdrawal) > 0) {
                    type = "withdrawal"

                    // نکته: اگر خروجی AI منفی بود (برای ستون تک‌مقداری)، اینجا آن را مثبت می‌کنیم

                    amount = Math.abs(Number(tx.withdrawal))
                }

                const safeDate = toEnglishDigits(tx.date)

                const safeTrack = toEnglishDigits(tx.tracking_code)

                const currentTx = {
                    date: safeDate,

                    time: tx.time || "00:00",

                    type: type,

                    amount: amount,

                    description: fullDescription,

                    partyName: "نامشخص",

                    tracking_code: safeTrack,

                    dl_code: null as string | null,

                    dl_type: null as number | null,

                    sl_code: null as string | null,

                    ai_verification_status: "pending"
                }

                // الف: قوانین هوشمند

                // الف: قوانین هوشمند (شامل قوانین ثابت و هوش مصنوعی دیتابیس)
                const smartMatch = await findSmartRule(
                    tx.description,
                    currentTx.partyName || ""
                )

                if (smartMatch) {
                    // تعیین کد معین یا تفصیلی بر اساس نوع بازگشتی
                    if (smartMatch.type === "DL") {
                        currentTx.dl_code = smartMatch.code
                    } else if (smartMatch.type === "SL") {
                        currentTx.sl_code = smartMatch.code
                    }

                    currentTx.partyName = smartMatch.title

                    // ✅ تغییر مهم: وضعیت را "verified" می‌زنیم تا در پنل سبز شود
                    currentTx.ai_verification_status = "verified"

                    // چون قانون هوشمند پیدا شد، دیگر جستجوهای بعدی را انجام نده و برگرد
                    return currentTx
                }
                // ب: استخراج نام

                const extractedName = await extractNameFromDesc(tx.description);

                if (extractedName) {
                    currentTx.partyName = extractedName;
                }

                // ج: جستجوی در راهکاران

                if (currentTx.partyName !== "نامشخص") {
                    try {
                        const matchedEntity = await findAccountCode(currentTx.partyName)

                        if (matchedEntity && matchedEntity.dlCode) {
                            currentTx.dl_code = matchedEntity.dlCode

                            currentTx.dl_type = matchedEntity.dlType || null

                            currentTx.partyName = matchedEntity.foundName
                        }
                    } catch (e) {
                        console.error(`Search failed for ${currentTx.partyName}`, e)
                    }
                }

                return currentTx
            })
        )

        return {
            success: true,

            data: {
                header_info: { ...headerFromAI, number: extractedAccNum },

                bank_details: bankDetails,

                transactions: enrichedTransactions
            }
        }
    } catch (e: any) {
        console.error("AI Bridge Failed:", e)

        return { success: false, error: e.message }
    }
}




export async function analyzeInvoice(fileUrl: string) {
    try {
        const fileRes = await fetch(fileUrl, { cache: "no-store" })
        if (!fileRes.ok) throw new Error("دانلود فایل ناموفق بود")

        const fileBuffer = await fileRes.arrayBuffer()
        const base64Data = Buffer.from(fileBuffer).toString("base64")
        const mimeType = fileUrl.toLowerCase().endsWith(".pdf")
            ? "application/pdf"
            : "image/jpeg"
        //net error
        const response = await gpt5Client.chat.completions.create({
            model: AI_MODELS.GPT5_MINI, // مدل مناسب و سریع
            messages: [
                {
                    role: "system",
                    content:
                        "You are an expert accountant AI. Extract the 'Total Amount' (مبلغ قابل پرداخت/جمع کل) and 'Seller Name' (فروشنده) from this invoice image/pdf. Return JSON only."
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `Extract data. Return JSON: { "total_amount": 123000, "seller_name": "string", "invoice_date": "YYYY/MM/DD" }. Ignore commas in numbers.`
                        },
                        {
                            type: "image_url",
                            // اصلاح شده: به جای imageUrl باید از image_url (با underscore) استفاده کنید
                            image_url: {
                                url: `data:${mimeType};base64,${base64Data}`
                            }
                        }
                    ]
                }
            ],
            response_format: { type: "json_object" }
        })

        const content = response.choices[0].message.content as string
        const data = JSON.parse(content || "{}")

        return { success: true, data }
    } catch (error: any) {
        console.error("Invoice OCR Error:", error)
        return { success: false, error: error.message }
    }
}


export async function extractNameFromDesc(desc: string): Promise<string | null> {
    if (!desc) return null;
    const keywords = [
        "فرستنده:",
        "گیرنده:",
        "به نام",
        "شرکت",
        "فروشگاه",
        "آقای",
        "خانم",
        "در وجه"
    ]
    for (const key of keywords) {
        if (desc.includes(key)) {
            const parts = desc.split(key)
            if (parts.length > 1) {
                let nameCandidate = parts[1].trim().split(" ").slice(0, 5).join(" ")
                nameCandidate = nameCandidate.split(/[\-\/]/)[0].trim()
                if (nameCandidate.length > 2) return nameCandidate
            }
        }
    }
    return null
}


export async function batchMatchAccountsAI(
    transactions: { id: string; description: string; partyName: string; amount: number; type: string }[],
    workspaceId: string
): Promise<Record<string, any>> {
    try {
        if (transactions.length === 0) return {};

        // ۱. استخراج کلمات کلیدی
        const searchTerms = transactions
            .map(t => t.partyName)
            .filter(name => name && name !== "نامشخص" && name.length > 2);

        let accountsList = "";

        if (searchTerms.length > 0) {
            // جایگزین بخش Supabase با کوئری PostgreSQL آروان
            // استفاده از ANY و ILIKE برای جستجوی همزمان چندین کلمه
            const query = `
                SELECT code, title, account_type 
                FROM public.rahkaran_accounts 
                WHERE ${searchTerms.map((_, i) => `title ILIKE $${i + 1}`).join(' OR ')}
                LIMIT 50
            `;

            // آماده‌سازی کلمات برای LIKE (اضافه کردن % به ابتدا و انتها)
            const values = searchTerms.map(term => `%${term}%`);

            const { rows: accounts } = await pool.query(query, values);

            if (accounts && accounts.length > 0) {
                accountsList = accounts.map(a =>
                    `[${a.code}] ${a.title} (${a.account_type})`
                ).join("\n");
            }
        }

        // ۲. حساب‌های پیش‌فرض در صورت عدم یافتن نتیجه
        if (!accountsList) {
            accountsList = "[111005] موجودی بانک ریالی\n[621105] هزینه کارمزد بانکی\n[211002] سایر حساب های پرداختنی";
        }

        // ۳. آماده‌سازی لیست تراکنش‌ها
        const txList = transactions.map(t =>
            `ID: ${t.id} | Desc: ${t.description} | Name: ${t.partyName} | Type: ${t.type}`
        ).join("\n");

        // ۴. فراخوانی هوش مصنوعی (Arvan Gemini)
        const response = await geminiClient.chat.completions.create({
            model: AI_MODELS.GEMINI_PRO,
            messages: [
                {
                    role: "system",
                    content: `You are a professional accountant. Match each transaction to the best provided Account Code. 
                    Return JSON where keys are Transaction IDs.`
                },
                {
                    role: "user",
                    content: `CANDIDATE ACCOUNTS FROM ARVAN DB:\n${accountsList}\n\nTRANSACTIONS TO MATCH:\n${txList}`
                }
            ],
            response_format: { type: "json_object" },
            temperature: 0
        });

        return JSON.parse(response.choices[0].message.content || "{}");

    } catch (e) {
        console.error("❌ Arvan Native AI Matching Failed:", e);
        return {};
    }
}


// اضافه کردن به انتهای فایل ai-service.ts
// export async function batchMatchTransactionsAI(transactions: any[], mode: string) {
//     try {
//         // ۱. دریافت لیست حساب‌ها از دیتابیس برای راهنمایی AI
//         const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
//         const { data: accounts } = await supabase.from("rahkaran_accounts").select("code, title");
//         const accountsList = accounts?.map(a => `[${a.code}] ${a.title}`).join("\n") || "";

//         // ۲. آماده‌سازی لیست تراکنش‌ها
//         const txList = transactions.map(t =>
//             `ID: ${t.id} | Desc: ${t.description} | Name: ${t.partyName}`
//         ).join("\n");

//         const response = await openai.chat.completions.create({
//             model: "openai/gpt-4o-mini", // برای سرعت بالا حتما از Flash استفاده کنید
//             messages: [
//                 {
//                     role: "system",
//                     content: `You are a professional accountant. For each transaction:
//                 1. Match it to the best Account Code.
//                 2. Write a professional, concise Persian description (humanized) for a bank voucher.
//                 Example of humanized desc: "واریز وجه بابت قرارداد فاز ۲ - شرکت آوند"
//                Return ONLY a JSON object:
//             { "ID": { "code": "string", "title": "string", "humanDesc": "string", "isFee": boolean } }`
//                 },
//                 {
//                     role: "user",
//                     content: `ACCOUNTS:\n${accountsList}\n\nTRANSACTIONS:\n${txList}`
//                 }
//             ],
//             response_format: { type: "json_object" }
//         });

//         return JSON.parse(response.choices[0].message.content as string);
//     } catch (error) {
//         console.error("Batch AI Error:", error);
//         return {};
//     }
// }



export async function batchMatchTransactionsAI(transactions: any[], mode: string) {
    try {
        const partyNames = transactions
            .map(t => t.partyName)
            .filter(name => name && name !== "نامشخص" && name.length > 2);

        let accountsList = "";

        if (partyNames.length > 0) {
            const conditions = partyNames.map((_, i) => `title ILIKE $${i + 1}`).join(' OR ');
            const query = `
                SELECT code, title 
                FROM public.rahkaran_accounts 
                WHERE ${conditions}
                LIMIT 40
            `;
            const values = partyNames.map(name => `%${name}%`);
            const { rows: matchedAccounts } = await pool.query(query, values);

            if (matchedAccounts.length > 0) {
                accountsList = matchedAccounts.map(a => `[${a.code}] ${a.title}`).join("\n");
            }
        }

        if (!accountsList) {
            accountsList = "111005 - موجودی بانک\n621105 - هزینه کارمزد بانکی\n211002 - سایر حساب های پرداختنی";
        }

        const txList = transactions.map(t =>
            `ID: ${t.id} | Desc: ${t.description} | Name: ${t.partyName}`
        ).join("\n");

        // ۴. ارسال به Arvan AI با پرامپت اصلاح شده
        const response = await gpt5Client.chat.completions.create({
            model: AI_MODELS.GPT5_MINI,
            messages: [
                {
                    role: "system",
                    content: `You are an expert accountant. Match transactions to Account Codes. 
                    IMPORTANT: For each ID, you MUST provide:
                    1. "code": The best matching account code.
                    2. "description": A unique Persian description including the party name and reason (e.g., "واریز وجه توسط علی بابت تسویه").
                    DO NOT use the same description for all items. Return a JSON object where keys are Transaction IDs.`
                },
                {
                    role: "user",
                    content: `CANDIDATE ACCOUNTS:\n${accountsList}\n\nTRANSACTIONS TO PROCESS:\n${txList}`
                }
            ],
            response_format: { type: "json_object" },
            temperature: 0.1 // کمی افزایش دما برای جلوگیری از تکرار جملات کاملاً یکسان
        });

        // ✅ هندلینگ امن پاسخ (رفع ارور reading '0')
        if (!response?.choices?.[0]?.message?.content) {
            console.error("⚠️ AI returned an empty or invalid response structure");
            return {};
        }

        const content = response.choices[0].message.content;
        return JSON.parse(content);

    } catch (error: any) {
        console.error("❌ Arvan Optimized Batch AI Error:", error.message);
        return {};
    }
}