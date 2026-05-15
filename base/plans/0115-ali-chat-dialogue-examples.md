---
id: 0115
slug: ali-chat-dialogue-examples
status: in-progress
created: 2026-05-13
---

# Cycle 0115 — Ali:Chat dialogue examples (column + form + refiner + injection)

## Driver

Audit cycle 0112 §3.2: Ali:Chat dialogue examples are mandatory per the doc; "LLMs are pattern-matching machines. Show, don't describe." At least one **refusal example** is required — without it the model defaults to compliance regardless of trait list. Today: zero. The `characters` schema has no `dialogue_examples` column. V1/V2 imports lose the `<START>` delimiter when fusing `mes_example` into `system_prompt` as prose (`mapCardToDraft.ts:55, 74-79`).

## Shape

- **Schema:** `characters.dialogue_examples jsonb` — array of `{user_msg, char_reply, kind}` where `kind ∈ ("everyday" | "refusal" | "unguarded")`.
- **Prompt assembly:** new **Position 5.5** `# Voice Samples` block — rendered as `<START>\n{{user}}: ...\n{{char}}: ...\n\n<START>\n...` with full placeholder substitution.
- **Refiner:** new output field `dialogue_examples`. System prompt instructs 3-5 entries with ≥1 refusal and ≥1 unguarded. Already-shipped cycle 0114 anti-romance rules apply.
- **CharacterForm:** new fieldset "Voice samples" with add/remove rows.
- **Import path:** best-effort regex parse of `mes_example` from V1/V2/V3 cards into structured rows.

## Non-negotiables

Refiner remains isolated. RLS preserved (column on characters, owner-scoped). No agent state mutation. Conversation snapshot includes the new field (write-once at creation, per architecture.md §4.1).

## Files modified

- NEW `supabase/migrations/0040_dialogue_examples.sql`
- `backend/app/prompt_assembly.py` — Position 5.5
- `backend/app/agents/character_refine.py` — `CharacterRefineResult.dialogue_examples`
- `backend/app/prompts/character_refine_system.txt` — schema field + generation rule
- `frontend/src/lib/characters.ts` + `lib/characterRefine.ts` — types
- `frontend/src/lib/conversations.ts` — `CharacterSnapshot` + `buildCharacterSnapshot`
- `frontend/src/features/import/mapCardToDraft.ts` — best-effort import parse
- `frontend/src/features/characters/CharacterForm.tsx` — fieldset

## Verification

Live: thin draft refiner test, confirm 3-5 dialogue_examples with ≥1 refusal. CharacterForm fieldset renders + persists. Position 5.5 appears in assembled system prompt with substitution.
