import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Users,
  Activity,
  Wallet
} from "lucide-react"

export default async function CeoDashboardPage() {
  // در اینجا می‌توانید داده‌های واقعی را از Supabase فچ کنید
  // const { data } = await supabase...

  return (
    <div className="space-y-8">
      {/* بخش خوش‌آمدگویی */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            نمای کلی سازمان
          </h2>
          <p className="mt-1 text-slate-500">
            خلاصه عملکرد شرکت در ۳۰ روز گذشته
          </p>
        </div>
        <div className="rounded-lg border bg-white px-4 py-2 text-sm text-gray-400 shadow-sm">
          آخرین بروزرسانی: همین الان
        </div>
      </div>

      {/* کارت‌های KPI */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="درآمد کل"
          value="۱۲,۵۰۰,۰۰۰,۰۰۰"
          unit="ریال"
          icon={<DollarSign className="size-4 text-emerald-600" />}
          trend="+۲۰.۱٪"
          trendUp={true}
        />
        <KpiCard
          title="هزینه‌های جاری"
          value="۴,۲۰۰,۰۰۰,۰۰۰"
          unit="ریال"
          icon={<Wallet className="size-4 text-red-600" />}
          trend="+۴٪"
          trendUp={false} // یعنی افزایش هزینه بد است (رنگ قرمز)
        />
        <KpiCard
          title="مشتریان فعال"
          value="+۵۷۳"
          unit="مشتری"
          icon={<Users className="size-4 text-blue-600" />}
          trend="+۱۲٪"
          trendUp={true}
        />
        <KpiCard
          title="بهره‌وری تیم"
          value="۹۴.۲٪"
          unit="KPI"
          icon={<Activity className="size-4 text-amber-600" />}
          trend="+۲.۴٪"
          trendUp={true}
        />
      </div>

      {/* بخش نمودارها و گزارشات (Placeholder) */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 border-0 bg-white shadow-sm">
          <CardHeader>
            <CardTitle>روند درآمدی (۶ ماه اخیر)</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="flex h-[200px] items-center justify-center rounded-md bg-gray-50 text-gray-400">
              [محل نمایش نمودار خطی درآمد]
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3 border-0 bg-white shadow-sm">
          <CardHeader>
            <CardTitle>فروش بر اساس دسته‌بندی</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-[200px] items-center justify-center rounded-md bg-gray-50 text-gray-400">
              [محل نمایش نمودار دایره‌ای]
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// کامپوننت کوچک برای کارت‌ها
function KpiCard({ title, value, unit, icon, trend, trendUp }: any) {
  return (
    <Card className="border-0 bg-white shadow-sm transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">
          {title}
        </CardTitle>
        <div className="rounded-full bg-slate-100 p-2">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-1 text-2xl font-bold text-slate-900">
          {value}{" "}
          <span className="text-xs font-normal text-slate-400">{unit}</span>
        </div>
        <p
          className={`mt-1 flex items-center text-xs ${trendUp ? "text-emerald-600" : "text-red-600"}`}
        >
          {trendUp ? (
            <ArrowUpRight className="mr-1 size-3" />
          ) : (
            <ArrowDownRight className="mr-1 size-3" />
          )}
          {trend} <span className="mr-1 text-slate-400">نسبت به ماه قبل</span>
        </p>
      </CardContent>
    </Card>
  )
}
