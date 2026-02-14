// app/api/cron/check-deadlines/route.ts

import { createClient } from "@supabase/supabase-js"
import { sendReminderSMS } from "@/lib/sms-service"
import { NextResponse } from "next/server"

// تابع کمکی برای محاسبه اختلاف روز
function getDaysPassed(deadlineISO: string): string {
  const deadline = new Date(deadlineISO)
  const now = new Date()

  // محاسبه اختلاف به میلی‌ثانیه
  const diffTime = Math.abs(now.getTime() - deadline.getTime())
  // تبدیل به روز (رند شده به بالا)
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  return diffDays.toString()
}

export async function POST(req: Request) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const now = new Date().toISOString()

    // ۱. دریافت اسناد عقب‌افتاده که هنوز یادآوری نشده‌اند
    const { data: overdueRequests, error } = await supabaseAdmin
      .from("payment_requests")
      .select(
        `
        id, 
        supplier_name, 
        deadline,
        assigned_user_id,
        profiles:assigned_user_id ( phone )
      `
      )
      .lt("deadline", now) // ددلاین گذشته باشد
      .eq("status", "pending_docs") // هنوز تکمیل نشده باشد
      .is("last_reminder_sent_at", null) // قبلاً پیامک نرفته باشد

    if (error) throw error

    let sentCount = 0

    // ۲. ارسال پیامک برای هر مورد
    for (const item of overdueRequests || []) {
      // @ts-ignore
      const phone = item.profiles?.phone || item.profiles?.[0]?.phone
      const supplierName = item.supplier_name || "سند مالی"

      // ✅ محاسبه تعداد روزهای گذشته برای قرار دادن در متن پیامک
      const daysPassed = getDaysPassed(item.deadline)

      if (phone) {
        // ارسال با پارامتر جدید
        await sendReminderSMS(phone, supplierName, daysPassed)

        // آپدیت دیتابیس که پیامک ارسال شد
        await supabaseAdmin
          .from("payment_requests")
          .update({ last_reminder_sent_at: new Date().toISOString() })
          .eq("id", item.id)

        sentCount++
      }
    }

    return NextResponse.json({
      success: true,
      processed: overdueRequests?.length || 0,
      sent_sms: sentCount
    })
  } catch (error: any) {
    console.error("Cron Job Error:", error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
