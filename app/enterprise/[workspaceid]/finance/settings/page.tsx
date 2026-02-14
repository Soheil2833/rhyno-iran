// فایل: D:\rhyno-site\rhyno\app\enterprise\[workspaceid]\finance\settings\page.tsx

import { CustomerMappingUpload } from "@/components/CustomerMappingUpload" // مسیر را چک کنید

export default function SettingsPage({
  params
}: {
  params: { workspaceid: string }
}) {
  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">تنظیمات مالی</h1>

      {/* استفاده از کامپوننت ایمپورت شده */}
      <CustomerMappingUpload workspaceId={params.workspaceid} />
    </div>
  )
}
