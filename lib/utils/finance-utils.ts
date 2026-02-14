import DateObject from "react-date-object"
import persian from "react-date-object/calendars/persian"
import gregorian from "react-date-object/calendars/gregorian"

// اضافه کردن export برای دسترسی در سایر فایل‌ها
export async function withRetry<T>(
    fn: () => Promise<T>,
    retries = 3,
    delay = 1000
): Promise<T> {
    try {
        return await fn()
    } catch (error) {
        if (retries <= 0) throw error
        console.warn(`⚠️ Retrying... attempts left: ${retries}`)
        await new Promise(res => setTimeout(res, delay))
        return withRetry(fn, retries - 1, delay)
    }
}

export function toEnglishDigits(str: string) {
    if (!str) return ""
    return str
        .toString()
        .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d).toString())
        .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
}

export function getSafeDate(inputDate: string | undefined): string {
    const today = new Date().toISOString().split("T")[0]
    if (!inputDate) return today

    try {
        let cleanStr = toEnglishDigits(inputDate).replace(/\//g, "-")
        const parts = cleanStr.split("-")
        const yearPart = parseInt(parts[0])

        if (yearPart >= 1300 && yearPart <= 1500) {
            const dateObj = new DateObject({
                date: cleanStr,
                format: "YYYY-MM-DD",
                calendar: persian
            })
            if (dateObj.isValid) {
                return dateObj.convert(gregorian).format("YYYY-MM-DD")
            }
        }

        if (yearPart > 1900 && yearPart < 2100) {
            return cleanStr
        }
    } catch (e) {
        console.error("Date Parse Error:", e)
    }
    return today
}

export function sanitizeSql(text: string | null): string {
    if (!text) return ""
    return text.replace(/'/g, "''")
}