"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getRequestDict } from "@/i18n/server";
import type { Dict } from "@/i18n/types";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { USERNAME_RE } from "@/lib/auth/identity";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";

/**
 * /settings server actions — display name + username editing, plus
 * sign-out passthrough.
 *
 * display_name matters more than it looks: it's what {{user}} resolves
 * to in buildSystemPrompt. Creators want it spelled their way.
 */

function createProfileSchema(t: Dict["settings"]) {
  return z.object({
    displayName: z
      .preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string())
      .pipe(
        z.string().min(1, t.displayNameRequired).max(128, t.displayNameTooLong),
      ),
    username: z
      .preprocess((v) => {
        if (typeof v !== "string") return v;
        const trimmed = v.trim();
        return trimmed === "" ? undefined : trimmed;
      }, z.string().optional())
      .pipe(z.string().regex(USERNAME_RE, t.usernameInvalid).optional()),
    phone: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : v),
      z.string().max(32, t.phoneTooLong).nullable(),
    ),
    // 个人主页一句简介。空串当作清空,写 null,渲染层走 fallback。
    // 280 字符上限沿用推特长度直觉,够写一段自介又不至于把布局撑爆。
    bio: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : v),
      z.string().max(280, t.bioTooLong).nullable(),
    ),
    // avatarUrl 由 UserAvatarUpload 在前端上传后填进 hidden input。空串视为「移除」，
    // 写 null 而非 ''——后端按 NULL 落库，渲染层就能干净地走 fallback firstChar。
    // 仅允许 https + 长度限制，防止 client 端塞一个奇怪 URL 进来。
    avatarUrl: z
      .preprocess(
        (v) => (typeof v === "string" && v.trim() === "" ? null : v),
        z.string().url(t.avatarUrlInvalid).max(1024).nullable(),
      )
      .refine(
        (v) =>
          v === null ||
          v.startsWith("https://") ||
          // 允许本地/自托管 Supabase Storage 的 http URL(云端是 https,仍走上一条)。
          v.startsWith(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://"),
        { message: t.avatarUrlInvalid },
      ),
  });
}

export type ProfileActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function updateProfileAction(
  _prev: ProfileActionResult | null,
  formData: FormData,
): Promise<ProfileActionResult> {
  const dict = await getRequestDict();
  const t = dict.settings;
  const parsed = createProfileSchema(t).safeParse({
    displayName: formData.get("displayName"),
    username: formData.get("username"),
    phone: formData.get("phone"),
    bio: formData.get("bio"),
    avatarUrl: formData.get("avatarUrl"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: t.validationFailed,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }
  const userId = await getCurrentUserId();

  try {
    await db
      .update(users)
      .set({
        displayName: parsed.data.displayName,
        username: parsed.data.username ?? null,
        phone: parsed.data.phone,
        bio: parsed.data.bio,
        avatarUrl: parsed.data.avatarUrl,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  } catch (err) {
    // Unique-violation on username comes back as a constraint error.
    const msg = (err as Error).message;
    if (msg.includes("users_username_uidx")) {
      return {
        ok: false,
        error: t.usernameTaken,
        fieldErrors: { username: [t.usernameTaken] },
      };
    }
    return { ok: false, error: t.saveFailed };
  }

  revalidatePath("/settings");
  revalidatePath("/me");
  return { ok: true };
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/signin");
}
