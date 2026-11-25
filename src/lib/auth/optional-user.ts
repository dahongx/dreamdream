import { cache } from "react";
import { getAuthUser } from "@/lib/auth/auth-user";

/** Returns userId or null if not logged in. Never redirects. */
export const getOptionalUserId = cache(async (): Promise<string | null> => {
  const user = await getAuthUser();
  return user?.id ?? null;
});
