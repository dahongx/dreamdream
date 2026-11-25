import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { ChatRoom } from "@/components/chat/ChatRoom";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { getRequestDict } from "@/i18n/server";
import {
  getCurrentUserId,
  isCurrentUserDeveloper,
} from "@/lib/auth/current-user";
import {
  type ChatUIMessage,
  createPublicChatMeta,
  type DebugInfo,
  type DebugMeta,
} from "@/lib/chat/debug-meta";
import { db } from "@/lib/db/client";
import { SFW_MODE } from "@/lib/config/site";
import type { Message } from "@/lib/db/schema";
import { users } from "@/lib/db/schema";
import { getSessionMaskState } from "@/lib/masks/queries";
import { TIER_SPECS } from "@/lib/membership/constants";
import { getUserMembership } from "@/lib/membership/queries";
import { loadCharacterOpeningComponents } from "@/lib/opening/queries";
import { loadCharacterGlobalCss, loadRulesAndPrefs } from "@/lib/regex/queries";
import {
  getOrCreateCharacterConversation,
  listRecentSessionsForUser,
  loadSessionById,
} from "@/lib/sessions/queries";
import { sanitizeAndScopeCss } from "@/lib/styling/whitelist";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ characterId: string }>;
  searchParams: Promise<{ session?: string }>;
}

/**
 * Chat surface — left sidebar listing characters this user has talked to,
 * right pane with the persistent conversation against the focused character.
 *
 * URL forms:
 *   /chat/<characterId>                 → current (saved_at IS NULL) session,
 *                                          find-or-create. 默认入口
 *   /chat/<characterId>?session=<uuid>  → 进入指定 saved 对话(可续聊)
 *
 * RSC fetches everything; client owns streaming + per-bubble regex/sanitize/markdown.
 */
