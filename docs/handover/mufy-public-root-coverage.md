# Public source root coverage

The legacy preparation script converted only `markdownBlocks[0]`. Public source inventories can contain additional roots with zero-height frames whose authored programs create visible music or emoji tools in the parent page. Frame height zero does not establish that a component is nonvisual.

`publicRootComponentCoverage` keys each captured frame by root index and frame index. Old mappings without `sourceRootIndex` continue to mean root 0 only. Additional roots cannot inherit those successes. Unknown indices, duplicate keys, missing evidence and unresolved dispositions prevent acceptance.

The old preparation route now refuses any nonempty additional root with `UNRESOLVED_ADDITIONAL_PUBLIC_ROOTS`. This is a preparation guard, not a completed native adapter: a reviewed finite extraction and actual target recheck are still required. It does not run or transplant arbitrary parent scripts, change the renderer sandbox, or overwrite existing imports.

Run `bun scripts/audit-mufy-public-root-coverage.ts` for the current batch's saved metadata. Ranks 31, 37 and 50 are excluded before opening any per-card files. The audit reports missing mappings, not inferred target failures. Current browser observations must establish actual differences separately.

The independently handed-off rc.2 package is frozen and is not changed by this source-tree guard. Neither a local test nor this audit certifies a whole card or authorizes a build before the batch review gate.

Validation: focused component coverage and literal frame restoration regressions. See [product reasoning](../insights/mufy-public-root-coverage.md).
