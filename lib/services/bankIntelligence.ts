
import { geminiClient, AI_MODELS, gpt5Client, embeddingClient } from "@/lib/arvanapi";
import { pool } from "@/lib/db";
import { batchMatchAccountsAI } from "@/lib/services/ai-service"



const PETTY_CASH_HOLDERS = [
  "امین امین نیا",
  "امین امین‌نیا", // با نیم‌فاصله
  "امین امین",
  "ایرج امین نیا",
  "ایرج امین‌نیا",
  "امین نیا"
]
export interface SmartRuleResult {
  type: "SL" | "DL"
  code: string
  title: string
  source?: "HARDCODE" | "AI_DB"
}

export interface FeeResult {
  isFee: boolean
  reason: string
}
interface DetectionResult {
  code: string
  title: string
  type: "DL" | "SL"
  matchedKeyword: string
}

export const INTERNAL_BANK_ACCOUNTS = [
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

function toEnglishDigits(str: string): string {
  return str
    .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d).toString())
    .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
}

// تابع کمکی برای پیدا کردن بانک از روی شماره
export function matchBankByNumber(
  numberStr: string
): { dlCode: string; title: string } | null {
  // 1. تمیزکاری ورودی
  const cleanInput = toEnglishDigits(numberStr).replace(/[^0-9]/g, "")

  if (cleanInput.length < 5) return null

  let bestMatch = null
  let maxMatchLength = 0

  for (const bank of INTERNAL_BANK_ACCOUNTS) {
    for (const key of bank.keywords) {
      // 2. تمیزکاری کلید
      const cleanKey = toEnglishDigits(key).replace(/[^0-9]/g, "")

      if (!cleanKey) continue

      // 3. بررسی تطابق دو طرفه
      if (cleanInput.includes(cleanKey) || cleanKey.includes(cleanInput)) {
        // طول بخش مشترک را پیدا می‌کنیم (معمولا طولِ کوچکترِ این دو است)
        // اما اینجا چون بحث 'includes' است، طول cleanKey مهم است اگر ورودی بزرگتر باشد
        const matchLen = Math.min(cleanInput.length, cleanKey.length)

        // شرط اطمینان (حداقل 5 رقم)
        if (matchLen >= 5) {
          // 🔥 تغییر حیاتی: اگر این تطابق "طولانی‌تر" از قبلی است، آن را نگه دار
          // این باعث می‌شود 161161118501021 (طولانی) برنده شود، نه 16116111850 (کوتاه)
          if (matchLen > maxMatchLength) {
            maxMatchLength = matchLen
            bestMatch = { dlCode: bank.dl, title: bank.title }
          }
        }
      }
    }
  }

  // در نهایت بهترین گزینه را برگردان
  return bestMatch
}

// ---------------------------------------------------------
// 2. تابع تشخیص هوشمند بانک (مرجع واحد)
// ---------------------------------------------------------
export function detectBankInfoByNumber(
  identifier: string,
  excludeDLCode?: string | null
): {
  slCode: string
  dlCode: string
  bankName: string
} {
  const DEFAULT = {
    slCode: "111005",
    dlCode: "200001",
    bankName: "بانک نامشخص (پیش‌فرض)"
  }

  if (!identifier) return DEFAULT

  // تمیزکاری ورودی: حذف تمام غیر اعداد
  const cleanInput = identifier.replace(/\D/g, "") // \D یعنی هر چیزی غیر از عدد

  if (cleanInput.length < 5) return DEFAULT

  for (const bank of INTERNAL_BANK_ACCOUNTS) {
    for (const key of bank.keywords) {
      // ✅ نکته مهم: تمیزکاری کلیدهای کانفیگ قبل از مقایسه
      const cleanKey = key.replace(/\D/g, "")

      // مقایسه دو طرفه (شاید ورودی بخشی از کلید باشد یا برعکس)
      if (cleanInput.includes(cleanKey) || cleanKey.includes(cleanInput)) {
        // اطمینان از حداقل ۵ رقم تطابق
        const commonLen = Math.min(cleanInput.length, cleanKey.length)
        if (commonLen >= 5) {
          return {
            slCode: "111005",
            dlCode: bank.dl,
            bankName: bank.title
          }
        }
      }
    }
  }

  return DEFAULT
}



