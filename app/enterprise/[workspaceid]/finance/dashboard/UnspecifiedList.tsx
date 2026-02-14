"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  Loader2,
  CheckCircle,
  Image as ImageIcon,
  FileText,
  FileSpreadsheet,
  Printer
} from "lucide-react"
import {
  AccountSelector,
  AccountOption
} from "@/components/finance/AccountSelector"
import { approveUnspecifiedDocument } from "@/app/actions/finance-actions"

// اینترفیس داده‌های ورودی
export interface UnspecifiedItem {
  id: string
  description: string | null
  supplier_name: string | null
  amount: number | null
  receipt_image_url?: string | null | string[]
  file_url?: string | null | string[]
  status?: string
  [key: string]: any
}

interface UnspecifiedListProps {
  items: UnspecifiedItem[]
  slAccounts: AccountOption[]
  dlAccounts: AccountOption[]
  workspaceId: string
}

export default function UnspecifiedList({
  items,
  slAccounts,
  dlAccounts,
  workspaceId
}: UnspecifiedListProps) {
  const [loading, setLoading] = useState<string | null>(null)

  // --- تابع خروجی اکسل (CSV) ---
  const handleExportExcel = () => {
    if (!items || items.length === 0) {
      toast.error("داده‌ای برای خروجی وجود ندارد")
      return
    }

    // هدرهای CSV
    const headers = [
      "شرح تراکنش",
      "تامین کننده",
      "مبلغ (ریال)",
      "وضعیت",
      "لینک فایل"
    ]

    // تبدیل داده‌ها به فرمت CSV
    const csvContent = items
      .map(item => {
        const desc = item.description
          ? `"${item.description.replace(/"/g, '""')}"`
          : "-"
        const supplier = item.supplier_name ? `"${item.supplier_name}"` : "-"
        const amount = item.amount || 0
        const status = "نامشخص"
        // استخراج لینک
        let link = "-"
        const rawImage = item.receipt_image_url || item.file_url
        if (Array.isArray(rawImage)) link = rawImage[0]
        else if (typeof rawImage === "string") link = rawImage

        return `${desc},${supplier},${amount},${status},${link}`
      })
      .join("\n")

    const blob = new Blob([`\uFEFF${headers.join(",")}\n${csvContent}`], {
      type: "text/csv;charset=utf-8;"
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute(
      "download",
      `unspecified_report_${new Date().toISOString().split("T")[0]}.csv`
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // --- تابع پرینت (PDF) ---
  const handlePrint = () => {
    window.print()
  }

  const handleApprove = async (
    id: string,
    slCode: string,
    dlCode: string | null,
    currentDesc: string | null
  ) => {
    if (!slCode) {
      toast.error("لطفاً حساب معین را انتخاب کنید")
      return
    }
    setLoading(id)

    const result = await approveUnspecifiedDocument(
      id,
      slCode,
      dlCode,
      currentDesc,
      workspaceId
    )

    setLoading(null)

    if (!result.success) {
      toast.error(`خطا: ${result.error}`)
    } else {
      toast.success("سند با موفقیت ثبت شد")
    }
  }

  if (!items || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-white py-10 text-gray-400">
        <CheckCircle className="mb-2 size-10 text-green-500 opacity-50" />
        <p className="text-sm">هیچ سند نامشخصی وجود ندارد.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* هدر و دکمه‌های خروجی */}
      <div className="flex items-center justify-end gap-2 print:hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportExcel}
          className="flex items-center gap-2 text-green-700 hover:bg-green-50 hover:text-green-800"
        >
          <FileSpreadsheet className="size-4" />
          خروجی اکسل
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrint}
          className="flex items-center gap-2 text-gray-600 hover:bg-gray-50"
        >
          <Printer className="size-4" />
          چاپ / PDF
        </Button>
      </div>

      <div className="min-h-[300px] overflow-visible rounded-xl border border-gray-200 bg-white shadow-sm print:border-none print:shadow-none">
        <table className="w-full text-right text-sm">
          <thead className="border-b border-gray-100 bg-gray-50/80 text-gray-600">
            <tr>
              <th className="w-16 p-4 text-center font-medium">تصویر</th>
              <th className="w-1/4 p-4 font-medium">شرح تراکنش</th>
              <th className="p-4 font-medium">مبلغ (ریال)</th>
              <th className="w-1/4 p-4 font-medium print:hidden">حساب معین</th>
              <th className="w-1/4 p-4 font-medium print:hidden">تفصیلی</th>
              <th className="p-4 font-medium print:hidden">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map(item => (
              <UnspecifiedRow
                key={item.id}
                item={item}
                slAccounts={slAccounts}
                dlAccounts={dlAccounts}
                onApprove={handleApprove}
                loading={loading}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function UnspecifiedRow({
  item,
  slAccounts,
  dlAccounts,
  onApprove,
  loading
}: any) {
  const [selectedSL, setSelectedSL] = useState("")
  const [selectedDL, setSelectedDL] = useState("")
  const [imageError, setImageError] = useState(false) // مدیریت خطای عکس

  // --- منطق استخراج عکس ---
  const rawImage = item.receipt_image_url || item.file_url || item.image_url
  let imageUrl: string | null = null

  if (rawImage) {
    if (Array.isArray(rawImage) && rawImage.length > 0) {
      imageUrl = rawImage[0]
    } else if (typeof rawImage === "string") {
      // تمیزکاری رشته اگر فرمت JSON داشته باشد
      let cleanRaw = rawImage.trim()
      if (cleanRaw.startsWith("[") || cleanRaw.startsWith("{")) {
        try {
          const parsed = JSON.parse(cleanRaw)
          imageUrl = Array.isArray(parsed) ? parsed[0] : parsed
        } catch {
          imageUrl = cleanRaw
        }
      } else {
        imageUrl = cleanRaw
      }
    }
  }

  if (imageUrl) {
    imageUrl = imageUrl.replace(/"/g, "")
  }

  // تشخیص نوع فایل (آیا PDF است؟)
  const isPdf = imageUrl?.toLowerCase().endsWith(".pdf")

  return (
    <tr className="group break-inside-avoid transition-colors hover:bg-gray-50/50">
      {/* 1. تصویر / فایل */}
      <td className="p-4 align-middle">
        {imageUrl ? (
          <a
            href={imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="relative flex size-12 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50 transition-all hover:scale-110 hover:ring-2 hover:ring-blue-400"
            title="مشاهده فایل"
          >
            {/* اگر PDF بود آیکون فایل نشان بده، اگر عکس بود و لود شد خودش را، اگر لود نشد آیکون عکس */}
            {isPdf ? (
              <FileText className="size-6 text-red-500" />
            ) : !imageError ? (
              <img
                src={imageUrl}
                alt="سند"
                className="size-full object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <ImageIcon className="size-6 text-gray-400" />
            )}
          </a>
        ) : (
          <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-gray-100 text-gray-300">
            <ImageIcon className="size-5" />
          </div>
        )}
      </td>

      {/* 2. شرح */}
      <td className="p-4 align-middle">
        <div className="flex items-center gap-2">
          <span className="size-1.5 shrink-0 rounded-full bg-orange-400" />
          <span
            className="max-w-[200px] truncate font-medium text-gray-700"
            title={item.description || ""}
          >
            {item.description || "بدون شرح"}
          </span>
        </div>
        {item.supplier_name && (
          <div className="mt-1 truncate text-xs text-gray-400">
            {item.supplier_name}
          </div>
        )}
      </td>

      {/* 3. مبلغ */}
      <td className="p-4 align-middle font-mono text-xs font-medium text-gray-600">
        {item.amount ? Number(item.amount).toLocaleString() : "0"}
      </td>

      {/* 4. انتخاب معین (SL) */}
      <td className="p-4 align-middle print:hidden">
        <AccountSelector
          accounts={slAccounts}
          value={selectedSL}
          onChange={setSelectedSL}
        />
      </td>

      {/* 5. انتخاب تفصیلی (DL) */}
      <td className="p-4 align-middle print:hidden">
        <AccountSelector
          accounts={dlAccounts}
          value={selectedDL}
          onChange={setSelectedDL}
        />
      </td>

      {/* 6. دکمه عملیات */}
      <td className="p-4 align-middle print:hidden">
        <Button
          size="sm"
          onClick={() =>
            onApprove(item.id, selectedSL, selectedDL || null, item.description)
          }
          disabled={loading === item.id || !selectedSL}
          className={`h-9 px-3 text-xs shadow-sm transition-all ${
            selectedSL
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "cursor-not-allowed bg-gray-100 text-gray-400"
          }`}
        >
          {loading === item.id ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            "ثبت"
          )}
        </Button>
      </td>
    </tr>
  )
}
