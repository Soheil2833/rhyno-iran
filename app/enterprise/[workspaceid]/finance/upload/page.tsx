"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import {
  submitGroupedTransactions,
  verifyAndSettleRequest,
  submitDayComplete,
  savePaymentRequestAction
} from "@/app/actions/finance-actions"
import { analyzeSinglePage } from "@/lib/services/ai-service"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  FiPaperclip,
  FiSend,
  FiFile,
  FiCpu,
  FiCalendar,
  FiArrowDownLeft,
  FiArrowUpRight,
  FiPieChart,
  FiUploadCloud,
  FiUser,
  FiCheckCircle
} from "react-icons/fi"
import { Loader2 } from "lucide-react"
import Script from "next/script"
import Image from "next/image"
// ✅ ایمپورت کامپوننت رسید جدید (مسیر را چک کنید)
import VoucherSuccessReceipt from "@/components/finance/VoucherSuccessReceipt"
import { CustomerMappingUpload } from "@/components/CustomerMappingUpload"
// --- تایپ‌ها ---
type Transaction = {
  date: string
  time?: string
  type: "deposit" | "withdrawal"
  amount: number
  description: string
  counterparty?: string
  tracking_code?: string
}
type AIResult = {
  bank_name?: string
  account_number?: string
  transactions: Transaction[]
  dl_code?: string
}

// ✅ اضافه کردن تایپ برای دیتای رسید
type VoucherReceiptData = {
  docId: string
  partyName: string
  slCode: string
  amount: number
  date: string
  description: string
  status: "success" | "duplicate" | "error"
}

type Message = {
  id: string
  // ✅ اضافه کردن نقش جدید voucher-receipt
  role: "user" | "system" | "ai-result" | "voucher-receipt"
  content?: string
  fileUrl?: string | string[]
  fileType?: string
  progress?: number
  status?: "converting" | "uploading" | "done"
  data?: AIResult
  // ✅ فیلد جدید برای دیتای رسید
  voucherData?: VoucherReceiptData
  isSubmitted?: boolean
}

declare global {
  interface Window {
    pdfjsLib: any
  }
}

export default function ChatUploadPage() {
  const params = useParams()
  const router = useRouter()
  const workspaceId = params?.workspaceid as string

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "system",
      content:
        "سند خود را آپلود کنید 👇\n\nسلام 👋\nمن دستیار هوشمند مالی شما هستم.\nتصویر یا PDF صورتحساب بانکی را ارسال کنید تا آن را تحلیل و ثبت کنم."
    }
  ])
  const [isUploading, setIsUploading] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [pdfLibLoaded, setPdfLibLoaded] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // --- توابع پردازش PDF و آپلود (بدون تغییر) ---
  const extractTextFromPdf = async (file: File) => {
    if (!window.pdfjsLib) return ""
    try {
      const arrayBuffer = await file.arrayBuffer()
      const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer })
      const pdf = await loadingTask.promise
      let fullText = ""
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(" ")
        fullText += `\n--- Page ${i} ---\n${pageText}`
      }
      return fullText
    } catch (e) {
      return ""
    }
  }

  const convertPdfToImages = async (
    file: File,
    onProgress: (current: number, total: number) => void
  ) => {
    if (!window.pdfjsLib) throw new Error("PDF Library loading...")
    const arrayBuffer = await file.arrayBuffer()
    const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer })
    const pdf = await loadingTask.promise
    const images: File[] = []
    for (let i = 1; i <= pdf.numPages; i++) {
      onProgress(i, pdf.numPages)
      const page = await pdf.getPage(i)
      const viewport = page.getViewport({ scale: 2 })
      const canvas = document.createElement("canvas")
      const context = canvas.getContext("2d")
      canvas.height = viewport.height
      canvas.width = viewport.width
      if (context)
        await page.render({ canvasContext: context, viewport }).promise
      const img = await new Promise<File>(resolve => {
        canvas.toBlob(
          blob =>
            resolve(new File([blob!], `page_${i}.png`, { type: "image/png" })),
          "image/png"
        )
      })
      images.push(img)
    }
    return images
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const originalFile = e.target.files?.[0]
    if (!originalFile) return
    const msgId = Date.now().toString()
    setMessages(prev => [
      ...prev,
      {
        id: msgId,
        role: "user",
        fileType: originalFile.type,
        progress: 0,
        status: "converting",
        content: originalFile.name
      }
    ])
    setIsUploading(true)
    try {
      if (originalFile.type === "application/pdf")
        await processPdf(originalFile, msgId)
      else await processImage(originalFile, msgId)
    } catch (err: any) {
      toast.error(err.message)
      setIsUploading(false)
      setMessages(prev => prev.filter(m => m.id !== msgId))
    }
  }

  const getCleanFileName = (fileName: string) => {
    const nameWithoutExt =
      fileName.substring(0, fileName.lastIndexOf(".")) || fileName
    return nameWithoutExt.replace(/[-_]/g, " ")
  }