// تابع کمکی برای محاسبه شباهت کسینوسی در حافظه
function cosineSimilarity(vecA: number[], vecB: number[]) {
  let dotProduct = 0;
  let mA = 0;
  let mB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    mA += vecA[i] * vecA[i];
    mB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(mA) * Math.sqrt(mB));
}

export async function findBestEntitiesByEmbedding(
  searchText: string,
  matchCount: number = 5
) {
  try {
    // ۱. دریافت Embedding متن جستجو از طریق کلاینت جدید آروان
    // توجه: مدل Embedding-3-Large معمولاً خروجی با ابعاد بالا دارد
    const embeddingResponse = await embeddingClient.embeddings.create({
      model: AI_MODELS.Embeddings,
      input: searchText.replace(/\n/g, " "),
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;

    // ۲. دریافت تمام ردیف‌ها از دیتابیس آروان
    // چون pgvector نداریم، ستون embedding باید به صورت TEXT یا JSONB ذخیره شده باشد
    const { rows } = await pool.query(
      "SELECT dl_code, title, embedding FROM public.rahkaran_entities"
    );

    if (!rows || rows.length === 0) return [];

    // ۳. محاسبه شباهت کسینوسی در سمت سرور (Application Level)
    const results = rows
      .map((row) => {
        // اگر ستون embedding در دیتابیس به صورت رشته ذخیره شده، پارسش می‌کنیم
        const rowEmbedding = typeof row.embedding === 'string'
          ? JSON.parse(row.embedding)
          : row.embedding;

        return {
          code: row.dl_code,
          title: row.title,
          similarity: cosineSimilarity(queryEmbedding, rowEmbedding)
        };
      })
      // ۴. فیلتر کردن بر اساس آستانه شباهت (مثلاً ۰.۳) و مرتب‌سازی
      .filter(item => item.similarity > 0.3)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, matchCount);

    return results;

  } catch (e) {
    console.error("❌ Arvan Embedding Search Failed:", e);
    return [];
  }
}

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
  "پخش",
  "نوید",
  "گستر",
  "آریا",
  "برتر"
])

const FAST_FEE_KEYWORDS = [
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
  "ابطال چک",
  "عودت چک",
  "رفع سوء اثر",
  "کارمزد رفع سوء اثر",
  "صدور چک",
  "تمتی چک",
  "تمبر",
  "ضمام",
  "ضمان"
]

