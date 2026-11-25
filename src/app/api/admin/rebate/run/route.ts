/**
 * POST /api/admin/rebate/run
 *
 * 手动触发创作者返利结算（仅管理员）。日常由服务器 crontab 每天 8 点自动跑
 * scripts/run-daily-rebate.ts；这个路由给 admin 在后台手动补跑 / 验证用。
 *
 * body（可选）：{ dryRun?: boolean } —— dryRun=true 只算不写，返回明细供核对。
 */

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { runDailyRebate } from "@/lib/creator/rebate";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const userId = await getCurrentUserId();

  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let dryRun = false;
  try {
    const body = (await req.json()) as { dryRun?: boolean } | null;
    dryRun = body?.dryRun === true;
  } catch {
    // 无 body / 非 JSON：按真跑处理
  }

  const result = await runDailyRebate({ dryRun });

  return NextResponse.json({
    dryRun: result.dryRun,
    charactersScanned: result.charactersScanned,
    creatorsPaid: result.creatorsPaid,
    totalPaid: result.totalPaid,
    itemCount: result.items.length,
  });
}
