import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { listSessionsForUser } from "@/lib/sessions/queries";

export const dynamic = "force-dynamic";

/**
 * /chat (no characterId) — bookmark-friendly entry point. Lands the user
 * on their most recent character conversation if they have any, otherwise
 * punts to /explore.
 *
 * No side effects on GET — we don't conjure a character or seed an empty
 * conversation here; the find-or-create only happens at /chat/[characterId].
 */
export default async function ChatIndex() {
  const userId = await getCurrentUserId();
  const sessions = await listSessionsForUser(userId);
  // 取最近一条**还打得开**的会话:角色被作者改私密、或随创作者注销被删
  // (characterId 为 null)的会话都进不去,拿它跳会落到 /chat/null。
  const landing = sessions.find((s) => s.accessible && s.characterId !== null);
  if (landing) redirect(`/chat/${landing.characterId}`);
  redirect("/explore");
}
