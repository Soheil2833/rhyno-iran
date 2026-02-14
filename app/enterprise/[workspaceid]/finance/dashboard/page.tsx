import { pool } from "@/lib/db" // اتصال به دیتابیس آروان
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import UnspecifiedList, { UnspecifiedItem } from "./UnspecifiedList"
import { getRahkaranSLs, getRahkaranDLs } from "@/app/actions/finance-actions"

export default async function ManagerDashboard({
  params
}: {
  params: { workspaceid: string }
}) {
  
  // ۱. دریافت همزمان لیست معین‌ها و تفصیلی‌ها (Server-Side)
  const [slAccounts, dlAccounts] = await Promise.all([
    getRahkaranSLs(),
    getRahkaranDLs()
  ])

  try {
    // ۲. اجرای کوئری‌های دیتابیس به صورت همزمان برای سرعت بالا
    const [unspecifiedRes, statsRes, recentRes] = await Promise.all([
      // الف: اسناد نامشخص
      pool.query(
        "SELECT * FROM payment_requests WHERE status = $1 AND workspace_id = $2 ORDER BY created_at ASC",
        ["unspecified", params.workspaceid]
      ),
      // ب: دریافت تعداد پرونده‌های باز و تکمیل شده در یک کوئری
      pool.query(
        `SELECT 
          COUNT(*) FILTER (WHERE status = 'pending_docs') as pending_count,
          COUNT(*) FILTER (WHERE status = 'completed') as completed_count
         FROM payment_requests WHERE workspace_id = $1`,
        [params.workspaceid]
      ),
      // ج: ۵ تراکنش اخیر (تاریخچه)
      pool.query(
        `SELECT * FROM payment_requests 
         WHERE workspace_id = $1 AND status != 'unspecified' 
         ORDER BY created_at DESC LIMIT 5`,
        [params.workspaceid]
      )
    ]);

    const unspecifiedItems = unspecifiedRes.rows;
    const { pending_count, completed_count } = statsRes.rows[0];
    const recent = recentRes.rows;

    // محاسبه درصد عملکرد
    const pendingCountNum = parseInt(pending_count) || 0;
    const completedCountNum = parseInt(completed_count) || 0;
    const total = pendingCountNum + completedCountNum;
    const performance = total > 0 ? ((completedCountNum / total) * 100).toFixed(0) : 0;

    return (
      <div className="min-h-screen space-y-8 bg-gray-50 p-8 text-gray-900">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-slate-800">داشبورد مدیریت مالی</h1>
          {unspecifiedItems.length > 0 && (
            <span className="animate-pulse rounded-full border border-red-200 bg-red-100 px-3 py-1 text-sm font-bold text-red-800">
              {unspecifiedItems.length} سند نیاز به تعیین تکلیف دارد
            </span>
          )}
        </div>

        {/* بخش کارتابل تعیین تکلیف */}
        <Card className="border-orange-200 bg-white shadow-md">
          <CardHeader className="border-b border-orange-100 bg-orange-50 pb-4">
            <CardTitle className="flex items-center gap-2 text-lg text-orange-700">
              ⚠️ اسناد نامشخص (نیاز به اقدام مدیر)
            </CardTitle>
            <p className="text-sm text-gray-500">
              لطفاً برای اسناد زیر، سرفصل حسابداری و طرف حساب را مشخص کنید.
            </p>
          </CardHeader>
          <CardContent className="pt-6">
            <UnspecifiedList
              items={unspecifiedItems as unknown as UnspecifiedItem[]}
              slAccounts={slAccounts}
              dlAccounts={dlAccounts}
              workspaceId={params.workspaceid}
            />
          </CardContent>
        </Card>

        {/* بخش آمارها */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Card className="bg-white border-none shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">پرونده‌های باز</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-gray-700">{pendingCountNum}</div>
            </CardContent>
          </Card>
          <Card className="bg-white border-none shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">تکمیل شده</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-green-600">{completedCountNum}</div>
            </CardContent>
          </Card>
          <Card className="bg-white border-none shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">عملکرد</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-blue-600">٪{performance}</div>
            </CardContent>
          </Card>
        </div>

        {/* بخش تاریخچه */}
        <Card className="bg-white border-none shadow-sm text-gray-900">
          <CardHeader className="border-b border-gray-50">
            <CardTitle className="text-xl">تاریخچه واریزی‌های اخیر</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-b text-gray-400">
                  <th className="pb-3 font-medium">تامین کننده</th>
                  <th className="pb-3 font-medium">مبلغ</th>
                  <th className="pb-3 font-medium text-center">وضعیت</th>
                  <th className="pb-3 font-medium text-left">تاریخ</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((item: any) => (
                  <tr key={item.id} className="h-14 border-b last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="font-semibold text-slate-700">{item.supplier_name}</td>
                    <td className="text-slate-600 font-mono">
                      {Number(item.amount).toLocaleString()} <small className="text-gray-400">ریال</small>
                    </td>
                    <td className="text-center">
                      <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase
                        ${item.status === "completed" 
                          ? "bg-green-50 text-green-600 border border-green-100" 
                          : "bg-amber-50 text-amber-600 border border-amber-100"}`}>
                        {item.status === "completed" ? "تکمیل شده" : "در انتظار مدرک"}
                      </span>
                    </td>
                    <td className="text-left text-gray-400">
                      {item.created_at ? new Date(item.created_at).toLocaleDateString("fa-IR") : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    );
  } catch (error) {
    console.error("❌ Dashboard Load Error:", error);
    return <div className="p-10 text-center text-red-500">خطا در برقراری ارتباط با دیتابیس ابر آروان</div>;
  }
}