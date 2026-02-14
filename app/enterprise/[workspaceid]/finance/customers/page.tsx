import { GroupSettings } from "@/components/finance/group-settings"
import { Separator } from "@/components/ui/separator"

export default function FinanceCustomersPage({
  params
}: {
  params: { workspaceid: string }
}) {
  return (
    // ✅ تغییر: استفاده از bg-gray-50 (مات) و text-gray-900 (مشکی) برای اجبار تم روشن
    <div className="flex min-h-screen flex-col space-y-6 bg-gray-50 p-8 text-gray-900">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          {/* اطمینان از رنگ مشکی برای تیتر */}
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">
            مدیریت مشتریان و مسئولین
          </h2>
          <p className="text-sm text-gray-500">
            محل بارگذاری فایل اکسل مشتریان و مشاهده مسئولین تخصیص داده شده
          </p>
        </div>
      </div>

      {/* جداکننده با رنگ مشخص */}
      <Separator className="my-4 bg-gray-300" />

      {/* کامپوننت داخلی */}
      <GroupSettings workspaceId={params.workspaceid} workspaceUsers={[]} />
    </div>
  )
}
