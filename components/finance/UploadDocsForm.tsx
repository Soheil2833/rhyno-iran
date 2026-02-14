"use client"

import { useState } from "react"
import { completeRequestDocs } from "@/app/actions/finance-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { uploadToArvanS3 } from "@/lib/upload-helper"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

export function UploadDocsForm({
  requestId,
  workspaceId
}: {
  requestId: string
  workspaceId: string
}) {
  const [uploading, setUploading] = useState(false)
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const [warehouseFile, setWarehouseFile] = useState<File | null>(null)

  const handleComplete = async () => {
    if (!invoiceFile || !warehouseFile) {
      toast.error("لطفا هر دو فایل فاکتور و رسید انبار را انتخاب کنید")
      return
    }
    setUploading(true)
    try {
      const invoiceUrl = await uploadToArvanS3(invoiceFile)
      const warehouseUrl = await uploadToArvanS3(warehouseFile)
      const res = await completeRequestDocs(
        requestId,
        workspaceId,
        invoiceUrl,
        warehouseUrl
      )
      if (res.error) throw new Error(res.error)
      toast.success("مدارک ثبت شد و پرونده بسته شد")
    } catch (error: any) {
      toast.error(error.message || "خطا در عملیات")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="mt-4 space-y-3 border-t pt-4">
      <h4 className="text-sm font-bold text-gray-800">تکمیل و بستن پرونده</h4>
      <div>
        <label className="mb-1 block text-xs font-medium">فاکتور فروش:</label>
        <Input
          type="file"
          className="h-9 text-xs"
          onChange={e => setInvoiceFile(e.target.files?.[0] || null)}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium">رسید انبار:</label>
        <Input
          type="file"
          className="h-9 text-xs"
          onChange={e => setWarehouseFile(e.target.files?.[0] || null)}
        />
      </div>
      <Button
        onClick={handleComplete}
        disabled={uploading || !invoiceFile || !warehouseFile}
        className="h-8 w-full bg-blue-600 text-xs hover:bg-blue-700"
      >
        {uploading ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" /> در حال آپلود...
          </>
        ) : (
          "بستن حساب (تکمیل)"
        )}
      </Button>
    </div>
  )
}
