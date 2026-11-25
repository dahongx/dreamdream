# Public drawer sizing repair

Status: local candidate, not deployed or accepted. Product rationale: [insights](../insights/mufy-public-drawer-sizing.md).

The rank60 public drawer was measured through normal Chrome DOM in both states. The closed outer box is 68×48, with a 48px image and 20px right inset. The open box is 300×464: 48px summary, 8px gap, 400px isolated document, 8px gap. Position is right 0, top 20% of the viewport. Evidence and screenshot are in `outputs/mufy-rank53-70-20261111/rank60/source-sidebar-geometry.json` and `source-sidebar-open.jpg`.

`NativeImageSidebar.sourceBox` is an optional, bounded geometry-only setting. It is accepted only for the generic native drawer, leaving existing named variants unchanged. The inert shell remains sanitized in its ShadowRoot, and the authored program remains in its existing isolated iframe. It does not change sandbox permissions, palettes, authentication, or network access. Activated documents remain mounted when the drawer closes.

`scripts/prepare-rank60-sidebar-repair.ts` derives the shell and document from the saved public capture. It produces a separate native envelope and an opening replacement with the embedded duplicate removed. The new memory synchronization reads only `host.getHistory()` and commits complete memory blocks to public list text nodes. It does not read cookies, storage, hidden source state or a database. The original archive and capture are preserved. This locally derived compatibility is not a capture of source-author rules.

Ordinary regex artifacts can separately opt in to a bounded minimum height using `data-nj-iframe-min-height` on the root `<html>`. Missing metadata keeps the existing minimum. This is sizing metadata, never a source-authenticity flag.

Before release: compare candidate files against the actual test runtime; preserve concurrent changes; run geometry, decoder and regex regressions. After release, import the native component through owner UI, update the existing opening rule through its normal editor, verify only one drawer exists, test closed/open scroll position, music progress across close/reopen, complete-memory updates and mobile/desktop overflow. Update rank63's root sizing metadata and compare actual header height with the source. A local test pass is not card acceptance.