export default async function ChatPage({ params, searchParams }: Props) {
  const { characterId } = await params;
  const { session: sessionParam } = await searchParams;
  const userId = await getCurrentUserId();
  // 调试面板暴露 host-level prompt 工程（canonical master / regex guidance 拼接
  // 等），不能让普通 creator 看到，否则反推走 prompt 体系。安全边界 = 环境变量
  // 白名单（prod 默认空，见 src/lib/auth/dev-allowlist.ts）。提前判定还让
  // loadMessages 能对非开发者瘦身 debug_info（长会话省 MB 级 DB 传输）。
  const canDebug = await isCurrentUserDeveloper();
  const dict = await getRequestDict();

  const [active, sessions] = await Promise.all([
    sessionParam
      ? loadSessionById(sessionParam, characterId, userId, {
          withDebugInfo: canDebug,
        })
      : getOrCreateCharacterConversation(characterId, userId, {
          withDebugInfo: canDebug,
        }),
    listRecentSessionsForUser(userId),
  ]);

  if (!active) {
    // 跳到最近一条**还打得开**的会话。角色被作者改私密、或随创作者注销被删
    // (characterId 为 null)的会话进不去,拿它跳会落到 /chat/null。
    const landing = sessions.find(
      (s) => s.accessible && s.characterId !== null,
    );
    if (landing) redirect(`/chat/${landing.characterId}`);
    notFound();
  }

  // 纵深防御：SFW 版不提供成人卡，已知 URL 直达也不放行。放在会话解析
  // **之后**是因为 active 才是权威的角色行（含旧会话指向的卡）；与会话
  // 可访问性判定（lib/sessions/access.ts）互不重叠 —— 那条管「删没删/私没私」，
  // 这条管「内容分级是否属于本产品」。
  if (SFW_MODE && active.character.nsfw) notFound();

  // 面具语义 = 「起点」：默认面具只在建会话时(sessions/queries.ts)拷进新会话的
  // activeMaskId,拷完即断线归会话自己。进页面不再兜底把默认面具补绑到 null 会话 ——
  // 那会让「换成无面具/删掉面具后刷新又弹回默认」,且 set 追溯、unset 不追溯造成语义
  // 不对称。去掉后换任何面具(含无面具)刷新都稳、set/unset 对称。
  // 六路互不依赖的查询并行发（原实现串行 await，白吃多段往返延迟）。
  const [
    { rules, userPrefs },
    openingComponents,
    maskState,
    rawCss,
    meRows,
    membership,
  ] = await Promise.all([
    loadRulesAndPrefs(active.character.id, userId, dict),
    loadCharacterOpeningComponents(active.character.id),
    getSessionMaskState(active.session.id, userId),
    loadCharacterGlobalCss(active.character.id),
    db
      .select({
        email: users.email,
        displayName: users.displayName,
        username: users.username,
        name: users.name,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
    getUserMembership(userId),
  ]);

  const initialUserPrefs: Record<string, boolean> = {};
  for (const [k, v] of userPrefs.entries()) initialUserPrefs[k] = v;

  const characterCss = rawCss
    ? sanitizeAndScopeCss(rawCss, active.character.id).css
    : "";

  const me = meRows[0];
  const userName =
    me?.displayName || me?.username || me?.name || dict.chat.defaultUserName;
  const userAvatarUrl = me?.avatarUrl ?? null;

  // 计算用户是否拥有无限面具权益
  let hasUnlimitedMasks = false;
  if (membership.active && membership.tier) {
    const tierSpec = TIER_SPECS[membership.tier];
    hasUnlimitedMasks = tierSpec?.benefits.unlimitedMasks ?? false;
  }

  const initialMessages: ChatUIMessage[] = active.messages.map(toUIMessage);
  // canDebug 判定已提前到页首（isCurrentUserDeveloper，同一请求内 cache 去重）。
  // 不叠加 owner 闸：平台开发者要在任意卡上看 assembled prompt 才能调效果。
  // trade-off：allowlist 上的 email 能看到任意卡的 system prompt（含 creator
  // persona/opening 等 prompt 资产），所以 NIMIR_DEBUG_EMAILS 严禁配进 prod。
  const debugMetaMap: Record<string, DebugMeta> = {};
  // 截断标记走单独 map: debugMetaMap 仅开发者可见 (会带 systemPrompt 等机密),
  // 但被安全策略截断这件事所有用户都要看到, 才能决定要不要换模型重生成.
  const truncatedBySafetyIds = new Set<string>();
  for (const m of active.messages) {
    if (m.role !== "assistant") continue;
    const debug = (m.debugInfo as DebugInfo | null) ?? null;
    if (debug?.truncatedBySafety) truncatedBySafetyIds.add(m.id);
    if (canDebug) {
      // Always include the entry — DebugPanel handles the empty-debug case
      // upstream so the owner sees an explanatory placeholder for rows that
      // predate the debug_info column write.
      debugMetaMap[m.id] = {
        debug,
        model: m.model,
        tokensIn: m.tokensIn,
        tokensOut: m.tokensOut,
        cacheReadTokens: m.cacheReadTokens,
        cacheWriteTokens: m.cacheWriteTokens,
        reasoningTokens: m.reasoningTokens,
        costMillicents: m.costMillicents,
        costCnyMillicents: m.costCnyMillicents,
        latencyMs: m.latencyMs,
        safetyBlocked: debug?.truncatedBySafety === true,
        stoppedByUser: debug?.stoppedByUser === true,
      };
    }
  }

  return (
    <div
      className="flex h-dvh min-h-0 md:h-[calc(100dvh-var(--topbar-height))]"
      data-character-css={active.character.id}
    >
      {characterCss && (
        // biome-ignore lint/security/noDangerouslySetInnerHtml: pre-sanitized + scope-prefixed by sanitizeAndScopeCss
        <style dangerouslySetInnerHTML={{ __html: characterCss }} />
      )}
      <ChatSidebar
        sessions={sessions}
        activeCharacterId={active.character.id}
      />
      <ChatRoom
        sessionId={active.session.id}
        character={{
          id: active.character.id,
          name: active.character.name,
          avatarUrl: active.character.avatarUrl,
          coverImageUrl: active.character.coverImageUrl,
          tags: active.character.tags,
          bio: active.character.bio,
          creatorNote: active.character.creatorNote,
        }}
        initialMessages={initialMessages}
        rules={rules}
        openingComponents={openingComponents}
        openingGlobalCss={rawCss ?? ""}
        initialUserPrefs={initialUserPrefs}
        userName={userName}
        userAvatarUrl={userAvatarUrl}
        canDebug={canDebug}
        debugMetaMap={debugMetaMap}
        truncatedBySafetyIds={Array.from(truncatedBySafetyIds)}
        sessions={sessions}
        activeCharacterId={active.character.id}
        masks={maskState.masks}
        activeMaskId={maskState.activeMaskId}
        hasUnlimitedMasks={hasUnlimitedMasks}
      />
    </div>
  );
}

function toUIMessage(row: Message): ChatUIMessage {
  const debug = (row.debugInfo as DebugInfo | null) ?? null;
  const safetyBlocked = debug?.truncatedBySafety === true;
  const stoppedByUser = debug?.stoppedByUser === true;
  return {
    id: row.id,
    role: row.role,
    parts: [{ type: "text", text: row.content }],
    metadata:
      safetyBlocked || stoppedByUser
        ? createPublicChatMeta({ safetyBlocked, stoppedByUser })
        : undefined,
  };
}
