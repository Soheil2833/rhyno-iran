"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  TrendingUp,
  PieChart,
  Users,
  Target,
  Briefcase
} from "lucide-react"

interface SidebarProps {
  workspaceId: string
}

export const CeoSidebar = ({ workspaceId }: SidebarProps) => {
  const pathname = usePathname()

  const links = [
    {
      name: "نمای کلی (Overview)",
      href: `/enterprise/${workspaceId}/ceo/dashboard`,
      icon: <LayoutDashboard className="size-5" />
    },
    {
      name: "گزارشات مالی کلان",
      href: `/enterprise/${workspaceId}/ceo/financial-reports`,
      icon: <TrendingUp className="size-5" />
    },
    {
      name: "عملکرد تیم‌ها",
      href: `/enterprise/${workspaceId}/ceo/team-performance`,
      icon: <Users className="size-5" />
    },
    {
      name: "اهداف استراتژیک",
      href: `/enterprise/${workspaceId}/ceo/strategy`,
      icon: <Target className="size-5" />
    },
    {
      name: "تحلیل بازار (AI)",
      href: `/enterprise/${workspaceId}/ceo/market-analysis`,
      icon: <PieChart className="size-5" />
    }
  ]

  return (
    <aside className="hidden h-full w-64 flex-col border-l border-gray-800 bg-slate-900 text-white shadow-xl md:flex">
      {/* لوگوی اختصاصی مدیریت */}
      <div className="flex h-16 items-center justify-center border-b border-gray-700 bg-slate-950">
        <span className="text-lg font-bold tracking-wide text-amber-500">
          Executive Portal
        </span>
      </div>

      <div className="flex-1 space-y-2 p-4">
        {links.map(link => {
          const isActive = pathname === link.href
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-3 rounded-lg p-3 text-sm font-medium transition-all duration-200",
                isActive
                  ? "border-r-4 border-amber-500 bg-amber-500/10 text-amber-500"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              )}
            >
              {link.icon}
              {link.name}
            </Link>
          )
        })}
      </div>

      <div className="border-t border-gray-800 p-4">
        <div className="rounded-lg bg-slate-800 p-3 text-xs text-slate-400">
          <p className="mb-1 text-white">وضعیت سیستم:</p>
          همه سرویس‌ها فعال هستند.
        </div>
      </div>
    </aside>
  )
}
