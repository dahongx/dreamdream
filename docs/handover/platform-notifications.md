# Platform Notifications Handover

> 产品思考见 [../insights/platform-notifications.md](../insights/platform-notifications.md)。

## Scope

平台通知目前实现了全平台公告：

- 管理员在 `/admin?tab=announcements` 发布公告。
- 公告写入 `platform_notifications`，`notification_type='announcement'`，`target_user_id=null` 表示全员可见。
- 用户侧顶部铃铛读取未读通知。打开铃铛会先清掉本次界面的黄点；点开某一条消息后才写入 `user_notification_reads`，之后刷新或切页不再显示这条消息。

预留了 `notification_type='reminder'` 和 `target_user_id`，用于后续单用户提醒，但本次没有接任何提醒数据源。

## Data

Migration: `drizzle/0043_platform_announcements.sql`

- `platform_notifications`
  - `id`
  - `notification_type`: `announcement | reminder`
  - `created_by`: admin user id, nullable on admin deletion
  - `target_user_id`: nullable; null means platform-wide
  - `title`
  - `body`
  - `created_at`
- `user_notification_reads`
  - composite primary key: `(user_id, notification_id)`
  - `read_at`

Both tables enable RLS in the migration. Server code uses Drizzle with `DATABASE_URL`, matching the repo's existing server-only data access posture.

## Server API

`src/lib/notifications/admin.ts` exports:

- `createAnnouncementAction`: admin-only Server Action for publishing announcements.
- `listAnnouncements`: admin-only history list for the admin tab.
- `listUnreadNotificationsForUser`: server query for topbar surfaces that already know a user id.
- `markNotificationReadAction`: marks a single item read.

## UI

- `src/components/notifications/AdminAnnouncementsSection.tsx` renders publish form and history.
- `src/components/notifications/NotificationBell.tsx` renders the bell popover.
- `src/components/Shell.tsx` uses the bell on ordinary pages.
- `src/app/explore/page.tsx` uses the same bell inside the custom mobile Explore hero chrome.

Chat paths and character detail little-theater paths are intentionally untouched. The notification UI does not use `nj_*` selectors.
