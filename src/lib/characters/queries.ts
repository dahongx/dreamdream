import { and, desc, eq, ilike, lt, or, sql } from "drizzle-orm";
import { sfwExploreTagValues } from "@/lib/characters/sfw-explore-tags";
import { SFW_MODE } from "@/lib/config/site";
import { db } from "@/lib/db/client";
import { type Character, characters, users } from "@/lib/db/schema";

export type ExploreListItem = Pick<
  Character,
  | "id"
  | "name"
  | "bio"
  | "tags"
  | "nsfw"
  | "coverImageUrl"
  | "avatarUrl"
  | "visibility"
  | "conversationCount"
  | "createdAt"
  | "ownerId"
> & {
  ownerDisplayName: string | null;
  ownerUsername: string | null;
  likesCount: number;
  favoritesCount: number;
};

const ownerDisplayNameExpr = sql<
  string | null
>`coalesce(${users.displayName}, ${users.name}, ${users.username})`;
const likesCountExpr = sql<number>`coalesce((
  select count(*)::int from character_likes where character_id = ${characters.id}
), 0)`;
const favoritesCountExpr = sql<number>`coalesce((
  select count(*)::int from character_favorites where character_id = ${characters.id}
), 0)`;

const exploreSelect = {
  id: characters.id,
  name: characters.name,
  bio: characters.bio,
  tags: characters.tags,
  nsfw: characters.nsfw,
  coverImageUrl: characters.coverImageUrl,
  avatarUrl: characters.avatarUrl,
  visibility: characters.visibility,
  conversationCount: characters.conversationCount,
  createdAt: characters.createdAt,
  ownerId: characters.ownerId,
  ownerDisplayName: ownerDisplayNameExpr,
  ownerUsername: users.username,
  likesCount: likesCountExpr,
  favoritesCount: favoritesCountExpr,
};

export type ExploreSort = "recommended" | "latest" | "trending" | "hot";

export const EXPLORE_SORTS: ExploreSort[] = [
  "recommended",
  "latest",
  "trending",
  "hot",
];

export function parseExploreSort(v: string | undefined): ExploreSort {
  return v === "latest" ||
    v === "trending" ||
    v === "hot" ||
    v === "recommended"
    ? v
    : "recommended";
}

export interface ListCharactersParams {
  showNsfw: boolean;
  ownerId?: string | null;
  /**
   * 用于「推荐」排序：从该用户的 likes/favorites 聚合 tag 偏好，
   * 命中数最多的卡排前面。未传 / 该用户没有偏好时回退到 recentScore。
   */
  viewerId?: string | null;
  sort?: ExploreSort;
  /** null returns every row matching the active filters. */
  limit?: number | null;
  cursor?: { createdAt: Date; id: string } | null;
  search?: string;
  tag?: string;
  /**
   * 屏蔽的 tag 列表：任何一个命中就排除。和 `tag`（正向筛选）独立，
   * 两者可并存（例：tag="校园" + excludeTags=["NSFW", "高虐"]）。
   */
  excludeTags?: string[];
}

/**
 * Explore page query. Returns public + (if logged-in) own private characters.
 * Cursor pagination on (createdAt, id) to keep it stable when many cards share
 * the same second-precision timestamp.
 *
 * NSFW filter is metadata-only; the platform does no content detection.
 *
 * Sort modes:
 *   recommended  viewer 偏好标签命中数 desc;未登录/无偏好 → recentScore desc
 *   latest       createdAt desc
 *   trending     最近 7 天 assistant 消息数 desc(短期热度);并列时按 createdAt
 *   hot          conversationCount + likes + favorites desc(总热度)
 */
