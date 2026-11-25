"use server";

import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequestDict } from "@/i18n/server";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { db } from "@/lib/db/client";
import {
  platformNotifications,
  userNotificationReads,
  users,
} from "@/lib/db/schema";

const notificationSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(3000),
});

export type NotificationType = "announcement" | "reminder";

export interface PlatformNotificationRow {
  id: string;
  notificationType: NotificationType;
  title: string;
  body: string;
  createdAt: string;
  createdBy: string | null;
  targetUserId: string | null;
}

export type NotificationActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

async function ensureAdmin() {
  const userId = await getCurrentUserId().catch(() => null);
  if (!userId) return null;
  const [me] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return me?.role === "admin" ? userId : null;
}

export async function createAnnouncementAction(
  _prev: NotificationActionResult | null,
  formData: FormData,
): Promise<NotificationActionResult> {
  const adminId = await ensureAdmin();
  if (!adminId) return { ok: false, error: "Forbidden" };

  const dict = await getRequestDict();
  const t = dict.admin;
  const parsed = notificationSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: t.announcementValidationError,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  const [row] = await db
    .insert(platformNotifications)
    .values({
      notificationType: "announcement",
      createdBy: adminId,
      title: parsed.data.title,
      body: parsed.data.body,
    })
    .returning({ id: platformNotifications.id });

  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/explore");
  revalidatePath("/sessions");
  revalidatePath("/create");
  revalidatePath("/me");
  revalidatePath("/shop");
  revalidatePath("/settings");
  return { ok: true, id: row.id };
}

async function listNotificationsForUser(
  userId: string | null,
  unreadOnly: boolean,
): Promise<PlatformNotificationRow[]> {
  const audienceCondition = or(
    isNull(platformNotifications.targetUserId),
    userId
      ? eq(platformNotifications.targetUserId, userId)
      : isNull(platformNotifications.targetUserId),
  );
  const whereCondition =
    userId && unreadOnly
      ? and(
          audienceCondition,
          sql`not exists (
            select 1
            from ${userNotificationReads}
            where ${userNotificationReads.userId} = ${userId}
              and ${userNotificationReads.notificationId} = ${platformNotifications.id}
          )`,
        )
      : audienceCondition;

  const query = db
    .select({
      id: platformNotifications.id,
      notificationType: platformNotifications.notificationType,
      title: platformNotifications.title,
      body: platformNotifications.body,
      createdAt: platformNotifications.createdAt,
      createdBy: platformNotifications.createdBy,
      targetUserId: platformNotifications.targetUserId,
    })
    .from(platformNotifications)
    .where(whereCondition)
    .orderBy(desc(platformNotifications.createdAt));
  const rows = unreadOnly ? await query.limit(20) : await query;

  return rows.map((row) => ({
    id: row.id,
    notificationType: row.notificationType as NotificationType,
    title: row.title,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy,
    targetUserId: row.targetUserId,
  }));
}

export async function listAnnouncements(): Promise<PlatformNotificationRow[]> {
  const adminId = await ensureAdmin();
  if (!adminId) return [];
  const rows = await db
    .select({
      id: platformNotifications.id,
      notificationType: platformNotifications.notificationType,
      title: platformNotifications.title,
      body: platformNotifications.body,
      createdAt: platformNotifications.createdAt,
      createdBy: platformNotifications.createdBy,
      targetUserId: platformNotifications.targetUserId,
    })
    .from(platformNotifications)
    .where(
      and(
        eq(platformNotifications.notificationType, "announcement"),
        isNull(platformNotifications.targetUserId),
      ),
    )
    .orderBy(desc(platformNotifications.createdAt));

  return rows.map((row) => ({
    id: row.id,
    notificationType: row.notificationType as NotificationType,
    title: row.title,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy,
    targetUserId: row.targetUserId,
  }));
}

export async function listUnreadNotificationsForUser(
  userId: string,
): Promise<PlatformNotificationRow[]> {
  try {
    return await listNotificationsForUser(userId, true);
  } catch (error) {
    console.warn(
      "Notifications are unavailable. Run `bun run db:migrate` after configuring DATABASE_URL.",
      error,
    );
    return [];
  }
}

export async function listUnreadNotifications(): Promise<
  PlatformNotificationRow[]
> {
  return listUnreadNotificationsForUser(await getCurrentUserId());
}

export async function markNotificationReadAction(
  notificationId: string,
): Promise<void> {
  const userId = await getCurrentUserId();
  await db
    .insert(userNotificationReads)
    .values({ userId, notificationId })
    .onConflictDoNothing();
}
