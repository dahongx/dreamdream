/**
 * Drizzle schema for Dearm (寄情) v1.
 *
 * Aligned with docs/exec-plans/v1-foundation.md §三 (entities).
 * Includes Auth.js v5 tables (users / accounts / authSessions / verificationTokens)
 * named explicitly to avoid clash with the chat-session entity.
 */

import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

const now = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updated = () =>
  timestamp("updated_at", { withTimezone: true }).defaultNow().notNull();

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Auth.js managed fields (do not rename — DrizzleAdapter expects these names)
    name: text("name"),
    email: text("email"),
    phone: varchar("phone", { length: 32 }),
    emailVerified: timestamp("email_verified", { withTimezone: true }),
    image: text("image"),
    // Password auth (Credentials provider). Nullable so an account can exist
    // without one (future: OAuth signups, password reset flows).
    passwordHash: text("password_hash"),
    // Dearm profile fields (user-settable, shown in UI)
    username: varchar("username", { length: 64 }),
    displayName: varchar("display_name", { length: 128 }),
    avatarUrl: text("avatar_url"),
    // 个人主页(/me)展示的一句自介,设置页可编辑;不进 LLM prompt,纯展示。
    // migration 0022。280 字符上限在 application 层 Zod 约束。
    bio: text("bio"),
    // Tier + daily quota (migration 0016)
    role: text("role")
      .$type<"regular" | "beta_tester" | "admin">()
      .default("regular")
      .notNull(),
    dailyUsageCount: integer("daily_usage_count").default(0).notNull(),
    usageDate: date("usage_date", { mode: "string" }).defaultNow().notNull(),
    // Currency balances (migration 0025) - 聊天/美化包/图片生成统一从这里扣
    // 0028 把曾经并行的 gold_coins / silver_coins 列删了，只保留 *_balance。
    goldBalance: integer("gold_balance").default(100).notNull(),
    silverBalance: integer("silver_balance").default(200).notNull(),
    // 每日签到打卡日，用来防止一天重复领（migration 0024）
    lastDailyClaimDate: date("last_daily_claim_date", { mode: "string" }),
    // 会员等级 + 到期日（migration 0031）
    // tier 为 null 或 expiresAt < now() 即视为未订阅；只保留当前状态、不留历史。
    membershipTier: text("membership_tier").$type<
      "gold" | "platinum" | "diamond"
    >(),
    membershipExpiresAt: timestamp("membership_expires_at", {
      withTimezone: true,
    }),
    // 创作者返利余额（migration 0039）—— 独立「创作收益」，与消费用的整数
    // goldBalance 分离。numeric 支持小数（单笔返利可到 0.6）。每日 8 点结算累加。
    creatorEarnings: numeric("creator_earnings", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),
    createdAt: now(),
    updatedAt: updated(),
  },
  (t) => [
    uniqueIndex("users_email_uidx").on(t.email),
    // username 仅作展示名，可重复（登录靠唯一的 email）。保留普通索引利于查询。
    index("users_username_idx").on(t.username),
  ],
);

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const authSessions = pgTable("auth_sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

/* ─────────── domain ─────────── */

export const userMasks = pgTable(
  "user_masks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    note: text("note"),
    name: varchar("name", { length: 128 }).notNull(),
    gender: varchar("gender", { length: 10 }),
    description: text("description"),
    preference: text("preference"),
    instruction: text("instruction"),
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: now(),
    updatedAt: updated(),
  },
  (t) => [
    index("user_masks_user_updated_idx").on(t.userId, t.updatedAt.desc()),
  ],
);

export const beautificationPacks = pgTable(
  "beautification_packs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 128 }).notNull(),
    description: text("description"),
    globalCss: text("global_css"),
    isPublic: boolean("is_public").default(false).notNull(),
    subscriberCount: integer("subscriber_count").default(0).notNull(),
    createdAt: now(),
    updatedAt: updated(),
  },
  (t) => [
    index("packs_owner_idx").on(t.ownerUserId),
    index("packs_public_hot_idx").on(t.isPublic, t.subscriberCount),
  ],
);

export const characters = pgTable(
  "characters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // A. meta — does NOT enter LLM prompt
    name: varchar("name", { length: 128 }).notNull(),
    gender: text("gender")
      .$type<"male" | "female" | "other" | "unset">()
      .default("unset")
      .notNull(),
    age: integer("age"),
    nsfw: boolean("nsfw").default(false).notNull(),
    isAi: boolean("is_ai").default(false).notNull(),
    contentType: text("content_type")
      .$type<"original" | "self_designed" | "fanwork">()
      .default("original")
      .notNull(),
    coverImageUrl: text("cover_image_url"),
    avatarUrl: text("avatar_url"),
    tags: jsonb("tags").$type<string[]>().default([]).notNull(),
    bio: text("bio"),
    // 作者的话 —— 创作者对玩家说的话（展示性，给玩家看，不进 LLM prompt）。
    // 访客可见字段（见 CLAUDE.md 白名单）。外部导入的「作者的话」落这里。
    creatorNote: text("creator_note"),
    visibility: text("visibility")
      .$type<"public" | "private" | "unlisted">()
      .default("private")
      .notNull(),

    // B. persona — fed into system prompt
    persona: text("persona").notNull().default(""),
    adversity: text("adversity"),
    defaultCognition: text("default_cognition"),
    opening: text("opening"),

    // C. advanced settings
    plotSetting: text("plot_setting"),
    outputSetting: text("output_setting"),
    sampleDialogue: text("sample_dialogue"),

    // D. denormalized counters
    conversationCount: integer("conversation_count").default(0).notNull(),

    createdAt: now(),
    updatedAt: updated(),
  },
  (t) => [
    index("characters_visibility_created_idx").on(
      t.visibility,
      t.createdAt.desc(),
    ),
    index("characters_owner_idx").on(t.ownerId),
  ],
);

