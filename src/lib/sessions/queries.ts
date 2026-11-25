import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  inArray,
  isNotNull,
  isNull,
  sql,
} from "drizzle-orm";
import {
  interpolate,
  parseOpening,
  resolveUserName,
} from "@/lib/ai/build-prompt";
import { db } from "@/lib/db/client";
import {
  type Character,
  type ChatSession,
  characters,
  chatSessions,
  type Message,
  messages,
  users,
} from "@/lib/db/schema";
import { getDefaultMask, getSessionActiveMask } from "@/lib/masks/queries";
import { isSessionAccessible } from "./access";

/**
 * Sessions visible in the chat sidebar — user's own only, newest first.
 * Joins character.name + avatar so the sidebar doesn't fan out to N queries.
 *
 * 侧栏只展示每角色的"当前临时对话"(saved_at IS NULL)。已保存的历史
 * 对话在聊天页内通过历史弹窗访问,不在侧栏展开。
 */
export async function listSessionsForUser(userId: string) {
  const rows = await db
    .select({
      id: chatSessions.id,
      title: chatSessions.title,
      lastMessageAt: chatSessions.lastMessageAt,
      characterId: chatSessions.characterId,
      characterName: characters.name,
      characterAvatarUrl: characters.avatarUrl,
      characterVisibility: characters.visibility,
      characterOwnerId: characters.ownerId,
    })
    .from(chatSessions)
    // leftJoin 而非 innerJoin:创作者注销会删掉他的角色卡,而 0042 把
    // chat_sessions.character_id 改成了 SET NULL —— 别人跟这些卡的会话变成
    // 「孤儿」保留下来。用 innerJoin 会把这些会话**静默丢掉**,用户看到的是
    // 记录凭空消失,跟直接删了没区别。
    .leftJoin(characters, eq(characters.id, chatSessions.characterId))
    .where(
      and(
        eq(chatSessions.userId, userId),
        isNull(chatSessions.savedAt),
        isNull(chatSessions.discardedAt),
      ),
    )
    .orderBy(desc(chatSessions.lastMessageAt));

  // 可访问性的判据见 ./access（四种成因,含「角色随创作者注销被删」）。
  // 不可访问的一律在列表里标灰、点击给提示,不是从列表里摘掉。
  return rows.map(({ characterVisibility, characterOwnerId, ...rest }) => ({
    ...rest,
    characterDeleted: rest.characterId === null,
    accessible: isSessionAccessible(
      { ...rest, characterVisibility, characterOwnerId },
      userId,
    ),
  }));
}

export type SessionListItem = Awaited<
  ReturnType<typeof listSessionsForUser>
>[number];

export interface RecentSessionListItem extends SessionListItem {
  /** 最新一条「活跃」消息文本(用作 /sessions「最近会话」tab 卡片预览),无消息时为 null。 */
  previewContent: string | null;
  /** 最新一条消息的角色,用于决定是否给前缀("user" / "assistant")。 */
  previewRole: "user" | "assistant" | null;
  /** 最新一条消息时间。当不存在消息时退回 chatSessions.lastMessageAt 做分组。 */
  previewCreatedAt: Date | null;
}

/**
 * 「最近会话」tab(/sessions)用 —— 在 listSessionsForUser 基础上额外拉每
 * session 的最新一条活跃消息(用作卡片预览,参考 /tmp/page/10.jpg)。
 *
 * 用 DISTINCT ON (session_id) 走 messages_session_active_idx,一次往返。
 * 没单独放进 listSessionsForUser 里,因为聊天页侧栏只需要角色名,加 join
 * 会被无谓拖慢。
 */
