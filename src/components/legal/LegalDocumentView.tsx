import Link from "next/link";
import { BackButton } from "@/components/nav/BackButton";
import type { Dict } from "@/i18n/types";
import type { LegalBlock, LegalDocument } from "@/lib/legal/types";

/**
 * 法律文书渲染器 —— 用户协议 / 隐私政策共用。
 *
 * 排版取向：这是要被真读完的长文，不是营销页。所以正文列宽压到 ~65ch、
 * 行高放到 1.9、章节之间给足留白；装饰只保留 DESIGN.md 的衬线大标题，
 * 不加 cosmic-dust 之类会跟正文抢注意力的东西（scanline / vignette 由
 * globals.css 全站提供，这里不用重复）。
 */

interface Props {
  document: LegalDocument;
  /** 页脚互链到另一份文书。 */
  counterpart: { href: string; label: string };
  dict: Dict;
}

function Blocks({ blocks }: { blocks: LegalBlock[] }) {
  return (
    <>
      {blocks.map((block, index) => (
        // 法律文本是静态数据、顺序固定，index 就是稳定身份。
        // biome-ignore lint/suspicious/noArrayIndexKey: static ordered content
        <Block block={block} key={index} />
      ))}
    </>
  );
}

function Block({ block }: { block: LegalBlock }) {
  switch (block.kind) {
    case "subheading":
      return (
        <h3 className="mt-[var(--space-lg)] text-lg font-semibold text-text-primary">
          {block.text}
        </h3>
      );

    case "paragraph":
      return (
        <p
          className={
            block.strong
              ? "font-semibold text-text-primary"
              : "text-text-secondary"
          }
        >
          {block.text}
        </p>
      );

    case "list":
      return block.ordered ? (
        <ol className="list-decimal space-y-[var(--space-sm)] pl-[1.35em] text-text-secondary marker:text-accent-primary">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      ) : (
        <ul className="list-disc space-y-[var(--space-sm)] pl-[1.35em] text-text-secondary marker:text-accent-primary">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );

    case "notice":
      return (
        <aside className="rounded-[var(--radius-md)] border border-border-subtle border-l-2 border-l-accent-gold bg-surface-glass/60 px-[var(--space-md)] py-[var(--space-md)]">
          <p className="font-display-zh text-lg text-accent-gold-soft">
            {block.title}
          </p>
          <ul className="mt-[var(--space-sm)] list-disc space-y-[var(--space-sm)] pl-[1.35em] text-text-secondary marker:text-accent-gold">
            {block.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </aside>
      );
  }
}

export function LegalDocumentView({ document, counterpart, dict }: Props) {
  const t = dict.legal;

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-[var(--space-xl)] px-[var(--page-px)] py-[var(--page-py)] pb-[var(--space-3xl)] leading-[1.9]">
      <BackButton label={t.backButton} fallbackHref="/explore" />

      <header className="flex flex-col gap-[var(--space-sm)]">
        <h1 className="hero-title">{document.title}</h1>
        <p className="font-mono text-sm text-text-muted">
          {t.effectiveDate}: {document.effectiveDate}
        </p>
      </header>

      <nav
        aria-label={t.tocAria}
        className="rounded-[var(--radius-md)] border border-border-subtle bg-surface-glass/50 px-[var(--space-md)] py-[var(--space-md)]"
      >
        <p className="text-sm font-semibold text-text-primary">{t.toc}</p>
        <ol className="mt-[var(--space-sm)] grid gap-x-[var(--space-md)] gap-y-[var(--space-2xs)] text-sm sm:grid-cols-2">
          {document.sections.map((section) => (
            <li key={section.id}>
              <a
                className="text-text-secondary underline-offset-4 transition-colors hover:text-accent-primary hover:underline"
                href={`#${section.id}`}
              >
                {section.heading}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {document.intro.length > 0 && (
        <div className="flex flex-col gap-[var(--space-md)]">
          <Blocks blocks={document.intro} />
        </div>
      )}

      {document.sections.map((section) => (
        <section
          className="flex scroll-mt-[calc(var(--topbar-height)+var(--space-md))] flex-col gap-[var(--space-md)]"
          id={section.id}
          key={section.id}
        >
          <h2 className="font-display-zh text-2xl font-bold text-text-primary">
            {section.heading}
          </h2>
          <Blocks blocks={section.blocks} />
        </section>
      ))}

      <footer className="border-t border-border-subtle pt-[var(--space-lg)] text-sm text-text-muted">
        <p>{t.counterpartHint}</p>
        <Link
          className="text-accent-primary underline-offset-4 hover:underline"
          href={counterpart.href}
        >
          {counterpart.label}
        </Link>
      </footer>
    </article>
  );
}