export const chatSessions = pgTable(
  "chat_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // 可空 + SET NULL(migration 0042):角色卡被删时会话不跟着走。
    // 这是账号注销的落点 —— 创作者注销会删掉他的角色卡,但**其他用户**跟这些卡
    // 的对话记录不能被连坐删除。character_id 置 null 后会话变「孤儿」:数据完整
    // 保留,列表里标灰不可点(与「角色被作者改成 private」共用 accessible 闸)。
    // 详见 docs/exec-plans/completed/account-deletion.md。
    characterId: uuid("character_id").references(() => characters.id, {
      onDelete: "set null",
    }),
    title: varchar("title", { length: 256 }),
    createdAt: now(),
    updatedAt: updated(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    // 显式"保存"动作把当前临时对话归档进历史。null = 当前未保存的临时
    // 对话(每用户每角色至多一条);非空 = 已归档,出现在历史保存对话弹窗。
    savedAt: timestamp("saved_at", { withTimezone: true }),
    // "开启新对话(不保存)" 打的软删除标记。null = 未丢弃;非空 = 已丢弃,
    // 侧栏 / find-or-create / 收藏预览等都过滤掉。exact-id 加载仍允许,
    // 相当于"回收站"——用户 URL 还在就能找回。物理清理留给后续 cron。
    discardedAt: timestamp("discarded_at", { withTimezone: true }),
    activeMaskId: uuid("active_mask_id").references(() => userMasks.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    index("chat_sessions_user_idx").on(t.userId, t.lastMessageAt.desc()),
    // 每 (user, character) 最多一个"当前临时"对话。已保存 / 已丢弃的不受限。
    // 路由 find-or-create 走这个 partial unique 兜底并发竞态。
    uniqueIndex("chat_sessions_user_char_current_uidx")
      .on(t.userId, t.characterId)
      .where(sql`${t.savedAt} IS NULL AND ${t.discardedAt} IS NULL`),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => chatSessions.id, { onDelete: "cascade" }),
    role: text("role").$type<"user" | "assistant">().notNull(),
    content: text("content").notNull(),
    renderedHtml: text("rendered_html"),
    model: varchar("model", { length: 64 }),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    cacheReadTokens: integer("cache_read_tokens"),
    cacheWriteTokens: integer("cache_write_tokens"),
    reasoningTokens: integer("reasoning_tokens"),
    costMillicents: integer("cost_millicents"),
    // CNY snapshot frozen at write time using the model's usd_cny_rate at
    // that moment. Lets aggregations stay stable across later rate edits.
    costCnyMillicents: integer("cost_cny_millicents"),
    // Currency payment tracking (migration 0026): which currency was used
    // (gold/silver) and how much was deducted for this message.
    currencyType: text("currency_type").$type<"gold" | "silver">(),
    currencyAmount: integer("currency_amount"),
    latencyMs: integer("latency_ms"),
    /**
     * Per-message debug payload. Shape (loose, not enforced):
     *   {
     *     rawOutput: string,           // model output before regex pass
     *     finishReason: string,        // streamText finishReason: 'stop' | 'length' | ...
     *     matchedRules: string[],      // regex_rules.id list that fired
     *     unmatchedRules: string[],    // visible rules that did not match
     *     systemPrompt: string,        // assembled system prompt
     *     toolCalls?: any[],
     *   }
     */
    debugInfo: jsonb("debug_info"),
    createdAt: now(),
    // 软归档标记。null = 活跃消息(正常渲染/喂给模型);非空 = 被 fork 截断掉
    // 的旧分叉尾巴。对用户看起来像"回到某节点后这些消息消失了",但底层日志
    // 不删 —— 所有读取处加 `superseded_at IS NULL` 过滤即可。见
    // forkSessionAtMessage (src/lib/sessions/queries.ts)。
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
  },
  (t) => [
    index("messages_session_created_idx").on(t.sessionId, t.createdAt),
    // 所有 load 都按 (session, 活跃) 取数,partial index 让活跃路径查询不被
    // 归档的旧分叉拖慢。对齐 chat_sessions 的 partial unique 写法。
    index("messages_session_active_idx")
      .on(t.sessionId, t.createdAt)
      .where(sql`${t.supersededAt} IS NULL`),
  ],
);

