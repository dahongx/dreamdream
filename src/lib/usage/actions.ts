"use server";

import { eq } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { type DailyModelUsage, getDailyModelUsage } from "@/lib/usage/stats";

const EMPTY: DailyModelUsage = {
  days: [],
  models: [],
  callCounts: {},
  costCnyMillicents: {},
};

// 严格 YYYY-MM-DD 形式（避免任意字符串落到 SQL 时间字面量里）。
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function fetchDailyModelUsageAction(
  endDate: string,
): Promise<DailyModelUsage> {
  if (!DATE_RE.test(endDate)) return EMPTY;

  const userId = await getCurrentUserId();
  const [me] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (me?.role !== "admin") return EMPTY;

  return getDailyModelUsage(endDate, 7);
}
