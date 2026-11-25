import { notFound } from "next/navigation";
import { RegexForm } from "@/components/regex/RegexForm";
import { getRequestDict } from "@/i18n/server";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { updateRegexRuleAction } from "@/lib/regex/actions";
import { getOwnedRule } from "@/lib/regex/queries";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string; ruleId: string }>;
}

export default async function EditRulePage({ params }: Props) {
  const { id: packId, ruleId } = await params;
  const [userId, dict] = await Promise.all([
    getCurrentUserId(),
    getRequestDict(),
  ]);
  const owned = await getOwnedRule(ruleId, userId);
  if (!owned || owned.packId !== packId) notFound();

  const action = updateRegexRuleAction.bind(null, ruleId);

  return (
    <main className="mx-auto w-full max-w-[var(--content-max-width)] px-[var(--page-px)] py-[var(--page-py)]">
      <header className="mb-[var(--space-md)] md:mb-[var(--space-lg)]">
        <h1 className="hero-title">
          {dict.regex.formEditEyebrowPrefix}
          {owned.rule.name}
        </h1>
      </header>
      <RegexForm
        action={action}
        initial={owned.rule}
        submitLabel={dict.regex.submitUpdate}
        cancelHref={`/packs/${packId}/studio`}
      />
    </main>
  );
}
