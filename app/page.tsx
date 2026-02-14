"use client"
// app/enterprise/login/page.tsx
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { FiLock, FiShield, FiArrowLeft, FiLoader } from "react-icons/fi"
import Link from "next/link"
import { loginEnterpriseUser } from "@/app/enterprise/login/actions"

export default function EnterpriseLoginPage() {
  const [loading, setLoading] = useState(false)

  const handleServerLogin = async (formData: FormData) => {
    setLoading(true)
    try {
      const result = await loginEnterpriseUser(formData)
      if (result?.error) {
        toast.error(result.error)
        setLoading(false)
      }
    } catch (err) {
      toast.error("خطای غیرمنتظره رخ داد")
      setLoading(false)
    }
  }

  return (
    // تغییر bg-white به bg-[#0f1018] برای یکپارچگی حالت دارک
    <div className="flex min-h-screen w-full bg-[#0f1018] text-white">
      
      {/* بخش سمت راست - فرم ورود */}
      <div className="flex w-full flex-col justify-center p-8 md:w-1/2 lg:px-20">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8">
            <div className="mb-6 flex items-center gap-2 text-blue-500">
              <FiShield size={40} />
              <span className="text-2xl font-bold tracking-tight">
                Rhyno Enterprise
              </span>
            </div>
            <h1 className="text-3xl font-bold text-white">
              ورود به پنل مدیریت
            </h1>
            <p className="mt-2 text-sm text-gray-400">
              لطفاً اطلاعات حساب سازمانی خود را وارد کنید.
            </p>
          </div>

          <form action={handleServerLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-200">ایمیل سازمانی</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="name@company.com"
                // تغییر بک‌گراند به تیره و اجبار متن به سفید برای جلوگیری از غیب شدن نوشته
                className="h-12 bg-gray-900 border-gray-800 text-white placeholder:text-gray-500 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-gray-200">رمز عبور</Label>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type="password"
                  // استفاده از pr-10 اگر جهت متن RTL است، یا pl-10 برای آیکون سمت چپ
                  className="h-12 bg-gray-900 border-gray-800 text-white pl-10 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                <FiLock className="absolute left-3 top-3.5 text-gray-500" />
              </div>
            </div>

            <Button
              type="submit"
              className="h-12 w-full bg-blue-600 text-white text-lg hover:bg-blue-700 transition-colors"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <FiLoader className="mr-2 animate-spin" /> 
                  <span>در حال پردازش...</span>
                </div>
              ) : (
                "ورود امن"
              )}
            </Button>
          </form>

          <div className="mt-8 text-center text-sm">
            <Link
              href="/"
              className="mt-4 inline-flex items-center gap-1 text-gray-500 hover:text-gray-300 transition-colors"
            >
              <FiArrowLeft /> بازگشت به صفحه اصلی سایت
            </Link>
          </div>
        </div>
      </div>

      {/* بخش سمت چپ - تصویر و برندینگ */}
      <div className="relative hidden w-1/2 overflow-hidden bg-slate-950 md:block">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/40 to-black/80 z-0" />
        
        {/* این بخش ستاره‌ها که در CSS تعریف کرده بودی اینجا اعمال می‌شود */}
        <div className="stars absolute inset-0 z-0 opacity-30"></div>

        <div className="relative z-10 flex h-full flex-col items-center justify-center p-12 text-center text-white">
          <div className="mb-6 rounded-2xl bg-white/5 p-4 backdrop-blur-xl border border-white/10">
            <svg
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-blue-400"
            >
              <path d="M3 3v18h18" />
              <path d="M18 17V9" />
              <path d="M13 17V5" />
              <path d="M8 17v-3" />
            </svg>
          </div>
          <h2 className="mb-4 text-3xl font-bold tracking-tight">هوش تجاری پیشرفته</h2>
          <p className="max-w-md text-lg text-blue-100/70 font-light">
            سیستم جامع مدیریت مالی و BI اختصاصی راینو
          </p>
        </div>
      </div>
    </div>
  )
}