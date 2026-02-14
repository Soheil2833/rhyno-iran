"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  FiDatabase,
  FiPlus,
  FiTrash2,
  FiCheckCircle,
  FiLoader,
  FiRefreshCw
} from "react-icons/fi"
import { toast } from "sonner"

export default function ConnectionsPage({
  params
}: {
  params: { workspaceid: string }
}) {
  const [isLoading, setIsLoading] = useState(false)
  const [connections, setConnections] = useState<any[]>([])
  const [fetching, setFetching] = useState(true)
  const [dbType, setDbType] = useState("mssql")

  // ✅ استفاده از Ref برای دسترسی امن به فرم
  const formRef = useRef<HTMLFormElement>(null)

  const fetchConnections = useCallback(async () => {
    try {
      setFetching(true)
      const res = await fetch(
        `/api/bi/connections?workspaceId=${params.workspaceid}`
      )
      if (res.ok) {
        const data = await res.json()
        setConnections(data)
      }
    } catch (e) {
      console.error("Fetch error:", e)
    } finally {
      setFetching(false)
    }
  }, [params.workspaceid])

  useEffect(() => {
    fetchConnections()
  }, [fetchConnections])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)

    // جمع‌آوری اطلاعات فرم
    const formData = new FormData(e.currentTarget)
    const data: any = Object.fromEntries(formData.entries())

    data.workspaceId = params.workspaceid
    data.type = dbType

    try {
      // ۱. تست اتصال
      const testRes = await fetch("/api/bi/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      })

      const testResult = await testRes.json()
      if (!testRes.ok || !testResult.success) {
        throw new Error(testResult.error || "خطا در برقراری ارتباط")
      }

      toast.success("تست موفق بود. در حال ذخیره...")

      // ۲. ذخیره در دیتابیس
      const saveRes = await fetch("/api/bi/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      })

      if (!saveRes.ok) {
        throw new Error("خطا در ذخیره اطلاعات")
      }

      // ۳. موفقیت
      toast.success("اتصال با موفقیت ذخیره شد ✅")

      // ✅ ریست کردن امن فرم با Ref
      if (formRef.current) {
        formRef.current.reset()
      }
      setDbType("mssql")

      // آپدیت لیست
      await fetchConnections()
    } catch (error: any) {
      toast.error(error.message || "خطای نامشخص")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("آیا از حذف مطمئن هستید؟")) return
    const tid = toast.loading("در حال حذف...")
    try {
      const res = await fetch(`/api/bi/connections?id=${id}`, {
        method: "DELETE"
      })
      if (res.ok) {
        setConnections(prev => prev.filter(c => c.id !== id))
        toast.success("حذف شد", { id: tid })
      } else {
        throw new Error()
      }
    } catch {
      toast.error("خطا در حذف", { id: tid })
    }
  }

  return (
    <div className="font-vazir space-y-8 p-2">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">منابع داده</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchConnections}
          disabled={fetching}
        >
          <FiRefreshCw className={`mr-2 ${fetching ? "animate-spin" : ""}`} />
          بروزرسانی
        </Button>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        <Card className="border-blue-100 md:col-span-1 dark:border-blue-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FiPlus className="text-blue-600" /> افزودن دیتابیس
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* ✅ اتصال Ref به فرم */}
            <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>نوع دیتابیس</Label>
                <Select value={dbType} onValueChange={setDbType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mssql">SQL Server</SelectItem>
                    <SelectItem value="postgres">PostgreSQL</SelectItem>
                    <SelectItem value="mysql">MySQL</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>نام نمایشی</Label>
                <Input name="name" placeholder="مثال: انبار" required />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>Host</Label>
                  <Input
                    name="host"
                    placeholder="127.0.0.1"
                    className="dir-ltr"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Port</Label>
                  <Input
                    name="port"
                    placeholder="1433"
                    className="dir-ltr"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>User</Label>
                <Input
                  name="username"
                  placeholder="sa"
                  className="dir-ltr"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  name="password"
                  type="password"
                  className="dir-ltr"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Database</Label>
                <Input
                  name="database"
                  placeholder="master"
                  className="dir-ltr"
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={isLoading}
              >
                {isLoading ? "در حال پردازش..." : "اتصال و ذخیره"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FiDatabase /> لیست اتصال‌ها
            </CardTitle>
          </CardHeader>
          <CardContent>
            {fetching && connections.length === 0 ? (
              <div className="flex justify-center p-8">
                <FiLoader className="animate-spin text-blue-600" />
              </div>
            ) : connections.length === 0 ? (
              <div className="text-muted-foreground rounded-lg border-2 border-dashed p-10 text-center">
                هیچ دیتابیسی متصل نیست.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>نام</TableHead>
                    <TableHead>نوع</TableHead>
                    <TableHead className="text-left">آدرس</TableHead>
                    <TableHead className="text-left">دیتابیس</TableHead>
                    <TableHead className="text-center">وضعیت</TableHead>
                    <TableHead className="text-left"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {connections.map(c => (
                    <TableRow key={c.id}>
                      <TableCell>{c.name || "بدون نام"}</TableCell>
                      <TableCell className="font-bold text-blue-600">
                        {c.db_type}
                      </TableCell>
                      <TableCell className="text-left font-mono text-xs">
                        {c.host}:{c.port}
                      </TableCell>
                      <TableCell className="text-left font-mono text-xs">
                        {c.database_name}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className="border-green-200 bg-green-50 text-green-600"
                        >
                          فعال
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:bg-red-50"
                          onClick={() => handleDelete(c.id)}
                        >
                          <FiTrash2 />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
