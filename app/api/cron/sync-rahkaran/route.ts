import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { createClient } from "@supabase/supabase-js"

export const maxDuration = 300
export const dynamic = "force-dynamic"

// -------- helper functions --------

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(supabaseUrl, supabaseKey)
}

function getOpenAI() {
  return new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
      "HTTP-Referer": "https://rhyno.ir",
      "X-Title": "Rhyno Automation"
    }
  })
}

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

async function generateEmbedding(openai: OpenAI, text: string) {
  const cleanText = text.replace(/\s+/g, " ").trim()
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: cleanText
  })
  return response.data[0].embedding
}

// -------- handler --------

export async function GET(req: NextRequest) {

  const supabase = getSupabase()
  const openai = getOpenAI()

  try {
    console.log("🔄 Starting Smart Sync Job...")

    const { data: existingRecords, error: fetchError } = await supabase
      .from("rahkaran_entities")
      .select("dl_code, title")

    if (fetchError) throw fetchError

    const existingMap = new Map<string, string>()
    existingRecords?.forEach(rec => existingMap.set(rec.dl_code, rec.title))

    const sql = `SELECT Code, DLTypeRef, Title FROM [FIN3].[DL] WHERE State = 1`
    const rahkaranAccounts = await executeRahkaranSql(sql)

    const toProcess = rahkaranAccounts.filter((acc: any) => {
      const existingTitle = existingMap.get(acc.Code)
      if (existingTitle === undefined) return true
      if (existingTitle !== acc.Title) return true
      return false
    })

    if (toProcess.length === 0)
      return NextResponse.json({ message: "Everything is up to date.", processed: 0 })

    let successCount = 0
    let errorCount = 0

    for (const acc of toProcess) {
      try {
        const embedding = await generateEmbedding(openai, acc.Title)
        const isUpdate = existingMap.has(acc.Code)

        if (isUpdate) {
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
        } else {
          const { error } = await supabase.from("rahkaran_entities").insert({
            dl_code: acc.Code,
            dl_type: acc.DLTypeRef,
            title: acc.Title,
            embedding: embedding
          })
          if (error) throw error
        }

        successCount++
        await new Promise(r => setTimeout(r, 100))

      } catch {
        errorCount++
      }
    }

    return NextResponse.json({
      success: true,
      stats: { processed: successCount, errors: errorCount }
    })

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
