import { FinancialReportsClient } from "@/components/ceo/financial-reports-client"

export default function FinancialReportsPage({
  params
}: {
  params: { workspaceid: string }
}) {
  return (
    <div className="space-y-6">
      {/* کامپوننت کلاینت که نمودارها و فیلترها را هندل می‌کند */}
      <FinancialReportsClient workspaceId={params.workspaceid} />
    </div>
  )
}
