"use server"

import { pool } from "@/lib/db"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import bcrypt from "bcrypt"

export async function loginEnterpriseUser(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  let targetPath = "";

  try {
    const userQuery = `
      SELECT id, full_name, email, password_hash, role 
      FROM public.users 
      WHERE email = $1 AND is_active = true 
      LIMIT 1
    `;
    const { rows } = await pool.query(userQuery, [email.toLowerCase()]);
    const user = rows[0];

    if (!user) {
      return { error: "ایمیل یا رمز عبور اشتباه است" };
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return { error: "ایمیل یا رمز عبور اشتباه است" };
    }

    const cookieStore = await cookies();
    cookieStore.set("session_user_id", user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    const role = user.role || "payer";
    
    // ۱. حتماً از یک UUID معتبر که در دیتابیس وجود دارد استفاده کنید
    // این همان آیدی است که در جدول workspaces دارید
    const workspaceId = "ec0c8548-6305-42fc-bfe6-189bd070f1ba"; 

    // ۲. تعیین مسیر بر اساس نقش (اضافه شدن حالت Payer)
    switch (role) {
      case "ceo": 
        targetPath = `/enterprise/${workspaceId}/ceo/dashboard`; 
        break;
      case "finance_manager": 
        targetPath = `/enterprise/${workspaceId}/finance/dashboard`; 
        break;
      case "payer": 
        targetPath = `/enterprise/${workspaceId}/finance/upload`; 
        break;
      default: 
        targetPath = `/enterprise/${workspaceId}/dashboard`;
    }

    console.log(`✅ ورود موفق: ${email} با نقش ${role}`);

  } catch (error: any) {
    // در Next.js، تابع redirect یک خطا پرتاب می‌کند که باید از catch عبور کند
    if (error.digest?.includes('NEXT_REDIRECT')) throw error;
    
    console.error("❌ Login Error:", error.message);
    return { error: "خطا در برقراری ارتباط با سرور" };
  }

  if (targetPath) {
    redirect(targetPath);
  }
}