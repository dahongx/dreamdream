# Preserve source drawer geometry

Status: candidate awaiting deployment and real-page validation. Technical workflow: [handover](../handover/mufy-public-drawer-sizing.md).

A fixed widget inside an opening iframe is fixed to that document rather than the chat viewport. Enlarging the iframe makes the opening layout worse and can still clip the trigger. The repair separates the inert trigger shell from the independent authored program, retaining source colors and the program's music/fold state.

Measure both outer states. The inner content width alone is not the drawer width: rank60's visible card is narrower than the 300px iframe, and the source wrapper adds two 8px gaps. Guessing from the card produced an incorrect 260px candidate. Source-specific sizing must be explicit and bounded so it cannot silently alter unrelated cards.

Acceptance requires interaction and scrolling on the actual test site. A correct still screenshot, a successful import, or a local regression does not establish that music state, streamed memory and mobile clipping are correct.
