"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { db } from "@/lib/db/client";
import { regexRules } from "@/lib/db/schema";
import { upsertRegexPreference } from "@/lib/regex/queries";

/**
 * Toggle a user's preference for a visible regex rule. Owner of the
 * rule's character is irrelevant — this is the END-USER opt-out switch.
 * Visibility was opted-into by the creator (visible=true); this lets
 * the chatting user mute the rule without affecting other users.
 *
 * 授权边界：`visible=true` 就是创作者对「这条规则允许玩家自行开关」的显式
 * 授权，所以这里的闸只有一道 —— 规则必须存在且 visible。原先没有这道闸，
 * 任何登录用户可以对任意 ruleId（含创作者未公开的规则）写偏好行。危害本身
 * 有限（行按自己的 userId 落库），但它让 user_regex_preferences 变成一张能
 * 被外部塞任意 rule id 的表，且能反向探测规则 id 是否存在。
 *
 * routeId 只用于 revalidatePath，必须先验 UUID 形态再插值 —— 否则调用方能
 * 往缓存 key 里塞任意路径。
 */
export async function setRegexPreferenceAction(
  ruleId: string,
  enabled: boolean,
  routeId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = z
    .object({
      ruleId: z.string().uuid(),
      enabled: z.boolean(),
      routeId: z.string().uuid(),
    })
    .safeParse({ ruleId, enabled, routeId });
  if (!parsed.success) return { ok: false, error: "参数错误" };

  try {
    const userId = await getCurrentUserId();

    const [rule] = await db
      .select({ visible: regexRules.visible })
      .from(regexRules)
      .where(eq(regexRules.id, parsed.data.ruleId))
      .limit(1);
    if (!rule?.visible) {
      return { ok: false, error: "该规则不支持自行开关" };
    }

    await upsertRegexPreference(
      userId,
      parsed.data.ruleId,
      parsed.data.enabled,
    );
    revalidatePath(`/chat/${parsed.data.routeId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
