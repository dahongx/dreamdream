# Character Image Generation Handover

Product note: see [../insights/character-image-generation.md](../insights/character-image-generation.md).

## What shipped

Character create/edit image fields now support a two-step AI flow:

1. Creator writes a short visual description.
2. `/api/ai/generate` runs the sealed `image-prompt` generator and streams back a refined prompt.
3. Creator can edit the refined prompt and send it to `/api/ai/images/generate`.
4. The generated blob is previewed locally; `使用这张` uploads it through the existing `/api/uploads/image` route and writes the resulting R2 URL into `coverImageUrl` or `avatarUrl`.

No schema changes were added. The final persisted data remains the existing `characters.cover_image_url` / `avatar_url` fields.

## Key files

- `src/components/characters/CharacterForm.tsx` — `ImageAIGenerateDialog` is colocated with `ImageUploadField`.
- `src/lib/ai/generators/prompts/image-prompt.txt` — sealed prompt optimizer template.
- `src/app/api/ai/images/generate/route.ts` — authenticated image generation route using `gpt-image-2`.
- `src/lib/ai/provider.ts` — OpenAI image provider wiring via `NIMIR_OPENAI_API_KEY`, falling back to `OPENAI_API_KEY`.

## Operational notes

- Image generation is rate-limited with the existing in-memory limiter under a separate `{userId}:image` bucket.
- Prompt optimization uses the normal text-generation bucket.
- Generated images are not stored until the creator clicks `使用这张`; storage still goes through the existing R2 upload path.
- Required env for production image generation: `NIMIR_OPENAI_API_KEY` or `OPENAI_API_KEY`. Optional relay: `NIMIR_OPENAI_BASE_URL`.
