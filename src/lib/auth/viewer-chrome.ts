import { eq } from "drizzle-orm";
import { cache } from "react";
import { getAuthUser } from "@/lib/auth/auth-user";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { listUnreadNotificationsForUser } from "@/lib/notifications/admin";

export interface ViewerChromeData {
  id: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
  unreadNotifications: Awaited<
    ReturnType<typeof listUnreadNotificationsForUser>
  >;
}

export const getViewerChromeData = cache(
  async (): Promise<ViewerChromeData | null> => {
    const user = await getAuthUser();
    if (!user) return null;

    const [row, unreadNotifications] = await Promise.all([
      db
        .select({
          avatarUrl: users.avatarUrl,
          displayName: users.displayName,
          username: users.username,
          role: users.role,
        })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1)
        .then(([profile]) => profile),
      listUnreadNotificationsForUser(user.id),
    ]);

    return {
      id: user.id,
      name: row?.displayName ?? row?.username ?? user.email ?? null,
      email: user.email ?? null,
      avatarUrl: row?.avatarUrl ?? null,
      isAdmin: row?.role === "admin",
      unreadNotifications,
    };
  },
);