export const characterPackSubscriptions = pgTable(
  "character_pack_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    packId: uuid("pack_id")
      .notNull()
      .references(() => beautificationPacks.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull(),
    // Whether this subscription's pack.globalCss is applied to the character's
    // chat page. Default true preserves the legacy behavior (subscribing a pack
    // pulled its CSS in). Set to false when the creator wants the regex rules
    // but not the cosmetic CSS. See loadCharacterGlobalCss for the filter.
    cssEnabled: boolean("css_enabled").default(true).notNull(),
    openingEnabled: boolean("opening_enabled").default(true).notNull(),
    createdAt: now(),
  },
  (t) => [
    uniqueIndex("char_pack_sub_uidx").on(t.characterId, t.packId),
    index("char_pack_sub_order_idx").on(t.characterId, t.orderIndex),
  ],
);

export const regexRules = pgTable(
  "regex_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    packId: uuid("pack_id")
      .notNull()
      .references(() => beautificationPacks.id, { onDelete: "cascade" }),

    name: varchar("name", { length: 128 }).notNull(),

    // Creator's raw input — sample LLM output the rule should match.
    targetText: text("target_text"),

    // Compiled output — what runtime actually uses
    pattern: text("pattern").notNull(),
    replacement: text("replacement").notNull(),

    // Variable mapping metadata — drives the variable-pill UI; populated
    // automatically when pattern is derived from targetText.
    variableMapping: jsonb("variable_mapping")
      .$type<Array<{ index: number; name: string; sample?: string }>>()
      .default([])
      .notNull(),

    // Output guidance — concatenated into system prompt so the model knows how to emit the tag
    outputGuidance: text("output_guidance"),

    enabled: boolean("enabled").default(true).notNull(),
    visible: boolean("visible").default(false).notNull(),
    orderIndex: integer("order_index").default(0).notNull(),

    createdAt: now(),
    updatedAt: updated(),
  },
  (t) => [index("regex_rules_pack_order_idx").on(t.packId, t.orderIndex)],
);

export const subscriptionRuleOverrides = pgTable(
  "subscription_rule_overrides",
  {
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => characterPackSubscriptions.id, { onDelete: "cascade" }),
    ruleId: uuid("rule_id")
      .notNull()
      .references(() => regexRules.id, { onDelete: "cascade" }),
    disabled: boolean("disabled").notNull(),
  },
  (t) => [primaryKey({ columns: [t.subscriptionId, t.ruleId] })],
);

/**
 * 开场组件 —— 与 regex_rules（对话组件）并列的第二种包内条目。
 *
 * 与对话组件的本质区别：开场组件是**静态**的，不匹配任何模型输出（无 pattern /
 * 无 capture group / 无 outputGuidance / 不进 system prompt）。它在「独立开场插槽」
 * 里每会话渲染一次、不随对话变化，内容由创作者用单独的 AI 生成器产出。
 *
 * 访问边界（owner-private）：开场组件即使所在包被别的创作者订阅也**不传递**——
 * 仅当「包 owner == 角色 owner」时才在该角色聊天页渲染（见 loadCharacterOpeningComponents）。
 * 这让包对对话组件保持可复用/可分享，但创作者 bespoke 的开场组件是不外泄的护城河。
 *
 * content 渲染路由复用 regex segments 约定（segments.ts ARTIFACT_ENVELOPE_RE）：
 * `<artifact>…</artifact>` → iframe 沙箱，否则走 sanitize HTML。
 */
export const openingComponents = pgTable(
  "opening_components",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    packId: uuid("pack_id")
      .notNull()
      .references(() => beautificationPacks.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 128 }).notNull(),
    content: text("content").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    orderIndex: integer("order_index").default(0).notNull(),
    createdAt: now(),
    updatedAt: updated(),
  },
  (t) => [
    index("opening_components_pack_order_idx").on(t.packId, t.orderIndex),
  ],
);

/**
 * 开场组件的逐条开关 —— 镜像 subscriptionRuleOverrides。无记录 = 该组件随包总闸
 * 开启;disabled=true = 角色 owner 明确关掉了这条开场组件。读路径见
 * loadCharacterOpeningComponents(LEFT JOIN 过滤 disabled !== true)。
 */
export const openingComponentOverrides = pgTable(
  "opening_component_overrides",
  {
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => characterPackSubscriptions.id, { onDelete: "cascade" }),
    openingComponentId: uuid("opening_component_id")
      .notNull()
      .references(() => openingComponents.id, { onDelete: "cascade" }),
    disabled: boolean("disabled").notNull(),
  },
  (t) => [primaryKey({ columns: [t.subscriptionId, t.openingComponentId] })],
);

/**
 * 角色槽位填充 —— 每(角色, 开场组件, 槽位名) 一条手填值。创作者在 studio 组件内容
 * 里用 {{槽位名}} 挖空位(保留字 char/user 自动填,不进此表),每个角色在编辑页各自
 * 手填。按 character 而非 subscription:切换订阅不丢已填值。运行时静态替换,不调 AI。
 */
