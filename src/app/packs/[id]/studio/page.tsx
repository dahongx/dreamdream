import { notFound, redirect } from "next/navigation";
import { StudioLayout } from "@/components/packs/studio/StudioLayout";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { listOwnedPackOpeningComponents } from "@/lib/opening/queries";
import { getSessionMessages } from "@/lib/packs/assistant-messages";
import { canEditPack } from "@/lib/packs/permissions";
import { getPack } from "@/lib/packs/queries";
import { listStudioSessions } from "@/lib/packs/session-queries";
import { listPackRules } from "@/lib/regex/queries";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}

/**
 * Whitelists the `returnTo` query param to internal absolute paths only so
 * the back-button can't be tricked into open-redirects. Anything that doesn't
 * start with a single "/" (e.g. "//evil.com", "https://..." , "javascript:")
 * gets dropped to null. The character edit page is the only intended caller
 * today, but the check is generic so future entry points (chat, plaza) don't
 * need ad-hoc rules.
 */
function sanitizeReturnTo(value: string | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  return value;
}

export default async function StudioPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { returnTo: rawReturnTo } = await searchParams;
  const [pack, rules, userId] = await Promise.all([
    getPack(id),
    listPackRules(id),
    getCurrentUserId(),
  ]);
  if (!pack) notFound();
  if (!canEditPack(pack, userId)) redirect(`/packs/${id}`);

  const openingComponents = await listOwnedPackOpeningComponents(id, userId);

  const sessions = await listStudioSessions(userId, id);
  const activeSession = sessions.find((s) => s.status === "active") ?? null;
  const initialMessages = activeSession
    ? await getSessionMessages(activeSession.id)
    : [];

  const returnTo = sanitizeReturnTo(rawReturnTo);

  return (
    <StudioLayout
      pack={pack}
      rules={rules}
      openingComponents={openingComponents}
      sessions={sessions}
      initialActiveSessionId={activeSession?.id ?? null}
      initialMessages={initialMessages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        attachments: m.attachments ?? undefined,
      }))}
      returnTo={returnTo}
    />
  );
}
