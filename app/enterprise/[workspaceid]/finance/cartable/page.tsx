import { pool } from "@/lib/db" // اتصال به دیتابیس آروان
import { cookies } from "next/headers"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { UploadDocsForm } from "./upload-docs-form"
import { RequestNotes } from "@/components/finance/request-notes"

export default async function CartablePage({
  params
}: {
  params: { workspaceid: string }
}) {
  // ۱. دریافت شناسه کاربر از کوکی (که در مرحله لاگین ست کردیم)
  const cookieStore = await cookies()
  const userId = cookieStore.get("session_user_id")?.value

  if (!userId) return <div className="p-8 text-center">لطفا وارد شوید</div>

  // ۲. کوئری دریافت درخواست‌ها + یادداشت‌ها به صورت JSON (با استفاده از JSON_AGG)
  // این کوئری تمام اطلاعات درخواست و نوت‌های مربوطه را در یک مرحله دریافت می‌کند
  const query = `
    SELECT 
      pr.*,
      COALESCE(
        (
          SELECT json_agg(json_build_object(
            'id', rn.id,
            'content', rn.content,
            'created_at', rn.created_at,
            'user_id', rn.user_id,
            'display_name', u.full_name
          ) ORDER BY rn.created_at DESC)
          FROM request_notes rn
          LEFT JOIN public.users u ON rn.user_id = u.id
          WHERE rn.request_id = pr.id
        ), '[]'
      ) as request_notes
    FROM payment_requests pr
    WHERE pr.workspace_id = $1 
      AND pr.assigned_user_id = $2 
      AND pr.status = 'pending_docs'
    ORDER BY pr.created_at DESC
  `

  let requests: any[] = []
  try {
    const { rows } = await pool.query(query, [params.workspaceid, userId])
    requests = rows
  } catch (error) {
    console.error("❌ Database Error:", error)
    return <div className="p-8 text-red-500">خطا در دریافت اطلاعات دیتابیس</div>
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">کارتابل پیگیری من</h1>
        <Badge variant="secondary" className="px-4 py-1">
          تعداد موارد: {requests.length}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {requests.map(req => {
          // منطق محاسبات ددلاین (بدون تغییر نسبت به قبل)
          const deadline = req.deadline ? new Date(req.deadline) : null
          let deadlineText = "بدون مهلت تعیین شده"
          let isOverdue = false
          let diffHours = 0

          if (deadline) {
            const now = new Date()
            diffHours = Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60))
            isOverdue = diffHours < 0
            deadlineText = isOverdue
              ? `⚠️ مهلت تمام شده! (${Math.abs(diffHours)} ساعت تاخیر)`
              : `⏳ مهلت باقی‌مانده: ${diffHours} ساعت`
          }

          return (
            <Card
              key={req.id}
              className={`border-l-4 shadow-md ${req.ai_verification_status === "rejected" ? "border-l-red-500" : "border-l-orange-500"}`}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-lg">
                  <span>{req.supplier_name || "نامشخص"}</span>
                  {req.customer_group && (
                    <Badge variant="outline" className="text-xs">
                      {req.customer_group}
                    </Badge>
                  )}
                </CardTitle>
                <span className="text-xs text-gray-400">
                  {req.created_at ? new Date(req.created_at).toLocaleDateString("fa-IR") : "-"}
                </span>
              </CardHeader>
              <CardContent>
                <div className={`mb-3 rounded border p-2 text-center text-xs font-bold ${isOverdue ? "border-red-100 bg-red-50 text-red-600" : "border-blue-100 bg-blue-50 text-blue-600"}`}>
                  {deadlineText}
                </div>

                <div className="mb-4 space-y-2 rounded-md bg-gray-50 p-3 text-sm text-gray-600">
                  <p className="flex justify-between">
                    <span>مبلغ:</span>
                    <span className="font-bold">{Number(req.amount || 0).toLocaleString()} ریال</span>
                  </p>
                  <p className="flex justify-between">
                    <span>کد پیگیری:</span> <span>{req.tracking_code}</span>
                  </p>
                  <p className="text-xs text-gray-500">{req.description}</p>

                  {req.ai_verification_status === "rejected" && (
                    <div className="mt-2 rounded border border-red-100 bg-red-50 p-2 text-xs text-red-600">
                      🤖 <b>رد شده توسط هوش مصنوعی:</b><br />
                      {req.ai_verification_reason}
                    </div>
                  )}
                </div>

                <UploadDocsForm
                  requestId={req.id}
                  workspaceId={params.workspaceid}
                  currentAiStatus={req.ai_verification_status || undefined}
                />

                <RequestNotes
                  requestId={req.id}
                  notes={req.request_notes} // نوت‌ها به صورت آرایه JSON از کوئری می‌آیند
                />
              </CardContent>
            </Card>
          )
        })}

        {requests.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-24 text-gray-400">
            <p className="text-lg font-medium">سینی کارتابل شما خالی است! ✨</p>
            <p className="text-sm">موردی برای نمایش وجود ندارد.</p>
          </div>
        )}
      </div>
    </div>
  )
}