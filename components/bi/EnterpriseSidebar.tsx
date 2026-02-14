"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { FiPieChart, FiDatabase, FiSettings, FiLogOut } from "react-icons/fi"
import { cn } from "@/lib/utils"

interface SidebarProps {
  workspaceId: string
}

export const EnterpriseSidebar = ({ workspaceId }: SidebarProps) => {
  const pathname = usePathname()

  // اصلاح مهم: اگر در بخش مالی هستیم، سایدبار BI را نشان نده
  if (
    pathname.includes(`/enterprise/${workspaceId}/finance`) ||
    pathname.includes(`/enterprise/${workspaceId}/ceo`)
  ) {
    return null
  }

  const links = [
    {
      name: "داشبورد تحلیل",
      href: `/enterprise/${workspaceId}/dashboard`,
      icon: <FiPieChart />
    },
    {
      name: "اتصال منابع داده",
      href: `/enterprise/${workspaceId}/connections`,
      icon: <FiDatabase />
    },
    {
      name: "تنظیمات مدل AI",
      href: `/enterprise/${workspaceId}/settings`,
      icon: <FiSettings />
    }
  ]

  return (
    <div className="flex h-full w-64 flex-col border-l border-gray-200 bg-white dark:border-gray-800 dark:bg-[#18181b]">
      {/* Logo Area */}
      <div className="flex h-16 items-center justify-center border-b border-gray-200 dark:border-gray-800">
        <h1 className="text-xl font-bold text-blue-600">
          Rhyno <span className="text-gray-600 dark:text-gray-400">BI</span>
        </h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {links.map(link => {
          const isActive = pathname === link.href
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                  : "text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              )}
            >
              <span className="text-lg">{link.icon}</span>
              {link.name}
            </Link>
          )
        })}
      </nav>

      {/* Footer Actions */}
      <div className="border-t border-gray-200 p-4 dark:border-gray-800">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 transition-colors hover:text-red-500"
        >
          <FiLogOut />
          خروج به صفحه اصلی
        </Link>
      </div>
    </div>
  )
}
