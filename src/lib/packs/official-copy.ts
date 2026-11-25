import type { Dict } from "@/i18n/types";
import type { BeautificationPack } from "@/lib/db/schema";
import { OFFICIAL_PACK_ID } from "@/lib/packs/official-ids";

export const OFFICIAL_PACK_CANONICAL_NAME = "Dearm Official Pack";
export const OFFICIAL_PACK_CANONICAL_DESCRIPTION =
  "Dearm's maintained collection of interactive components: Phone, Environment Status, and Dynamic Memory. Enable any component you need.";

export type OfficialPackCopy = Pick<
  Dict["packs"],
  "officialPackName" | "officialPackDescription"
>;

/** Localize only presentation fields; canonical DB data stays request-neutral. */
export function localizeOfficialPack(
  pack: BeautificationPack,
  copy?: OfficialPackCopy,
): BeautificationPack {
  if (pack.id !== OFFICIAL_PACK_ID || !copy) return pack;
  return {
    ...pack,
    name: copy.officialPackName,
    description: copy.officialPackDescription,
  };
}