export async function extractCounterpartyBankWithAI(
  description: string,
  hostDLCode?: string | null
): Promise<{ dlCode: string; title: string } | null> {
  // پیدا کردن اطلاعات بانک میزبان برای اینکه به AI بگوییم این را نادیده بگیر
  let hostInfo = ""
  if (hostDLCode) {
    const hostBank = INTERNAL_BANK_ACCOUNTS.find(b => b.dl === hostDLCode)
    if (hostBank) {
      // به AI میگوییم این شماره‌ها را ایگنور کن چون مال خودمان است
      hostInfo = `CRITICAL: You MUST IGNORE this account number (Host/My Account): ${hostBank.keywords[0]} or any similar format. Do NOT return this number.`
    }
  }

  try {
    const completion = await gpt5Client.chat.completions.create({
      model: AI_MODELS.GPT5_MINI, // مدل سریع
      messages: [
        {
          role: "system",
          content: `You are a bank transaction text analyzer.
          Task: Extract the *Counterparty* (Other Side) Bank Account Number from the text.
          
          Rules:
          1. ${hostInfo}
          2. Find the account number that is the SOURCE (if deposit) or DESTINATION (if withdrawal).
          3. Only return digits.
          4. If the only account number in text is the Host Account, return null.
          
          Output JSON: { "found_number": "123456789" } or { "found_number": null }`
        },
        {
          role: "user",
          content: `Text: "${description}"`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0
    })

    const content = completion.choices[0].message.content as string
    const result = JSON.parse(content || "{}")
    const foundNumber = result.found_number

    if (foundNumber) {
      console.log(`🤖 AI Extracted Number: ${foundNumber}`)

      // حالا چک می‌کنیم این شماره در لیست بانک‌های ما هست یا نه
      const matchedBank = matchBankByNumber(foundNumber)

      if (matchedBank) {
        // چک نهایی امنیتی: اگر AI اشتباه کرد و دوباره کد میزبان را داد، ما جلویش را می‌گیریم
        if (hostDLCode && matchedBank.dlCode === hostDLCode) {
          console.warn(
            "🤖 AI returned host bank despite instructions. Ignoring."
          )
          return null
        }
        return matchedBank
      }
    }
  } catch (e) {
    console.error("AI Extraction Failed:", e)
  }

  return null
}

// ---------------------------------------------------------
// تابع جدید: استخراج هوشمند بانک از شرح (برای موارد نامشخص)
// ---------------------------------------------------------
export function recoverBankFromDescription(
  description: string,
  excludeDLCode?: string | null // ✅ آرگومان جدید برای جلوگیری از انتخاب خودمان
): { code: string; title: string } | null {
  if (!description) return null

  // 1. نرمال‌سازی اعداد (تبدیل فارسی به انگلیسی)
  const normalizedDesc = description
    .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d).toString())
    .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())

  // 2. الگوی یابی قدرتمند (Regex)
  // گروه اول: شماره‌های با جداکننده (مثل 1-611...)
  // گروه دوم: شماره‌های طولانی و پیوسته (مثل شبا یا شماره کارت یا سپرده‌های ملی)
  const accountPattern =
    /(\d{1,5}[-.\/]\d{1,10}[-.\/]\d{1,10}(?:[-.\/]\d{1,5})?)|(\d{10,26})/g

  const matches = normalizedDesc.match(accountPattern)

  if (matches) {
    // 🔄 شروع جستجوی سریالی: تک تک شماره‌های پیدا شده را چک کن
    for (const rawMatch of matches) {
      // تمیزکاری (حذف خط تیره و ...)
      const cleanNumber = rawMatch.replace(/[-.\/]/g, "")

      // آیا این شماره در لیست بانک‌های ما هست؟
      const detected = detectBankInfoByNumber(cleanNumber)

      // شرط 1: بانک معتبر پیدا شده باشد (کد 200001 یعنی نامشخص)
      if (detected.dlCode !== "200001") {
        // شرط 2 (حیاتی): بانک پیدا شده، نباید همان بانک میزبان باشد!
        if (excludeDLCode && detected.dlCode === excludeDLCode) {
          console.log(
            `⚠️ RecoverLoop: Found Host Bank (${detected.bankName}) in desc. Skipping to next number...`
          )
          continue // ⏩ برو سراغ شماره بعدی در متن!
        }

        // اگر رسیدیم اینجا، یعنی یک بانک "غریبه" و "معتبر" پیدا کردیم. پیروزی! 🎯
        console.log(
          `✅ Recovered Bank from Description: ${detected.bankName} (Ref: ${cleanNumber})`
        )
        return {
          code: detected.dlCode,
          title: detected.bankName
        }
      }
    }
  }

  return null // اگر همه شماره‌ها را گشتیم و چیزی پیدا نشد
}

export function verifyNameMatch(inputName: string, foundName: string): boolean {
  const normalize = (s: string) =>
    s
      .replace(/[يیكک]/g, m => (m === "ك" ? "ک" : "ی"))
      .replace(/ئ/g, "ی")
      .replace(/[^\w\s\u0600-\u06FF]/g, "")
      .toLowerCase()

  const inputNorm = normalize(inputName)
  const foundNorm = normalize(foundName)

  if (inputNorm === foundNorm) return true
  if (foundNorm.includes(inputNorm) && inputNorm.length > 4) return true

  const inputTokens = inputNorm
    .split(/\s+/)
    .filter(w => w.length > 2 && !GENERIC_WORDS.has(w))
  if (inputTokens.length === 0) return false

  let matchCount = 0
  for (const token of inputTokens) {
    if (foundNorm.includes(token)) matchCount++
  }

  return matchCount >= Math.ceil(inputTokens.length * 0.7)
}