export async function listCharactersForExplore({
  showNsfw,
  ownerId,
  viewerId,
  sort = "recommended",
  limit = 24,
  cursor = null,
  search,
  tag,
  excludeTags,
}: ListCharactersParams): Promise<ExploreListItem[]> {
  const visibilityClause = ownerId
    ? or(eq(characters.visibility, "public"), eq(characters.ownerId, ownerId))
    : eq(characters.visibility, "public");

  const conditions = [visibilityClause];
  if (!showNsfw) conditions.push(eq(characters.nsfw, false));
  if (cursor) {
    conditions.push(lt(characters.createdAt, cursor.createdAt));
  }
  if (search?.trim()) {
    const pattern = `%${search.trim()}%`;
    conditions.push(
      or(
        ilike(characters.name, pattern),
        ilike(characters.bio, pattern),
      ) as ReturnType<typeof eq>,
    );
  }
  if (tag?.trim()) {
    const selectedTag = tag.trim();
    const values = SFW_MODE ? sfwExploreTagValues(selectedTag) : [selectedTag];
    const includedTags = sql`array[${sql.join(
      values.map((value) => sql`${value}`),
      sql`, `,
    )}]::text[]`;
    conditions.push(sql`${characters.tags} ?| ${includedTags}`);
  }
  // 屏蔽 tags：NOT (tags ?| array[...])。?| 测「任一」key 存在,刚好匹配
  // 「命中其一就排除」的语义。空数组跳过,避免拼出 array[]::text[] 出错。
  const cleanedExcludeTags =
    excludeTags
      ?.map((t) => t.trim())
      .filter((t) => t.length > 0 && t !== tag?.trim())
      .flatMap((t) => (SFW_MODE ? sfwExploreTagValues(t) : [t])) ?? [];
  if (cleanedExcludeTags.length > 0) {
    const excludeArray = sql`array[${sql.join(
      cleanedExcludeTags.map((t) => sql`${t}`),
      sql`, `,
    )}]::text[]`;
    conditions.push(sql`not (${characters.tags} ?| ${excludeArray})`);
  }

  const where = and(...conditions);

  // 推荐：拉一次 viewer 偏好标签;有就按命中数排,没有回退到 recentScore。
  let preferredTags: string[] = [];
  if (sort === "recommended" && viewerId) {
    preferredTags = await fetchUserPreferredTags(viewerId);
  }

  const recentScore = sql<number>`case when ${characters.createdAt} > now() - interval '7 days' then ${characters.conversationCount} * 2 else ${characters.conversationCount} end`;

  if (sort === "recommended" && preferredTags.length > 0) {
    // 命中数 = characters.tags 与 preferredTags 数组交集大小。
    // jsonb_array_elements_text 把 tags 拆开,在 ANY(array[...]) 里过滤,再 count。
    // 注意:drizzle 直接插数组会展开成 record,PG 不认 record→text[] 强转,
    // 必须用 array[$2,$3,...]::text[] 显式构造。
    const tagsArray = sql`array[${sql.join(
      preferredTags.map((t) => sql`${t}`),
      sql`, `,
    )}]::text[]`;
    const hitCount = sql<number>`(
      select count(*)::int from jsonb_array_elements_text(${characters.tags}) t
      where t = any(${tagsArray})
    )`;
    const query = db
      .select(exploreSelect)
      .from(characters)
      .leftJoin(users, eq(users.id, characters.ownerId))
      .where(where)
      .orderBy(
        desc(hitCount),
        desc(recentScore),
        desc(characters.createdAt),
        desc(characters.id),
      );
    return limit === null ? query : query.limit(limit);
  }

  if (sort === "trending") {
    // 最近 7 天 assistant 消息数 → 短期热度。LEFT JOIN 子查询,没活动的卡得 0。
    // 时间窗口写死 7 天;比 1 天更稳,避免新卡昙花一现就榜上有名。
    const recentMsgs = sql<number>`coalesce((
      select count(*)::int
      from messages m
      join chat_sessions s on s.id = m.session_id
      where s.character_id = ${characters.id}
        and m.role = 'assistant'
        and m.created_at > now() - interval '7 days'
    ), 0)`;
    const query = db
      .select(exploreSelect)
      .from(characters)
      .leftJoin(users, eq(users.id, characters.ownerId))
      .where(where)
      .orderBy(
        desc(recentMsgs),
        desc(characters.createdAt),
        desc(characters.id),
      );
    return limit === null ? query : query.limit(limit);
  }

  if (sort === "hot") {
    // 综合热度 = 对话数 + 点赞数 + 收藏数。点赞/收藏一般稀疏,直接等权相加,
    // 不调系数,免得后续维护要解释。
    const hotScore = sql<number>`(
      ${characters.conversationCount}
      + coalesce((select count(*)::int from character_likes where character_id = ${characters.id}), 0)
      + coalesce((select count(*)::int from character_favorites where character_id = ${characters.id}), 0)
    )`;
    const query = db
      .select(exploreSelect)
      .from(characters)
      .leftJoin(users, eq(users.id, characters.ownerId))
      .where(where)
      .orderBy(desc(hotScore), desc(characters.createdAt), desc(characters.id));
    return limit === null ? query : query.limit(limit);
  }

  const orderBy =
    sort === "recommended"
      ? [desc(recentScore), desc(characters.createdAt)]
      : [desc(characters.createdAt), desc(characters.id)];

  const query = db
    .select(exploreSelect)
    .from(characters)
    .leftJoin(users, eq(users.id, characters.ownerId))
    .where(where)
    .orderBy(...orderBy);
  return limit === null ? query : query.limit(limit);
}

/**
 * 从 viewer 的 likes / favorites 反推 tag 偏好,取前 20 个。
 *
 * 实现简化版「相似度」:每出现一次 +1(收藏和点赞等权),按总权重 desc。
 * 命中数排序时仅用作 ANY() 入参,具体权重不参与打分 —— 命中数本身就够区分
 * 偏好度。如果未来要做加权命中(高权重 tag 命中分更多),把权重 select 出来
 * 改成 jsonb_object 注入即可。
 */
export async function fetchUserPreferredTags(
  userId: string,
  limit = 20,
): Promise<string[]> {
  const rows = await db.execute<{ tag: string }>(sql`
    SELECT tag FROM (
      SELECT jsonb_array_elements_text(c.tags) AS tag
      FROM character_favorites f
      JOIN characters c ON c.id = f.character_id
      WHERE f.user_id = ${userId}
      UNION ALL
      SELECT jsonb_array_elements_text(c.tags) AS tag
      FROM character_likes l
      JOIN characters c ON c.id = l.character_id
      WHERE l.user_id = ${userId}
    ) t
    WHERE tag IS NOT NULL AND length(tag) > 0
    GROUP BY tag
    ORDER BY count(*) DESC
    LIMIT ${limit}
  `);
  return rows.map((r) => r.tag).filter(Boolean);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getCharacterById(id: string): Promise<Character | null> {
  // Defensive: non-UUID input would throw on the UUID-typed column.
  if (!UUID_RE.test(id)) return null;
  const rows = await db
    .select()
    .from(characters)
    .where(eq(characters.id, id))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * "My library" — list ALL characters owned by the user, regardless of
 * visibility (public / private / unlisted) and NSFW. Sorted by recency.
 */
export async function listMyCharacters(
  userId: string,
): Promise<ExploreListItem[]> {
  return db
    .select(exploreSelect)
    .from(characters)
    .leftJoin(users, eq(users.id, characters.ownerId))
    .where(eq(characters.ownerId, userId))
    .orderBy(desc(characters.createdAt), desc(characters.id));
}