export async function listRecentSessionsForUser(
  userId: string,
): Promise<RecentSessionListItem[]> {
  const base = await listSessionsForUser(userId);
  if (base.length === 0) return [];

  const sessionIds = base.map((s) => s.id);
  if (sessionIds.length === 0) return [];

  const previews = await db.execute<{
    session_id: string;
    content: string;
    role: "user" | "assistant";
    created_at: Date;
  }>(sql`
    SELECT DISTINCT ON (session_id) session_id, content, role, created_at
    FROM ${messages}
    WHERE ${messages.sessionId} IN (${sql.join(
      sessionIds.map((id) => sql`${id}`),
      sql`, `,
    )})
      AND ${messages.supersededAt} IS NULL
    ORDER BY session_id, ${messages.createdAt} DESC
  `);

  const byId = new Map<
    string,
    { content: string; role: "user" | "assistant"; createdAt: Date }
  >();
  for (const p of previews) {
    byId.set(p.session_id, {
      content: p.content,
      role: p.role,
      createdAt: new Date(p.created_at),
    });
  }

  return base.map((s) => {
    const preview = byId.get(s.id);
    return {
      ...s,
      previewContent: preview?.content ?? null,
      previewRole: preview?.role ?? null,
      previewCreatedAt: preview?.createdAt ?? null,
    };
  });
}

interface LoadedConversation {
  session: ChatSession;
  character: Character;
  messages: Message[];
}

async function seedOpeningMessage(
  sessionId: string,
  character: Character,
  userId: string,
): Promise<void> {
  const [user] = await db
    .select({
      displayName: users.displayName,
      username: users.username,
      name: users.name,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const userCtx = {
    char: character.name,
    user: resolveUserName(user, await getSessionActiveMask(sessionId, userId)),
  };

  const parsed = parseOpening(character.opening);
  if (parsed.firstAssistantBody) {
    await db.insert(messages).values({
      sessionId,
      role: "assistant" as const,
      content: interpolate(parsed.firstAssistantBody, userCtx),
    });
  }
}

/**
 * withDebugInfo=false（默认，普通用户视角）时把 debug_info 瘦身成
 * `{truncatedBySafety}`：该 jsonb 每行都带完整 assembled system prompt
 * （动辄几 KB），长会话打开页面要白搬 MB 级数据、全为了一个布尔标记。
 * truncatedBySafety 是所有用户都要看的（「换模型重生成」提示），单独抽出。
 * 开发者视角（DebugPanel 需要全量 rawOutput/systemPrompt/规则命中）传 true。
 */
async function loadMessages(
  sessionId: string,
  withDebugInfo = false,
): Promise<Message[]> {
  const cols = getTableColumns(messages);
  const selection = withDebugInfo
    ? cols
    : {
        ...cols,
        debugInfo: sql<Message["debugInfo"]>`
          case
            when ${messages.debugInfo} is null then null
            else jsonb_build_object(
              'truncatedBySafety',
              ${messages.debugInfo} -> 'truncatedBySafety'
            )
          end
        `.as("debug_info"),
      };
  return db
    .select(selection)
    .from(messages)
    .where(
      and(eq(messages.sessionId, sessionId), isNull(messages.supersededAt)),
    )
    .orderBy(asc(messages.createdAt));
}

async function loadCharacterForChat(
  characterId: string,
  userId: string,
): Promise<Character | null> {
  const [character] = await db
    .select()
    .from(characters)
    .where(eq(characters.id, characterId))
    .limit(1);
  if (!character) return null;
  if (character.visibility === "private" && character.ownerId !== userId) {
    return null;
  }
  return character;
}

/**
 * Find-or-create the user's CURRENT conversation (saved_at IS NULL) for a
 * given character, then load it along with the character record and messages.
 *
 * Title is left null on create; the chat API back-fills it from the first
 * user message (LEFT(content, 30)). On the create branch we also bump
 * characters.conversation_count and seed the opening assistant message.
 *
 * Visibility: any user can chat with public/unlisted; only owner can chat
 * with private. Returns null on visibility violation (route surfaces 404).
 */
export async function getOrCreateCharacterConversation(
  characterId: string,
  userId: string,
  opts: { withDebugInfo?: boolean } = {},
): Promise<LoadedConversation | null> {
  const character = await loadCharacterForChat(characterId, userId);
  if (!character) return null;

  let [session] = await db
    .select()
    .from(chatSessions)
    .where(
      and(
        eq(chatSessions.userId, userId),
        eq(chatSessions.characterId, characterId),
        isNull(chatSessions.savedAt),
        isNull(chatSessions.discardedAt),
      ),
    )
    .limit(1);

  if (!session) {
    // partial unique on (user_id, character_id)
    // WHERE saved_at IS NULL AND discarded_at IS NULL
    // bounces concurrent inserts; fall back to re-select on conflict.
    const defaultMask = await getDefaultMask(userId);
    const [created] = await db
      .insert(chatSessions)
      .values({
        userId,
        characterId: character.id,
        title: null,
        activeMaskId: defaultMask?.id ?? null,
      })
      .onConflictDoNothing()
      .returning();

    if (created) {
      session = created;
      // conversationCount 不在此处自增。原先「session 创建即 +1」会把
      // 「打开页面看一眼就走」的访客也算成一次对话（叠加 seed 的开场白
      // 让数据看起来像「有过 1 次对话」）。真正的 +1 移到 api/chat 路由
      // 接收用户第一条 user message 时（route.ts），那才是「开始对话」。
      await seedOpeningMessage(created.id, character, userId);
    } else {
      [session] = await db
        .select()
        .from(chatSessions)
        .where(
          and(
            eq(chatSessions.userId, userId),
            eq(chatSessions.characterId, characterId),
            isNull(chatSessions.savedAt),
            isNull(chatSessions.discardedAt),
          ),
        )
        .limit(1);
    }
  }

  if (!session) return null;

  const rows = await loadMessages(session.id, opts.withDebugInfo);
  return { session, character, messages: rows };
}

/**
 * Load a specific session by id, used when the chat page receives ?session=
 * for a saved conversation. Enforces (1) session belongs to userId,
 * (2) session belongs to the same character in the URL, and (3) character
 * visibility (route uses null to 404 the request).
 */
export async function loadSessionById(
  sessionId: string,
  characterId: string,
  userId: string,
  opts: { withDebugInfo?: boolean } = {},
): Promise<LoadedConversation | null> {
  const [session] = await db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.id, sessionId))
    .limit(1);
  if (!session) return null;
  if (session.userId !== userId) return null;
  if (session.characterId !== characterId) return null;

  const character = await loadCharacterForChat(characterId, userId);
  if (!character) return null;

  const rows = await loadMessages(session.id, opts.withDebugInfo);
  return { session, character, messages: rows };
}

