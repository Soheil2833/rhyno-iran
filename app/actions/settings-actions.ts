"use server"

// import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import * as XLSX from "xlsx"
import { revalidatePath } from "next/cache"

// آپلود اکسل مشتریان
export async function uploadCustomerMapping(
  workspaceId: string,
  formData: FormData
) {
  const cookieStore = cookies()
  // const supabase = createClient(cookieStore)

  try {
    const file = formData.get("file") as File
    if (!file) throw new Error("فایلی انتخاب نشده است")

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const workbook = XLSX.read(buffer, { type: "buffer" })

    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json(sheet) as any[]

    if (jsonData.length === 0) throw new Error("فایل اکسل خالی است")

    // Mapping fields
    const records = jsonData
      .map(row => ({
        workspace_id: workspaceId,
        customer_name: row["مشتری"] || row["Customer"] || row["نام طرف حساب"],
        group_name: row["گروه"] || row["Group"] || "عمومی"
      }))
      .filter(r => r.customer_name)

    // Upsert to directory
    // const { error } = await supabase
    //   .from("customer_directory")
    //   .upsert(records, {
    //     onConflict: "workspace_id,customer_name"
    //   })

    // if (error) throw error

    revalidatePath(`/enterprise/${workspaceId}/finance/settings`)
    return { success: true, count: records.length }
  } catch (error: any) {
    console.error("Excel Upload Error:", error)
    return { success: false, error: error.message }
  }
}