export const characterOpeningSlotValues = pgTable(
  "character_opening_slot_values",
  {
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    openingComponentId: uuid("opening_component_id")
      .notNull()
      .references(() => openingComponents.id, { onDelete: "cascade" }),
    slotKey: varchar("slot_key", { length: 128 }).notNull(),
    slotValue: text("slot_value").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.characterId, t.openingComponentId, t.slotKey] }),
  ],
);

/**
 * Studio AI 助手的 session 模型 —— 一个 session 锁定到一个产物：
 *   type="css"       → 迭代该 pack 唯一的 globalCss
 *   type="component" → 新增 / 编辑 ONE regex_rule
 *   type="opening"   → 新增 / 编辑 ONE opening_component（静态开场组件）
 * 多轮 chat 到满意 → 「确认应用」commit 入库 + 同步主 preview。
 * 详见 docs/exec-plans/active/studio-session-refactor.md（待写）。
 */
export const studioSessions = pgTable(
  "studio_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    packId: uuid("pack_id")
      .notNull()
      .references(() => beautificationPacks.id, { onDelete: "cascade" }),
    type: text("type").$type<"css" | "component" | "opening">().notNull(),
    status: text("status")
      .$type<"active" | "committed" | "discarded">()
      .notNull()
      .default("active"),
    title: text("title"),
    // 编辑已有 rule 时绑定；新增时为 null。rule 删除后置空，session 历史保留。
    targetRuleId: uuid("target_rule_id").references(() => regexRules.id, {
      onDelete: "set null",
    }),
    // 编辑已有开场组件时绑定（type="opening"）；新增时为 null。组件删除后置空。
    targetOpeningComponentId: uuid("target_opening_component_id").references(
      () => openingComponents.id,
      { onDelete: "set null" },
    ),
    // WIP payload。type="css" → { kind:"css", css:string }
    //              type="component" → { kind:"rule", rule: ProposalAddRule }
    //              null = 还没 Apply 过任何 proposal
    draftPayload: jsonb("draft_payload"),
    createdAt: now(),
    updatedAt: updated(),
  },
  (t) => [
    index("studio_sessions_pack_idx").on(
      t.userId,
      t.packId,
      t.status,
      t.updatedAt,
    ),
  ],
);

/** Studio AI 助手用户消息可附带的参考图。jsonb 里存 R2 public URL + 元数据。
 *  仅 user role 用得到；assistant role 总是 null。 */
export type MessageAttachment = {
  url: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  size: number;
};

export const packAssistantMessages = pgTable(
  "pack_assistant_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => studioSessions.id, { onDelete: "cascade" }),
    role: text("role").$type<"user" | "assistant">().notNull(),
    content: text("content").notNull(),
    attachments: jsonb("attachments").$type<MessageAttachment[]>(),
    createdAt: now(),
  },
  (t) => [
    index("pack_assistant_msgs_session_idx").on(t.sessionId, t.createdAt),
  ],
);

export const userRegexPreferences = pgTable(
  "user_regex_preferences",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    regexRuleId: uuid("regex_rule_id")
      .notNull()
      .references(() => regexRules.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").default(true).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.regexRuleId] })],
);

export const characterComments = pgTable(
  "character_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    body: text("body").notNull(),
    createdAt: now(),
    updatedAt: updated(),
  },
  (t) => [
    foreignKey({
      columns: [t.parentId],
      foreignColumns: [t.id],
      name: "character_comments_parent_id_fk",
    }).onDelete("cascade"),
    index("character_comments_thread_idx").on(
      t.characterId,
      t.parentId,
      t.createdAt,
    ),
  ],
);

export const characterCommentLikes = pgTable(
  "character_comment_likes",
  {
    commentId: uuid("comment_id")
      .notNull()
      .references(() => characterComments.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: now(),
  },
  (t) => [
    primaryKey({ columns: [t.commentId, t.userId] }),
    index("character_comment_likes_user_idx").on(t.userId),
  ],
);

/* ─────────── character favorites + likes (migration 0023) ─────────── */

/**
 * 用户对角色的「收藏」—— 私有,聚合进 /sessions「我的收藏」tab。
 * 同 (user, character) 至多一条。同源结构参考 characterCommentLikes。
 */
export const characterFavorites = pgTable(
  "character_favorites",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    createdAt: now(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.characterId] }),
    index("character_favorites_character_idx").on(t.characterId),
    index("character_favorites_user_created_idx").on(
      t.userId,
      t.createdAt.desc(),
    ),
  ],
);

/**
 * 用户对角色的「点赞」—— 公开,聚合数渲染在角色详情页 hero 心形按钮旁。
 * 同 (user, character) 至多一条。
 */
export const characterLikes = pgTable(
  "character_likes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    createdAt: now(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.characterId] }),
    index("character_likes_character_idx").on(t.characterId),
  ],
);

/* ─────────── invite codes (migration 0016) ─────────── */

export const inviteCodes = pgTable(
  "invite_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 32 }).notNull(),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    maxUses: integer("max_uses").default(1).notNull(),
    usedCount: integer("used_count").default(0).notNull(),
    dailyLimit: integer("daily_limit").default(200).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: now(),
  },
  (t) => [uniqueIndex("invite_codes_code_uidx").on(t.code)],
);