/**
 * "回到此处重说" —— soft-archive fork。把会话从某个**用户消息**节点截断:
 * 保留 [0, keepCount) 的活跃消息，把 [keepCount, …] 全部打上 superseded_at
 * 标记(软归档,不真删,见 0013 migration)。
 *
 * 语义契约:
 *   - keepCount = 客户端消息数组里 fork 目标(用户消息)的下标。截断后该用户
 *     消息及其之后全部归档,对话停在它前面那条 assistant(或开场白)上,用户
 *     可以重新输入。
 *   - **只允许 fork 用户输入**: rows[keepCount].role 必须是 "user",否则拒绝
 *     (Bot 气泡不挂 fork —— 产品决定)。
 *   - 客户端与服务端按**序数**对齐(都按 created_at asc 取活跃消息),绕开
 *     "本会话流式消息 id 与 DB 行 id 不一致"的坑。
 *
 * 非破坏: 归档行仍在库里,底层日志完整。返回归档条数供 UI toast。
 * 越界(keepCount<=0 或 >=活跃消息数 或目标非 user)→ no-op 返回 archived:0。
 */
export async function forkSessionAtMessage(
  sessionId: string,
  userId: string,
  keepCount: number,
): Promise<{ ok: boolean; archived: number }> {
  const [session] = await db
    .select({ id: chatSessions.id })
    .from(chatSessions)
    .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))
    .limit(1);
  if (!session) return { ok: false, archived: 0 };

  const rows = await db
    .select({ id: messages.id, role: messages.role })
    .from(messages)
    .where(
      and(eq(messages.sessionId, sessionId), isNull(messages.supersededAt)),
    )
    .orderBy(asc(messages.createdAt));

  // keepCount 必须落在 [1, len): 至少保留开场白,且 fork 点不能是末尾之后。
  if (
    !Number.isInteger(keepCount) ||
    keepCount < 1 ||
    keepCount >= rows.length
  ) {
    return { ok: false, archived: 0 };
  }
  // 只 fork 用户输入: 被截断的第一条(fork 目标)必须是用户消息。
  if (rows[keepCount].role !== "user") {
    return { ok: false, archived: 0 };
  }

  const toArchive = rows.slice(keepCount).map((r) => r.id);
  const archived = await db
    .update(messages)
    .set({ supersededAt: new Date() })
    .where(
      and(
        eq(messages.sessionId, sessionId),
        isNull(messages.supersededAt),
        inArray(messages.id, toArchive),
      ),
    )
    .returning({ id: messages.id });

  await db
    .update(chatSessions)
    .set({ lastMessageAt: new Date() })
    .where(eq(chatSessions.id, sessionId));

  return { ok: true, archived: archived.length };
}