const autoSaveToDatabase = async (fileUrl: string, rawFileName: string) => {
  const dynamicName = getCleanFileName(rawFileName);
  
  try {
    await savePaymentRequestAction({
      workspaceId,
      fileUrl,
      supplierName: dynamicName,
      description: `آپلود از چت: ${rawFileName}`,
      amount: 0,
      status: "uploaded",
      paymentDate: new Date().toISOString().split("T")[0],
      type: "withdrawal"
    });
    console.log("✅ اطلاعات در دیتابیس آروان ذخیره شد");
  } catch (error) {
    console.error("❌ خطا در ذخیره دیتابیس:", error);
    // لزوماً عملیات را متوقف نکنید تا کاربر بتواند آنالیز را ببیند
  }
}
// این تابع را قبل از processImage تعریف کنید
const uploadViaServer = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "خطا در آپلود از طریق سرور");
  }

  const data = await response.json();
  return data.url; // بازگرداندن لینک نهایی
};
const processImage = async (file: File, msgId: string) => {
  setMessages(prev =>
    prev.map(m => m.id === msgId ? { ...m, status: "uploading", progress: 10 } : m)
  );

  try {
    // ✅ تغییر: به جای آپلود مستقیم، از سرور خودمان استفاده می‌کنیم
    const url = await uploadViaServer(file);

    await autoSaveToDatabase(url, file.name);

    setMessages(prev =>
      prev.map(m =>
        m.id === msgId
          ? { ...m, fileUrl: [url], progress: 100, status: "done" }
          : m
      )
    );
    setIsUploading(false);
    startPageByPageAnalysis([url], []);
  } catch (err: any) {
    toast.error("خطا در آپلود: " + err.message);
    setIsUploading(false);
  }
};

