/**
 * POST /api/admin/models/health-check
 *
 * 触发所有模型的健康检查（仅管理员）
 */

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { checkAllModelsHealth } from "@/lib/ai/health-check";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function POST() {
  const userId = await getCurrentUserId();

  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const results = await checkAllModelsHealth();

  return NextResponse.json({ results });
}