/**
 * "保存并开启新对话" — mark the current (saved_at IS NULL) session as saved,
 * then create a fresh current session with opening seeded. Returns the new
 * session id so the caller can navigate.
 *
 * If there is no current session, just create a new one (idempotent enough
 * for double-click safety).
 */
export async function saveCurrentAndStartNew(
  characterId: string,
  userId: string,
): Promise<{ newSessionId: string } | null> {
  const character = await loadCharacterForChat(characterId, userId);
  if (!character) return null;

  await db
    .update(chatSessions)
    .set({ savedAt: new Date() })
    .where(
      and(
        eq(chatSessions.userId, userId),
        eq(chatSessions.characterId, characterId),
        isNull(chatSessions.savedAt),
        isNull(chatSessions.discardedAt),
      ),
    );

  const defaultMask = await getDefaultMask(userId);
  const [created] = await db
    .insert(chatSessions)
    .values({
      userId,
      characterId: character.id,
      title: null,
      activeMaskId: defaultMask?.id ?? null,
    })
    .returning();

  if (!created) return null;
  await seedOpeningMessage(created.id, character, userId);
  return { newSessionId: created.id };
}

/**
 * "开启新对话(不保存)" — 软删除当前临时对话(打 discarded_at 时间戳),然后
 * 创建一段新的。messages 保留在库,通过 URL/id 仍可加载(回收站语义),但侧栏
 * 和 find-or-create 不再看得到。物理清理留给后续 cron。
 *
 * 历史注记:曾经这里是 hard delete + CASCADE,用户点错一次直接丢日志
 * (2026-07-06 婉清 session 235047ae 3 条消息不可恢复即此)。改软删除后
 * 破坏性动作变可逆,UI 的 confirm 也仍然保留,但代价可控。
 */
export async function discardCurrentAndStartNew(
  characterId: string,
  userId: string,
): Promise<{ newSessionId: string } | null> {
  const character = await loadCharacterForChat(characterId, userId);
  if (!character) return null;

  await db
    .update(chatSessions)
    .set({ discardedAt: new Date() })
    .where(
      and(
        eq(chatSessions.userId, userId),
        eq(chatSessions.characterId, characterId),
        isNull(chatSessions.savedAt),
        isNull(chatSessions.discardedAt),
      ),
    );

  const defaultMask = await getDefaultMask(userId);
  const [created] = await db
    .insert(chatSessions)
    .values({
      userId,
      characterId: character.id,
      title: null,
      activeMaskId: defaultMask?.id ?? null,
    })
    .returning();

  if (!created) return null;
  await seedOpeningMessage(created.id, character, userId);
  return { newSessionId: created.id };
}

export interface SavedSessionListItem {
  id: string;
  title: string | null;
  savedAt: Date;
  lastMessageAt: Date;
  messageCount: number;
}

