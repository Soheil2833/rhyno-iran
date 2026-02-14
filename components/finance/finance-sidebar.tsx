"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  UploadCloud,
  ClipboardList,
  FileText,
  Users
} from "lucide-react"

// اصلاح: اضافه کردن userRole به اینترفیس (به صورت اختیاری با علامت سوال)
interface SidebarProps {
  workspaceId: string
  userRole?: string
}

export const FinanceSidebar = ({ workspaceId, userRole }: SidebarProps) => {
  const pathname = usePathname()

  const commonLinks = [
    {
      name: "کارتابل پیگیری",
      href: `/enterprise/${workspaceId}/finance/cartable`,
      icon: <ClipboardList className="size-5" />
    },
    {
      name: "آرشیو اسناد",
      href: `/enterprise/${workspaceId}/finance/documents`,
      icon: <FileText className="size-5" />
    }
  ]

  const managerLinks = [
    {
      name: "داشبورد مالی",
      href: `/enterprise/${workspaceId}/finance/dashboard`,
      icon: <LayoutDashboard className="size-5" />
    },
    {
      name: "مدیریت مشتریان",
      href: `/enterprise/${workspaceId}/finance/customers`,
      icon: <Users className="size-5" />
    }
  ]

  const payerLinks = [
    {
      name: "ثبت سند جدید",
      href: `/enterprise/${workspaceId}/finance/upload`,
      icon: <UploadCloud className="size-5" />
    }
  ]

  let links = [...commonLinks]

  // لاجیک نمایش منوها بر اساس نقش
  if (
    userRole === "finance_manager" ||
    userRole === "ceo" ||
    userRole === "owner"
  ) {
    links = [...managerLinks, ...payerLinks, ...commonLinks]
  } else if (userRole === "payer") {
    links = [...payerLinks, ...links]
  }

  return (
    <aside className="hidden h-full w-64 flex-col border-l border-gray-200 bg-white md:flex">
      <div className="border-b p-4">
        <div className="text-xs font-medium text-gray-500">نقش شما:</div>
        <div className="text-sm font-bold text-blue-700">
          {userRole === "finance_manager"
            ? "مدیر مالی"
            : userRole === "finance_staff"
              ? "مسئول پیگیری"
              : userRole === "payer"
                ? "مسئول پرداخت"
                : userRole === "ceo"
                  ? "مدیر عامل"
                  : "کاربر"}
        </div>
      </div>

      <div className="flex-1 space-y-1 p-4">
        {links.map(link => {
          const isActive = pathname === link.href
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
              )}
            >
              {link.icon}
              {link.name}
            </Link>
          )
        })}
      </div>
    </aside>
  )
}