export const inviteCodeRedemptions = pgTable(
  "invite_code_redemptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    codeId: uuid("code_id")
      .notNull()
      .references(() => inviteCodes.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("invite_code_redemptions_user_code_uidx").on(
      t.userId,
      t.codeId,
    ),
  ],
);

/**
 * Per-model pricing (USD per 1M tokens), expressed as integer
 * micro-USD-per-M-token (1 USD = 1_000_000). Lets admin edit prices at
 * runtime without code changes. messages.cost_millicents is computed at
 * write-time using the price row current at that moment, so historical
 * messages stay frozen while new messages pick up the new rate.
 *
 * One row per model_id. Edits update this row AND append a snapshot to
 * model_price_history for audit.
 */
export const modelPrices = pgTable("model_prices", {
  modelId: text("model_id").primaryKey(),
  displayName: text("display_name").notNull(),
  inputPerMTokMicroUsd: integer("input_per_m_tok_micro_usd").notNull(),
  outputPerMTokMicroUsd: integer("output_per_m_tok_micro_usd").notNull(),
  cacheReadPerMTokMicroUsd: integer("cache_read_per_m_tok_micro_usd").notNull(),
  cacheWritePerMTokMicroUsd: integer(
    "cache_write_per_m_tok_micro_usd",
  ).notNull(),
  reasoningPerMTokMicroUsd: integer("reasoning_per_m_tok_micro_usd").notNull(),
  // USD→CNY exchange rate as integer micro (rate × 1_000_000). 7.2 → 7_200_000.
  usdCnyRateMicro: integer("usd_cny_rate_micro").notNull().default(7_200_000),
  // Currency cost per model call (migration 0024)
  goldCostPerCall: integer("gold_cost_per_call").default(1).notNull(),
  silverCostPerCall: integer("silver_cost_per_call").default(2).notNull(),
  notes: text("notes"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedBy: uuid("updated_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: now(),
});

/**
 * Append-only audit of every price change. The initial migration seeds one
 * row per model so "first effective_from" always exists.
 */
export const modelPriceHistory = pgTable(
  "model_price_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    modelId: text("model_id").notNull(),
    displayName: text("display_name").notNull(),
    inputPerMTokMicroUsd: integer("input_per_m_tok_micro_usd").notNull(),
    outputPerMTokMicroUsd: integer("output_per_m_tok_micro_usd").notNull(),
    cacheReadPerMTokMicroUsd: integer(
      "cache_read_per_m_tok_micro_usd",
    ).notNull(),
    cacheWritePerMTokMicroUsd: integer(
      "cache_write_per_m_tok_micro_usd",
    ).notNull(),
    reasoningPerMTokMicroUsd: integer(
      "reasoning_per_m_tok_micro_usd",
    ).notNull(),
    usdCnyRateMicro: integer("usd_cny_rate_micro").notNull().default(7_200_000),
    notes: text("notes"),
    effectiveFrom: timestamp("effective_from", { withTimezone: true })
      .defaultNow()
      .notNull(),
    changedBy: uuid("changed_by").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    index("model_price_history_model_idx").on(t.modelId, t.effectiveFrom),
  ],
);

/* ─────────── currency transactions (migration 0024) ─────────── */

/**
 * 货币交易记录表 —— 记录所有金币和银币的变动。
 *
 * 交易类型：
 * - daily_claim: 每日登录领取银币
 * - recharge: 充值获得金币
 * - model_usage: 调用模型消耗金币或银币
 */
export const currencyTransactions = pgTable(
  "currency_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    transactionType: text("transaction_type")
      .$type<"daily_claim" | "recharge" | "model_usage">()
      .notNull(),
    currencyType: text("currency_type").$type<"gold" | "silver">().notNull(),
    // 变动数量（正数表示增加，负数表示减少）
    amount: integer("amount").notNull(),
    // 交易后余额快照
    balanceAfter: integer("balance_after").notNull(),
    // 关联的模型 ID（仅 model_usage 类型有值）
    modelId: text("model_id"),
    // 关联的消息 ID（仅 model_usage 类型有值）
    messageId: uuid("message_id").references(() => messages.id, {
      onDelete: "set null",
    }),
    // 关联的会话 ID（聊天/续写扣费冗余存这一列，让 ledger UI 不依赖 messageId
    // 链路：流式 onError 没插 message 时，凭 sessionId 也能 JOIN 出角色名）
    sessionId: uuid("session_id").references(() => chatSessions.id, {
      onDelete: "set null",
    }),
    // 操作员 ID（仅 transaction_type='recharge' 由 admin 手动操作时有值，
    // 让 ledger UI 在「充值」一栏明确展示哪个 admin 操作的，便于审计
    // 与给当事用户解释来源。migration 0030。
    operatorId: uuid("operator_id").references(() => users.id, {
      onDelete: "set null",
    }),
    // 调用对应的真实 CNY 成本 snapshot（millicents）。migration 0031。
    // 写入时机：deduct 之后等流式 onFinish 拿到 usage，settleTransactionCost
    // 单独 UPDATE 这一列。失败 / 退款行保持 NULL；账本 UI 对 refund 行从
    // 配对的 deduct 行反推显示。老聊天数据仍能从 messages JOIN 兜底。
    costCnyMillicents: integer("cost_cny_millicents"),
    // 备注信息
    note: text("note"),
    createdAt: now(),
  },
  (t) => [
    index("currency_transactions_user_created_idx").on(
      t.userId,
      t.createdAt.desc(),
    ),
    index("currency_transactions_type_idx").on(
      t.userId,
      t.transactionType,
      t.createdAt.desc(),
    ),
  ],
);