/**
 * List all saved (saved_at IS NOT NULL) sessions for (user, character) for
 * the history dialog. Newest save first.
 */
export async function listSavedSessions(
  userId: string,
  characterId: string,
): Promise<SavedSessionListItem[]> {
  const rows = await db
    .select({
      id: chatSessions.id,
      title: chatSessions.title,
      savedAt: chatSessions.savedAt,
      lastMessageAt: chatSessions.lastMessageAt,
      messageCount: count(messages.id),
    })
    .from(chatSessions)
    .leftJoin(
      messages,
      and(
        eq(messages.sessionId, chatSessions.id),
        isNull(messages.supersededAt),
      ),
    )
    .where(
      and(
        eq(chatSessions.userId, userId),
        eq(chatSessions.characterId, characterId),
        isNotNull(chatSessions.savedAt),
        isNull(chatSessions.discardedAt),
      ),
    )
    .groupBy(chatSessions.id)
    .orderBy(desc(chatSessions.savedAt));

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    // savedAt is non-null here (filtered above), narrow the type
    savedAt: r.savedAt as Date,
    lastMessageAt: r.lastMessageAt,
    messageCount: r.messageCount,
  }));
}

/**
 * Rename any of the user's own sessions (current or saved). Length 1-256.
 * Returns true on success, false on ownership / not-found.
 */
export async function renameSession(
  sessionId: string,
  userId: string,
  title: string,
): Promise<boolean> {
  const trimmed = title.trim();
  if (trimmed.length === 0 || trimmed.length > 256) return false;

  const result = await db
    .update(chatSessions)
    .set({ title: trimmed })
    .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))
    .returning({ id: chatSessions.id });

  return result.length > 0;
}

/**
 * Delete a user–assistant message pair from a session. The assistant message
 * is identified by `assistantMsgId`; the immediately preceding user message
 * (by created_at order) is also deleted. Both are hard-deleted so downstream
 * context never sees them again.
 */
export async function deleteMessagePair(
  sessionId: string,
  userId: string,
  assistantMsgId: string,
): Promise<{ ok: boolean; deleted: number }> {
  const [session] = await db
    .select({ id: chatSessions.id })
    .from(chatSessions)
    .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))
    .limit(1);
  if (!session) return { ok: false, deleted: 0 };

  const rows = await db
    .select({ id: messages.id, role: messages.role })
    .from(messages)
    .where(
      and(eq(messages.sessionId, sessionId), isNull(messages.supersededAt)),
    )
    .orderBy(asc(messages.createdAt));

  const targetIdx = rows.findIndex((r) => r.id === assistantMsgId);
  if (targetIdx < 0 || rows[targetIdx].role !== "assistant") {
    return { ok: false, deleted: 0 };
  }

  const toDelete = [rows[targetIdx].id];
  if (targetIdx > 0 && rows[targetIdx - 1].role === "user") {
    toDelete.push(rows[targetIdx - 1].id);
  }

  const deleted = await db
    .delete(messages)
    .where(
      and(eq(messages.sessionId, sessionId), inArray(messages.id, toDelete)),
    )
    .returning({ id: messages.id });

  return { ok: true, deleted: deleted.length };
}

/**
 * "删除已保存对话" — 软删除。只处理 saved_at IS NOT NULL 的行,拒绝对当前
 * 临时对话生效(那条路走 discardCurrentAndStartNew)。
 *
 * 打 discarded_at 时间戳,messages 留库。历史弹窗因为过滤 discarded_at IS
 * NULL,自动不再展示;通过 URL 精确 id 仍可加载(回收站语义)。物理清理留
 * 给后续 cron。
 *
 * 历史注记:曾经这里是 hard delete + CASCADE。合并 discardCurrentAndStartNew
 * 的软删除改造后一起变成不可逆动作可逆化。
 */
