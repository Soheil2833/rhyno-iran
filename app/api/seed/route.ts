import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { pool } from "@/lib/db";

export async function GET() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const payerEmail = 'payer@gmail.com'; 
    const password = "123";
    const hash = await bcrypt.hash(password, 10);
    
    // ۱. درج در جدول users
    const userQuery = `
      INSERT INTO public.users (id, full_name, email, password_hash, role, is_active)
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
      RETURNING id
    `;
    const userValues = ['پرداخت کننده تست', payerEmail, hash, 'payer', true];
    const userRes = await client.query(userQuery, userValues);
    const userId = userRes.rows[0].id;

    // ۲. درج در جدول profiles
    const profileQuery = `
      INSERT INTO public.profiles (id, display_name, email)
      VALUES ($1, $2, $3)
    `;
    await client.query(profileQuery, [userId, 'مامور خرید (Payer)', payerEmail]);

    // ۳. اتصال به ورک‌اسپیس با یک UUID واقعی
    // توجه: آیدی زیر را بر اساس آیدی موجود در دیتابیس خودت (مثلاً اونی که با ec0c شروع می‌شد) جایگزین کن
    const workspaceId = 'ec0c8548-6305-42fc-bfe6-189bd070f1ba'; 

    const workspaceQuery = `
      INSERT INTO public.workspaces (id, name, user_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (id) DO UPDATE SET user_id = $3
    `;
    await client.query(workspaceQuery, [workspaceId, 'ورک‌اسپیس اصلی', userId]);

    await client.query('COMMIT');
    return NextResponse.json({ 
      message: "✅ کاربر Payer ساخته شد",
      email: payerEmail,
      workspaceId: workspaceId 
    });

  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error("Seed Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}