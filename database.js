import fs from "fs";
import csvParser from "csv-parser";
import pkg from "pg";
const { Pool } = pkg;

/* ================== CONFIG ================== */
const pool = new Pool({
  user: "base-user",
  host: "8fcba0a43c314571afcb8759628c581f.db.arvandbaas.ir",
  database: "default",
  password: "--sp600LPI99E6GMUYA-7aoB",
  port: 5432,
  ssl: false,
});

const CSV_FILE = "./rahkaran_entities.csv";
const BATCH_SIZE = 500; // مقدار کمتر برای پایداری بیشتر در حجم بالا

/* ================== HELPERS ================== */

function parseEmbedding(raw) {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw;

  try {
    // حذف فضاهای خالی احتمالی و تبدیل رشته به آرایه
    const cleanRaw = raw.trim();
    const arr = JSON.parse(cleanRaw);
    return arr.map((v) => Number(v));
  } catch (e) {
    console.error("❌ Error parsing embedding for raw string:", raw.substring(0, 50) + "...");
    throw new Error("Invalid embedding format");
  }
}

/* ================== DB INSERT ================== */

async function insertBatch(batch) {
  if (batch.length === 0) return;

  const values = [];
  const placeholders = [];

  batch.forEach((r, i) => {
    const base = i * 4;
    placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`);
    values.push(r.dl_code, r.dl_type, r.title, parseEmbedding(r.embedding));
  });

  const query = `
    INSERT INTO public.rahkaran_entities (dl_code, dl_type, title, embedding)
    VALUES ${placeholders.join(",")}
    ON CONFLICT (dl_code)
    DO UPDATE SET
      dl_type = EXCLUDED.dl_type,
      title = EXCLUDED.title,
      embedding = EXCLUDED.embedding,
      updated_at = NOW();
  `;

  try {
    await pool.query(query, values);
  } catch (err) {
    console.error("❌ Database Insert Error:", err.message);
    throw err;
  }
}

/* ================== CSV STREAM (REFIXED) ================== */

async function importCSV() {
  console.log("🚀 Start import...");
  
  let batch = [];
  let total = 0;

  const stream = fs.createReadStream(CSV_FILE).pipe(csvParser());

  for await (const row of stream) {
    batch.push({
      dl_code: row.dl_code,
      dl_type: Number(row.dl_type),
      title: row.title,
      embedding: row.embedding,
    });

    if (batch.length === BATCH_SIZE) {
      await insertBatch(batch);
      total += batch.length;
      console.log(`✅ Inserted: ${total}`);
      batch = [];
    }
  }

  // درج باقی‌مانده رکوردها
  if (batch.length > 0) {
    await insertBatch(batch);
    total += batch.length;
  }

  console.log(`🎉 DONE. Total rows: ${total}`);
  await pool.end();
}

/* ================== RUN ================== */
importCSV().catch(console.error);