/* ─────────── payment orders (migration 0033) ─────────── */

/**
 * 支付订单 —— 真实付款的「钱」侧记录，与 currencyTransactions（「账」侧
 * 余额变动）分工。每次在 /shop 下单建一行 pending，webhook 履约时翻成 paid。
 *
 * 幂等锚点：stripe_session_id UNIQUE。webhook 可能重投/重放同一事件，fulfillOrder
 * 在事务里 `for update` 选这行，已 paid 直接 no-op，绝不重复发月卡/银两。
 *
 * 履约时机：唯一可信信号是 Stripe webhook（支付宝/微信是异步重定向型，不能靠
 * 前端跳回发货）。fulfilled_at 为 null 表示尚未发货。
 *
 * 只接一次性买断月卡（mode:payment）—— 支付宝/微信不支持订阅，故无续费订阅 ID。
 */
export const paymentOrders = pgTable(
  "payment_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // 可空 + SET NULL(migration 0042):账号注销时订单不跟着删,只脱钩。
    // 隐私政策 8.2 自己写了「交易与对账记录按适用税法要求保留」,日本帐簿书类
    // 另有保存义务 —— 人删了,金额 / stripe_session_id / 时间必须留着能对账。
    // ⚠️ fulfillOrder 必须处理 user_id IS NULL(建单到履约之间用户注销了)。
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    // 购买的月卡档位（与 users.membership_tier / TIER_SPECS 对齐）。
    // null 表示金币包订单（非月卡），金币数量快照存于 goldAmount。
    tier: text("tier").$type<"gold" | "platinum" | "diamond">(),
    packageId: text("package_id"),
    goldAmount: integer("gold_amount"),
    // 支付渠道：保留 Stripe，同时支持 PayProo。
    provider: text("provider")
      .$type<"stripe" | "payproo">()
      .default("stripe")
      .notNull(),
    // 商户订单号 —— PayProo 和回跳轮询的通用幂等锚点。
    merchantOrderId: text("merchant_order_id"),
    // Stripe Checkout Session ID（cs_...）。PayProo 订单为空。
    stripeSessionId: text("stripe_session_id"),
    // Stripe PaymentIntent ID（pi_...）—— 履约时从 session 回填，便于对账/退款。
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    // PayProo 平台订单号 / 支付流水号。PayProo 订单使用，Stripe 为空。
    payprooOrderNo: text("payproo_order_no"),
    // 实收金额，最小货币单位（USD → cents）。履约时从 session.amount_total 回填。
    amountTotal: integer("amount_total"),
    // 结算币种（'usd'）。
    currency: text("currency"),
    // 订单状态：建单 pending → webhook 翻 paid / failed / expired。
    status: text("status")
      .$type<"pending" | "paid" | "failed" | "expired">()
      .default("pending")
      .notNull(),
    // 履约（发月卡 + 银两）完成时间；null = 尚未发货。
    fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }),
    createdAt: now(),
    updatedAt: updated(),
  },
  (t) => [
    uniqueIndex("payment_orders_session_uidx").on(t.stripeSessionId),
    uniqueIndex("payment_orders_merchant_order_uidx").on(t.merchantOrderId),
    index("payment_orders_user_created_idx").on(t.userId, t.createdAt.desc()),
  ],
);

/* ─────────── platform notifications (migration 0043) ─────────── */

export const platformNotifications = pgTable(
  "platform_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    notificationType: text("notification_type")
      .$type<"announcement" | "reminder">()
      .default("announcement")
      .notNull(),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    targetUserId: uuid("target_user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    title: varchar("title", { length: 120 }).notNull(),
    body: text("body").notNull(),
    createdAt: now(),
  },
  (t) => [
    index("platform_notifications_created_idx").on(t.createdAt.desc()),
    index("platform_notifications_target_created_idx").on(
      t.targetUserId,
      t.createdAt.desc(),
    ),
  ],
);

export const userNotificationReads = pgTable(
  "user_notification_reads",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    notificationId: uuid("notification_id")
      .notNull()
      .references(() => platformNotifications.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.notificationId] }),
    index("user_notification_reads_user_read_idx").on(
      t.userId,
      t.readAt.desc(),
    ),
  ],
);

/* ─────────── user follows (migration 0025) ─────────── */

/**
 * 用户关注关系表 —— 记录用户之间的关注关系（主要用于关注角色创作者）。
 * follower 关注 following。
 */
