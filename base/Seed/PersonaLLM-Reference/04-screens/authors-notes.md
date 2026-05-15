# Screen — Author's Notes

> First-class prompt-steering feature reached via [Chat Controls → Author's Notes](chat-controls.md#section-settings). Author's Notes become an **additional position** in the [11-position prompt assembly](../07-prompts-and-llm-touchpoints.md) — specifically, an injection at a configurable depth within the message history.

## Observed in PersonaLLM

Source: [Chat Controls/IMG_4213.PNG](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat%20Controls/IMG_4213.PNG).

### Header
`< · Author's Notes` (chevron-back from Chat Controls).

Sub: **"Persistent instructions that guide the AI"**

### Scope picker (3-state pill segmented control)

| Scope | Effect |
|---|---|
| **All Chats** | Applied to every chat in the app (global) |
| **This Character** | Applied to every conversation with *this* character |
| **This Conversation** | Applied only to the current Conversation (selected in screenshot) |

Hint below selection: **"Applies only to this conversation"** (dynamic — updates per chosen scope).

### Fields

- **Notes** — large multi-line textarea (empty in screenshot).
- **Injection Depth** — stepper row labeled **"Depth: 0"** with `−` / `+` controls.
  - Hint: "**0 = right before your latest message, higher = further back in history**"

### Examples (chip library, tap to insert into Notes)

- "A storm is approaching the city"
- "The user's character is hiding a secret"
- "Build toward a confrontation this scene"
- "We are in a medieval fantasy setting"

### CTA

- **Save Notes** — red pill, full-width (destructive-themed but action is save).

### Behavior

- Notes are **injected into the prompt** at the configured `depth` from the end of the message history.
  - Depth 0 → immediately before the user's latest message.
  - Depth N → N user-message turns further back.
  - This matches the classic "Author's Note" pattern used by SillyTavern and Agnai — the injection is closer to the latest turn for stronger steering without permanently polluting the scenario or system prompt.
- Scope determines which conversations this Note participates in:
  - `global` → every chat
  - `character` → every Conversation on a given Character
  - `conversation` → one Conversation only
- Multiple Notes with different scopes can coexist. Order of application is likely **global → character → conversation** (most specific overrides / stacks on top).

## Interaction with prompt assembly

This reveals that the [11-position assembly](../07-prompts-and-llm-touchpoints.md) captured in Pass D is incomplete — Author's Notes is effectively a **12th touchpoint** that injects *inside* the message history rather than at the start of the system prompt.

Updated prompt-assembly picture:

```
System prompt (positions 1–11, skip-if-empty)
  ...
Message history (rolling):
  ...
  [N messages back]
  <Author's Notes — depth N>  ← injected here
  [N-1 messages back]
  ...
  <Author's Notes — depth 0>  ← injected here (default)
  User's latest message
```

## Data model

### AuthorsNote (new entity)

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `userId` | ref(User) | per-user isolation |
| `scope` | enum(`global`, `character`, `conversation`) | from segmented control |
| `characterId` | ref(Character) \| null | required when scope = `character` |
| `conversationId` | ref(Conversation) \| null | required when scope = `conversation` |
| `notesText` | text | the note body |
| `injectionDepth` | int | 0 = right before latest message; N = N turns earlier |
| `createdAt` / `updatedAt` | timestamp | |

## User Extensions / Scope Decisions

- Keep the three-scope model verbatim. It's flexible enough for "fantasy setting" globals, per-character "always speaks in French" steering, and per-conversation "a storm is approaching" plot beats.
- Keep the **Injection Depth stepper** — power users will love it, new users can ignore it (default 0 is correct for most cases).
- Keep the **example chip library**; these are low-friction hints of what Author's Notes is for. Ship the same four; let users save their own.
- On web, render the "Applies only to this conversation" hint dynamically from the selected scope; fall back to "Applies to all chats" / "Applies to all chats with {characterName}" for the other scopes.
- Note: Author's Notes is **not** the same as the Character editor's "Default Author's Note" (which is a field of [WritingStylePreset](settings/prompt-editor.md#1b-edit-preset--roleplay-verbatim-defaults-img_4165)). Keep the names distinct:
  - `WritingStylePreset.defaultAuthorsNote` → style guidance shipped with a preset.
  - `AuthorsNote` (this screen) → user's dynamic plot/scene steering per scope.

## Open Questions

- When multiple AuthorsNotes with different scopes apply, what is the stacking order in the prompt?
- Can a single AuthorsNote be versioned (history of past notes for reference)?
- Does Injection Depth count user messages, assistant messages, or pairs?
- Is there a visual indicator in chat that an Author's Note is active (e.g., a badge on the composer)?
