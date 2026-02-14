"use client"

import { useState } from "react"
// تغییر ایمپورت به اکشن جدید
import { verifyAndSettleRequest } from "@/app/actions/finance-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { uploadToArvanS3 } from "@/lib/upload-helper"
import { toast } from "sonner"
import { Loader2, CheckCircle2, XCircle } from "lucide-react"

export function UploadDocsForm({
  requestId,
  workspaceId,
  currentAiStatus
}: {
  requestId: string
  workspaceId: string
  currentAiStatus?: string
}) {
  const [uploading, setUploading] = useState(false)
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const [warehouseFile, setWarehouseFile] = useState<File | null>(null)

 const handleProcess = async () => {
    if (!invoiceFile || !warehouseFile) {
      toast.error("لطفا هر دو فایل فاکتور و رسید انبار را انتخاب کنید")
      return
    }

    setUploading(true)
    const toastId = toast.loading("در حال آپلود و بررسی هوشمند اسناد...")

    try {
      // ۱. آپلود فایل‌ها به باکت اختصاصی (مثلا finance-docs)
      const invoiceUrl = await uploadToArvanS3(invoiceFile, "finance-docs")
      const warehouseUrl = await uploadToArvanS3(warehouseFile, "finance-docs")

      // ۲. فراخوانی اکشن هوشمند
      const res = await verifyAndSettleRequest(
        requestId,
        workspaceId,
        invoiceUrl,
        warehouseUrl
      )

      if (!res.success) throw new Error(res.error)

      if (res.approved) {
        toast.success("مدارک تایید و حساب تسویه شد! ✅", { id: toastId })
        // پاک کردن فایل‌ها از استیت بعد از موفقیت
        setInvoiceFile(null)
        setWarehouseFile(null)
      } else {
        toast.error(`عدم تطابق: ${res.reason}`, { id: toastId, duration: 5000 })
      }
    } catch (error: any) {
      toast.error(error.message || "خطا در عملیات", { id: toastId })
    } finally {
      setUploading(false)
    }
  }
  return (
    <div className="space-y-3 pt-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-[10px] font-medium text-gray-500">
            فاکتور فروش
          </label>
          <Input
            type="file"
            className="h-8 text-[10px]"
            onChange={e => setInvoiceFile(e.target.files?.[0] || null)}
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-medium text-gray-500">
            رسید انبار
          </label>
          <Input
            type="file"
            className="h-8 text-[10px]"
            onChange={e => setWarehouseFile(e.target.files?.[0] || null)}
          />
        </div>
      </div>

      <Button
        onClick={handleProcess}
        disabled={uploading || !invoiceFile || !warehouseFile}
        className={`h-9 w-full text-xs font-medium transition-all ${
          currentAiStatus === "rejected"
            ? "bg-red-600 hover:bg-red-700"
            : "bg-blue-600 hover:bg-blue-700"
        }`}
      >
        {uploading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" />
            <span>بررسی هوشمند...</span>
          </div>
        ) : currentAiStatus === "rejected" ? (
          <div className="flex items-center gap-2">
            <XCircle className="size-4" />
            <span>تلاش مجدد (اصلاح مدارک)</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4" />
            <span>بررسی و تسویه حساب</span>
          </div>
        )}
      </Button>
    </div>
  )
}
