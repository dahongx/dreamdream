import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import type { BeautificationPack } from "@/lib/db/schema";
import {
  beautificationPacks,
  characterPackSubscriptions,
  subscriptionRuleOverrides,
} from "@/lib/db/schema";
import {
  ensureOfficialPackSeed,
  getOfficialPack,
  OFFICIAL_PACK_ID,
} from "@/lib/packs/official";
import {
  localizeOfficialPack,
  type OfficialPackCopy,
} from "@/lib/packs/official-copy";

export async function getPack(
  id: string,
  officialCopy?: OfficialPackCopy,
): Promise<BeautificationPack | null> {
  if (id === OFFICIAL_PACK_ID) await ensureOfficialPackSeed();
  const rows = await db
    .select()
    .from(beautificationPacks)
    .where(eq(beautificationPacks.id, id))
    .limit(1);
  return rows[0] ? localizeOfficialPack(rows[0], officialCopy) : null;
}

export async function listMyPacks(
  userId: string,
): Promise<BeautificationPack[]> {
  return db
    .select()
    .from(beautificationPacks)
    .where(eq(beautificationPacks.ownerUserId, userId))
    .orderBy(desc(beautificationPacks.updatedAt));
}

export async function listPublicPacks(opts: {
  q?: string;
  sort?: "hot" | "new";
  limit?: number;
  offset?: number;
  officialCopy?: OfficialPackCopy;
}): Promise<BeautificationPack[]> {
  const { q, sort = "hot", limit = 24, offset = 0, officialCopy } = opts;

  try {
    await ensureOfficialPackSeed();
    const where = q
      ? and(
          eq(beautificationPacks.isPublic, true),
          or(
            ilike(beautificationPacks.name, `%${q}%`),
            ilike(beautificationPacks.description, `%${q}%`),
          ),
        )
      : eq(beautificationPacks.isPublic, true);

    const rows = await db
      .select()
      .from(beautificationPacks)
      .where(where)
      .orderBy(
        sort === "hot"
          ? desc(beautificationPacks.subscriberCount)
          : desc(beautificationPacks.createdAt),
      )
      .limit(limit)
      .offset(offset);
    const packs = rows.map((pack) => localizeOfficialPack(pack, officialCopy));

    const official = await getOfficialPack(officialCopy);
    if (
      official?.isPublic &&
      (!q ||
        official.name.toLowerCase().includes(q.toLowerCase()) ||
        (official.description ?? "").toLowerCase().includes(q.toLowerCase())) &&
      !packs.some((pack) => pack.id === official.id)
    ) {
      packs.unshift(official);
    }

    return packs.slice(0, limit);
  } catch (error) {
    console.warn(
      "[dearm] failed to load public packs; returning empty list.",
      error,
    );
    return [];
  }
}

export async function listSubscriptionsForCharacter(
  characterId: string,
  officialCopy?: OfficialPackCopy,
) {
  // Keep existing installations on canonical assets even when the creator
  // enters through character edit instead of the public plaza.
  await ensureOfficialPackSeed();
  const subs = await db
    .select({
      subscription: characterPackSubscriptions,
      pack: beautificationPacks,
    })
    .from(characterPackSubscriptions)
    .innerJoin(
      beautificationPacks,
      eq(beautificationPacks.id, characterPackSubscriptions.packId),
    )
    .where(eq(characterPackSubscriptions.characterId, characterId))
    .orderBy(asc(characterPackSubscriptions.orderIndex));

  // Load overrides per subscription
  const subIds = subs.map((s) => s.subscription.id);
  const overrides =
    subIds.length > 0
      ? await db
          .select()
          .from(subscriptionRuleOverrides)
          .where(
            sql`${subscriptionRuleOverrides.subscriptionId} = ANY(${sql.raw(`ARRAY[${subIds.map((id) => `'${id}'`).join(",")}]::uuid[]`)})`,
          )
      : [];

  return subs.map((s) => ({
    subscription: s.subscription,
    pack: localizeOfficialPack(s.pack, officialCopy),
    overrides: overrides.filter((o) => o.subscriptionId === s.subscription.id),
  }));
}
