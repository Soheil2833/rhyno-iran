// app/(enterprise)/[workspaceid]/dashboard/page.tsx
"use client"

import { useState, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  LabelList
} from "recharts"
import {
  FiSearch,
  FiDatabase,
  FiPieChart,
  FiBarChart2,
  FiActivity,
  FiList,
  FiDownload,
  FiTrash2,
  FiPlus,
  FiEye,
  FiEyeOff,
  FiTrendingUp
} from "react-icons/fi"
import { toast } from "sonner"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"

const COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4"
]

// --- توابع کمکی ---
const toPersianNumber = (n: any) => {
  if (n === undefined || n === null) return "0"
  return Number(n).toLocaleString("fa-IR")
}

const toPersianDate = (dateString: string) => {
  try {
    // چک سخت‌گیرانه: آیا فرمت شبیه تاریخ استاندارد است؟ (YYYY-MM-DD)
    // اگر با 4 رقم شروع نشود، تاریخ نیست (پس نام مشتری خراب نمیشه)
    if (!/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(dateString)) {
      return dateString
    }

    const date = new Date(dateString)
    if (isNaN(date.getTime())) return dateString

    const hasDay = dateString.length > 7
    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "long"
    }
    if (hasDay) options.day = "numeric"

    return new Intl.DateTimeFormat("fa-IR", options).format(date)
  } catch (e) {
    return dateString
  }
}

const calculateTrend = (values: number[]) => {
  const n = values.length
  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumXX = 0
  for (let i = 0; i < n; i++) {
    sumX += i
    sumY += values[i]
    sumXY += i * values[i]
    sumXX += i * i
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n
  return (x: number) => slope * x + intercept
}

export default function DashboardPage({
  params
}: {
  params: { workspaceid: string }
}) {
  const [widgets, setWidgets] = useState([{ id: Date.now() }])

  const addWidget = () => {
    setWidgets([...widgets, { id: Date.now() }])
    setTimeout(
      () =>
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: "smooth"
        }),
      100
    )
  }

  const removeWidget = (id: number) => {
    if (widgets.length === 1) return toast.error("حداقل یک نمودار لازم است")
    setWidgets(widgets.filter(w => w.id !== id))
  }

  return (
    <div className="font-vazir min-h-screen space-y-8 bg-gray-50/30 p-4 dark:bg-[#0f1018]">
      <div className="flex flex-col justify-between gap-4 md:flex-row">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">
            گزارش‌ساز هوشمند
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            تحلیل داده‌ها، پیش‌بینی آینده و خروجی حرفه‌ای.
          </p>
        </div>
        <Button
          onClick={addWidget}
          className="gap-2 bg-blue-600 hover:bg-blue-700"
        >
          <FiPlus /> نمودار جدید
        </Button>
      </div>

      <div className="space-y-8">
        {widgets.map((widget, index) => (
          <BIWidget
            key={widget.id}
            id={widget.id}
            workspaceId={params.workspaceid}
            onRemove={() => removeWidget(widget.id)}
            index={index + 1}
          />
        ))}
      </div>
    </div>
  )
}

