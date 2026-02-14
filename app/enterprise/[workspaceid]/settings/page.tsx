// app/enterprise/[workspaceid]/settings/page.tsx
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { FiSettings, FiSave, FiLoader } from "react-icons/fi"
import { toast } from "sonner"

export default function SettingsPage({
  params
}: {
  params: { workspaceid: string }
}) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState({ name: "", instructions: "" })

  // دریافت اطلاعات واقعی هنگام لود
  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch(
        `/api/bi/settings?workspaceId=${params.workspaceid}`
      )
      if (res.ok) {
        const ws = await res.json()
        setData({ name: ws.name || "", instructions: ws.instructions || "" })
      }
      setLoading(false)
    }
    fetchData()
  }, [params.workspaceid])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/bi/settings", {
        method: "POST",
        body: JSON.stringify({
          workspaceId: params.workspaceid,
          name: data.name,
          instructions: data.instructions
        })
      })
      if (!res.ok) throw new Error("خطا در ذخیره")
      toast.success("تغییرات با موفقیت ذخیره شد")
    } catch (e) {
      toast.error("مشکلی پیش آمد")
    } finally {
      setSaving(false)
    }
  }

  if (loading)
    return (
      <div className="flex justify-center p-10">
        <FiLoader className="animate-spin" />
      </div>
    )

  return (
    <div className="font-vazir max-w-4xl space-y-8 p-2">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">تنظیمات ورک‌اسپیس</h2>
        <p className="text-muted-foreground mt-1">مدیریت اطلاعات شرکت</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FiSettings /> مشخصات عمومی
          </CardTitle>
          <CardDescription>
            این نام در داشبورد و گزارش‌ها نمایش داده می‌شود.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label>نام تجاری شرکت</Label>
              <Input
                value={data.name}
                onChange={e => setData({ ...data, name: e.target.value })}
                placeholder="نام شرکت..."
              />
            </div>
            <div className="space-y-2">
              <Label>شناسه سیستم (ID)</Label>
              <Input
                disabled
                value={params.workspaceid}
                className="text-muted-foreground bg-gray-50 font-mono text-xs"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>توضیحات داخلی / ایمیل پشتیبانی</Label>
            <Input
              value={data.instructions}
              onChange={e => setData({ ...data, instructions: e.target.value })}
              placeholder="مثال: admin@company.com"
            />
          </div>

          <Separator />

          <div className="flex justify-end pt-4">
            <Button
              onClick={handleSave}
              className="gap-2 bg-blue-600 hover:bg-blue-700"
              disabled={saving}
            >
              {saving ? (
                "در حال ذخیره..."
              ) : (
                <>
                  <FiSave /> ذخیره تغییرات
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
