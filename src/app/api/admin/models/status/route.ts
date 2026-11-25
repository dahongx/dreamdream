/**
 * GET /api/admin/models/status
 *
 * 获取所有模型的健康状态（仅管理员）
 */

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getAllModelsHealthStatus } from "@/lib/ai/health-check";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getCurrentUserId();

  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = await getAllModelsHealthStatus();

  return NextResponse.json({ models: status });
}
