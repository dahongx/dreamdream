"use server";

import { createClient as createBareClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { getRequestDict } from "@/i18n/server";
import { getAuthUser } from "@/lib/auth/auth-user";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { db } from "@/lib/db/client";
import { deactivatedEmailHashes } from "@/lib/db/schema";
import { deleteUserUploads } from "@/lib/r2/client";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getSupabaseAnonKey,
  getSupabaseServerUrl,
} from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { hashDeactivatedEmailFromEnv } from "./email-hash";

/**
 * 账号注销 —— 硬删除。
 *
 * 设计与决策记录见 docs/exec-plans/completed/account-deletion.md。
 *
 * 主体只有一句 `auth.admin.deleteUser()`：drizzle/0011 给 public.users.id 加的
 * `REFERENCES auth.users(id) ON DELETE CASCADE`，配合 20+ 张业务表挂在
 * public.users 上的 CASCADE，会在同一个事务里把该用户的一切带走。这里的代码
 * 几乎全是在处理级联**管不到**的两处（对象存储、邮箱指纹）和级联**删过头**
 * 的一处（别人跟他角色卡的会话，由 0042 改成 SET NULL 解决）。
 */

export type DeleteAccountResult = { ok: false; error: string };

export async function deleteAccountAction(
  _prev: DeleteAccountResult | null,
  formData: FormData,
): Promise<DeleteAccountResult> {
  const dict = await getRequestDict();
  const t = dict.settings;

  // 1) 授权闸。呼应近期的 server action 授权审计 —— 一个都不能省。
  const userId = await getCurrentUserId();

  const password = formData.get("password")?.toString() ?? "";
  const confirmed = formData.get("confirm") === "on";
  if (!confirmed) return { ok: false, error: t.deleteAccountNotConfirmed };
  if (!password) return { ok: false, error: t.deleteAccountPasswordRequired };

  const authUser = await getAuthUser();
  const email = authUser?.email;
  if (!email) return { ok: false, error: t.deleteAccountFailed };

  // 2) 口令复核。必须用**另起的**无 cookie client —— @/lib/supabase/server 的
  //    createClient 绑着 cookieStore，signInWithPassword 成功会把会话 cookie
  //    整个重写一遍（等于在注销流程里悄悄换发了一张新票）。
  const verifier = createBareClient(
    getSupabaseServerUrl(),
    getSupabaseAnonKey(),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error: pwError } = await verifier.auth.signInWithPassword({
    email,
    password,
  });
  if (pwError) return { ok: false, error: t.deleteAccountWrongPassword };

  // 3) 邮箱指纹入库。**必须在删之前**——删完就再也拿不到这个邮箱了。
  //    这张表刻意不含 user_id、不关联任何内容行，是全库唯一残留物。
  try {
    await db
      .insert(deactivatedEmailHashes)
      .values({ emailHash: hashDeactivatedEmailFromEnv(email) })
      .onConflictDoNothing({ target: deactivatedEmailHashes.emailHash });
  } catch (err) {
    // pepper 没配会走到这里。宁可整个流程失败，也不要静默写一个可被字典枚举
    // 反查的裸哈希进去。
    console.error("[dearm] account deletion: email hash failed", err);
    return { ok: false, error: t.deleteAccountFailed };
  }

  // 4) 删对象存储。**顺序不能和第 5 步对调**：若先删账号再删图片而图片删失败，
  //    照片会留在 public bucket 且此后再没有任何记录能指向它去清理 —— 那是
  //    隐私漏洞。反过来最坏只是「账号还在但头像碎了」，重传即可自愈。
  //    单个对象删不掉不该阻断注销本身，记日志后继续。
  try {
    const removed = await deleteUserUploads(userId);
    console.info(`[dearm] account deletion: removed ${removed} object(s)`);
  } catch (err) {
    console.error("[dearm] account deletion: storage cleanup failed", err);
  }

  // 5) 正主。GoTrue 带走整条身份链（auth.users / identities / sessions /
  //    refresh_tokens），Postgres 的级联把业务侧全部删掉，一个事务。
  const admin = createAdminClient();
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    console.error("[dearm] account deletion: deleteUser failed", deleteError);
    return { ok: false, error: t.deleteAccountFailed };
  }

  // 6) 清本地会话 cookie。放在删除**之后**，是为了让不可逆那一步失败时用户仍然
  //    登录着、能看见错误。@supabase/ssr 的 cookie 可能被分块成 .0 / .1，手动
  //    cookies().delete() 容易漏，交给 signOut 自己清；scope: "local" 不回源
  //    调用已经不存在的账号。就算这步没清干净也能自愈 —— proxy 的 getUser()
  //    对失效 token 会 catch 成「未登录」并跳登录页。
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });

  redirect("/signin?message=accountDeleted");
}
