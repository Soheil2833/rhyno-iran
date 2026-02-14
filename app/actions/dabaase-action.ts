"use server"
import { pool } from "@/lib/db"

export async function getArchiveDocuments(workspaceId: string, filters: { searchTerm?: string, startDate?: string, endDate?: string }) {
  try {
    let query = `SELECT * FROM payment_requests WHERE workspace_id = $1`;
    const params: any[] = [workspaceId];

    if (filters.searchTerm) {
      params.push(`%${filters.searchTerm}%`);
      query += ` AND (supplier_name ILIKE $${params.length} OR tracking_code ILIKE $${params.length} OR description ILIKE $${params.length})`;
    }

    if (filters.startDate) {
      params.push(filters.startDate);
      query += ` AND payment_date >= $${params.length}`;
    }

    if (filters.endDate) {
      params.push(filters.endDate);
      query += ` AND payment_date <= $${params.length}`;
    }

    query += ` ORDER BY created_at DESC`;

    const { rows } = await pool.query(query, params);
    return { success: true, data: rows };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}