export const userFollows = pgTable(
  "user_follows",
  {
    followerId: uuid("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followingId: uuid("following_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: now(),
  },
  (t) => [
    primaryKey({ columns: [t.followerId, t.followingId] }),
    index("user_follows_follower_idx").on(t.followerId, t.createdAt.desc()),
    index("user_follows_following_idx").on(t.followingId, t.createdAt.desc()),
  ],
);

/* ─────────── creator rebate (migration 0039) ─────────── */

/**
 * 创作者返利记录 —— 收益详情 tab 的数据源。一条 = 某作者某天某角色（或账号级
 * 粉丝返利）的一笔进账。characterId 可空：粉丝返利属于账号不属于任何角色，
 * 那一行 characterId = null、kind = 'fans'。
 */
export const creatorEarningRecords = pgTable(
  "creator_earning_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // 粉丝返利为 null；角色删了记录一并删。
    characterId: uuid("character_id").references(() => characters.id, {
      onDelete: "cascade",
    }),
    kind: text("kind")
      .$type<"dialogue" | "like" | "favorite" | "fans">()
      .notNull(),
    // 进账金额（正数，小数）。drizzle numeric 以 string 读写，避免浮点误差。
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    // 计算明细快照，便于审计（如 { goldConsumed, delta } / { likeDelta }）。
    detail: jsonb("detail"),
    createdAt: now(),
  },
  (t) => [
    index("creator_earning_records_user_created_idx").on(
      t.userId,
      t.createdAt.desc(),
    ),
  ],
);

/**
 * 按角色的返利防刷 / 幂等游标 —— 每角色一行，存「上次结算时各累计量的快照」。
 * 每次结算只对「当前累计 − 快照」的正增量返利，再把快照推进。点赞/收藏用高水位
 * 棘轮：取消再点不会重复发钱；一天多跑也不会重复计。对话金币按已发档位推进
 * （3 金币一档，余数结转到下次）。
 *
 * ⚠️ 首次上线须先 seed（把游标设成当前值、不发钱），否则第一次结算会把全部
 * 历史点赞/收藏/金币一次性补发。见 scripts/run-daily-rebate.ts --seed。
 */
export const creatorCharacterCursors = pgTable("creator_character_cursors", {
  characterId: uuid("character_id")
    .primaryKey()
    .references(() => characters.id, { onDelete: "cascade" }),
  // 该角色被消耗的「金币」累计快照（对话返利用）
  lastGoldConsumed: integer("last_gold_consumed").default(0).notNull(),
  // 该角色对话条数快照（migration 0040）—— 仅用于总览「新增 ▲」增量基线，
  // 不参与返利发钱（对话返利仍按金币消耗）。
  conversationsSettled: integer("conversations_settled").default(0).notNull(),
  // 该角色被点赞的累计条数快照
  likesSettled: integer("likes_settled").default(0).notNull(),
  // 该角色被收藏的累计条数快照
  favoritesSettled: integer("favorites_settled").default(0).notNull(),
  updatedAt: updated(),
});

/**
 * 粉丝返利游标 —— 按作者（账号级，不属于任何角色）。高水位棘轮防刷。
 */
export const creatorFansCursors = pgTable("creator_fans_cursors", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  fansSettled: integer("fans_settled").default(0).notNull(),
  updatedAt: updated(),
});

/* ─────────── inferred types (re-exported via src/types) ─────────── */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserMask = typeof userMasks.$inferSelect;
export type NewUserMask = typeof userMasks.$inferInsert;
export type Character = typeof characters.$inferSelect;
export type NewCharacter = typeof characters.$inferInsert;
export type ChatSession = typeof chatSessions.$inferSelect;
export type NewChatSession = typeof chatSessions.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type BeautificationPack = typeof beautificationPacks.$inferSelect;
export type NewBeautificationPack = typeof beautificationPacks.$inferInsert;

