// فایل: app/enterprise/[workspaceid]/finance/settings/CustomerMappingUpload.tsx
// یا در پوشه components
"use client"

import { useState, useRef } from "react" // useRef را اضافه کردم برای راه حل بهتر
import { uploadCustomerMapping } from "@/app/actions/settings-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Loader2, FileSpreadsheet } from "lucide-react"

export function CustomerMappingUpload({
  workspaceId
}: {
  workspaceId: string
}) {
  const [uploading, setUploading] = useState(false)
  const [file, setFile] = useState<File | null>(null)

  // استفاده از ref به جای document.getElementById (روش استاندارد ریکت)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUpload = async () => {
    if (!file) return toast.error("لطفا یک فایل اکسل انتخاب کنید")

    setUploading(true)
    const formData = new FormData()
    formData.append("file", file)

    try {
      const res = await uploadCustomerMapping(workspaceId, formData)

      if (!res.success) throw new Error(res.error)

      toast.success(`${res.count} مشتری با موفقیت بروزرسانی شد! 🎉`)
      setFile(null)

      // ریست کردن اینپوت با استفاده از Ref
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <div className="rounded-full bg-green-100 p-2 text-green-600">
          <FileSpreadsheet className="size-6" />
        </div>
        <h3 className="text-lg font-semibold">تخصیص گروهی مشتریان</h3>
      </div>

      <p className="mb-4 text-sm text-gray-500">
        فایل اکسل شامل ستون‌های <b>Customer</b> (نام مشتری) و <b>Email</b>{" "}
        (ایمیل مسئول) را آپلود کنید.
      </p>

      <div className="flex gap-3">
        <Input
          ref={fileInputRef} // اتصال Ref
          id="excel-upload"
          type="file"
          accept=".xlsx, .xls"
          className="cursor-pointer"
          onChange={e => setFile(e.target.files?.[0] || null)}
        />
        <Button
          onClick={handleUpload}
          disabled={uploading || !file}
          className="bg-green-600 hover:bg-green-700"
        >
          {uploading ? <Loader2 className="animate-spin" /> : "آپلود و اعمال"}
        </Button>
      </div>
    </div>
  )
}