export async function detectFeeWithAI(
  partyName: string,
  desc: string,
  amount: number
): Promise<FeeResult> {
  if (desc.includes("جبران رسوب")) {
    // اگر فرمت شماره حساب (حداقل دو خط تیره یا فرمت خاص) دیده شد
    // مثل: 1-6116111-850-10
    const hasAccountNumber = /\d+[-\/]\d+[-\/]\d+/.test(desc)

    if (hasAccountNumber) {
      console.log(
        "🛡️ Force Override: Jobran Rosub with Account # is NOT a fee."
      )
      // برگرداندن false باعث می‌شود سیستم در مراحل بعد سراغ تشخیص "انتقال" برود
      return {
        isFee: false,
        reason: "جبران رسوب دارای شماره حساب (تراکنش داخلی)"
      }
    }
  }
  const normalizeText = (text: string) =>
    text ? text.replace(/[يیكک]/g, m => (m === "ك" ? "ک" : "ی")) : ""
  const combinedSearchText = normalizeText(`${partyName} ${desc}`)

  const hasFeeKeyword = FAST_FEE_KEYWORDS.some(k =>
    combinedSearchText.includes(k)
  )

  if (amount < 10000 && (partyName === "نامشخص" || partyName === "")) {
    return { isFee: true, reason: "مبلغ ناچیز و طرف حساب نامشخص (Fast Check)" }
  }

  if (hasFeeKeyword) {
    return { isFee: true, reason: "تشخیص کلمه کلیدی کارمزد (Fast Check)" }
  }

  if (amount < 500000) {
    try {
      const aiRes = await gpt5Client.chat.completions.create({
        model: AI_MODELS.GPT5_MINI,
        messages: [
          {
            role: "system",
            content:
              'You are a bank transaction classifier. Answer JSON: { "isFee": boolean }'
          },
          {
            role: "user",
            content: `Is this a bank fee/service charge? Description: "${desc}", Amount: ${amount}`
          }
        ],
        response_format: { type: "json_object" }
      })
      const content = aiRes.choices[0].message.content as string
      const result = JSON.parse(content || "{}")
      if (result.isFee) {
        return { isFee: true, reason: "تشخیص هوشمند بافت تراکنش (AI Check)" }
      }
    } catch (e) {
      console.error("AI Fee Check Error", e)
    }
  }

  return { isFee: false, reason: "" }
}

export function detectFee(
  partyName: string,
  desc: string,
  amount: number
): FeeResult {
  const res = FAST_FEE_KEYWORDS.some(k => desc.includes(k))
  if (res) return { isFee: true, reason: "Keyword" }
  if (amount < 10000 && partyName === "نامشخص")
    return { isFee: true, reason: "Small Amount" }
  return { isFee: false, reason: "" }
}

