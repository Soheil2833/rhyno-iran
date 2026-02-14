import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { createClient } from "@supabase/supabase-js"

export const maxDuration = 300
export const dynamic = "force-dynamic"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "https://rhyno.ir",
    "X-Title": "Rhyno Automation"
  }
})

const PROXY_URL = process.env.RAHKARAN_PROXY_URL
const PROXY_KEY = process.env.RAHKARAN_PROXY_KEY
const EMBEDDING_MODEL = "qwen/qwen3-embedding-8b"

async function executeRahkaranSql(sql: string) {
  const proxyRes = await fetch(PROXY_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-proxy-key": PROXY_KEY! },
    body: JSON.stringify({ query: sql })
  })
  if (!proxyRes.ok) throw new Error(`Rahkaran Proxy Error: ${proxyRes.status}`)
  const data = await proxyRes.json()
  return data.recordset || []
}

async function generateEmbedding(text: string) {
  const cleanText = text.replace(/\s+/g, " ").trim()
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: cleanText
  })
  return response.data[0].embedding
}

export async function GET(req: NextRequest) {
  try {
    console.log("🔄 Starting Smart Sync Job...")

    // 1. دریافت لیست موجود در Supabase (فقط کد و عنوان برای مقایسه)
    // این کوئری سبک است و سریع اجرا می‌شود
    const { data: existingRecords, error: fetchError } = await supabase
      .from("rahkaran_entities")
      .select("dl_code, title")

    if (fetchError) throw fetchError

    // تبدیل به Map برای جستجوی سریع (O(1))
    // ساختار: { '601161': 'شرکت چسب پارس' }
    const existingMap = new Map<string, string>()
    existingRecords?.forEach(rec => existingMap.set(rec.dl_code, rec.title))

    console.log(`💾 Existing records in Supabase: ${existingMap.size}`)

    // 2. دریافت لیست کامل از راهکاران
    const sql = `SELECT Code, DLTypeRef, Title FROM [FIN3].[DL] WHERE State = 1`
    const rahkaranAccounts = await executeRahkaranSql(sql)
    console.log(`📥 Fetched ${rahkaranAccounts.length} accounts from Rahkaran.`)

    // 3. فیلتر کردن آیتم‌هایی که نیاز به پردازش دارند
    const toProcess = rahkaranAccounts.filter((acc: any) => {
      const existingTitle = existingMap.get(acc.Code)

      // حالت ۱: اصلاً وجود ندارد -> باید اضافه شود
      if (existingTitle === undefined) return true

      // حالت ۲: وجود دارد اما عنوان تغییر کرده -> باید آپدیت شود
      // (چون اگر عنوان عوض شود، امبدینگ هم باید عوض شود)
      if (existingTitle !== acc.Title) return true

      // حالت ۳: وجود دارد و تغییری نکرده -> نادیده بگیر
      return false
    })

    console.log(`⚡ Items to process (New/Changed): ${toProcess.length}`)

    if (toProcess.length === 0) {
      return NextResponse.json({
        message: "Everything is up to date.",
        processed: 0
      })
    }

    // 4. پردازش فقط روی آیتم‌های جدید/تغییر یافته
    let successCount = 0
    let errorCount = 0

    for (const acc of toProcess) {
      try {
        console.log(`🔹 Generating embedding for: ${acc.Title} (${acc.Code})`)
        const embedding = await generateEmbedding(acc.Title)

        // بررسی اینکه آیا آپدیت است یا اینزرت
        const isUpdate = existingMap.has(acc.Code)

        if (isUpdate) {
          // آپدیت رکورد موجود
          const { error } = await supabase
            .from("rahkaran_entities")
            .update({
              title: acc.Title,
              dl_type: acc.DLTypeRef,
              embedding: embedding,
              updated_at: new Date().toISOString()
            })
            .eq("dl_code", acc.Code)
          if (error) throw error
          console.log(`🔄 Updated: ${acc.Title}`)
        } else {
          // اینزرت رکورد جدید
          const { error } = await supabase.from("rahkaran_entities").insert({
            dl_code: acc.Code,
            dl_type: acc.DLTypeRef,
            title: acc.Title,
            embedding: embedding
          })
          if (error) throw error
          console.log(`✅ Inserted: ${acc.Title}`)
        }

        successCount++
        // تاخیر کوچک برای جلوگیری از Rate Limit
        await new Promise(r => setTimeout(r, 100))
      } catch (err: any) {
        console.error(`❌ Failed to process ${acc.Title}:`, err.message)
        errorCount++
      }
    }

    return NextResponse.json({
      success: true,
      message: "Sync completed",
      stats: {
        total_rahkaran: rahkaranAccounts.length,
        processed: successCount,
        errors: errorCount,
        skipped: rahkaranAccounts.length - toProcess.length
      }
    })
  } catch (error: any) {
    console.error("Sync Error:", error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
