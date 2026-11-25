import type { BeautificationPack } from "@/lib/db/schema";

export function canEditPack(pack: BeautificationPack, userId: string): boolean {
  return pack.ownerUserId === userId;
}

export function canSubscribePack(
  pack: BeautificationPack,
  userId: string,
): boolean {
  return pack.isPublic || pack.ownerUserId === userId;
}
