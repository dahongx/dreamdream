# Creator styling owns the chat scene

[Implementation and release gates](../handover/chat-source-skin-isolation.md).

The 113-card follow-up found a second fallback trap: removing an illegal paint
donor is insufficient if replay keeps native gradient/currentColor defaults
while siblings reset to a different glass surface. With no legal replay donor,
reset the complete toolbar family, not just the model and sibling controls.
Do not weaken selector safety merely to manufacture a matching paint source.

Do not globally brighten cards or substitute the platform palette for authored
colors. The user's clarified contract is a coherent four-control toolbar:
replay supplies color, border and surface paint to mask, model and currency,
even when a source supplies a standalone neutral model surface. Function labels,
model names, sizing and interactions remain native and usable. Without replay
paint, a model-only skin must not create an isolated visual family.

Transparent colors depend on the surface behind them. Imported source scenes
need their compatible base and overlay instead of leaking the site's blue
palette. This must be limited to imported scenes, not a site-wide theme change.
Independent iframe content and host chrome are separate styling boundaries.

Acceptance must include real top bars and input controls, not only component
fixtures. Historical cards with damaged flattened CSS require public-source
repair before they can pass, even if the improved pipeline protects new imports.

The full accessible inventory audit found 28 background mismatches beyond the
initial screenshot fixture, plus 3 border-only differences. A source-provenance
gate alone cannot fix older imported cards, because most lack the newer marker.
Apply toolbar compatibility by public control semantics; keep source backdrop
isolation provenance-gated. Separate measured DOM coverage from visual and
interaction acceptance, and never treat an unapplied CSS tail as a successful fix.

The 2026-10-27 release collision exposed an additional acceptance requirement:
visual regressions can come from publishing the wrong combined version, not just
from CSS. Serialize TEST releases, identify the actual running image, preserve
other verified feature hashes, and distinguish a disconnected terminal from a
failed remote build. A passing local candidate is not proof of what users see.
