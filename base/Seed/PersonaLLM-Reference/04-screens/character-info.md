# Screen — Character (Create, View, Edit)

## Observed in PersonaLLM

Source folder: [Character Info/](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/) — IMG_4134 … IMG_4146 (13 screenshots). Related first-step: [Import Character/IMG_4096.PNG](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Import%20Character/IMG_4096.PNG) (creation method picker).

This screen family covers three tightly coupled surfaces:
1. **Creation method picker** — choose AI / Manual / Import.
2. **AI Generate flow** — describe-and-generate.
3. **Edit Character** — canonical editor (Avatar / Info / Settings tabs).

A fourth surface — **Character landing / pre-chat card** — is documented in [chat.md](chat.md) because it's the gateway into a conversation.

---

### 1. Creation method picker ([Import/IMG_4096](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Import%20Character/IMG_4096.PNG))

- Header: **Cancel** · "Create Character" (no Save — this is a picker).
- Heading: **"How would you like to create?"**
- Sub: "Choose a creation method that works for you"
- Three large option rows, each with icon, title, subtitle, chevron:
  - ✨ **AI Generate** — "Describe your idea and let AI create the character" — **Recommended** pink badge (top-right of row).
  - ✏️ **Manual** — "Create your character with a form"
  - ⬇ **Import** — "Import from TavernAI/SillyTavern (JSON or PNG)" → [character-import.md](character-import.md)

### 2. AI Generate flow

#### 2.a. Mode picker ([IMG_4097](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Import%20Character/IMG_4097.PNG))
- Heading: **"What kind of character?"** · "Choose a mode to get started"
- Two option rows:
  - 🎭 **Roleplay** — "Immersive character interaction"
  - ✨ **Assistant** — "Helpful tool with personality"
- **Character Mode is set at creation and cannot be changed** (confirmed by Settings tab footer, [IMG_4145](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4145.PNG)).

#### 2.b. Describe screen ([IMG_4134](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4134.PNG), [IMG_4098](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Import%20Character/IMG_4098.PNG), [IMG_4099](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Import%20Character/IMG_4099.PNG))
- Heading: **"Describe Your Character"** · "Tell us who they are and we'll create the rest"
- **Character Concept** (multi-line textarea with voice-input mic)
  - Placeholder: "Who are they? Think personality, world, motivations, and quirks — the more vivid the detail, the richer the character…"
- **"Or try an example"** — five pill chips (tap to populate concept):
  - "A sarcastic vampire who runs a late-night coffee shop"
  - "A gentle AI companion learning about human emotions"
  - "A mysterious fortune teller with dark secrets"
  - "A cheerful pirate captain searching for legendary treasure"
  - "A stoic samurai sworn to protect their village"
- **Writing Style** (radio cards with book icon, tick indicator):
  - **Roleplay** (Built-in) — default selected
  - **Storybook** (Built-in)
  - **Texting** (Built-in)
  - Footer hint: "Influences how the AI writes scenario openings and descriptions."
- Primary CTA (gradient pill): **"Generate Character"**
- Microcopy below CTA: "Cloud only · Uses 10 credits"

#### 2.c. Generating modal ([IMG_4135](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4135.PNG))
- Modal with sparkle icon and title **"Creating Character"** · "AI is crafting your character…"
- Streaming preview of the generated fields (e.g. `Clara Moretti` · `Welcome in — I've been expecting you.` · growing description body).
- Bottom row: "`Ns` elapsed" timer · **Cancel** (red) · **Continue in Background** (green).
- While generating, the "Generate Character" button below the modal shows "Generating…" state.

### 3. Edit Character

A three-tab segmented control at the top: **Avatar · Info · Settings** (purple pill indicates active tab). Header: **Cancel · "Edit Character" · Save**.

#### 3.a. Avatar tab ([IMG_4138](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4138.PNG), [IMG_4139](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4139.PNG))

