# Screen — Character Import

## Observed in PersonaLLM

Source folder: [Import Character/](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Import%20Character/) (IMG_4096–IMG_4104).

> **Note on this folder.** Despite the folder name, the screenshots actually cover **all three creation flows** (Import, AI Generate, Manual), because they all share the "Create Character" entry point. The AI Generate and Manual flows are consolidated into [character-info.md](character-info.md); only the **Import** path is documented here.

### Entry
- From [Home](home.md) "+ New Persona" tile/row → creation method picker ([IMG_4096](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Import%20Character/IMG_4096.PNG)) → **Import** row.

### Import screen ([IMG_4104](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Import%20Character/IMG_4104.PNG))

- Header: **Back** · "**Import**" (white title, no Save — file picker drives the flow).
- Centered dashed-border dropzone (square card):
  - ⬇ download icon (green)
  - Label inside dropzone: **"Tap to Select"**
- Below dropzone:
  - Heading: **"Select a Character Card"**
  - Sub: "PNG or JSON format"
- **Supported Formats** block (muted text):
  - Platforms: "**TavernAI, SillyTavern, Chub.ai**"
  - Spec: "**Character Card V1 & V2**"

### Behavior (inferred from marketing + this screen)

- User taps the dropzone → native iOS file picker opens → user picks a `.json` or `.png` file.
- On PNG, the app reads the character-card metadata embedded in the PNG `tEXt`/`iTXt` chunks (TavernAI/SillyTavern convention; Character Card V1 uses `chara` key with base64-encoded JSON; V2 uses `ccv2`). `(inferred)`
- Parsed fields map into the app's own Character schema ([character-info.md](character-info.md)). Fields beyond the V1/V2 spec (e.g., Optional Deep Dives, scenarios structure, accent color) are left empty for the user to fill in the editor.
- After import, user likely lands in [Edit Character](character-info.md#3-edit-character) with fields pre-populated.

### What's NOT visible

- URL-based import (paste a Chub.ai character link). Not seen in these screenshots — `(open question)`.
- V3 character card support (V3 is the newer spec introduced by AICharacterEditor / Risu). Only "V1 & V2" listed — `(observed)`.
- Conflict handling (character with same name already exists).
- Bulk import.

### Character Card spec reminder (reference)

Character Card V1 / V2 typically contain these JSON fields (PersonaLLM implicitly consumes these):
- `name`, `description`, `personality`, `scenario`, `first_mes`, `mes_example` (V1 core)
- V2 adds: `creator`, `character_version`, `character_book` (embedded lorebook), `alternate_greetings`, `tags`, `system_prompt`, `post_history_instructions`, `extensions`
- PNG variant embeds the above JSON (base64) in PNG metadata.

## User Extensions / Scope Decisions

- Keep PNG + JSON import in v1 — low-cost, high-value for onboarding power users who already have card libraries.
- Prefer drag-and-drop + file picker on web (HTML5 drop target).
- Consider supporting **URL import** (paste Chub.ai link) in v1 — the clone's target users expect it. Add as explicit field.
- Consider supporting **V3** cards (additive; same PNG metadata extraction logic).
- On import, map V1/V2 fields into the clone's own schema explicitly:
  - `description` → systemPrompt (primary)
  - `personality` → personality.coreTraits
  - `scenario` → create a default Scenario with this body
  - `first_mes` → that Scenario's opening message
  - `mes_example` → stored as `exampleDialogue` (retain for prompt assembly even if no UI field yet)
  - `alternate_greetings[]` → additional Scenarios (one per greeting)
  - `character_book` → seed LorebookEntries
  - `tags[]` → tags
- Preserve the **Supported Formats** block; list the actual supported platforms (TavernAI, SillyTavern, Chub.ai) to reduce "will this work?" friction.

## Open Questions

- Does PersonaLLM do any post-import AI "cleanup" pass (rewrite description to match its richer schema)?
- Does import copy the embedded PNG image as the avatar automatically, or does the user need to upload one?
- Are duplicate names auto-suffixed ("(1)", "(2)")?
- Does import support character books / lorebooks embedded in V2 cards?
