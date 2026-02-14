import dotenv from "dotenv";
import path from "path";
import OpenAI from "openai";
import pkg from "pg";
const { Pool } = pkg;
import fetch from "node-fetch"; // اگر node 18+، لازم نیست

dotenv.config({ path: path.resolve("./.env.local") });

console.log("pool user", process.env.User); // چک کن درست لود شده

const pool = new Pool({
  user: "base-user",
  host: "8fcba0a43c314571afcb8759628c581f.db.arvandbaas.ir",
  database: "default",
  password: "--sp600LPI99E6GMUYA-7aoB",
  port: 5432,
  ssl: false
});

const arvanClient = new OpenAI({
  apiKey: process.env.ARVAN_API_KEY, // کلید خود را در .env قرار دهید
  baseURL:"https://arvancloudai.ir/gateway/models/Embedding-3-Large/MAgwqIh8Mq5Wr6rRyslDSVzfV1QQWfTIT492MaiZOqQ7mVSBclPqTeoayoMgjuLL4JNfUb53cn5GYCtIhufoiFHg5636fkx_BfBNwa_L2et7kvdwyoymBe7sNJdFJphqFp1cnRPLJiG2G9ULW7RdVs2KDnhq6KjqaB2iovAmDeIl2StqmhSH81CHcPz2wK1wlNRwRLTLLFGteuwLh2-xdtV4__na-6ehivqoMUmrB27asgoTE2dXg5RuQnrMMi_1m3BP66kXOQY/v1"
});


const PROXY_URL = "http://188.121.101.223:3001/run-query";
const PROXY_KEY = "soheil1371 ";
const EMBEDDING_MODEL = "Embedding-3-Large-c12yn";

// ---------------- Rahkaran SQL ----------------
async function executeRahkaranSql(sql) {
  const proxyRes = await fetch(PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-proxy-key": PROXY_KEY },
    body: JSON.stringify({ query: sql })
  });
  if (!proxyRes.ok) throw new Error(`Rahkaran Proxy Error: ${proxyRes.status}`);
  const data = await proxyRes.json();
  return data.recordset || [];
}

// ---------------- Generate Embedding ----------------
async function generateEmbedding(text) {
  const cleanText = text.replace(/\s+/g, " ").trim();
  if (!cleanText) return null;

  try {
    // حتماً از await استفاده کنید و متد را به embeddings برگردانید
    const response = await arvanClient.embeddings.create({
      model: EMBEDDING_MODEL,
      input: cleanText,
      // برای رفع مشکل برگرداندن صفر در مدل‌های گوگل، این بخش را اضافه کنید
      extra_body: {
        task_type: "RETRIEVAL_DOCUMENT"
      }
    });

    // چک کردن وجود دیتا
    if (response && response.data && response.data[0]) {
      const embedding = response.data[0].embedding;
      
      // لاگ برای اطمینان از اینکه اعداد صفر نیستند
      console.log(`DEBUG: First 3 values for "${text.substring(0,10)}...":`, embedding.slice(0, 3));
      
      return embedding;
    } else {
      throw new Error("Invalid response structure from Arvan AI");
    }
    
  } catch (err) {
    console.error("❌ Embedding generation error for:", text);
    throw err;
  }
}


// ---------------- Main ----------------
async function main() {
  try {
    console.log("🔄 Starting Smart Sync Job...");

    // 1️⃣ Existing records in Arvan
    const existingRes = await pool.query("SELECT dl_code, title FROM public.rahkaran_entities");
    const existingMap = new Map();
    existingRes.rows.forEach(r => existingMap.set(r.dl_code, r.title));
    console.log(`💾 Existing records in Arvan: ${existingMap.size}`);

    // 2️⃣ Get Rahkaran data
    const sql = "SELECT Code, DLTypeRef, Title FROM [FIN3].[DL] WHERE State = 1";
    const rahkaranAccounts = await executeRahkaranSql(sql);
    console.log(`📥 Fetched ${rahkaranAccounts.length} accounts from Rahkaran.`);

    // 3️⃣ Filter new/changed
    const toProcess = rahkaranAccounts.filter(acc => {
      const existingTitle = existingMap.get(acc.Code);
      return existingTitle === undefined || existingTitle !== acc.Title;
    });
    console.log(`⚡ Items to process (New/Changed): ${toProcess.length}`);

    // 4️⃣ Insert/Update in Arvan
    let successCount = 0;
    let errorCount = 0;

    for (const acc of toProcess) {
      try {
        console.log(`🔹 Generating embedding for: ${acc.Title} (${acc.Code})`);
        const embedding = await generateEmbedding(acc.Title);

      await pool.query(
  `
  INSERT INTO public.rahkaran_entities (dl_code, dl_type, title, embedding, updated_at)
  VALUES ($1, $2, $3, $4::vector, NOW())  -- اضافه شد ::vector
  ON CONFLICT (dl_code)
  DO UPDATE SET
    dl_type = EXCLUDED.dl_type,
    title = EXCLUDED.title,
    embedding = EXCLUDED.embedding,
    updated_at = NOW()
  `,
  [acc.Code, acc.DLTypeRef, acc.Title, JSON.stringify(embedding)] // تغییر کرد
);

        successCount++;
        await new Promise(r => setTimeout(r, 100));
      } catch (err) {
        console.error(`❌ Failed to process ${acc.Title}:`, err.message);
        errorCount++;
      }
    }

    await pool.end();

    console.log("✅ Sync completed");
    console.log({
      total_rahkaran: rahkaranAccounts.length,
      processed: successCount,
      errors: errorCount,
      skipped: rahkaranAccounts.length - toProcess.length
    });

 } catch (error) {
    console.error("Sync Error Full:", error); // << این خط رو اضافه کن
    console.error("Sync Error Message:", error?.message); // این هم پیام اصلی
    return { success: false, error: error?.message || "Unknown error" };
}

}

// Run
main();
