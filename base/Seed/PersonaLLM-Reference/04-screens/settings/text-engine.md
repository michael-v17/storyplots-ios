# Settings → Text Engine

## Observed in PersonaLLM

Sources: [IMG_4176](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4176.PNG), [IMG_4177](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4177.PNG), [IMG_4178](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4178.PNG), [IMG_4179](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4179.PNG), [IMG_4180](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4180.PNG), [IMG_4181](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4181.PNG), [IMG_4182](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4182.PNG).

Header: `< · Text Engine`. Section: **TEXT GENERATION**.

Top-level tab switcher: **Cloud | Custom**.

---

## Cloud tab ([IMG_4176](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4176.PNG))

Two tier cards (radio-selectable):

- ⚡ **Standard (Free)** — selected
  - "Basic AI · Auto-memory via Apple Intelligence · Free — no credits required"
- ⭐ **Premium**
  - "Advanced AI · Smarter auto-memory via Cloud · 5 credits per message"

Below tiers: link — "Or subscribe for unlimited premium — **$7.99/mo**"

**How Unlimited Conversations Work** (explainer card):
- 📄 **Rolling Summaries** — "When a conversation gets long, older messages are automatically summarized to preserve the story."
- 🧠 **Character Memory (RAG)** — "Your character remembers details across all your conversations using on-device retrieval-augmented generation. If older messages leave the context window, relevant details are also recalled from earlier in the same chat."

*(All of this is SCOPE-CUT in the clone — no Standard/Premium tiers, no credits.)*

---

## Custom tab ([IMG_4177](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4177.PNG))

Saved Providers card:
- ✅ **OpenRouter** — `deepseek/deepseek-v3.2` (chevron → Text Provider detail)

Same "How Unlimited Conversations Work" explainer below.

→ Tapping the saved provider opens the **Text Provider** detail screen.

---

## Text Provider detail ([IMG_4178](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4178.PNG), [IMG_4179](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4179.PNG), [IMG_4180](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4180.PNG))

Header: `< · Text Provider`.

### Quick actions
- ⚡ **Quick Start from Template** (green button — pre-filled configs for popular providers)

### Saved Providers
- ✅ OpenRouter · `openrouter.ai/api/v1` · `deepseek/deepseek-v3.2` (current)

### Configuration block

| Field | Observed value | Notes |
|---|---|---|
| **Base URL** | `https://openrouter.ai/api/v1` | OpenAI-compatible base URL |
| **API Key** | masked input with 👁 reveal toggle | Encrypted at rest `(inferred)` |
| **Model** | `deepseek/deepseek-v3.2` (+ refresh icon) | Tapping opens [Select Model](#select-model) |
| **Test Connection** | button | Shows ✅ "Connected" on success ([IMG_4180](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4180.PNG)) |

### Thinking Mode (toggle, OFF in screenshot)
Copy: "Enable chain-of-thought reasoning for supported models (e.g., DeepSeek R1, Qwen). Uses more tokens and is slower."

### Generation Settings

| Param | Control | Observed value | Notes |
|---|---|---|---|
| **Temperature** | Slider | `0.7` | Standard sampler |
| **Max Tokens** | Slider | `8192` | Per-response cap |
| **Context Length** | Slider | `32768` | Hint: "Tap the value to type an exact number. Match your model's context window for best results." |

Only three generation knobs exposed here. No top-p / top-k / presence/frequency penalties / stop sequences visible — either not supported or in an unexpanded sub-panel.

---

## Select Model ([IMG_4181](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4181.PNG))

Header: `Cancel · Select Model`.
- Search input: "Search models…"
- Alphabetical scrollable list of model IDs.
- Observed leading entries (snapshot of a live OpenRouter list):
  - `ai21/jamba-large-1.7`
  - `aion-labs/aion-1.0`, `aion-labs/aion-1.0-mini`, `aion-labs/aion-2.0`, `aion-labs/aion-rp-llama-3.1-8b`
  - `alfredpros/codellama-7b-instruct-solidity`
  - `alibaba/tongyi-deepresearch-30b-a3b`
  - `allenai/olmo-2-0325-32b-instruct`, `allenai/olmo-3-32b-think`, `allenai/olmo-3.1-32b-instruct`
  - `alpindale/goliath-120b`
  - `amazon/nova-2-lite-v1`, `amazon/nova-lite-v1`, `amazon/nova-micro-v1`
  - … (list continues)

→ The list is **fetched from the provider** (Refresh icon in the Model field supports this).

---

## Choose Provider ([IMG_4182](../../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4182.PNG))

Header: `Cancel · Choose Provider`.

### LOCAL PROVIDERS — "Run models on your own hardware"
| Provider | Default port |
|---|---|
| **Ollama** | `11434` |
| **LM Studio** | `1234` |
| **KoboldCpp** | `5001` |
| **llama.cpp** | `8080` |
| **Text Gen WebUI** (oobabooga) | `5000` |
| **vLLM** | `8000` |

### CLOUD PROVIDERS — "Requires an API key"
| Provider | Notes |
|---|---|
| **OpenRouter** | "200+ models, one key" · API Key |
| **OpenAI** | "GPT models" · API Key |
| **Google** | "Gemini models" · API Key |
| _(list continues off-screen)_ | |

→ Marketing claim of "13+ text providers" is consistent with this visible list (6 local + 3+ cloud captured; more below fold).

---

## ProviderConfig — Text subset (data model)

| Field | Observed | Example |
|---|---|---|
| `providerFamily` | enum | OpenRouter / OpenAI / Google / Ollama / LM Studio / KoboldCpp / llama.cpp / TextGenWebUI / vLLM / … |
| `baseUrl` | string | `https://openrouter.ai/api/v1` or `http://localhost:11434` |
| `apiKey` | encrypted string | `(inferred)` encryption |
| `modelId` | string | `deepseek/deepseek-v3.2` |
| `thinkingMode` | bool | false |
| `temperature` | float | 0.7 |
| `maxTokens` | int | 8192 |
| `contextLength` | int | 32768 |
| `lastTestedOk` | bool | displayed as ✅ |

## User Extensions / Scope Decisions

- **Cut the Cloud tab (Standard/Premium tiers).** Clone is BYOK-only: Custom is the only tab, renamed just "Text Engine".
- Keep the entire Custom flow verbatim — Quick Start templates, Provider picker (Local + Cloud), saved providers, test connection, model list with refresh, Thinking Mode, generation knobs.
- Expand the generation settings panel to include **top-p, top-k, frequency/presence penalty, stop sequences** as an "Advanced" collapsible — mandatory for power users, low cost.
- **BYOK security:** API keys encrypted server-side with envelope encryption per user data-key; never returned in API responses (mask with `••••`).
- Preserve **Rolling Summaries** + **Character Memory (RAG)** behavior copy — these are the mechanisms behind "Unlimited Conversations", and need to exist independent of tier.

## Open Questions

- Exact full list of Cloud providers beyond OpenRouter / OpenAI / Google (list cut off in screenshot).
- Does "Quick Start from Template" populate Base URL + Model but leave API key for the user to fill?
- Where are stop sequences / top-p / top-k / penalties configured? Either hidden or not implemented — matters for prompt-assembly completeness.
- Does "Thinking Mode" alter the request body (e.g., OpenRouter's `reasoning`/`include_reasoning` fields) or just the UI presentation of thoughts?
- When a user has multiple saved providers, how do they switch the "active" one? (Single ✅ check mark on OpenRouter suggests single-active-at-a-time.)
