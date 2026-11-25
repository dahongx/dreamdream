# Same CSS can render different fonts

See [technical handover](../handover/mufy-island-local-font-isolation.md).

The migration must preserve the author's fallback behavior as well as the CSS text. Dearm preloads fonts that the source site does not have. An imported component can therefore acquire a platform font even when its declared family list is copied exactly.

For the observed island, preserve the installed-font lookup through a reserved local-only alias. Keep the author's remaining fallback list and leave authored font imports alone. This avoids changing the platform's own typography or choosing a new decorative font.

Acceptance needs visible source/target comparison and actual glyph-font evidence when the pictures disagree. Computed `font-family` equality alone is insufficient. The rank43 relation text and mobile lifecycle passed their bounded checks; its TEST visual acceptance stays pending until this candidate is released and observed there.
