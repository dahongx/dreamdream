# Character Image Generation Insights

Technical handover: see [../handover/character-image-generation.md](../handover/character-image-generation.md).

## Why two steps

Creators often know the emotional hook but not the visual vocabulary needed for image models. A direct one-shot image button would turn weak descriptions into mediocre assets and hide the most useful control: the prompt.

The chosen flow keeps the creator in charge:

- Short description is low-friction.
- Optimized prompt makes the implicit taste visible.
- Editable prompt lets experienced creators correct details before spending an image call.
- Local preview avoids storing throwaway generations in R2.

## Product boundaries

This feature is deliberately scoped to role-card imagery: cover and avatar only. It does not create a general image studio, reference-image workflow, batch generator, or public asset history.

That keeps the first version close to the moment of need: a creator is filling out a character and needs a face or cover immediately.

## Future options

- Add style presets if creator prompts converge around repeatable aesthetics.
- Let creators derive an avatar crop from the generated cover, but only if it stays explicit and reversible.
- Persist recent refined prompts locally so creators can iterate without database history.
