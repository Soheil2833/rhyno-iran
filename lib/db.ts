// lib/db.ts
import { Pool } from 'pg';

const globalForPool = global as unknown as { pool: Pool };

export const pool = globalForPool.pool || new Pool({
  connectionString: "postgres://base-user:--sp600LPI99E6GMUYA-7aoB@8fcba0a43c314571afcb8759628c581f.db.arvandbaas.ir:5432/default",

  // تغییر اصلی اینجاست: کلاً SSL را به false تغییر دهید
  ssl: false,

  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

if (process.env.NODE_ENV !== 'production') globalForPool.pool = pool;

pool.on('error', (err) => {
  console.error('❌ خطای غیرمنتظره در استخر دیتابیس:', err);
});