export const modelHealthStatus = pgTable("model_health_status", {
  modelId: text("model_id").primaryKey(),
  status: text("status", {
    enum: ["healthy", "degraded", "unhealthy", "unknown"],
  })
    .notNull()
    .default("unknown"),
  lastCheckAt: timestamp("last_check_at", { withTimezone: true }),
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  lastErrorAt: timestamp("last_error_at", { withTimezone: true }),
  lastErrorMessage: text("last_error_message"),
  avgLatencyMs: integer("avg_latency_ms"),
  checkCount: integer("check_count").notNull().default(0),
  successCount: integer("success_count").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * Recent real-user model attempts used by the model picker health indicator.
 *
 * This deliberately stores no user/session/message identifiers or content. It
 * only records the provider-facing model, outcome and timing so operational
 * health can be aggregated without turning this table into chat telemetry.
 */
export const modelRequestEvents = pgTable(
  "model_request_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    modelId: varchar("model_id", { length: 64 }).notNull(),
    outcome: text("outcome", { enum: ["success", "failure"] }).notNull(),
    ttftMs: integer("ttft_ms"),
    durationMs: integer("duration_ms").notNull(),
    createdAt: now(),
  },
  (t) => [
    index("model_request_events_model_created_idx").on(
      t.modelId,
      t.createdAt.desc(),
    ),
    index("model_request_events_created_idx").on(t.createdAt),
  ],
);

/* ─────────── account deletion (migration 0042) ─────────── */

/**
 * 已注销邮箱的哈希 —— 唯一作用是让同一邮箱重新注册时不再发新人币
 * （users 表的列默认值 gold 100 / silver 200，注销→重注册可无限刷）。
 *
 * **刻意不含 user_id、不与任何内容表建立关联。** 账号注销是硬删除，这张表是
 * 全库唯一残留物；一旦它能指回任何内容行，「注销即删干净」就不成立了。
 *
 * 存的是 HMAC-SHA256(pepper, lower(trim(email)))，pepper 走服务端 env
 * ACCOUNT_DELETION_EMAIL_PEPPER。用 HMAC 而非裸 SHA256 —— 邮箱空间小到可以
 * 字典枚举，裸哈希等于明文。
 *
 * 详见 docs/exec-plans/completed/account-deletion.md。
 */
export const deactivatedEmailHashes = pgTable("deactivated_email_hashes", {
  emailHash: text("email_hash").primaryKey(),
  deactivatedAt: timestamp("deactivated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const OFFICIAL_PACK_IDS = {
  yearnPhone: "00000000-0000-0000-0000-000000000002",
} as const;
export type CharacterPackSubscription =
  typeof characterPackSubscriptions.$inferSelect;
export type NewCharacterPackSubscription =
  typeof characterPackSubscriptions.$inferInsert;
export type SubscriptionRuleOverride =
  typeof subscriptionRuleOverrides.$inferSelect;
export type RegexRule = typeof regexRules.$inferSelect;
export type NewRegexRule = typeof regexRules.$inferInsert;
export type OpeningComponent = typeof openingComponents.$inferSelect;
export type NewOpeningComponent = typeof openingComponents.$inferInsert;
export type OpeningComponentOverride =
  typeof openingComponentOverrides.$inferSelect;
export type NewOpeningComponentOverride =
  typeof openingComponentOverrides.$inferInsert;
export type CharacterOpeningSlotValue =
  typeof characterOpeningSlotValues.$inferSelect;
export type NewCharacterOpeningSlotValue =
  typeof characterOpeningSlotValues.$inferInsert;
export type UserRegexPreference = typeof userRegexPreferences.$inferSelect;
export type CharacterComment = typeof characterComments.$inferSelect;
export type NewCharacterComment = typeof characterComments.$inferInsert;
export type CharacterCommentLike = typeof characterCommentLikes.$inferSelect;
export type PackAssistantMessage = typeof packAssistantMessages.$inferSelect;
export type NewPackAssistantMessage = typeof packAssistantMessages.$inferInsert;
export type StudioSession = typeof studioSessions.$inferSelect;
export type NewStudioSession = typeof studioSessions.$inferInsert;
export type InviteCode = typeof inviteCodes.$inferSelect;
export type NewInviteCode = typeof inviteCodes.$inferInsert;
export type InviteCodeRedemption = typeof inviteCodeRedemptions.$inferSelect;
export type ModelPrice = typeof modelPrices.$inferSelect;
export type NewModelPrice = typeof modelPrices.$inferInsert;
export type ModelPriceHistory = typeof modelPriceHistory.$inferSelect;
export type NewModelPriceHistory = typeof modelPriceHistory.$inferInsert;
export type CurrencyTransaction = typeof currencyTransactions.$inferSelect;
export type NewCurrencyTransaction = typeof currencyTransactions.$inferInsert;
export type CreatorEarningRecord = typeof creatorEarningRecords.$inferSelect;
export type NewCreatorEarningRecord = typeof creatorEarningRecords.$inferInsert;
export type CreatorCharacterCursor =
  typeof creatorCharacterCursors.$inferSelect;
export type NewCreatorCharacterCursor =
  typeof creatorCharacterCursors.$inferInsert;
export type CreatorFansCursor = typeof creatorFansCursors.$inferSelect;
export type NewCreatorFansCursor = typeof creatorFansCursors.$inferInsert;
export type PaymentOrder = typeof paymentOrders.$inferSelect;
export type NewPaymentOrder = typeof paymentOrders.$inferInsert;
export type UserFollow = typeof userFollows.$inferSelect;
export type NewUserFollow = typeof userFollows.$inferInsert;
export type ModelHealthStatus = typeof modelHealthStatus.$inferSelect;
export type NewModelHealthStatus = typeof modelHealthStatus.$inferInsert;
export type UserRole = User["role"];
/** Studio session 的草稿载荷形态。type="css" 或 "component" 时分别使用。
 *  字段与 src/lib/packs/session-actions.ts 里的 ruleDraftSchema 对齐。 */
export type StudioDraftPayload =
  | { kind: "css"; css: string }
  | {
      kind: "rule";
      rule: {
        name: string;
        description?: string;
        targetText?: string | null;
        pattern: string;
        replacement: string;
        variableMapping: Array<{
          index: number;
          name: string;
          sample?: string;
        }>;
        outputGuidance?: string | null;
        enabled: boolean;
        visible: boolean;
      };
    }
  | {
      kind: "opening";
      opening: {
        name: string;
        description?: string;
        content: string;
        enabled: boolean;
      };
    };