- Sub-title: **"Avatar"** · "Customize your character's appearance"
- Avatar preview (large circle).
- Three actions row: **Upload** · **Generate** · **Remove Image** (red link below).
- **Appearance Description** (multi-line textarea)
  - Example content (Clara Moretti): "female, medium-length wavy brown hair, green eyes, white skin ,, average athletic build, white button-up blouse, navy blue blazer with hotel crest, gold name badge reading Clara, small gold hoop earrings, subtle makeup, friendly smile"
  - Footer hint: "Used for AI avatar generation and visual roleplay images."
- **Append appearance to image prompts** (toggle) — ON by default. Controls whether Appearance Description is auto-prepended to every in-chat image generation prompt.
- **Accent Color** — 2-row, 8-column palette of color swatches (16 presets) + a **Custom** picker button (+ swatch).
  - Observed default swatches (approx): violet, indigo, green, teal, coral, salmon, orange, yellow (row 1); lavender, mint, pink, cyan, magenta, periwinkle, lime, custom (row 2).
  - Selected swatch indicated by a white ring.
  - Label under palette shows selected swatch name ("Violet" in [IMG_4102](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Import%20Character/IMG_4102.PNG)).
- **The accent color themes the entire Chat screen** for this character (chat glow, scenario-card borders, send-button tint). Confirmed cross-screenshot:
  - Clara Moretti → green ([Chat/IMG_4147](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4147.PNG))
  - Socrates of Athens → bronze/gold ([Chat/IMG_4128](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4128.PNG))
  - AXIOM-7 → red ([Chat/IMG_4125](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4125.PNG))

#### 3.b. Info tab ([IMG_4140](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4140.PNG), [IMG_4141](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4141.PNG), [IMG_4142](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4142.PNG), [IMG_4143](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4143.PNG), [IMG_4144](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4144.PNG))

- Sub-title: **"Basic Info"** · "Character identity and personality"
- **Name** (text input) — e.g. "Clara Moretti"
- **Tagline** (text input) — e.g. "Welcome in — I've been expecting you."
- **System Prompt** (large multi-line textarea) with **character counter** `N / 2,000` top-right.
  - Example (excerpt from Clara Moretti): "You are Clara Moretti, a 27-year-old hotel receptionist at The Bellevue Grand, a charming boutique hotel in a coastal European city. You speak warmly and conversationally…" (1,243 / 2,000 chars)
  - Footer hint: "Describe your character's personality, background, and how they should respond."

- **Optional Deep Dives** (collapsible accordions; one visible at a time via a dropdown selector labelled with the current section name):

  - 🖐 **Personality Deep Dive** ([IMG_4141](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4141.PNG))
    | Field | Hint |
    |---|---|
    | Core Traits | "Key personality traits that define them" |
    | Fears & Insecurities | "What keeps them up at night?" |
    | Communication Style | "How they talk and express themselves" |
    | Quirks & Habits | "Distinctive behaviors or mannerisms" |

  - 🎯 **Goals & Motivations** ([IMG_4142](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4142.PNG))
    | Field | Hint |
    |---|---|
    | Primary Goal | "The one thing they're working toward" |
    | Secret Desire | "What they want but won't admit" |
    | Fears to Overcome | "Internal obstacles they must face" |
    | What They'd Sacrifice | "What they'd trade to achieve their goal" |

  - 🌐 **Worldbuilding Deep Dive** ([IMG_4143](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4143.PNG), [IMG_4144](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4144.PNG))
    | Field | Hint |
    |---|---|
    | Origin/Birthplace | "Their homeland or place of origin" |
    | Backstory | "Key events that shaped them" |
    | World/Setting | "The setting or universe they exist in" |
    | Special Abilities | "Powers, skills, or unique capabilities" |

- **Scenarios (N scenarios)** card at bottom of Info tab ([IMG_4144](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4144.PNG)) — chevron opens the Scenarios editor ([IMG_4204](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4204.PNG)).

#### Scenarios editor ([IMG_4204](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4204.PNG))

Header: `< · Scenarios · +` (the `+` button top-right adds a new Scenario).

