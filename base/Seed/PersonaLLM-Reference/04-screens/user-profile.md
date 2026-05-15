# Screen — UserPersona Editor ("Your Persona")

## Observed in PersonaLLM

Source: [User/IMG_4149.PNG](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/User/IMG_4149.PNG), [User/IMG_4150.PNG](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/User/IMG_4150.PNG).

### Purpose
Create / edit a **UserPersona** — the user's in-chat identity. Characters are told "who the user is" via this persona, which is injected into the prompt. Marketing quote: "Create multiple personas — your appearance, personality, and backstory. Characters react to who you are." ([Website.md](../../../References/PersonaLLM/ExtraDocuments/Website.md))

### Entry points
- Menu drawer → "Your Persona · Tap to set up" (first-time) or showing persona name/avatar (configured).
- `(inferred)` additional entry from Settings.

### Header
- Left: **Cancel** pill (dismisses without saving — prompt if dirty `(inferred)`).
- Center: **"New Persona"** (when creating) / persona name when editing `(inferred)`.
- Right: **Save** pill (purple text, enabled only when required fields are filled `(inferred)`).

### Avatar block
- Circular avatar placeholder with `+` icon, centered.
- Below the avatar: persona name preview (large, bold) — **"New Persona"** placeholder.
- Tiny purple dot indicator below the name (possibly "unsaved changes" marker `(inferred)`).
- Two pill buttons under the avatar:
  - **"Upload"** (photo icon) — pick from library.
  - **"Generate"** (sparkle / wand icon) — AI-generate avatar from the **Appearance → Description** field (confirmed by footer note "Used when generating your avatar").

### Section: STATUS
- Row: **"Set as Default"** — "Characters will use this persona for roleplay context."
  - Purple toggle; **ON** by default in screenshot.
  - Implies multiple UserPersonas exist; exactly one is Default.

### Section: IDENTITY
- **Name** (text input) — placeholder "What should characters call you?"
- **Gender** — pill segmented control; observed options: **Male / Female** (selected: Male in screenshot).
  - `(open question)` whether additional options exist (non-binary, custom), or if the field is free-text elsewhere.

### Section: APPEARANCE
- **Description** (multi-line text area).
  - Footer hint: "Used when generating your avatar."
  - Purpose: physical description used both for avatar generation AND as context for characters' visual awareness `(inferred)`.

### Section: ABOUT YOU
- **Background** (multi-line text area) — visible in [IMG_4150](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/User/IMG_4150.PNG).
  - Purpose: personality, backstory, context that characters react to.

### Fields not visible (possible more sections below)
Only the top portion of Appearance and the start of About You are visible in the two screenshots. Additional sections (e.g., personality traits, preferences) may exist — `(open question)`.

### Summary — UserPersona fields captured
| Field | Type | Section | Required | Notes |
|---|---|---|---|---|
| Avatar | image | — | no | Upload or AI-generate from Description |
| (isDefault) | boolean | STATUS | auto | Exactly one default |
| Name | string | IDENTITY | yes `(inferred)` | "What should characters call you?" |
| Gender | enum(Male, Female, ?) | IDENTITY | `(open)` | Options beyond Male/Female unconfirmed |
| Description | text | APPEARANCE | no `(inferred)` | Drives avatar generation |
| Background | text | ABOUT YOU | no `(inferred)` | Drives character reaction |
| … | | | | more sections may exist below |

## User Extensions / Scope Decisions

- Keep the multi-persona model (StoryPlots will benefit from it for "who is narrating").
- **Gender** should be an extensible list or free-text (Male / Female / Non-binary / Custom) in the clone — explicitly widen from observed.
- Avatar generation depends on an image provider being configured; if the user hasn't set ComfyUI / cloud image keys, disable the "Generate" button with a tooltip pointing to Settings.
- Multi-user: UserPersonas belong to the user account, fully isolated per-user.

## Open Questions

- Exact list of fields beyond Background (personality traits? pronouns? age? speech style?).
- Is there a persona switcher per-Chat, or is the default used globally?
- How many personas can a user create?
- What prompt template position does the UserPersona occupy (before / after the Character card)? See [07-prompts-and-llm-touchpoints.md](../07-prompts-and-llm-touchpoints.md).
- Does "Generate" cost credits? In the clone it uses the user's own ComfyUI / cloud key.