export async function deleteSavedSession(
  sessionId: string,
  userId: string,
): Promise<boolean> {
  const result = await db
    .update(chatSessions)
    .set({ discardedAt: new Date() })
    .where(
      and(
        eq(chatSessions.id, sessionId),
        eq(chatSessions.userId, userId),
        isNotNull(chatSessions.savedAt),
        isNull(chatSessions.discardedAt),
      ),
    )
    .returning({ id: chatSessions.id });

  return result.length > 0;
}

/**
 * Update the text content of a user message. Only the session owner can edit,
 * and only messages with role='user'.
 */
export async function updateUserMessage(
  sessionId: string,
  userId: string,
  messageId: string,
  newContent: string,
): Promise<{ ok: boolean }> {
  const [session] = await db
    .select({ id: chatSessions.id })
    .from(chatSessions)
    .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))
    .limit(1);
  if (!session) return { ok: false };

  const updated = await db
    .update(messages)
    .set({ content: newContent })
    .where(
      and(
        eq(messages.id, messageId),
        eq(messages.sessionId, sessionId),
        eq(messages.role, "user"),
        isNull(messages.supersededAt),
      ),
    )
    .returning({ id: messages.id });

  return { ok: updated.length > 0 };
}

/**
 * Update an assistant message's content. Verifies session ownership
 * and only messages with role='assistant'.
 */
export async function updateAssistantMessage(
  sessionId: string,
  userId: string,
  messageId: string,
  newContent: string,
): Promise<{ ok: boolean }> {
  const [session] = await db
    .select({ id: chatSessions.id })
    .from(chatSessions)
    .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))
    .limit(1);
  if (!session) return { ok: false };

  const updated = await db
    .update(messages)
    .set({ content: newContent })
    .where(
      and(
        eq(messages.id, messageId),
        eq(messages.sessionId, sessionId),
        eq(messages.role, "assistant"),
        isNull(messages.supersededAt),
      ),
    )
    .returning({ id: messages.id });

  return { ok: updated.length > 0 };
}

/**
 * Delete a user message and its following assistant reply. The user message
 * is identified by `userMsgId`; the immediately following assistant message
 * (by created_at order) is also deleted. Both are hard-deleted.
 */
export async function deleteUserMessagePair(
  sessionId: string,
  userId: string,
  userMsgId: string,
): Promise<{ ok: boolean; deleted: number }> {
  const [session] = await db
    .select({ id: chatSessions.id })
    .from(chatSessions)
    .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))
    .limit(1);
  if (!session) {
    console.error("[deleteUserMessagePair] Session not found or unauthorized", {
      sessionId,
      userId,
    });
    return { ok: false, deleted: 0 };
  }

  const rows = await db
    .select({ id: messages.id, role: messages.role })
    .from(messages)
    .where(
      and(eq(messages.sessionId, sessionId), isNull(messages.supersededAt)),
    )
    .orderBy(asc(messages.createdAt));

  const targetIdx = rows.findIndex((r) => r.id === userMsgId);
  if (targetIdx < 0) {
    console.error("[deleteUserMessagePair] Message not found in active messages", {
      userMsgId,
      sessionId,
      activeMessageIds: rows.map((r) => r.id),
    });
    return { ok: false, deleted: 0 };
  }
  if (rows[targetIdx].role !== "user") {
    console.error("[deleteUserMessagePair] Target message is not a user message", {
      userMsgId,
      role: rows[targetIdx].role,
    });
    return { ok: false, deleted: 0 };
  }

  const toDelete = [rows[targetIdx].id];
  if (targetIdx < rows.length - 1 && rows[targetIdx + 1].role === "assistant") {
    toDelete.push(rows[targetIdx + 1].id);
  }

  const deleted = await db
    .delete(messages)
    .where(
      and(eq(messages.sessionId, sessionId), inArray(messages.id, toDelete)),
    )
    .returning({ id: messages.id });

  console.log("[deleteUserMessagePair] Successfully deleted", {
    userMsgId,
    deleted: deleted.length,
    deletedIds: deleted.map((d) => d.id),
  });

  return { ok: true, deleted: deleted.length };
}