Body: vertical list of scenario cards, each card tinted in the Character's accent color (bronze for Socrates of Athens):

- Top-left label: **"Scenario N"** pill
- Top-right: scenario **title** pill (e.g., "Meeting in the Agora", "Evening by the River")
- Body: full scenario text — mixed narration (italic via `*asterisks*` in source) and dialogue (via `\"quoted\"` strings in source). Captured examples for Socrates:

**Scenario 1 — "Meeting in the Agora"** (full verbatim):
> `I wipe the dust from my hands and turn from the retreating sophist, who seems to have suddenly remembered an urgent appointment elsewhere. My eyes find you standing near the fig seller's stall, and something about your expression tells me you've been listening. \"Ah, my friend! You have the look of someone who either has a question or is trying very hard not to have one. Both are admirable states, though I confess I find the second far more interesting.\" *I take a step closer, sandals scraping against the warm stone.* \"Tell me — since you've been kind enough not to walk away yet — do you consider yourself a wise person? And before you answer, I should warn you: I've been told I'm terrible company once a conversation begins.\"`

**Scenario 2 — "Evening by the River"** (full verbatim):
> `I'm sitting with my back against the broad trunk of a plane tree, bare feet dangling toward the cool water of the Ilissos. The last light of the sun catches the river and turns it to bronze. I hear your footsteps on the path and look up with a slow smile. \"What good fortune — or perhaps what good daimonion — brings you here at this hour?\" *I gesture to the grass beside me.* \"Sit, if you like. I was just having a rather heated argument with myself about whether beauty exists in the thing itself or only in the soul that perceives it. I was losing badly on both sides. Perhaps you can settle the matter before the stars come out and make the question even more complicated.\"`

Tapping a scenario card → edit that scenario (fields: title, body). Tapping `+` → create a new scenario.

**Scenario field model (confirmed):**
| Field | Type | Notes |
|---|---|---|
| `title` | string | Short name shown in badge |
| `body` | text | Multi-paragraph. Uses `*asterisks*` for narration (matches Roleplay Writing Style convention) and `\"quoted\"` dialogue |
| (`firstMessage` override?) | — | No separate field visible — **the scenario body IS the first assistant message** when the conversation starts |

### Full Character editor — Settings tab (continued) ([IMG_4205](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4205.PNG))

