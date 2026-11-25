import { headers } from "next/headers";
import { ExploreLoadingFallback } from "@/components/explore/ExploreLoadingFallback";
import { RouteLoadingLogo } from "@/components/ui/RouteLoadingLogo";
import { getRequestDict } from "@/i18n/server";

/**
 * Root-level loading state. Next surfaces this while any Server
 * Component below is suspended (DB query, page composition, etc).
 *
 * Uses dict.shell.loading — a neutral "loading" message — rather than
 * dict.chat.streaming, so /explore, /mine, /settings etc don't claim
 * "AI is generating" when they're just waiting on a SQL query.
 *
 * Visual: same breathing-dots motif the chat stream uses, so the
 * loading vocabulary stays consistent across the app. Sits inside
 * Shell so the rail + topbar stay visible.
 */
export default async function Loading() {
  const headerStore = await headers();
  const pathname = headerStore.get("x-dearm-pathname");
  if (pathname === "/explore" || pathname?.startsWith("/explore/")) {
    return <ExploreLoadingFallback dict={await getRequestDict()} />;
  }

  const dict = await getRequestDict();
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <RouteLoadingLogo label={dict.shell.loading} />
    </div>
  );
}
