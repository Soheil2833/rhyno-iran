import { pool } from "@/lib/db"
import { cookies } from "next/headers"
import { Toaster } from "@/components/ui/sonner"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"
import Link from "next/link"
import { FinanceSidebar } from "@/components/finance/finance-sidebar"
import { redirect } from "next/navigation"

export default async function FinanceLayout({
  children,
  params
}: {
  children: React.ReactNode
  // ۱. تغییر تایپ به Promise
  params: Promise<{ workspaceid: string }> 
}) {
  // ۲. await کردن params برای استخراج workspaceid
  const { workspaceid } = await params
  
  const cookieStore = await cookies()
  const userId = cookieStore.get("session_user_id")?.value

  if (!userId) {
    redirect("/enterprise/login")
  }

  let userRole = "finance_staff"

  try {
    const { rows } = await pool.query(
      "SELECT role FROM profiles WHERE user_id = $1",
      [userId]
    )

    if (rows.length > 0) {
      userRole = rows[0].role
    }
  } catch (error) {
    console.error("❌ ArvanDB Connection Error:", error)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-gray-50 font-sans text-gray-900"
      dir="rtl"
    >
      <header className="z-20 flex h-16 shrink-0 items-center justify-between border-b bg-white px-6 shadow-sm">
        <div className="flex items-center gap-4">
          <h1 className="flex items-center gap-2 text-xl font-bold text-blue-800">
            <span className="rounded-lg bg-blue-100 p-2">💰</span>
            سامانه مالی راینو
          </h1>
          <span className="rounded-full border bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-600">
            ARVAN CLOUD DB
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/enterprise/login">
            <Button variant="ghost" size="sm" className="text-gray-500 hover:text-red-600">
              <LogOut className="ml-2 size-4" />
              خروج
            </Button>
          </Link>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ۳. استفاده از متغیر استخراج شده (workspaceid) به جای params.workspaceid */}
        <FinanceSidebar workspaceId={workspaceid} userRole={userRole} />

        <main className="flex-1 overflow-y-auto bg-gray-50/50 p-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>

      <Toaster />
    </div>
  )
}