[IMG_4205](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4205.PNG) confirms that the Settings tab ends just below the Memory section:
- Writing Styles radio list → Default Persona ("None · Use app default") → Memory section with Character Memory toggle + copy.
- **No additional sections below Memory** (closing the Pass C open question). Voice / delete / export / per-character provider-overrides are NOT in this tab — they live elsewhere (Chat Controls → Character Settings deep-links here; per-character image provider override is visible in [chat-controls.md §Generation](chat-controls.md#section-generation)).

#### 3.c. Settings tab ([IMG_4145](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4145.PNG), [IMG_4146](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Character%20Info/IMG_4146.PNG))

- Top action row: **🌐 Share to Community** (button; SCOPE-CUT in the clone).
- Sub-title: **"Interaction Settings"** · "Default preferences for conversations"
- **Character Mode** — read-only pill showing current mode (🎭 Roleplay).
  - Footer: "Mode is set at creation and cannot be changed."
- **Default Writing Style** — three radio cards:
  - 📖 **Roleplay** (Built-in) — selected in screenshot
  - 📖 **Storybook** (Built-in)
  - 📖 **Texting** (Built-in)
  - Footer: "Sets the default writing style for new conversations."
- **Default Persona** — dropdown card, currently **None · Use app default**.
  - Footer: "Sets which persona is used for new conversations with this character."
- **Memory** · "Cross-conversation recall"
  - **Character Memory** toggle — ON by default.
  - Full copy: "[Character Name] remembers details across conversations — names, preferences, story events. When off, memory is limited to the current conversation."
- `(open question)` Further Settings content below what's captured — voice, image generation per-character overrides, deletion, export — all plausible but not visible.

### Character data model captured so far

| Field | Source tab | Observed | Type |
|---|---|---|---|
| name | Info | ✅ | string |
| tagline | Info | ✅ | string |
| systemPrompt | Info | ✅ | string (≤ 2000 chars) |
| mode | Settings (read-only) | ✅ | enum(Roleplay, Assistant) |
| defaultWritingStyle | Settings | ✅ | enum(Roleplay, Storybook, Texting, …custom) |
| defaultPersona | Settings | ✅ | ref(UserPersona) \| null |
| characterMemoryEnabled | Settings | ✅ | bool |
| avatar | Avatar | ✅ | image |
| appearanceDescription | Avatar | ✅ | string |
| appendAppearanceToImagePrompts | Avatar | ✅ | bool |
| accentColor | Avatar | ✅ | color (16 presets + custom) — themes Chat UI |
| personality.coreTraits | Info → Personality | ✅ | text |
| personality.fearsInsecurities | Info → Personality | ✅ | text |
| personality.communicationStyle | Info → Personality | ✅ | text |
| personality.quirksHabits | Info → Personality | ✅ | text |
| goals.primaryGoal | Info → Goals | ✅ | text |
| goals.secretDesire | Info → Goals | ✅ | text |
| goals.fearsToOvercome | Info → Goals | ✅ | text |
| goals.whatTheydSacrifice | Info → Goals | ✅ | text |
| worldbuilding.originBirthplace | Info → Worldbuilding | ✅ | text |
| worldbuilding.backstory | Info → Worldbuilding | ✅ | text |
| worldbuilding.worldSetting | Info → Worldbuilding | ✅ | text |
| worldbuilding.specialAbilities | Info → Worldbuilding | ✅ | text |
| scenarios[] | Info → Scenarios card | ✅ (editable; count shown) | Scenario[] |
| tags[] | Community detail | ✅ | string[] (Sci-Fi, SFW, Male, …) |

### Scenario sub-entity (observed in Community detail, landing card, chat intro)
| Field | Example |
|---|---|
| title | "Late Night Check-In", "Midnight Conversation" |
| body | Opening scene narration |
| tag/badge | RP (pill) |

## User Extensions / Scope Decisions

- Keep **all three creation methods** (AI Generate, Manual, Import). Drop the "Uses 10 credits" microcopy — clone has no credits.
- Keep the **Avatar / Info / Settings** three-tab structure verbatim.
- Keep the **Optional Deep Dives** (Personality / Goals / Worldbuilding) as optional structured fields — they're gold for prompt assembly.
- Keep **Scenarios** as first-class entities on Character.
- Keep **accent color as the chat theme driver** — this is a strong identity signal per character and easy to port to CSS custom properties on web.
- **Writing Styles**: keep Roleplay / Storybook / Texting built-ins + allow user-defined custom styles (observed as future-friendly in Pass B; confirm in Settings in Pass D).
- **Share to Community** button — remove.
- **Mode is set at creation and cannot be changed** — keep this constraint. It simplifies prompt templating.
- **System Prompt char limit** — loosen if underlying provider allows (2000 chars was an iOS constraint; web-server limit can be higher). Keep the counter UI.
- **Append appearance to image prompts** — keep; it directly explains how in-chat image generation builds its prompt.

## Open Questions

- Full field set of the **Scenarios editor** (title? body/opening? tags? per-scenario first-message? per-scenario image prompt?). Not captured in this batch.
- What is below the Memory toggle in Settings tab (voice selection? per-character image provider override? delete character?)
- Is Character Mode (Roleplay vs Assistant) a template that swaps prompt scaffolding, or only a UI tag?
- What does "Refine with AI" do in the Manual creation flow ([Import/IMG_4101](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Import%20Character/IMG_4101.PNG))? Likely: rewrites a manually-entered description with the same generator used in AI Generate.
- Are the Optional Deep Dives all injected into the prompt at the same position, or at different positions? See [07-prompts-and-llm-touchpoints.md](../07-prompts-and-llm-touchpoints.md).
- Can scenarios have their own **first-message override**, separate from the character's default opening?