function BIWidget({ id, workspaceId, onRemove, index }: any) {
  const [query, setQuery] = useState("")
  const [originalData, setOriginalData] = useState<any[] | null>(null)
  const [displayData, setDisplayData] = useState<any[] | null>(null)
  const [sql, setSql] = useState("")
  const [showSql, setShowSql] = useState(false)
  const [loading, setLoading] = useState(false)
  const [chartType, setChartType] = useState("bar")
  const [hasForecast, setHasForecast] = useState(false)
  const widgetRef = useRef<HTMLDivElement>(null)

  const handleAskBI = async () => {
    if (!query.trim()) return
    setLoading(true)
    setOriginalData(null)
    setDisplayData(null)
    setHasForecast(false)
    setSql("")

    try {
      const res = await fetch("/api/bi/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: query, workspaceId })
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || "خطا در تحلیل")

      if (result.data.length === 0) {
        toast.warning("داده‌ای یافت نشد.")
      } else {
        setOriginalData(result.data)
        setDisplayData(result.data)
        setSql(result.sql)
        if (result.visualization) setChartType(result.visualization)
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleForecast = () => {
    if (!originalData || originalData.length < 2) {
      return toast.error("داده کافی برای پیش‌بینی وجود ندارد")
    }

    if (hasForecast) {
      setDisplayData(originalData)
      setHasForecast(false)
      return
    }

    const keys = Object.keys(originalData[0])
    // استفاده از منطق بهبود یافته انتخاب ستون‌ها که پایین‌تر تعریف شده
    const { xKey, yKey } = detectKeys(originalData)

    const values = originalData.map(d => Number(d[yKey]) || 0)
    const predictFn = calculateTrend(values)

    const forecastPoints = []
    const lastIndex = values.length
    let lastDate = new Date()
    const lastLabel = originalData[lastIndex - 1][xKey]

    // تشخیص تاریخ بودن
    const isDate =
      typeof lastLabel === "string" &&
      /^\d{4}[-/]\d{1,2}/.test(lastLabel) &&
      !isNaN(Date.parse(lastLabel))
    if (isDate) lastDate = new Date(lastLabel)

    for (let i = 0; i < 3; i++) {
      const nextVal = Math.max(0, Math.round(predictFn(lastIndex + i)))
      let nextLabel = `آینده ${i + 1}`

      if (isDate) {
        lastDate.setMonth(lastDate.getMonth() + 1)
        nextLabel = lastDate.toISOString().split("T")[0]
      }

      forecastPoints.push({
        [xKey]: nextLabel,
        [yKey]: nextVal,
        isForecast: true
      })
    }

    setDisplayData([...originalData, ...forecastPoints])
    setHasForecast(true)
    toast.success("پیش‌بینی انجام شد")
  }

  const handleDownloadPDF = async () => {
    if (!widgetRef.current) return
    const tid = toast.loading("ایجاد PDF...")
    try {
      const canvas = await html2canvas(widgetRef.current, {
        scale: 2,
        backgroundColor: document.documentElement.classList.contains("dark")
          ? "#18181b"
          : "#ffffff",
        ignoreElements: el => el.classList.contains("no-print")
      })
      const imgData = canvas.toDataURL("image/png")
      const pdf = new jsPDF("p", "mm", "a4")
      const pdfW = pdf.internal.pageSize.getWidth()
      const pdfH = (canvas.height * pdfW) / canvas.width
      pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH)
      pdf.save(`report-${id}.pdf`)
      toast.success("دانلود شد", { id: tid })
    } catch {
      toast.error("خطا در دانلود", { id: tid })
    }
  }

  // 🧠 تابع هوشمند تشخیص ستون‌ها
  const detectKeys = (data: any[]) => {
    if (!data || data.length === 0) return { xKey: "", yKey: "" }
    const keys = Object.keys(data[0]).filter(k => k !== "isForecast")

    // 1. پیدا کردن محور X (معمولا متن یا تاریخ)
    const xKey = keys.find(k => typeof data[0][k] === "string") || keys[0]

    // 2. پیدا کردن محور Y (حتما باید عدد باشد)
    // اولویت با ستون‌هایی است که اسمشان شبیه مقادیر مالی است
    const numberKeys = keys.filter(k => typeof data[0][k] === "number")

    let yKey = numberKeys[0]
    // اگر چند ستون عددی داشتیم، سعی کن اونی که اسمش معنی‌داره رو برداری
    const priorityKeywords = [
      "total",
      "sum",
      "amount",
      "balance",
      "price",
      "cost",
      "sale",
      "count",
      "value",
      "credit",
      "debit"
    ]
    const betterY = numberKeys.find(k =>
      priorityKeywords.some(pk => k.toLowerCase().includes(pk))
    )

    if (betterY) yKey = betterY
    // اگر yKey انتخاب شده همان xKey بود (در حالات خاص)، بعدی را بردار
    if (yKey === xKey && numberKeys.length > 1) {
      yKey = numberKeys.find(k => k !== xKey) || yKey
    }

    return { xKey, yKey }
  }

  const { formattedData, xKey, yKey, totalValue, avgValue } = useMemo(() => {
    if (!displayData || displayData.length === 0)
      return {
        formattedData: [],
        xKey: "",
        yKey: "",
        totalValue: 0,
        avgValue: 0
      }

    const { xKey, yKey } = detectKeys(displayData)

    const processedData = displayData.map(item => {
      const val = item[xKey]
      // ✅ شرط اصلاح شده: فقط اگر فرمت شبیه تاریخ (YYYY-MM-DD) بود تبدیل کن
      // این باعث میشه "Customer-1" دیگه تاریخ نشه
      const isDate =
        typeof val === "string" &&
        /^\d{4}[-/]\d{1,2}/.test(val) &&
        !isNaN(Date.parse(val))

      return {
        ...item,
        [xKey]: isDate ? toPersianDate(val) : val
      }
    })

    const realData = processedData.filter(d => !d.isForecast)
    // استفاده از yKey صحیح برای جمع زدن
    const total = realData.reduce(
      (acc, curr) => acc + (Number(curr[yKey]) || 0),
      0
    )
    const avg = total / (realData.length || 1)

    return {
      formattedData: processedData,
      xKey,
      yKey,
      totalValue: total,
      avgValue: avg
    }
  }, [displayData])

  const tooltipStyle = {
    backgroundColor: "#fff",
    color: "#000",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
    fontSize: "12px",
    textAlign: "right" as const
  }

  return (
    <div
      ref={widgetRef}
      className="relative rounded-3xl border border-gray-200 bg-white p-1 shadow-sm dark:border-gray-800 dark:bg-[#121212]"
    >
      <div className="flex items-center justify-between border-b px-4 py-3 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
            {index}
          </span>
          <span className="text-sm font-bold">
            {displayData ? `تحلیل: ${query}` : "بخش جدید"}
          </span>
        </div>

        <div className="no-print flex gap-2">
          {displayData && (
            <>
              <Button
                variant={hasForecast ? "secondary" : "ghost"}
                size="sm"
                onClick={handleForecast}
                className={
                  hasForecast
                    ? "bg-purple-100 text-purple-700 hover:bg-purple-200"
                    : "text-purple-600 hover:bg-purple-50"
                }
                title="پیش‌بینی آینده"
              >
                <FiTrendingUp className="mr-2" />
                {hasForecast ? "لغو" : "پیش‌بینی"}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSql(!showSql)}
                title="مشاهده کوئری"
              >
                {showSql ? <FiEyeOff /> : <FiEye />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDownloadPDF}
                title="دانلود PDF"
              >
                <FiDownload />
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="text-red-500 hover:bg-red-50"
          >
            <FiTrash2 />
          </Button>
        </div>
      </div>

      <div className="space-y-6 p-6">
        <div className="no-print flex gap-2">
          <div className="relative flex-1">
            <FiSearch className="absolute right-3 top-3.5 text-gray-400" />
            <Input
              className="h-12 pr-10"
              placeholder="سوال خود را بپرسید (مثال: جدول مانده حساب مشتریان)"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAskBI()}
            />
          </div>
          <Button
            className="h-12 px-6"
            onClick={handleAskBI}
            disabled={loading}
          >
            {loading ? "..." : "اجرا"}
          </Button>
        </div>

        {showSql && (
          <div className="dir-ltr mb-4 max-h-32 overflow-auto rounded-xl border border-gray-700 bg-gray-900 p-4 font-mono text-xs text-green-400 shadow-inner">
            {sql}
          </div>
        )}

        {displayData ? (
          <>
            <div className="grid grid-cols-3 gap-4">
              <Card className="border-none bg-blue-50 shadow-none dark:bg-blue-900/10">
                <CardContent className="p-4 text-center">
                  <p className="text-muted-foreground text-xs">
                    مجموع ({yKey})
                  </p>
                  <p className="text-lg font-bold text-blue-600">
                    {toPersianNumber(totalValue)}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-none bg-gray-50 shadow-none dark:bg-gray-800/50">
                <CardContent className="p-4 text-center">
                  <p className="text-muted-foreground text-xs">میانگین</p>
                  <p className="text-lg font-bold">
                    {toPersianNumber(Math.round(avgValue))}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-none bg-gray-50 shadow-none dark:bg-gray-800/50">
                <CardContent className="p-4 text-center">
                  <p className="text-muted-foreground text-xs">تعداد</p>
                  <p className="text-lg font-bold">
                    {toPersianNumber(originalData?.length)}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Tabs
              value={chartType}
              onValueChange={setChartType}
              className="space-y-4"
            >
              <div className="no-print flex justify-end">
                <TabsList className="h-9 bg-gray-100 dark:bg-gray-900">
                  <TabsTrigger value="bar" className="h-7 px-3">
                    <FiBarChart2 />
                  </TabsTrigger>
                  <TabsTrigger value="area" className="h-7 px-3">
                    <FiActivity />
                  </TabsTrigger>
                  <TabsTrigger value="pie" className="h-7 px-3">
                    <FiPieChart />
                  </TabsTrigger>
                  <TabsTrigger value="table" className="h-7 px-3">
                    <FiList />
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="h-[400px] w-full" dir="ltr">
                {chartType === "table" ? (
                  <div
                    className="size-full overflow-auto rounded-xl border bg-gray-50/50 p-0 dark:bg-black/20"
                    dir="rtl"
                  >
                    <table className="w-full border-collapse text-right text-base">
                      <thead className="sticky top-0 z-10 bg-gray-100 shadow-sm dark:bg-gray-900">
                        <tr>
                          {Object.keys(formattedData[0])
                            .filter(k => k !== "isForecast")
                            .map(k => (
                              <th
                                key={k}
                                className="border-b p-4 text-right font-bold text-gray-700 dark:border-gray-800 dark:text-gray-200"
                              >
                                {k}
                              </th>
                            ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-950">
                        {formattedData.map((row, i) => (
                          <tr
                            key={i}
                            className={`border-b transition-colors dark:border-gray-800 ${row.isForecast ? "bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20" : "hover:bg-blue-50 dark:hover:bg-blue-900/10"}`}
                          >
                            {Object.entries(row)
                              .filter(([k]) => k !== "isForecast")
                              .map(([k, v]: any, j) => (
                                <td
                                  key={j}
                                  className="p-4 text-right text-gray-800 dark:text-gray-300"
                                >
                                  {typeof v === "number"
                                    ? toPersianNumber(v)
                                    : v}
                                  {row.isForecast && j === 0 && (
                                    <span className="mr-2 rounded-full bg-purple-200 px-2 py-0.5 text-[10px] text-purple-800">
                                      پیش‌بینی
                                    </span>
                                  )}
                                </td>
                              ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    {chartType === "bar" ? (
                      <BarChart
                        data={formattedData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          opacity={0.1}
                          vertical={false}
                        />
                        <XAxis
                          dataKey={xKey}
                          tick={{ fontSize: 12, fill: "#888" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis axisLine={false} tickLine={false} />
                        <Tooltip
                          cursor={{ fill: "transparent" }}
                          contentStyle={tooltipStyle}
                          itemStyle={{ color: "#000" }}
                          formatter={(v: any) => toPersianNumber(v)}
                          labelFormatter={l => l}
                        />
                        <Bar dataKey={yKey} radius={[6, 6, 0, 0]}>
                          {formattedData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.isForecast ? "#a855f7" : "#3b82f6"}
                            />
                          ))}
                          <LabelList
                            dataKey={yKey}
                            position="top"
                            formatter={(v: any) => toPersianNumber(v)}
                            fill="#666"
                            fontSize={11}
                          />
                        </Bar>
                      </BarChart>
                    ) : chartType === "area" ? (
                      <AreaChart
                        data={formattedData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <defs>
                          <linearGradient
                            id={`grad${id}`}
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#10b981"
                              stopOpacity={0.8}
                            />
                            <stop
                              offset="95%"
                              stopColor="#10b981"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                        <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
                        <YAxis />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          itemStyle={{ color: "#000" }}
                          formatter={(v: any) => toPersianNumber(v)}
                        />
                        <Area
                          type="monotone"
                          dataKey={yKey}
                          stroke="#10b981"
                          fill={`url(#grad${id})`}
                        >
                          <LabelList
                            dataKey={yKey}
                            position="top"
                            formatter={(v: any) => toPersianNumber(v)}
                            fill="#666"
                            fontSize={11}
                          />
                        </Area>
                      </AreaChart>
                    ) : (
                      <PieChart>
                        <Pie
                          data={formattedData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={120}
                          paddingAngle={2}
                          dataKey={yKey}
                          nameKey={xKey}
                          label={({ name, percent }: any) =>
                            `${name} (${(percent * 100).toFixed(0)}%)`
                          }
                        >
                          {formattedData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={
                                entry.isForecast
                                  ? "#a855f7"
                                  : COLORS[index % COLORS.length]
                              }
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={tooltipStyle}
                          itemStyle={{ color: "#000" }}
                          formatter={(v: any) => toPersianNumber(v)}
                        />
                      </PieChart>
                    )}
                  </ResponsiveContainer>
                )}
              </div>
            </Tabs>
          </>
        ) : (
          <div className="flex h-[250px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-100 bg-gray-50/50 text-center dark:border-gray-800 dark:bg-black/20">
            <div className="mb-3 rounded-full bg-white p-3 shadow-sm dark:bg-gray-900">
              <FiDatabase className="size-6 text-gray-400" />
            </div>
            <p className="text-muted-foreground text-sm">
              سوال خود را بپرسید تا گزارش تولید شود.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
