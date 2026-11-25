# Mufy island font availability isolation

See [product rationale](../insights/mufy-island-local-font-isolation.md).

The rank43 public island declared `"Noto Serif SC", STKaiti, KaiTi, serif` on both sites, but actual Chrome glyph inspection found STKaiti on Mufy and the platform's downloaded Noto Serif SC on Dearm. Shadow DOM isolates selectors, not document font availability.

`isolateMufyIslandLocalFonts` parses native island CSS and recognizes this exact fallback stack. It substitutes a reserved family backed only by `local("Noto Serif SC")`. An installed source font remains eligible; otherwise STKaiti/KaiTi/serif remain the authored fallback. The reserved face is registered outside the shadow root, and no network font is added. Platform typography keeps its own names.

The adapter checks original CSS before sanitization. Any authored font face or font import disables this transformation. Other stacks and content strings stay unchanged. Parse failures preserve the sanitized stylesheet. The adapter is applied only to native island music, with its existing component identity retained.

The V4 playlist artist label also restores the source's 11px size. V3 remains 10px, as independently observed in its source program.

Validation: four focused regressions, 113 assertions; focused production TypeScript check passes. A real local Chrome fixture loads the platform's existing bundled font: source uses STKaiti, pre-fix uses Noto Serif SC, post-fix uses STKaiti. Evidence is in `outputs/mufy-island-font-isolation-20261103/browser-font-proof.json`. Full repository typecheck fails in historical scripts/tests and is not reported as passing.

This is a separate local candidate. It is not in the previously frozen eleven-file proposal and is not deployed. Actual TEST revalidation is required after the agreed whole-batch prebuild gate. Original resource-unavailability qualifications and all completed command checks remain separate.
