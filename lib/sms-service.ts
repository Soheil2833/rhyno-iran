// lib/sms-service.ts

const SMS_API_KEY = process.env.SMSIR_API_KEY

// 📌 ۱. شناسه قالب‌ها (Template IDs)
// قالبی که ساختید: "لطفا نسبت به اخذ فاکتور #SUPPLIER# اقدامات لازم را مبذول فرمایید."
const TEMPLATE_ID_ASSIGNMENT = 615139

// اگر برای "تکمیل" یا "یادآوری" هم قالب ساختید، آیدی آن‌ها را اینجا بگذارید
// فعلاً اگر ندارید، صفر بگذارید تا ارسال نشود
const TEMPLATE_ID_COMPLETION = 0
const TEMPLATE_ID_REMINDER = 734950

// 📌 تابع کمکی برای استانداردسازی شماره موبایل
const toE164 = (phone: string) => {
  if (!phone) return ""
  if (phone.startsWith("0")) {
    return `+98${phone.slice(1)}`
  }
  if (!phone.startsWith("+")) {
    return `+98${phone}`
  }
  return phone
}

// 📌 تابع اصلی ارسال سریع (Verify)
async function sendSmsVerify(
  phone: string,
  templateId: number,
  parameters: { name: string; value: string }[]
) {
  if (!SMS_API_KEY) {
    console.error("❌ SMSIR_API_KEY is missing in .env")
    return { success: false, error: "API Key missing" }
  }

  if (!templateId || templateId === 0) {
    console.warn("⚠️ Template ID is not defined, skipping SMS.")
    return { success: false, error: "No Template ID" }
  }

  const phoneE164 = toE164(phone)

  try {
    const response = await fetch("https://api.sms.ir/v1/send/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": SMS_API_KEY
      },
      body: JSON.stringify({
        mobile: phoneE164,
        templateId: templateId,
        parameters: parameters
      })
    })

    const result = await response.json()

    if (result.status === 1) {
      console.log(
        `✅ Verify SMS sent to ${phoneE164} (Template: ${templateId})`
      )
      return { success: true, data: result }
    } else {
      console.error(`❌ SMS API Error: ${result.message}`, result)
      return { success: false, error: result.message }
    }
  } catch (error: any) {
    console.error("❌ Network Error sending SMS:", error)
    return { success: false, error: error.message }
  }
}

// ------------------------------------------------------------------
// توابع فراخوانی کننده
// ------------------------------------------------------------------

// ۱. پیامک تخصیص کار (استفاده از قالب شما)
export async function sendAssignmentSMS(phone: string, supplierName: string) {
  return sendSmsVerify(phone, TEMPLATE_ID_ASSIGNMENT, [
    { name: "SUPPLIER", value: supplierName } // مقدار متغیر #SUPPLIER#
  ])
}

// ۲. پیامک تکمیل کار (نیاز به ساخت قالب جدید دارید)
export async function sendCompletionSMS(phone: string, supplierName: string) {
  // مثال قالب پیشنهادی: "پرونده پرداخت #SUPPLIER# تکمیل شد."
  return sendSmsVerify(phone, TEMPLATE_ID_COMPLETION, [
    { name: "SUPPLIER", value: supplierName }
  ])
}

// ۳. پیامک یادآوری (نیاز به ساخت قالب جدید دارید)
export async function sendReminderSMS(
  phone: string,
  supplierName: string,
  daysPassed: string
) {
  return sendSmsVerify(phone, TEMPLATE_ID_REMINDER, [
    { name: "SUPPLIER", value: supplierName },
    { name: "DATE", value: daysPassed } // ✅ مقدار متغیر #DATE#
  ])
}

// تابع عمومی (بلااستفاده در حالت Verify مگر اینکه لاجیک خاصی بخواهید)
export async function sendSMS(phone: string, text: string) {
  console.warn("⚠️ sendSMS (custom text) is not supported in Verify mode.")
  return { success: false }
}
