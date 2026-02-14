import { Toaster } from "@/components/ui/sonner"
import { Button } from "@/components/ui/button"
import { LogOut, Bell } from "lucide-react"
import Link from "next/link"
import { CeoSidebar } from "@/components/ceo/ceo-sidebar"



type Props = {
  children: React.ReactNode
  params: Promise<{ workspaceid: string }>
}




export default async function CEOLayout({ children, params }: Props) {
  // ۳. پارامترها را await کنید
  const { workspaceid } = await params
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-slate-50 font-sans text-gray-900"
      dir="rtl"
    >
      {/* هدر مخصوص مدیریت */}
      <header className="z-20 flex h-16 shrink-0 items-center justify-between border-b bg-white px-6 shadow-sm">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-slate-800">داشبورد اجرایی</h1>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
            CEO ACCESS
          </span>
        </div>

        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="text-gray-500">
            <Bell className="size-5" />
          </Button>
          <div className="h-6 w-px bg-gray-200" />
          <Link href="/enterprise/login">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <LogOut className="size-4" /> خروج امن
            </Button>
          </Link>
        </div>
      </header>

      {/* بدنه اصلی */}
      <div className="flex flex-1 overflow-hidden">
        <CeoSidebar workspaceId={workspaceid} />

        <main className="flex-1 overflow-y-auto p-8">
          <div className="animate-in fade-in slide-in-from-bottom-4 mx-auto max-w-7xl duration-500">
            {children}
          </div>
        </main>
      </div>

      <Toaster />
    </div>
  )
}
