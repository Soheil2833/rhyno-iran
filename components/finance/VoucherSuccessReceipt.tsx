import React, { useState } from "react"
import {
  CheckCircle,
  Copy,
  FileText,
  Calendar,
  User,
  CreditCard,
  Hash,
  AlertTriangle, // آیکون هشدار برای تکراری
  XCircle // آیکون خطا برای نامشخص
} from "lucide-react"

// اضافه کردن وضعیت‌های مختلف به تایپ
type ReceiptStatus = "success" | "duplicate" | "error"

interface VoucherSuccessProps {
  docId: string
  partyName: string
  slCode: string
  amount: number
  date: string
  description: string
  status?: ReceiptStatus // ✅ پراپ جدید (اختیاری، پیش‌فرض success)
  onClose?: () => void
}

export default function VoucherSuccessReceipt({
  docId,
  partyName,
  slCode,
  amount,
  date,
  description,
  status = "success", // پیش‌فرض روی موفق
  onClose
}: VoucherSuccessProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    if (!docId || docId === "---") return
    navigator.clipboard.writeText(docId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // فرمت‌دهی مبلغ
  const formattedAmount = new Intl.NumberFormat("fa-IR").format(amount)

  // --- تنظیمات ظاهری بر اساس وضعیت ---
  const config = {
    success: {
      bgHeader: "bg-green-50",
      borderHeader: "border-green-100",
      textHeader: "text-green-800",
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      Icon: CheckCircle,
      title: "سند با موفقیت ثبت شد",
      subtitle: "تراکنش در سیستم راهکاران نهایی شد"
    },
    duplicate: {
      bgHeader: "bg-amber-50",
      borderHeader: "border-amber-100",
      textHeader: "text-amber-800",
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
      Icon: AlertTriangle, // آیکون زرد رنگ
      title: "سند تکراری است",
      subtitle: "این تراکنش قبلاً در سیستم ثبت شده بود"
    },
    error: {
      bgHeader: "bg-red-50",
      borderHeader: "border-red-100",
      textHeader: "text-red-800",
      iconBg: "bg-red-100",
      iconColor: "text-red-600",
      Icon: XCircle, // آیکون قرمز رنگ
      title: "ثبت سند انجام نشد",
      subtitle: "اطلاعات نامشخص یا ناقص است (نیاز به بررسی)"
    }
  }

  const theme = config[status]

  return (
    <div
      className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-gray-100 bg-white font-sans shadow-xl"
      dir="rtl"
    >
      {/* Header Section Dynamic */}
      <div
        className={`border-b p-6 text-center ${theme.bgHeader} ${theme.borderHeader}`}
      >
        <div
          className={`mx-auto mb-4 flex size-16 items-center justify-center rounded-full shadow-sm ${theme.iconBg}`}
        >
          <theme.Icon
            className={`size-8 ${theme.iconColor}`}
            strokeWidth={2.5}
          />
        </div>
        <h2 className={`mb-1 text-xl font-bold ${theme.textHeader}`}>
          {theme.title}
        </h2>
        <p className={`text-sm ${theme.textHeader} opacity-80`}>
          {theme.subtitle}
        </p>
      </div>

      {/* Ticket Body */}
      <div className="space-y-5 p-6">
        {/* Voucher ID Block */}
        <div className="group relative flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-gray-50 p-4">
          <span className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500">
            {status === "error" ? "وضعیت خطا" : "شماره سند (Doc ID)"}
          </span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-3xl font-extrabold tracking-tight text-gray-800">
              {docId || "---"}
            </span>
            {/* دکمه کپی فقط اگر آیدی وجود داشته باشد نمایش داده شود */}
            {docId && docId !== "---" && (
              <button
                onClick={handleCopy}
                className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600"
                title="کپی"
              >
                {copied ? (
                  <span className="text-xs font-bold text-green-600">
                    کپی شد
                  </span>
                ) : (
                  <Copy size={16} />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Details Grid */}
        <div className="space-y-3">
          <DetailRow
            icon={<User size={16} />}
            label="طرف حساب"
            value={partyName}
            highlight
            // اگر نامشخص بود قرمز نشان بده
            valueColor={
              partyName.includes("نامشخص") ? "text-red-600" : undefined
            }
          />
          <DetailRow
            icon={<Hash size={16} />}
            label="کد معین (SL)"
            value={slCode || "---"}
          />
          <DetailRow
            icon={<CreditCard size={16} />}
            label="مبلغ کل"
            value={`${formattedAmount} ریال`}
          />
          <DetailRow
            icon={<Calendar size={16} />}
            label="تاریخ سند"
            value={date}
          />
        </div>

        {/* Description */}
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
          <div className="flex items-start gap-2">
            <FileText className="mt-1 size-4 shrink-0 text-blue-500" />
            <p className="text-sm leading-relaxed text-blue-800">
              <span className="mb-0.5 block text-xs font-semibold text-blue-400">
                شرح سند:
              </span>
              {description}
            </p>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      {onClose && (
        <div className="flex justify-center border-t border-gray-100 bg-gray-50 p-4">
          <button
            onClick={onClose}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:text-gray-900 active:scale-95"
          >
            بستن پنجره
          </button>
        </div>
      )}
    </div>
  )
}

// Helper Component Updated
const DetailRow = ({
  icon,
  label,
  value,
  highlight = false,
  valueColor
}: {
  icon: React.ReactNode
  label: string
  value: string
  highlight?: boolean
  valueColor?: string
}) => (
  <div className="flex items-center justify-between py-1">
    <div className="flex items-center gap-2 text-gray-500">
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </div>
    <span
      className={`text-sm font-bold ${valueColor ? valueColor : highlight ? "text-gray-900" : "text-gray-700"}`}
    >
      {value}
    </span>
  </div>
)
