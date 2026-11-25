/**
 * Opening components are creator-private even when their containing pack is
 * public. Character authoring surfaces may therefore load component content
 * only from packs owned by the character creator.
 */
export function filterOwnerOpeningPacks<
  T extends { id: string; ownerUserId: string },
>(packs: T[], ownerUserId: string): T[] {
  const seen = new Set<string>();
  return packs.filter((pack) => {
    if (pack.ownerUserId !== ownerUserId || seen.has(pack.id)) return false;
    seen.add(pack.id);
    return true;
  });
}
