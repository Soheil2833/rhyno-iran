"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { FiDownload, FiPrinter, FiX } from "react-icons/fi"

// 👇 ایمپورت صحیح (چون الان هر دو فایل کنار هم در پوشه components/finance هستند)
import { UploadDocsForm } from "./UploadDocsForm"

interface FilePreviewModalProps {
  isOpen: boolean
  onClose: () => void
  fileUrl: string
  fileType?: string
  title?: string
  requestId?: string
  workspaceId: string // ✅ این فیلد ضروری است
}

export function FilePreviewModal({
  isOpen,
  onClose,
  fileUrl,
  fileType = "image",
  workspaceId,
  requestId,
  title = "پیش‌نمایش سند"
}: FilePreviewModalProps) {
  const handlePrint = () => {
    const printWindow = window.open(fileUrl, "_blank")
    printWindow?.print()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex h-[90vh] max-w-4xl flex-col overflow-hidden bg-white p-0 dark:bg-gray-900">
        <DialogHeader className="flex flex-row items-center justify-between border-b bg-gray-50 px-4 py-3 dark:bg-gray-800">
          <DialogTitle className="text-sm font-medium">{title}</DialogTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handlePrint}
              title="پرینت"
            >
              <FiPrinter />
            </Button>
            <a href={fileUrl} download target="_blank" rel="noreferrer">
              <Button size="sm" variant="ghost" title="دانلود">
                <FiDownload />
              </Button>
            </a>
            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
              className="text-red-500"
            >
              <FiX />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-auto bg-gray-100 p-4 dark:bg-black">
          {/* بخش نمایش فایل */}
          <div className="flex min-h-[300px] flex-1 items-center justify-center">
            {fileType === "pdf" || fileUrl.endsWith(".pdf") ? (
              <iframe
                src={fileUrl}
                className="size-full rounded-md border-none"
              />
            ) : (
              <div className="relative size-full">
                <img
                  src={fileUrl}
                  alt="Preview"
                  className="mx-auto max-h-full max-w-full object-contain shadow-lg"
                />
              </div>
            )}
          </div>

          {/* 👇👇👇 اینجا جایی است که ارور می‌داد و الان درست شده 👇👇👇 */}
          {requestId && (
            <div className="shrink-0 rounded-xl border border-gray-200 bg-white p-4">
              <h4 className="mb-2 text-sm font-bold text-gray-800">
                تکمیل و بستن پرونده
              </h4>

              <UploadDocsForm
                requestId={requestId}
                // ✅ ما اینجا workspaceId را که از ورودی مودال گرفتیم، به فرم می‌دهیم
                workspaceId={workspaceId}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
