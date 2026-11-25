# Characters Module — Handover

> Companion: [insights/characters.md](../insights/characters.md)

The characters surface — schema, CRUD, clone, delete, visibility model,
and how creator-authored fields feed into the chat pipeline.

## Schema (`src/lib/db/schema.ts::characters`)

16 user-facing fields plus housekeeping. Grouped in the UI as A / B / C:

### A. Info (does NOT enter LLM prompt)
| Column | Type | Notes |
|--------|------|-------|
| `name` | varchar(128), not null | Display + `{{char}}` template var |
| `gender` | enum | `male` / `female` / `other` / `unset` (default `unset`) |
| `age` | int, nullable | |
| `nsfw` | bool, not null | Creator self-report, no platform check |
| `is_ai` | bool, not null | Whether the character ITSELF is AI in-fiction |
| `content_type` | enum | `original` / `self_designed` / `fanwork` |
| `cover_image_url` / `avatar_url` | text, nullable | Public image URLs written after R2 upload |
| `tags` | jsonb string[] | Up to 20, used by jsonb-containment filter on /explore |
| `bio` | text, nullable | Card-only description |
| `visibility` | enum | `public` / `private` / `unlisted` (default `private`) |

### B. Persona (feeds system prompt)
| Column | Pipeline destination |
|--------|---------------------|
| `persona` | core of `buildSystemPrompt` |
| `adversity` | `## 逆境处理` section |
| `default_cognition` | `## 默认认知` section |
| `opening` | parsed by `parseOpening` — `<message>` becomes seeded assistant rows; `<scenario>` / `<system>` go into the system prompt |

### C. Advanced
| Column | Pipeline destination |
|--------|---------------------|
| `plot_setting` | `## 情节走向` section |
| `output_setting` | `## 输出格式约束` section |
| `sample_dialogue` | `## 样例对话与文风（仅作风格参考，非真实历史）` section |
| `global_css` | runs through `sanitizeAndScopeCss` → injected on chat page (see [global-styling.md](../insights/global-styling.md)) |

### Housekeeping
- `conversation_count` — denormalized counter, `+1` on each
  `createSessionForCharacter` call (fixed in v1.8)
- `owner_id` FK to `users` (cascade delete)
- `created_at` / `updated_at` timestamps

## CRUD lifecycle

### Create — `createCharacterAction`

Form (`<CharacterForm>` client component) → zod validate via
`characterFormSchema` → INSERT with `ownerId = currentUser`. New cards
land at the visibility the creator picks (defaults to `private`).

The image fields are now uploaded through `POST /api/uploads/image`
before submit. The route stores the file in R2 and writes the returned
public URL into the hidden form fields, so the database still only sees
plain URLs.

### Read — `getCharacterById` / `listCharactersForExplore` / `listMyCharacters`

- `getCharacterById` is unfiltered; gate visibility in the calling page
  (e.g. `/characters/[id]` displays everything; chat page enforces
  `visibility === 'public' || ownerId === userId || visibility === 'unlisted'`)
- `listCharactersForExplore` mixes "public + my own private" via SQL
  `OR (visibility='public', owner_id=$current)`. NSFW filter is the
  cookie-driven toggle in Shell.
- `listMyCharacters` (added v1.5) is "all mine" — every visibility, no
  NSFW filter, for the /mine page

### Update — `updateCharacterAction`

Owner-only at the action level (`WHERE id = ? AND owner_id = ?`). Edit
page (added v1.13) also redirects non-owners to detail so they don't
see the form.

### Delete — `deleteCharacterAction`

Owner-only. Cascades through sessions, messages, regex_rules,
user_regex_preferences via FK. Wired into edit page via
`<DeleteCharacterButton>` (v1.13). Name-echo confirm to prevent
accidental clicks.

### Clone — `cloneCharacterAction` (v1.11)

Composes `buildCharacterExport(sourceId)` + an INSERT with
`ownerId = currentUser`. New card:

- Visibility forced to `private` regardless of source
- Name suffixed with `（副本）`
- Regex rules carried over with `orderIndex` preserved
- All other fields copied verbatim

Visibility check: anyone can clone a `public` / `unlisted` card;
`private` is owner-only.

## Visibility model

| Value | Visible to | Indexed in /explore | Cloneable | Exportable |
|-------|------------|--------------------|-----------|------------|
| `public` | everyone | yes | anyone | anyone |
| `unlisted` | anyone with the URL | no | anyone | anyone |
| `private` | owner only | no (in owner's "my own" feed) | owner only | owner only |

The action surface enforces this — visibility isn't a client-side
filter.

## Opening parser

`opening` field is parsed by `parseOpening` (in `src/lib/ai/build-prompt.ts`)
which splits on the three tag types:

```ts
{
  messages: string[],    // → seeded as assistant rows
  scenarios: string[],   // → "## 场景设定" in system prompt
  systems: string[],     // → appended to system prompt
}
```

Free text outside tags becomes an implicit `<message>` (concatenated).
`{{char}}` and `{{user}}` interpolation happens via `interpolate()`.

## Owner enforcement

Three layers, defense in depth:

1. **Action layer** — `WHERE owner_id = $current` clause in update /
   delete / clone-private. Always present.
2. **Route layer** — `/characters/[id]/edit` and
   `/characters/[id]/regex/new` redirect non-owners to the detail page.
3. **Visibility check** — `private` cards return 404-equivalent
   (`notFound()`) from non-owner clients, so private cards aren't even
   linkable.

Authorship can't be forged via clone — `ownerId` is always
rewritten to the current user.

## What's NOT in this module

- Image upload — `cover_image_url` / `avatar_url` accept external URLs
  in v1; R2 is on the v1.5 roadmap
- Tag autocomplete — creators type free-form, the curated chips on
  /explore are a fixed list
- Card-level analytics beyond `conversation_count`
- Drafts — characters write directly to the DB on create, no autosave
