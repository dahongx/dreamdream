# Examples — Creator Onboarding Seeds

Drop these into your library to see how the regex + system prompt
pipeline composes end to end. Imports go through
`/characters/new` → 文件导入 (character) or
`/characters/[id]/regex` → 文件导入 (rules).

## Files

### `su-ran-example.character.json`

A complete character card — 苏然, a quiet bookstore-owner in Shanghai.
Includes:

- All 16 character fields filled out (persona, adversity,
  default_cognition, opening with `<scenario>` + `<message>`, plot,
  output, sample dialogue)
- Two attached regex rules:
  - **环境状态面板** — turns `<env><time>...</time><weather>...</weather><scene>...</scene></env>` into a styled status card
  - **心理叙述** — turns `<narration>...</narration>` into italic grey side-text

After import:

1. Open the character → click 开始对话
2. Type anything; the AI should produce an `<env>` block at the
   start of every reply, rendered as the status card
3. Open the Debug toggle (top-right of chat) to see the raw output,
   the matched rules, and the assembled system prompt

### `starter.rules.json`

Three regex rules you can attach to any existing character:

- 环境状态面板
- 动态记忆区 (short-term + long-term memory cards)
- 心理叙述

Open one of your own characters → 正则规则 → 文件导入 → pick this file.

## Reuse

The repo as a whole is `private: true` in `package.json` and ships no
LICENSE file. These two example exports are deliberately public-
domain-friendly so creators inside the project can copy + modify
without attribution requirements. If this repo ever ships
externally, the license question will be settled at the project root
before these examples need to be re-licensed.
