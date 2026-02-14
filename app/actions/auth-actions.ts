"use server"

import { pool } from "@/lib/db"
import { cookies } from "next/headers"

export async function resolveUserAccess() {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get("session_user_id")?.value

    if (!userId) return { status: "unauthenticated" }

    // کوئری ترکیبی برای دریافت نقش و ورک‌اسپیس در یک مرحله (JOIN)
    const query = `
      SELECT 
        p.role, 
        w.id as workspace_id
      FROM public.profiles p
      LEFT JOIN public.workspaces w ON w.user_id = p.user_id
      WHERE p.user_id = $1
      ORDER BY w.created_at DESC
      LIMIT 1
    `
    const { rows } = await pool.query(query, [userId])

    if (rows.length === 0) return { status: "no_profile" }

    return {
      status: "success",
      role: rows[0].role,
      workspaceId: rows[0].workspace_id
    }
  } catch (error) {
    console.error("Resolve Access Error:", error)
    return { status: "error" }
  }
}