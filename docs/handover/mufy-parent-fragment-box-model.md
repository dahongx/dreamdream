# Mufy parent fragments and standalone documents

Actual rank34 source/target evidence is in `logs/mufy-profiles/full-20261013/next-batch-30-20261028/final-acceptance/34/resume-checkpoint-20261107.json`.

Do not infer an independent source document from the fact that Dearm renders a fragment inside an iframe. Rank34's three `censy-*` introduction blocks originally lived in Mufy's host document. Its music and relationship blocks were independent documents. They require different inheritance.

Measured host-fragment defaults were border-box, 14px inherited font size and 20px inherited line height. The source's authored paragraph selector additionally applies 14.5px/1.85, 0.5px spacing and its authored ink. The source markdown image rule uses automatic image height at an OUTER viewport at most768px; desktop keeps the authored85px height. CSS media queries inside the new iframe see the iframe width, so they do not generally represent the outer breakpoint.

The November7 owner-only repair restores these properties only under the three observed root classes. No shared renderer release was made. Source/target390px layout and1280px desktop geometry were measured, and the first expanded world fold matched after its transition settled. Intermediate tablet breakpoints remain unverified; the existing480px iframe rule is not proof of all source768px behavior.

Do not copy this repair as a universal component reset. Standalone documents retain their original content-box unless authored otherwise; parent fragments need measured parent inheritance. Do not strip authored resets, change sandbox/network boundaries, or inject private source state.

The current owner candidate SHA256 is `ddca4905493169d455fb702303f6ba0780784e57ed8eeaeaa904df5b535ff442`. The previous November1 candidate remains historical evidence and must not be restored over it. Inspect current normal owner UI and compare hashes before making any further edit.

Browser observations on the next goal turn detected a minimized Chrome window and page binding timeouts. This does not prove a permission denial, authentication failure, site outage or Mufy restriction. Inspect current UI after recovery and do not blindly repeat the interrupted second-fold click.
