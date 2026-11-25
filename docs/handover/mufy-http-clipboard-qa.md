# HTTP clipboard follow-up — 8091 only

The reviewed 28-file runtime release is deployed. It does **not** include the
subsequent, unverified local change in `src/lib/util/clipboard.ts`.

Actual TEST rank 48 shows `data-copy-result="copied"`, but the automation's
clipboard read and normal paste retained a previously copied public command.
The same observation occurs in the isolated forced-legacy parent and opaque
iframe fixtures. A modern `navigator.clipboard.writeText` positive control is
observed correctly through the tool and normal paste. This does not yet
distinguish an actual legacy-copy fault from a clipboard-observation boundary.
The local contenteditable/focus candidate has **not** passed browser verification
and must not be included in another release or described as fixed.

An explicit, separate permission question was raised for a temporary localhost
page to read only freshly copied QA text through normal browser UI. No such
page read or browser permission grant has happened yet. Do not infer that
permission from the earlier controlled 8091 deployment authorization.

The fixture is `scripts/serve-mufy-legacy-copy-focus-qa.ts`, bound only to
127.0.0.1, with external requests blocked. Current live instance from this pass:
`http://127.0.0.1:50457/`. The source SHA for the unverified candidate is
`151a67b24e03bc57e4c911f11fd4d0e0be95832563c1fe65b41f4c7dd653cdd7`.
The unchanged deployed baseline SHA is
`f490d5f283f5dac1b5536123ef94dc642b6f1f7441382f222b74aeccd3223ad3`.

Another independent source fact: rank 48's visible public DOM repeats `cmd4`
on three different command cards. Preserve this as a source defect/qualification;
do not silently treat all three card texts as the source's copied result or
conflate it with the host clipboard issue.

Evidence and continuation details live under the batch's
`final-acceptance/48/post-reviewed-runtime-copy-failure-20261101.json` and
`http-clipboard-followup-20261101.json`.

See [product notes](../insights/mufy-http-clipboard-qa.md).
