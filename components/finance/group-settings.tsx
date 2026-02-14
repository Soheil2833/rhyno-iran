"use client"

import { useState, useEffect } from "react"
// import { supabase } from "@/lib/supabase/browser-client"
// import { uploadCustomerExcel } from "@/app/actions/mapping-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { toast } from "sonner"
import {
  Loader2,
  UploadCloud,
  FileSpreadsheet,
  Search,
  UserCheck
} from "lucide-react"

export function GroupSettings({
  workspaceId,
  workspaceUsers
}: {
  workspaceId: string
  workspaceUsers: any[]
}) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const [officers, setOfficers] = useState<string[]>([])
  const [selectedOfficer, setSelectedOfficer] = useState<string | null>(null)
  const [customers, setCustomers] = useState<string[]>([])
  const [loadingList, setLoadingList] = useState(false)

  useEffect(() => {
    fetchOfficers()
  }, [workspaceId])

  useEffect(() => {
    if (selectedOfficer) {
      fetchCustomers(selectedOfficer)
    } else {
      setCustomers([])
    }
  }, [selectedOfficer])

  const fetchOfficers = async () => {
    // const { data } = await supabase
    //   .from("customer_mappings")
    //   .select("officer_email")
    //   .eq("workspace_id", workspaceId)

    // if (data) {
    //   const emails = data
    //     .map((d: { officer_email: string }) => d.officer_email)
    //     .filter(Boolean)
    //   const uniqueOfficers = Array.from(new Set(emails))
    //   setOfficers(uniqueOfficers)
    // }
  }

  const fetchCustomers = async (officerEmail: string) => {
    setLoadingList(true)
    // const { data } = await supabase
    //   .from("customer_mappings")
    //   .select("customer_name")
    //   .eq("workspace_id", workspaceId)
    //   .eq("officer_email", officerEmail)

    // setLoadingList(false)
    // if (data) {
    //   setCustomers(data.map((d: { customer_name: string }) => d.customer_name))
    // }
  }

  const handleUpload = async () => {
    if (!file) return toast.error("لطفا فایل اکسل را انتخاب کنید")
    setUploading(true)

    const formData = new FormData()
    formData.append("file", file)

    // const res = await uploadCustomerExcel(workspaceId, formData)
    // setUploading(false)

    // if (res.success) {
    //   toast.success(
    //     `✅ ${res.count} مشتری با موفقیت ایمپورت و تخصیص داده شدند!`
    //   )
    //   setFile(null)
    //   const fileInput = document.getElementById(
    //     "excel-upload"
    //   ) as HTMLInputElement
    //   if (fileInput) fileInput.value = ""
    //   fetchOfficers()
    // } else {
    //   toast.error(`خطا: ${res.error}`)
    // }
  }

  return (
    <div className="grid gap-6 text-gray-900 md:grid-cols-2">
      {/* کارت ۱: آپلود اکسل */}
      <Card className="h-fit border-t-4 border-t-blue-600 bg-white text-gray-900 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-gray-900">
            <FileSpreadsheet className="size-5 text-blue-600" />
            بارگذاری فایل اکسل مشتریان
          </CardTitle>
          <CardDescription className="text-gray-500">
            فایل اکسل شامل ستون‌های <b>Customer</b> (مشتری)، <b>Officer</b>{" "}
            (ایمیل) و <b>Mobile</b> (موبایل - اختیاری) را آپلود کنید.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Input
              id="excel-upload"
              type="file"
              accept=".xlsx, .xls, .csv"
              className="cursor-pointer border-gray-300 bg-white text-gray-900 file:text-blue-600"
              onChange={e => setFile(e.target.files?.[0] || null)}
            />
          </div>
          <Button
            onClick={handleUpload}
            disabled={uploading || !file}
            className="w-full bg-blue-600 text-white hover:bg-blue-700"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" /> در حال پردازش
                اکسل...
              </>
            ) : (
              <>
                <UploadCloud className="mr-2 size-4" /> پردازش و تخصیص خودکار
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* کارت ۲: مشاهده لیست */}
      <Card className="h-fit border-t-4 border-t-green-600 bg-white text-gray-900 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-gray-900">
            <UserCheck className="size-5 text-green-600" />
            بررسی مشتریان هر مسئول
          </CardTitle>
          <CardDescription className="text-gray-500">
            برای اطمینان از صحت فایل آپلود شده، یک مسئول را انتخاب کنید.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-700">
              انتخاب مسئول پیگیری:
            </label>

            <Select
              onValueChange={setSelectedOfficer}
              value={selectedOfficer || ""}
            >
              <SelectTrigger className="w-full border-gray-300 bg-white text-gray-900">
                <SelectValue placeholder="یک مسئول را انتخاب کنید..." />
              </SelectTrigger>
              <SelectContent className="border-gray-200 bg-white text-gray-900">
                {officers.length === 0 ? (
                  <div className="p-2 text-center text-xs text-gray-400">
                    هیچ مسئولی یافت نشد
                  </div>
                ) : (
                  officers.map(email => (
                    <SelectItem
                      key={email}
                      value={email}
                      className="cursor-pointer text-gray-900 hover:bg-gray-100 focus:bg-gray-100 focus:text-gray-900"
                    >
                      {email}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="min-h-[150px] rounded-md border border-gray-200 bg-gray-50 p-4">
            {loadingList ? (
              <div className="flex h-full items-center justify-center text-gray-500">
                <Loader2 className="mr-2 size-5 animate-spin" /> در حال دریافت
                لیست...
              </div>
            ) : !selectedOfficer ? (
              <div className="flex h-full flex-col items-center justify-center text-gray-400">
                <Search className="mb-2 size-8 opacity-20" />
                <p className="text-xs">
                  لطفا یک مسئول را از لیست بالا انتخاب کنید.
                </p>
              </div>
            ) : customers.length === 0 ? (
              <div className="text-center text-sm text-gray-500">
                هیچ مشتری‌ای برای این مسئول یافت نشد.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-800">
                    لیست مشتریان ({customers.length} مورد):
                  </span>
                </div>
                <div className="flex max-h-[300px] flex-wrap gap-2 overflow-y-auto pr-1">
                  {customers.map((customer, idx) => (
                    // استفاده از تگ span معمولی با استایل روشن
                    <span
                      key={idx}
                      className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-black shadow-sm"
                    >
                      {customer}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