export async function verifyWithAI(
  inputName: string,
  dbName: string
): Promise<boolean> {
  // نرمال‌سازی اولیه برای حذف فاصله‌های اضافی
  if (inputName.replace(/\s/g, "") === dbName.replace(/\s/g, "")) return true

  try {
    const completion = await gpt5Client.chat.completions.create({
      model: AI_MODELS.GPT5_MINI,
      messages: [
        {
          role: "system",
          content: `You are a fuzzy string matcher for Persian business names.
          
RULES for MATCHING (Return "match": true):
1. **Phonetic Match:** "Arisman" == "Erisman", "Azar" == "Azer".
2. **Repeated Words:** Ignore repeated city names (e.g., "Tehran Erisman Tehran" == "Tehran Arisman").
3. **Prefix/Suffix:** Ignore "Sherkat", "Bazargani", "Gorooh", "Havale", "Satna".
4. **Typos:** Allow minor typos in Persian letters (س/ص, ت/ط, ا/آ).

Input 1: "${inputName}"
Input 2: "${dbName}"

Reply JSON: { "match": boolean }`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1
    })

    const content = completion.choices[0].message.content as string
    const result = JSON.parse(content || "{}")
    return result.match === true
  } catch (e) {
    return false
  }
}

export async function matchAccountByDescriptionAI(
  description: string,
  partyName: string
): Promise<SmartRuleResult | null> {
  try {
    // ---------------------------------------------------------
    // اصلاح حیاتی: حذف "بانک" و "صندوق" از لیست کاندیداها
    // ---------------------------------------------------------
    // اگر این‌ها در لیست باشند، AI همیشه "موجودی بانک" را انتخاب می‌کند چون کلماتش شبیه تراکنش است.
    const query = `
         SELECT code, title, account_type 
         FROM public.rahkaran_accounts
         WHERE code NOT LIKE '111005%' -- حذف موجودی بانکهای ریالی
         AND code NOT LIKE '111001%' -- حذف صندوق
         ORDER BY code ASC
       `;

    const { rows: accounts } = await pool.query(query);

    if (!accounts || accounts.length === 0) {
      console.warn("⚠️ No accounts found in Arvan DB.");
      return null;
    }

    // ساخت لیست برای AI
    const accountsList = accounts
      .map(acc => `- [${acc.code}] ${acc.title} (${acc.account_type})`)
      .join("\n");


    // 2. درخواست از هوش مصنوعی برای انتخاب بهترین گزینه
    const response = await gpt5Client.chat.completions.create({
      model: AI_MODELS.GPT5_MINI, // مدل سریع و ارزان
      messages: [
        {
          role: "system",
          content: `You are an expert accountant using the Iranian accounting system (Rahkaran).
Your task is to match a transaction description to the MOST ACCURATE accounting code from the provided list.

RULES:
1. IGNORE payment methods like 'Satna', 'Paya', 'Havale' when choosing the account.
2. Focus on the PERSON or COMPANY name in the description.
3. NEVER return '111005' (Bank) if a specific person or company is mentioned in the text.
4. '111005' is ONLY for internal transfers between our own bank accounts.
1. Return JSON ONLY: { "found": boolean, "code": "string", "reason": "string" }
2. If the transaction matches an account clearly (semantically or by keyword), set "found": true.
3. If uncertain, set "found": false.
4. Prioritize "Expense" accounts for withdrawals and "Revenue" accounts for deposits if context suggests.
5. Pay attention to keywords like "حقوق" (Salary), "بیمه" (Insurance), "مالیات" (Tax), "کارمزد" (Fee).
6. if person on describtion include  "امین امین نیا",
  "امین امین‌نیا", 
  "امین امین",
  "ایرج امین نیا",
  "ایرج امین‌نیا",
  "امین نیا"

  always sl code is '111003' 

7. اگر برای شخص یا شرکتی پول واریز کرده بودیم به جز تنخواه گردان
حتما sl 111901 به پیش پرداخت قفل بشه
`
        },
        {
          role: "user",
          content: `Transaction Description: "${description}"
Party/Name: "${partyName}"

Available Accounts List:
${accountsList}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0
    })

    const content = response.choices[0].message.content as string
    const result = JSON.parse(content || "{}")

    if (result.found && result.code) {
      const matchedAccount = accounts.find(a => a.code === result.code)
      if (matchedAccount) {
        console.log(
          `🧠 AI DB Match: ${description.substring(0, 20)}... => ${matchedAccount.title} (${matchedAccount.code})`
        )
        return {
          type: matchedAccount.account_type as "SL" | "DL",
          code: matchedAccount.code,
          title: matchedAccount.title,
          source: "AI_DB"
        }
      }
    }

    return null
  } catch (e) {
    console.error("❌ AI Account Matching Failed:", e)
    return null
  }
}

// ------------------------------------------------------------------
// تابع اصلی قوانین هوشمند (ترکیبی: اول قوانین ثابت، بعد هوش مصنوعی دیتابیس)
// ------------------------------------------------------------------
export async function findSmartRule(
  description: string,
  partyName: string
): Promise<SmartRuleResult | null> {
  const desc = (description || "").toLowerCase()
  const name = (partyName || "").toLowerCase()
  const fullText = `${desc} ${name}`
  const normalizedText = fullText
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\s+/g, " ")

  const cleanName = partyName.replace(/Unknown|نامشخص/gi, "").trim()

  const isPettyCashHolder =
    PETTY_CASH_HOLDERS.some(
      h => cleanName.includes(h)
    ) ||
    cleanName.includes("امین نیا") ||
    cleanName.includes("امین امین") // اضافه کردن شرط صریح برای امین نیا

  if (isPettyCashHolder) {
    console.log(`👤 Petty Cash Holder Detected: ${cleanName}`)
    let targetName =
      PETTY_CASH_HOLDERS.find(
        h => cleanName.includes(h)
      ) || cleanName

    // اصلاح نام برای جستجو دقیق‌تر
    if (targetName.includes("امین") || targetName.includes("نیا"))
      targetName = "امین امین نیا"
    return {
      type: "DL",
      code: "110201", // این کد را با کد واقعی تفصیلی تنخواه امین نیا در راهکاران جایگزین کنید
      title: "تنخواه گردان - امین امین نیا",
      source: "HARDCODE"
    };
  }

  // --- سطح ۱: قوانین هاردکد شده (برای اطمینان ۱۰۰٪) ---
  for (const bank of INTERNAL_BANK_ACCOUNTS) {
    for (const keyword of bank.keywords) {
      if (description.includes(keyword)) {
        return {
          type: "SL", // تغییر از تفصیلی به معین
          code: "111301", // کد معین موجودی بانک‌های ریالی در سیستم شما
          title: `انتقال بین بانکی - ${bank.title}`,
          source: "HARDCODE"
        };
      }
    }
  }
  // مالیات حقوق
  if (
    normalizedText.includes("مالیات حقوق") ||
    (normalizedText.includes("مالیات") && normalizedText.includes("کارکنان"))
  ) {
    return {
      type: "DL",
      code: "211202",
      title: "حسابهای پرداختنی-مالیات حقوق",
      source: "HARDCODE"
    }
  }

  // بیمه
  if (
    normalizedText.includes("حق بیمه") ||
    normalizedText.includes("تامین اجتماعی") ||
    normalizedText.includes("لیست بیمه")
  ) {
    return {
      type: "DL",
      code: "211004",
      title: "بیمه پرداختنی",
      source: "HARDCODE"
    }
  }

  // حقوق
  if (
    normalizedText.includes("حقوق") &&
    !normalizedText.includes("مالیات") &&
    (normalizedText.includes("پرسنل") || normalizedText.includes("کارکنان"))
  ) {
    return {
      type: "DL",
      code: "211003",
      title: "حقوق پرداختنی",
      source: "HARDCODE"
    }
  }

  // --- سطح ۲: استفاده از هوش مصنوعی روی دیتابیس (rahkaran_accounts) ---
  // اگر قوانین بالا مچ نشدند، از AI می‌خواهیم در جدول بگردد
  // const aiMatch = await matchAccountByDescriptionAI(description, partyName)
  // if (aiMatch) return aiMatch

  return null
}

// ---------------------------------------------------------
// 🔥 4️⃣ ناظر ارشد مالی (The Senior Auditor) - نسخه نهایی و هوشمند
// ---------------------------------------------------------
// در فایل bankIntelligence.ts

export async function auditVoucherWithAI(data: {
  inputName: string
  inputDesc: string
  amount: number
  selectedAccountName: string
  selectedAccountCode: string | null
  selectedSLCode?: string | null
  isFee?: boolean
}) {
  try {
    const prompt = `
    You are a Smart Financial Auditor. Verify if the selected accounting code matches the transaction.

    Transaction Data:
    - Description: "${data.inputDesc}"
    - Extracted Name: "${data.inputName}"
    - Selected Account: "${data.selectedAccountName}" (Code: ${data.selectedAccountCode})
    - Amount: ${data.amount}
    - Is Fee Logic Active: ${data.isFee ? "YES" : "NO"}

    CRITICAL APPROVAL RULES (Highest Priority):

    1. **EXCEPTION CODE 504600:**
       - If Selected Account Code is "504600", TREAT IT AS A VALID BANK. **APPROVE immediately**.

    2. **INTERNAL TRANSFERS (Jobran Rosob / Self-Transfer):**
       - IF Description explicitly says "Jobran Rosob" OR "Transfer to self/own account":
       - THEN Selected Account MUST be a BANK (Starts with "200...") OR Code "504600".
       - If it is a person/company in this specific context -> REJECT.

    3. **SATNA / PAYA / HAVALE (Method of Payment):**
       - These words describe HOW money is sent.
       - It is **VALID** to send Satna/Paya to a Vendor, Person, or Company.
       - **DO NOT REJECT** just because description says "Satna" and account is not a bank. This was a previous error.

    4. **FUZZY NAME MATCHING (Typos are OK):**
       - Ignore prefixes like "Sherkat", "Bazargani", "Aghaye".
       - Allow slight spelling differences (e.g., "Tehran Risman" == "Tehran Arisman").
       - If the core name sounds similar -> **APPROVE**.
       
    5. **FEES & COMMISSIONS (SAFE PASS):**
        - If transaction is a Bank Fee (Commission/Aboman) and code is ~621105 -> **APPROVE**.
       - IF the Description mentions "Karmozd" (Commission), "Tambr" (Stamp), "Hazine" (Expense), "Aboman", "Sodoor".
       - OR IF "Selected Account" is "هزینه بانکی" (Bank Fee).
       - OR IF "Is Fee Logic Active" is YES.
       - **ACTION: APPROVE IMMEDIATELY.**
       - **CRITICAL:** Do NOT reject if the Code is NULL or Account is "Unknown" or "Namoshakhas". 
       - REASON: Bank fees are general ledger expenses and often do not have a specific counterparty (DL) code. This is expected behavior.
       "If the selected account is a known Petty Cash Holder (e.g., Amin Amin Nia امین امین نیا , امین نیا), verify strictly against Petty Cash logic, permitting 'Person' accounts if they act as the treasurer."
    Output JSON ONLY: { "approved": boolean, "reason": "Short explanation" }
    `

    const completion = await gpt5Client.chat.completions.create({
      model: AI_MODELS.GPT5_MINI,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0
    })

    const content = completion.choices[0].message.content as string
    const result = JSON.parse(content || "{}")

    return {
      approved: result.approved,
      reason: result.reason || "تایید توسط ناظر"
    }
  } catch (error) {
    console.error("Audit Error:", error)
    // در صورت قطعی اینترنت یا خطا، سخت‌گیری نکن و رد نکن
    return {
      approved: true,
      reason: "Audit Service Unavailable - Auto Approved"
    }
  }
}

// ---------------------------------------------------------
// 🧹 5️⃣ تابع تمیزکننده و استانداردساز شرح سند (Description Generator)
// ---------------------------------------------------------
export function generateCleanDescription(
  rawDesc: string,
  partyName: string,
  type: "deposit" | "withdrawal"
): string {
  // ۱. اگر هر دو خالی بودند، برگردان پیش‌فرض
  if (!rawDesc && (!partyName || partyName === "نامشخص")) {
    return type === "deposit" ? "واریز وجه (نامشخص)" : "برداشت وجه (نامشخص)";
  }

  // ۲. تمیزکاری متن اصلی
  let clean = (rawDesc || "")
    .replace(/آپلود اولیه:.*\.pdf/gi, "")
    .replace(/No Title/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  const parts = clean.split(/[-–_،,\n]/).map(p => p.trim());
  const uniqueParts = [...new Set(parts)].filter(p => p.length > 2);

  // ۳. هوشمندسازی شرح نهایی
  let finalDesc = uniqueParts.join(" - ");

  // اگر متن اصلی دیتای خاصی نداشت، از نام طرف حساب استفاده کن
  if (!finalDesc || finalDesc.length < 3) {
    const action = type === "deposit" ? "واریز از" : "پرداخت به";
    if (partyName && partyName !== "نامشخص") {
      return `${action} ${partyName}`;
    }
    return type === "deposit" ? "واریز وجه" : "برداشت وجه";
  }

  // ۴. ترکیب نام طرف حساب با شرح (اختیاری - برای خوانایی بیشتر در سند حسابداری)
  // این کار باعث می‌شود حتی اگر شرح تکراری باشد، نام طرف حساب آن را متمایز کند
  if (partyName && partyName !== "نامشخص" && !finalDesc.includes(partyName)) {
    return `${partyName} - ${finalDesc}`.substring(0, 450);
  }

  return finalDesc;
}