# Bare message artifact height recovery

Actual TEST rank28 had a complete narrative document whose body measured347px while its outer iframe remained at the initial240px. Its public source narrative rendered at490px in a478px-wide frame. This is a host sizing defect, separate from the different viewport widths and inherited font stacks.

Bare artifacts do not run the Host API initialization handshake. The host now requests a repeat measurement after subscribing to resize and after iframe load. The shared measurement script accepts this request only from its actual parent. The iframe retains its opaque `allow-scripts` sandbox; no cross-origin document reads, storage access or security expansion are introduced.

The isolated browser harness using the saved public narrative and the actual ArtifactIframe component measured490px at478px width. A normal expanded/collapsed details interaction measured20→620→20px. These are local browser results, not TEST integration acceptance. The current TEST still needs post-release checks after the whole-batch prebuild gate, including replies and status folds.

The font follow-up now passes the source-default opt-in through both MessageRenderer artifact routes. Only imported documents inherit the observed Noto Sans SC and black body fallback, before authored CSS. Actual local browser checks retained native system-ui and slate text for ordinary artifacts, and retained an explicit authored Georgia/color override. At390×844, the imported narrative body measured571.375px inside a572px frame, without clipping. Forty selected regressions passed with134 assertions, and a focused typecheck including MessageRenderer and Next CSS declarations passed. This does not certify the TEST runtime, which has not received this candidate.

Candidate evidence is under `final-acceptance/28/artifact-height-local-*-20261104.json`. Preserve existing bridge changes and the older reviewed candidate independently; never deploy the whole worktree. See [reasoning](../insights/mufy-artifact-height.md).
