import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { EnterpriseSidebar } from "@/components/bi/EnterpriseSidebar"
import { pool } from "@/lib/db" // اتصال به Postgres آروان

export default async function EnterpriseWorkspaceLayout({
  children,
  params
}: {
  children: React.ReactNode
  params: Promise<{ workspaceid: string }> // در نسخه جدید Next.js این یک Promise است
}) {
  // ۱. await کردن پارامترها و کوکی‌ها (رفع خطای Property 'get' does not exist)
  const { workspaceid } = await params
  const cookieStore = await cookies()
  
  // ۲. دریافت آیدی کاربر از کوکی اختصاصی شما
  const userId = cookieStore.get("session_user_id")?.value

  // ۳. اگر نشست (Session) وجود نداشت، هدایت به لاگین
  if (!userId) {
    return redirect("/enterprise/login")
  }

  try {
    // ۴. (اختیاری) چک کردن دسترسی کاربر به این ورک‌اسپیس در دیتابیس آروان
    // این بخش جایگزین کدهای کامنت شده قبلی شماست
   // تغییر owner_id به user_id طبق ساختار دیتابیس شما
const { rows } = await pool.query(
  "SELECT id FROM workspaces WHERE id = $1 AND user_id = $2",
  [workspaceid, userId]
);

    // اگر ورک‌اسپیس متعلق به این کاربر نبود یا وجود نداشت
    // if (rows.length === 0) redirect('/enterprise/dashboard')
    
  } catch (error) {
    console.error("❌ Database Error in Layout:", error)
  }

  return (
    <div className="flex h-screen w-full overflow-hidden font-sans" dir="rtl">
      {/* سایدبار ثابت سمت راست با دیتای آروان */}
      <EnterpriseSidebar workspaceId={workspaceid} />

      {/* محتوای اصلی */}
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8 dark:bg-[#0f1018]">
        <div className="mx-auto max-w-7xl">
          {children}
        </div>
      </main>
    </div>
  )
}