"use server"

import { pool } from "@/lib/db"; // دیتابیس مستقیم شما


interface PaymentRequest {
  amount: number | string;
  // مقادیر واقعی که در خروجی دیتابیس دیدیم را اینجا بگذارید
  status: "paid" | "pending" | "approved" | "rejected" | "uploaded" | string; 
  assigned_user_id: string | null;
  created_at: string;
}


export async function getCeoFinancialStats(
  workspaceId: string,
  timeRange: string = "30_days"
) {
  try {
    // ۱. آماده‌سازی فیلتر زمان برای SQL
    let timeFilter = "";
    const params: any[] = [workspaceId];

    if (timeRange !== "all") {
      const date = new Date();
      if (timeRange === "30_days") date.setDate(date.getDate() - 30);
      if (timeRange === "7_days") date.setDate(date.getDate() - 7);
      
      timeFilter = `AND created_at >= $2`;
      params.push(date.toISOString());
    }

    // ۲. دریافت داده‌های مالی از جدول payment_requests
    // از pool.query برای اجرای مستقیم دستورات SQL استفاده می‌کنیم
    const requestsQuery = `
      SELECT amount, status, assigned_user_id, created_at 
      FROM payment_requests 
      WHERE workspace_id = $1 ${timeFilter}
    `;
    
    const { rows } = await pool.query(
  requestsQuery,
  params
);

const requests = rows as PaymentRequest[];




    if (requests.length === 0) {
      return {
        success: true,
        data: { overview: { count: 0, amount: 0 }, officers: [] }
      };
    }

    // ۳. استخراج لیست کاربران منحصر‌به‌فرد برای دریافت پروفایل‌ها
    const userIds = Array.from(
      new Set(requests.map((r: any) => r.assigned_user_id).filter((id: any) => id))
    );

    // ۴. دریافت اطلاعات پروفایل‌ها از جدول profiles با SQL
    let profilesMap: Record<string, any> = {};

    if (userIds.length > 0) {
      // ساخت کوئری برای IN (id1, id2, ...)
      const profileRows = await pool.query(
        `SELECT user_id, display_name FROM profiles WHERE user_id = ANY($1)`,
        [userIds]
      );

      profileRows.rows.forEach((p: any) => {
        profilesMap[p.user_id] = p;
      });
    }

    // ۵. محاسبات آماری (منطق کد خودتان)
    const totalCount = requests.length;
   const totalAmount = requests.reduce(
  (sum, r) => sum + (Number(r.amount) || 0),
  0
);



    const officerMap = new Map<string, any>();

    requests.forEach((r: any) => {
      const officerId = r.assigned_user_id || "unassigned";
      let officerName = "تخصیص نیافته";

      if (officerId !== "unassigned") {
        const profile = profilesMap[officerId];
        officerName = profile?.display_name || `کاربر ${officerId.substring(0, 4)}...`;
      }

      if (!officerMap.has(officerId)) {
        officerMap.set(officerId, {
          name: officerName,
          total: 0,
          completed: 0,
          open: 0
        });
      }

      const stats = officerMap.get(officerId)!;
      stats.total += 1;

     if (r.status === "paid") { 
    stats.completed += 1;
  } else {
    stats.open += 1;
  }
});

    // ۶. خروجی نهایی
    const officerStats = Array.from(officerMap.values()).map(s => ({
      ...s,
      completionRate: s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0,
      remainingRate: s.total > 0 ? 100 - Math.round((s.completed / s.total) * 100) : 0
    }));

    return {
      success: true,
      data: {
        overview: { count: totalCount, amount: totalAmount },
        officers: officerStats
      }
    };

  } catch (error: any) {
    console.error("CEO Stats Error:", error);
    return { success: false, error: error.message };
  }
}