const processPdf = async (file: File, msgId: string) => {
  setMessages(prev =>
    prev.map(m => (m.id === msgId ? { ...m, progress: 50, status: "uploading" } : m))
  );

  try {
    // ✅ تغییر: به جای آپلود مستقیم، از سرور خودمان استفاده می‌کنیم
    const url = await uploadViaServer(file);

    await autoSaveToDatabase(url, file.name);

    setMessages(prev =>
      prev.map(m =>
        m.id === msgId
          ? { ...m, fileUrl: [url], progress: 100, status: "done" }
          : m
      )
    );
    setIsUploading(false);
    startPageByPageAnalysis([url], [""]);
  } catch (err: any) {
    toast.error("خطا در آپلود PDF: " + err.message);
    setIsUploading(false);
  }
};
  const startPageByPageAnalysis = async (urls: string[], texts: string[]) => {
    setIsAnalyzing(true)
    const analyzingMsgId = "analyzing-" + Date.now()
    setMessages(prev => [
      ...prev,
      {
        id: analyzingMsgId,
        role: "system",
        content: `در حال خواندن ${urls.length} صفحه...`
      }
    ])
    const finalResult: AIResult = {
      bank_name: "",
      account_number: "",
      dl_code: "",
      transactions: []
    }
    for (let i = 0; i < urls.length; i++) {
      setMessages(prev =>
        prev.map(m =>
          m.id === analyzingMsgId
            ? {
              ...m,
              content: `در حال آنالیز صفحه ${i + 1} از ${urls.length}...`
            }
            : m
        )
      )
      const res = await analyzeSinglePage(urls[i], i + 1, texts[i] || "")
      if (res.success && res.data) {
        if (!finalResult.bank_name) finalResult.bank_name = res.data.bank_name
        if (!finalResult.account_number)
          finalResult.account_number = res.data.account_number
        if (res.data.transactions)
          finalResult.transactions.push(...res.data.transactions)

        // ✅ تغییر: این خط را آوردیم داخل بلوک if
        if (res.data.bank_details?.dlCode) {
          finalResult.dl_code = res.data.bank_details.dlCode
        }
      }
    }
    setMessages(prev => prev.filter(m => m.id !== analyzingMsgId))
    setIsAnalyzing(false)
    if (finalResult.transactions.length === 0) {
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "system",
          content: "❌ هیچ تراکنشی پیدا نشد. لطفا کیفیت تصویر را بررسی کنید."
        }
      ])
    } else {
      // 1. نمایش کارت نتیجه (لیست تراکنش‌ها)
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "ai-result",
          data: finalResult,
          fileUrl: urls,
          isSubmitted: false // هنوز ثبت نشده
        }
      ])

      // 2. 🔥 شروع عملیات ثبت خودکار
      console.log("🤖 Auto-submitting to Rahkaran...")
      await handleConfirm(finalResult, urls)
    }
  }

  const groupTransactionsByDate = (transactions: Transaction[]) => {
    const groups: Record<string, Transaction[]> = {}
    transactions?.forEach(tx => {
      const date = tx.date || "نامشخص"
      if (!groups[date]) groups[date] = []
      groups[date].push(tx)
    })
    return groups
  }

  // --- 🔥 نسخه نهایی: ثبت سند تجمیعی (روزانه) 🔥 ---
  // --- 🔥 نسخه اصلاح شده و نهایی handleConfirm 🔥 ---
  // --- 🔥 نسخه نهایی و اصلاح شده handleConfirm 🔥 ---
  // --- 🔥 نسخه نهایی و اصلاح شده handleConfirm 🔥 ---
  const handleConfirm = async (data: AIResult, fileUrls: string | string[]) => {
    const toastId = toast.loading("در حال ثبت اسناد در سیستم مالی...")
    const mainUrl = Array.isArray(fileUrls) ? fileUrls[0] : fileUrls
    const hostBankDL = data.dl_code
    // 1. گروه‌بندی تراکنش‌ها
    const groups = groupTransactionsByDate(data.transactions)

    // 2. آماده‌سازی پیلود
    const groupedPayload = Object.keys(groups).map(date => ({
      date,
      transactions: groups[date],
      fileUrl: mainUrl
    }))

    // 3. ذخیره اولیه (اینجا چک تکراری بودن فایل انجام می‌شود)
    // نتیجه این تابع می‌تواند تعداد رکوردهای جدید را برگرداند
    const dbResult = await submitGroupedTransactions(
      workspaceId,
      groupedPayload
    )

    // اگر هیچ رکوردی اینزرت نشد (count صفر بود)، یعنی احتمالاً همه تکراری بوده‌اند
    // اما ما فعلاً فرآیند را ادامه می‌دهیم تا submitDayComplete وضعیت دقیق را مشخص کند

    let totalSuccessDocs = 0

    // 4. پردازش روز به روز
    for (const date of Object.keys(groups)) {
      const res = await submitDayComplete(date, workspaceId, hostBankDL || null)

      // --- بررسی نتیجه واریز (Deposit) ---
      if (res.deposit) {
        const isSuccess = res.deposit.success
        // تشخیص تکراری بودن: اگر ارور شامل کلمات خاصی بود (بسته به خروجی سرور شما)
        // فعلاً فرض می‌کنیم اگر موفق نبود و ارور داشت، ممکن است تکراری یا خطا باشد
        // یک منطق ساده: اگر ارور "یافت نشد" باشد یعنی قبلا ثبت شده یا وجود ندارد
        const isDuplicate =
          res.deposit.error && res.deposit.error.includes("یافت نشد")

        const status = isSuccess
          ? "success"
          : isDuplicate
            ? "duplicate"
            : "error"

        if (isSuccess) totalSuccessDocs++

        setMessages(prev => [
          ...prev,
          {
            id: `receipt-dep-${Date.now()}`,
            role: "voucher-receipt",
            voucherData: {
              status: status, // ✅ ارسال وضعیت به کامپوننت
              docId: res.deposit.docId || "---",
              partyName: isSuccess ? "تراکنش‌های واریزی" : "ثبت ناموفق",
              slCode: "بستانکاران (211002)",
              amount: res.deposit.totalAmount || 0,
              date: date,
              description: isSuccess
                ? `سند تجمیعی واریز وجه (شماره ${res.deposit.docId})`
                : res.deposit.error || "خطای ناشناخته در ثبت"
            }
          }
        ])
      }

      // --- بررسی نتیجه برداشت (Withdrawal) ---
      if (res.withdrawal) {
        const isSuccess = res.withdrawal.success
        // منطق تشخیص خطا یا تکراری
        const isDuplicate =
          res.withdrawal.error && res.withdrawal.error.includes("یافت نشد")

        const status = isSuccess
          ? "success"
          : isDuplicate
            ? "duplicate"
            : "error"

        if (isSuccess) totalSuccessDocs++

        setMessages(prev => [
          ...prev,
          {
            id: `receipt-wd-${Date.now()}`,
            role: "voucher-receipt",
            voucherData: {
              status: status, // ✅ ارسال وضعیت
              docId: res.withdrawal.docId || "---",
              partyName: isSuccess ? "تراکنش‌های برداشتی" : "ثبت ناموفق",
              slCode: "پیش‌پرداخت (111901)",
              amount: res.withdrawal.totalAmount || 0,
              date: date,
              description: isSuccess
                ? `سند تجمیعی برداشت وجه (شماره ${res.withdrawal.docId})`
                : res.withdrawal.error || "خطای ناشناخته در ثبت"
            }
          }
        ])
      }
    }

    toast.dismiss(toastId)

    if (totalSuccessDocs > 0) {
      toast.success(`${totalSuccessDocs} سند حسابداری با موفقیت صادر شد!`)
      setMessages(prev =>
        prev.map(m =>
          m.role === "ai-result" ? { ...m, isSubmitted: true } : m
        )
      )
    } else {
      toast.warning("عملیات به پایان رسید اما سندی صادر نشد (بررسی کنید).")
    }
  }
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-gray-50 font-sans">
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"
        onLoad={() => {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"
          setPdfLibLoaded(true)
        }}
      />

      <header className="fixed inset-x-0 top-0 z-50 flex items-center justify-between border-b border-gray-200 bg-white/80 p-4 shadow-sm backdrop-blur-xl md:px-6">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <h1 className="flex items-center gap-2 text-sm font-bold text-gray-800 md:text-base">
              دستیار هوشمند مالی
            </h1>
            <span className="flex items-center gap-1 text-[10px] font-medium text-green-600 md:text-[11px]">
              <span className="size-1.5 animate-pulse rounded-full bg-green-50" />
              متصل به راهکاران
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="hidden rounded-xl border-gray-200 bg-white text-gray-700 shadow-sm transition-colors hover:bg-gray-50 sm:flex"
            onClick={() =>
              router.push(`/enterprise/${workspaceId}/finance/documents`)
            }
          >
            <FiPieChart className="mr-2 text-gray-500" /> مشاهده گزارشات
          </Button>
        </div>
      </header>

      <div className="h-20 shrink-0" />

      <div className="scrollbar-hide mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-4 pb-32 sm:px-0">
        {messages.length === 1 && (
          <div className="pointer-events-none flex h-[50vh] select-none flex-col items-center justify-center text-center opacity-60">
            <div className="mb-6 flex size-24 animate-pulse items-center justify-center rounded-full bg-gray-100">
              <FiUploadCloud size={40} className="text-gray-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-700">
              سند خود را آپلود کنید
            </h2>
            <p className="mt-2 max-w-xs text-sm text-gray-500">
              فایل PDF یا تصویر صورتحساب بانکی را بکشید و رها کنید.
            </p>
          </div>
        )}

        <div className="space-y-6 pt-4">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex w-full ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
            >
              {/* --- پیام سیستم --- */}
              {msg.role === "system" && (
                <div className="flex max-w-[90%] items-start gap-3 sm:max-w-[80%]">
                  <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-blue-600">
                    <FiCpu size={16} />
                  </div>
                  <div className="whitespace-pre-wrap rounded-2xl rounded-tr-none border border-gray-100 bg-white p-4 text-sm leading-7 text-gray-700 shadow-sm">
                    {msg.content}
                  </div>
                </div>
              )}

              {/* --- پیام کاربر (فایل آپلودی) --- */}
              {msg.role === "user" && (
                <div className="flex max-w-[85%] items-end gap-2">
                  <div className="rounded-2xl rounded-br-none bg-[#3b82f6] p-3 text-white shadow-lg shadow-blue-500/20">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-white/20 p-2">
                        <FiFile className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="max-w-[150px] truncate text-xs font-bold">
                          {msg.content}
                        </p>
                        <p className="font-mono text-[10px] uppercase opacity-80">
                          {msg.fileType?.split("/")[1] || "FILE"}
                        </p>
                      </div>
                    </div>
                    {/* ... (بخش نمایش تصاویر بندانگشتی) ... */}
                    {/* کد قبلی شما برای progress bar و ... اینجا محفوظ است */}
                  </div>
                  <div className="flex size-6 items-center justify-center rounded-full bg-gray-200 text-[10px] text-gray-500">
                    <FiUser />
                  </div>
                </div>
              )}

              {/* --- نتیجه هوش مصنوعی (لیست تراکنش‌ها) --- */}
              {msg.role === "ai-result" && msg.data && (
                <div className="mr-11 w-full max-w-lg">
                  <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl shadow-gray-200/50">
                    {/* ... (همان کد قبلی برای نمایش لیست تراکنش‌ها) ... */}
                    <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 p-4">
                      <div>
                        <h3 className="text-sm font-bold text-gray-800">
                          {msg.data.bank_name || "صورتحساب شناسایی شده"}
                        </h3>
                        <p className="mt-0.5 font-mono text-[11px] tracking-wide text-gray-500">
                          {msg.data.account_number}
                        </p>
                      </div>
                    </div>

                    <div className="scrollbar-thin scrollbar-thumb-gray-200 max-h-[350px] overflow-y-auto">
                      {Object.entries(
                        groupTransactionsByDate(msg.data.transactions)
                      ).map(([date, txs]) => (
                        <div key={date}>
                          <div className="sticky top-0 z-10 flex items-center gap-1.5 border-b border-gray-50 bg-white/95 px-4 py-2 text-[11px] font-bold text-gray-500 backdrop-blur-sm">
                            <FiCalendar size={12} /> {date}
                          </div>
                          {txs.map((tx, idx) => (
                            <div
                              key={idx}
                              className="flex justify-between border-b border-gray-50 p-3 text-xs"
                            >
                              <span>{tx.description}</span>
                              <span className="font-mono font-bold">
                                {Number(tx.amount).toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>

                    <div
                      className={`flex items-center justify-center border-t border-gray-100 p-3 transition-colors ${msg.isSubmitted ? "bg-green-50" : "bg-gray-50"}`}
                    >
                      {msg.isSubmitted ? (
                        <span className="flex items-center gap-2 text-xs font-bold text-green-600">
                          <FiCheckCircle className="size-4" />
                          ثبت نهایی انجام شد
                        </span>
                      ) : (
                        <span className="flex animate-pulse items-center gap-2 text-xs font-medium text-blue-600">
                          <Loader2 className="size-4 animate-spin" />
                          در حال ثبت اتوماتیک در راهکاران...
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* --- ✅ رسید دیجیتال (بخش جدید) --- */}
              {msg.role === "voucher-receipt" && msg.voucherData && (
                <div className="animate-in zoom-in-95 mr-11 w-full max-w-md duration-500">
                  <VoucherSuccessReceipt
                    {...msg.voucherData}
                    onClose={() => {
                      /* اختیاری: حذف رسید */
                    }}
                  />
                </div>
              )}
            </div>
          ))}

          {isAnalyzing && (
            <div className="flex animate-pulse justify-start pl-12">
              <div className="flex items-center gap-2 rounded-full border border-gray-100 bg-white px-4 py-2 text-xs text-gray-500 shadow-sm">
                <Loader2 className="size-3.5 animate-spin text-blue-600" />
                هوش مصنوعی در حال استخراج اطلاعات...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* --- Footer Input --- */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 p-4 sm:p-6">
        {/* کد اینپوت فایل شما بدون تغییر */}
        <div className="pointer-events-auto mx-auto flex max-w-3xl items-center gap-2 rounded-[2rem] border border-gray-100 bg-white p-2 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-xl">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*,application/pdf"
            className="hidden"
            aria-label="File Upload"
            title="File Upload"
          />
          <Button
            variant="ghost"
            size="icon"
            className="size-10 rounded-full"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || isAnalyzing}
          >
            <FiPaperclip size={20} className="text-gray-400" />
          </Button>
          <div
            className="flex h-10 flex-1 cursor-pointer items-center px-2"
            onClick={() => fileInputRef.current?.click()}
          >
            <span className="text-sm text-gray-400">
              تصویر یا PDF خود را اینجا آپلود کنید...
            </span>
          </div>
          <Button
            size="icon"
            className="size-10 rounded-full bg-blue-600 text-white"
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <FiSend className="size-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
