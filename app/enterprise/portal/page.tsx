"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { FiLoader } from "react-icons/fi"
import { resolveUserAccess } from "@/app/actions/auth-actions"
import { toast } from "sonner"

export default function EnterprisePortal() {
  const router = useRouter()

  useEffect(() => {
    const init = async () => {
      const result = await resolveUserAccess()

      if (result.status === "unauthenticated") {
        router.push("/enterprise/login")
        return
      }

      if (result.status === "error" || result.status === "no_profile") {
        toast.error("خطا در شناسایی حساب کاربری یا فضای کاری")
        return
      }

      const { role, workspaceId } = result

      if (!workspaceId) {
        toast.error("هیچ فضای کاری فعالی برای شما یافت نشد.")
        return
      }

      // هدایت هوشمند بر اساس نقش (برگرفته از دیتابیس آروان)
      if (role === "ceo") {
        router.push(`/enterprise/${workspaceId}/ceo/dashboard`)
      } else if (["finance_manager", "finance_staff", "payer"].includes(role)) {
        router.push(`/enterprise/${workspaceId}/finance/dashboard`)
      } else {
        router.push(`/enterprise/${workspaceId}/dashboard`)
      }
    }

    init()
  }, [router])

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-gray-50 dark:bg-[#0f1018]">
      <div className="flex flex-col items-center">
        <FiLoader className="size-12 animate-spin text-blue-600" />
        <div className="mt-6 text-center">
          <p className="text-xl font-bold text-gray-800 dark:text-white">
            خوش آمدید
          </p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            در حال شناسایی سطح دسترسی و ورود به پنل راینو...
          </p>
        </div>
      </div>
    </div>
  )
}