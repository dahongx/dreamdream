"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SfwHelpNav({
  links,
}: {
  links: { href: string; label: string }[];
}) {
  const pathname = usePathname();
  // Keep the conversation composer and character presentation unchanged.
  if (/^\/(chat|share|characters|packs)(\/|$)/.test(pathname)) return null;
  return (
    <footer className="border-t border-border-subtle px-[var(--page-px)] pt-[var(--space-lg)] pb-[calc(var(--bottombar-height)+env(safe-area-inset-bottom)+var(--space-lg))] md:pb-[var(--space-lg)]">
      <nav className="mx-auto flex max-w-5xl flex-wrap gap-x-[var(--space-lg)] gap-y-[var(--space-sm)] text-sm text-text-secondary">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={pathname === link.href ? "page" : undefined}
            className="rounded-sm underline-offset-4 transition-colors hover:text-text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-primary"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
