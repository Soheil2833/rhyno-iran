"use client"

import { useState, useEffect } from "react"
import { getCeoFinancialStats } from "@/app/actions/ceo-actions"
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
import { Progress } from "@/components/ui/progress"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts"
import { Loader2, DollarSign, FileText } from "lucide-react"

// رنگ‌های نمودار
const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"]

export function FinancialReportsClient({
  workspaceId
}: {
  workspaceId: string
}) {
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState("30_days")
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    fetchData()
  }, [timeRange])

  const fetchData = async () => {
    setLoading(true)
    const res = await getCeoFinancialStats(workspaceId, timeRange)
    if (res.success) {
      setData(res.data)
    }
    setLoading(false)
  }

  if (loading && !data) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* هدر و فیلتر */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            گزارش عملکرد مالی و تیم
          </h2>
          <p className="text-sm text-gray-500">
            تحلیل وضعیت پرداختی‌ها و کارایی مسئولین پیگیری
          </p>
        </div>
        <div className="w-[200px]">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="بازه زمانی" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7_days">۷ روز گذشته</SelectItem>
              <SelectItem value="30_days">۳۰ روز گذشته</SelectItem>
              <SelectItem value="all">تمام زمان‌ها</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* کارت‌های خلاصه */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              تعداد کل فیش‌ها
            </CardTitle>
            <FileText className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.overview.count.toLocaleString()}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              تراکنش ثبت شده در سیستم
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">جمع مبلغ کل</CardTitle>
            <DollarSign className="size-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.overview.amount.toLocaleString()}{" "}
              <span className="text-sm font-normal text-gray-500">ریال</span>
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              مجموع مبالغ برداشت شده
            </p>
          </CardContent>
        </Card>
      </div>

      {/* بخش نمودارها */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* نمودار میله‌ای عملکرد */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">
              مقایسه کارهای باز و بسته (به تفکیک مسئول)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.officers}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis />
                  <Tooltip
                    cursor={{ fill: "transparent" }}
                    contentStyle={{ borderRadius: "8px", direction: "rtl" }}
                  />
                  <Legend wrapperStyle={{ paddingTop: "10px" }} />
                  <Bar
                    dataKey="completed"
                    name="بسته شده (انجام شد)"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                    barSize={30}
                  />
                  <Bar
                    dataKey="open"
                    name="باز (در جریان)"
                    fill="#f59e0b"
                    radius={[4, 4, 0, 0]}
                    barSize={30}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* جدول جزئیات */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">جزئیات عملکرد تیمی</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">مسئول</TableHead>
                  <TableHead className="text-center">کل کارها</TableHead>
                  <TableHead className="text-center">وضعیت</TableHead>
                  <TableHead className="w-[100px] text-left">پیشرفت</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.officers.map((officer: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">
                      {officer.name}
                    </TableCell>
                    <TableCell className="text-center">
                      {officer.total}
                    </TableCell>
                    <TableCell className="space-y-1 text-center text-xs">
                      <div className="text-green-600">
                        {officer.completed} بسته
                      </div>
                      <div className="text-amber-600">{officer.open} باز</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-end text-xs font-bold">
                          {officer.completionRate}%
                        </span>
                        <Progress
                          value={officer.completionRate}
                          className="h-2"
                          color={
                            officer.completionRate === 100
                              ? "bg-green-500"
                              : "bg-blue-500"
                          }
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {data.officers.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-muted-foreground py-8 text-center"
                    >
                      هیچ داده‌ای برای نمایش وجود ندارد.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
