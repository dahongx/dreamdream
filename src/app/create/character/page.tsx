import { CharacterForm } from "@/components/characters/CharacterForm";
import { PageAtmosphere } from "@/components/PageAtmosphere";
import { getRequestDict } from "@/i18n/server";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { createCharacterAction } from "@/lib/characters/actions";
import { filterOwnerOpeningPacks } from "@/lib/opening/access";
import { listOwnedPackOpeningComponents } from "@/lib/opening/queries";
import { listMyPacks, listPublicPacks } from "@/lib/packs/queries";
import { listPackRules } from "@/lib/regex/queries";

export const dynamic = "force-dynamic";

export default async function NewCharacterPage() {
  const userId = await getCurrentUserId();
  const dict = await getRequestDict();
  const [myPacks, publicPacks] = await Promise.all([
    listMyPacks(userId),
    listPublicPacks({ limit: 48, officialCopy: dict.packs }),
  ]);
  const packRulesEntries = await Promise.all(
    [...myPacks, ...publicPacks].map(async (pack) => [
      pack.id,
      await listPackRules(pack.id, dict),
    ]),
  );
  const packRules = Object.fromEntries(packRulesEntries);
  const openingPacks = filterOwnerOpeningPacks(
    [...myPacks, ...publicPacks],
    userId,
  );
  const packOpeningComponentsEntries = await Promise.all(
    openingPacks.map(async (pack) => [
      pack.id,
      await listOwnedPackOpeningComponents(pack.id, userId),
    ]),
  );
  const packOpeningComponents = Object.fromEntries(
    packOpeningComponentsEntries,
  ) as Record<
    string,
    Awaited<ReturnType<typeof listOwnedPackOpeningComponents>>
  >;

  return (
    <PageAtmosphere>
      <CharacterForm
        action={createCharacterAction}
        cancelHref="/mine"
        myPacks={myPacks}
        publicPacks={publicPacks}
        packRules={packRules}
        packOpeningComponents={packOpeningComponents}
        currentUserId={userId}
      />
    </PageAtmosphere>
  );
}
