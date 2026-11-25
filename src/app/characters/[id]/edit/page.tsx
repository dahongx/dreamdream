import { notFound, redirect } from "next/navigation";
import { CharacterForm } from "@/components/characters/CharacterForm";
import { DeleteCharacterButton } from "@/components/characters/DeleteCharacterButton";
import { getRequestDict } from "@/i18n/server";
import {
  getCurrentUserId,
  isCurrentUserDeveloper,
} from "@/lib/auth/current-user";
import { updateCharacterAction } from "@/lib/characters/actions";
import { getCharacterById } from "@/lib/characters/queries";
import { filterOwnerOpeningPacks } from "@/lib/opening/access";
import {
  listOwnedPackOpeningComponents,
  loadCharacterOpeningOverrides,
  loadCharacterOpeningSlotValues,
} from "@/lib/opening/queries";
import {
  listMyPacks,
  listPublicPacks,
  listSubscriptionsForCharacter,
} from "@/lib/packs/queries";
import { listPackRules } from "@/lib/regex/queries";

export const dynamic = "force-dynamic";

/**
 * 分批并发: items 逐批(每批 limit 个)跑 fn. 编辑页可选包可达数十个, 一次
 * Promise.all 同时查每个包的规则+开场组件 = 上百并发查询, 超过 postgres 连接池
 * (max:20). 生产 app↔db 同机内网, 连接快、轮转得过来, 不崩; 但连远程库(高延迟)
 * 时并发查询排队超时 → 整页崩溃. 分批限峰值并发, 逻辑等价(仍查全部包), 生产
 * 行为不变(内网本就够快), 远程连接下不再超时.
 */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    out.push(...(await Promise.all(items.slice(i, i + limit).map(fn))));
  }
  return out;
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditCharacterPage({ params }: Props) {
  const { id } = await params;
  const character = await getCharacterById(id);
  if (!character) notFound();

  const userId = await getCurrentUserId();
  // 开发者(NIMIR_DEBUG_EMAILS)可进任意卡 edit 页查看 / 调 prompt;普通用户仍
  // 仅限自己的卡 —— 否则会把 creator 的 prompt 资产原文暴露给访客。
  const isDev = await isCurrentUserDeveloper();
  if (character.ownerId !== userId && !isDev) {
    redirect(`/characters/${character.id}`);
  }

  const bound = updateCharacterAction.bind(null, id);
  const dict = await getRequestDict();

  // 美化包按「角色作者」加载,不是按访客 —— 否则 dev 用 debug 权限进别人卡的
  // edit 页时,availablePacks 只会是访客自己的库,作者绑在这张卡上的私有美化包
  // 不在列表里,PackRuleSelector 渲染不出来(selectedRuleIds 有 id 却没有对应
  // pack 行)。用 ownerId 才能复现作者本人看到的美化包列表。
  const [rawSubs, myPacks, publicPacks] = await Promise.all([
    listSubscriptionsForCharacter(id, dict.packs),
    listMyPacks(character.ownerId),
    listPublicPacks({ limit: 48, officialCopy: dict.packs }),
  ]);

  const subscriptions = await Promise.all(
    rawSubs.map(async (s) => ({
      ...s,
      rules: await listPackRules(s.pack.id, dict),
    })),
  );
  const availablePacks = Array.from(
    new Map(
      [...myPacks, ...publicPacks].map((pack) => [pack.id, pack]),
    ).values(),
  );
  const packRules = Object.fromEntries(
    await mapLimit(availablePacks, 8, async (pack) => [
      pack.id,
      await listPackRules(pack.id, dict),
    ]),
  ) as Record<string, Awaited<ReturnType<typeof listPackRules>>>;
  const openingPacks = filterOwnerOpeningPacks(
    availablePacks,
    character.ownerId,
  );
  const packOpeningComponents = Object.fromEntries(
    await mapLimit(openingPacks, 8, async (pack) => [
      pack.id,
      await listOwnedPackOpeningComponents(pack.id, character.ownerId),
    ]),
  ) as Record<
    string,
    Awaited<ReturnType<typeof listOwnedPackOpeningComponents>>
  >;
  const [openingDisabledIds, openingSlotValues] = await Promise.all([
    loadCharacterOpeningOverrides(id),
    loadCharacterOpeningSlotValues(id),
  ]);

  return (
    <CharacterForm
      action={bound}
      initial={character}
      cancelHref={`/characters/${character.id}`}
      subscriptions={subscriptions}
      myPacks={myPacks}
      publicPacks={publicPacks}
      packRules={packRules}
      packOpeningComponents={packOpeningComponents}
      openingDisabledIds={openingDisabledIds}
      openingSlotValues={openingSlotValues}
      currentUserId={userId}
      dangerZone={
        <DeleteCharacterButton
          characterId={character.id}
          characterName={character.name}
        />
      }
    />
  );
}
