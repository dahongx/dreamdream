# AI Authoring Helpers — Handover

> Companion: [insights/ai-generators.md](../insights/ai-generators.md)

W9 ships 4 streaming AI helpers that fold the LLM into the creator
workflow instead of forcing them to copy-paste prompts to ChatGPT.
Each helper produces one specific kind of output and has its own
backend-sealed prompt template.

## Endpoints

`POST /api/ai/generate` — streaming SSE.

```ts
type RequestBody = {
  type: "target-text" | "replacement-html" | "global-css" | "output-guidance"
  prompt: string                          // creator-supplied free text (≤2000)
  context?: Record<string, unknown>       // per-type structured context
}
```

Response: `text/event-stream`, plain text chunks. Client just appends
to the target textarea.

## Generator dispatch

`src/lib/ai/generators/registry.ts::resolveGenerator` returns:

```ts
type ResolvedGenerator = {
  systemPrompt: string      // assembled from .txt template + interpolated context
  userPrompt: string        // creator input verbatim
}
```

Templates live in `src/lib/ai/generators/prompts/*.txt` and are loaded
+ cached at first use. They contain a fenced `# 用户需求` heading; the
user prompt lands below it as the streamed model input.

## Per-generator context contract

| type | context fields | injected into template |
|------|----------------|-----------------------|
| `target-text` | (none) | — |
| `replacement-html` | `targetText`, `variableMapping` | `<<<TARGET_TEXT>>>`, `<<<VARIABLE_MAPPING>>>` (JSON-stringified) |
| `global-css` | `targetSelectors` | `<<<TARGET_SELECTORS>>>` (comma-joined) |
| `output-guidance` | `targetText`, `replacementHint` | `<<<TARGET_TEXT>>>`, `<<<REPLACEMENT_HINT>>>` |

Unknown context fields are ignored. Missing fields render as empty strings.

## Rate limit

`src/lib/ai/generators/rate-limit.ts::checkRateLimit` — per-user
rolling 60-minute window, 20 calls. In-memory Map; not shared across
deploys or regions. v1.5 swaps to Upstash when needed.

The route returns `429` with `error: "rate limit exceeded — try again
at <ISO>"` when the bucket is exhausted.

## Client surface

`<AIGenerateButton>` (`src/components/ai/AIGenerateButton.tsx`) renders
a single ✨ button that opens a modal:

1. Creator types a prompt
2. Click "开始生成" → POST + stream response into a live `<pre>`
3. On completion: "应用到 textarea" / "重新生成" / close

Wired into:

- `<RegexForm>`: target-text (above target_text), replacement-html (above
  replacement textarea), output-guidance (above output_guidance textarea)
- `<CharacterForm>`: global-css (above global_css textarea, via
  `ref={globalCssRef}` since that form is uncontrolled)

## Auth + integrity

- Route requires a signed-in user via `getCurrentUserId()`
- Rate limit applies before the model call so abuse can't run up cost
- Templates are read-only at runtime (no creator-influenced prompt
  injection vector — they only see `# 用户需求`'s contents go through)
- Output validation lives on the consumer side: the regex/CSS forms
  pass the generator's output through the same walker/sanitize chain
  that creator-typed input goes through

## What's NOT live in v1

- Multi-turn refinement ("make it darker") — every call is fresh
- Per-user output history — sessions live in the browser only
- Model selection — locked to `defaultModel()`
- Tool-call structured output — the SDK supports it but creators don't
  benefit yet
