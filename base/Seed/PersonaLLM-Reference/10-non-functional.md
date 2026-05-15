# 10 — Non-Functional

> Tone, copy patterns, privacy posture, accessibility notes, error handling, and performance cues gathered across all passes.

## Observed in PersonaLLM

### Tone of voice

| Surface | Tone sample |
|---|---|
| Marketing tagline | "PersonaLLM — Your stories, brought to life." |
| Empty state | "No Companions Yet. Create your first AI persona or discover characters shared by the community." |
| Power-user empowerment | "Every setting is yours to control." |
| Consent gates | Direct, non-preachy: "You must be 18 or older to use PersonaLLM." |
| Microcopy reassurance | "Your exact age is never shared with PersonaLLM." / "You can revoke this consent anytime in Settings." / "On-device features (memory, TTS) work without cloud access." |
| Content guidelines | Rule-based bullet list with orange warning color, not moralizing. |
| Settings section labels | Small-caps functional labels ("CHAT EXPERIENCE", "AI & VOICE", "DATA & SECURITY"). |
| Destructive actions | Prefixed with red + explicit copy: "This action is permanent and cannot be undone." |
| Encourage without pushing | "Feel free to keep chatting." (during image generation) |

**Takeaway:** tone is **confident, transparent, power-user friendly**. No marketing fluff in-app; marketing language stays on the web site.

### Copy patterns to preserve

- **Verb + what + optional why.** "Generate Character · Cloud only · Uses 10 credits"; "Erase Everything & Reset · This action is permanent and cannot be undone."
- **Reveal, not hide, complexity.** The System Prompt Reference modal ([settings/prompt-editor.md §5](04-screens/settings/prompt-editor.md#5-how-system-prompts-are-built--system-prompt-reference-modal)) shows users exactly how the prompt is assembled. Mimic this spirit throughout.
- **Inline hints under every advanced control** — every slider/toggle/input has a one-line hint explaining impact (e.g., "Higher means better recall but slower retrieval.").
- **Skip-able with reassurance.** "Skip for Now" + "Change anytime in Settings" on onboarding + optional screens.

### Privacy posture

| Claim | Where |
|---|---|
| "Private & Local-First" | Marketing |
| On-device memory | Marketing + "On-device features (memory, TTS) work without cloud access." (Onboarding Slide 3) |
| Local model support (MLX, ComfyUI) | Marketing |
| Revoke cloud consent anytime | Onboarding + [settings/data-security.md](04-screens/settings/data-security.md) |
| Age never shared | Onboarding microcopy |
| Community content warning | "PersonaLLM does not endorse, verify, or guarantee the accuracy or safety of any shared content." |
| Storage transparency | [settings/data-security.md](04-screens/settings/data-security.md) breakdown per category |
| Data portability | Export My Data + Import Backup |
| Full-reset nuclear option | Erase Everything & Reset ([IMG_4192](../References/PersonaLLM/AppReferenceImages/RawScreenshots/Settigns/IMG_4192.PNG)) |

Cross-reference: [PrivacyPolicy.md](../References/PersonaLLM/ExtraDocuments/PrivacyPolicy.md) and [TermsOfService.md](../References/PersonaLLM/ExtraDocuments/TermsOfService.md) exist as linked docs from onboarding and privacy surfaces.

### Content safety

- Hard 18+ gate at onboarding.
- Characters depicting under-21 strictly prohibited ("Creating characters depicting anyone under 21 is strictly prohibited. Any content involving persons under 21 is not permitted.").
- Image Refinement system prompt includes: *"All characters are adults (18+). If source material implies a minor, age them up silently in the description."* ([settings/image-engine.md](04-screens/settings/image-engine.md))
- Community can remove content: "We may remove any content at any time for any reason."
- No impersonation, no harassment, no illegal content.

### Accessibility observations

| Attribute | State |
|---|---|
| Contrast on muted text | **Low** — "tap to set up", section labels, hints risk WCAG AA failure. Flag for clone to audit. |
| Font sizing | Appears to respect iOS Dynamic Type `(inferred — not verified)`. |
| VoiceOver labels | Not verifiable from screenshots. |
| Touch targets | Rail chips ~36 px — meets Apple HIG 44 × 44 target minimum? `(close to edge)` |
| Haptics | Not visible in stills. |
| Motion-reduced | Not evident. Typing Speed slider is user-controlled which partially addresses it. |

**Clone web commitment:** target WCAG 2.1 AA. Audit muted copy, ensure ≥ 4.5:1 contrast; focus rings on keyboard nav; prefers-reduced-motion MQ respected; all interactive elements labeled.

### Error states observed

| Trigger | Treatment |
|---|---|
| Provider not configured (Auto Lore Extraction) | Inline info card: "No providers available. Apple Intelligence is not available on this device. Configure a custom text provider to use this feature." + **Add Provider** CTA |
| Provider token limit | Info card: "Apple Intelligence has a 4,096 token context limit. Character descriptions over ~2,000 characters will be truncated." |
| Feature gated behind Premium | Purple info card: "Upgrade to Premium for cloud-powered memory extraction." (SCOPE-CUT) |
| TTS voices missing | "No enhanced voices available. Download voices in iOS Settings → …" |
| Test Connection failure | `(not captured — assumed: red "X Failed to connect" microtext)` |
| Autopilot gating | Hint "Send a message first — Autopilot needs an AI reply with suggestions" |
| No workflows (Video) | "No bundled default. Select a saved workflow for video generation." + "No saved workflows. Create one to use custom workflows." + Manage Workflows button |

**Pattern:** errors are **informational + actionable** — they tell the user what's wrong AND link to the fix.

### Performance & latency cues

- **Non-blocking image generation** — "Feel free to keep chatting."
- **Streaming AI character generation** — modal previews tokens as they arrive.
- **Elapsed timer** on generation modals ("6s elapsed").
- **Continue in Background** option on Creating Character modal.
- **Test Connection** buttons throughout Provider configs for fast feedback.
- **Typing Speed** slider for user preference on reveal rate.
- **Streaming indicator** not definitively visible in stills; assume supported.

### Empty states taxonomy

- **Illustration + heading + body + 1–2 CTAs** (Home empty).
- **Icon + heading + body** (Community Profile "No uploads yet", "Not following anyone yet").
- **Inline info card + action link** (Auto Lore Extraction "No providers available").

### Copy checklist (for the clone)

Default to PersonaLLM's voice unless noted:
- ✅ Keep "Create …", "Tap to select", "No X yet" patterns.
- ✅ Keep transparent prompts ("Cloud only · Uses N credits" → rewrite to "Uses your OpenRouter key").
- ✅ Keep "Change anytime in Settings" reassurance pattern.
- ✏ Remove Credits / Premium / App Store references.
- ✏ Replace "Verified via Apple" with "Verified via email" / OAuth provider name.
- ✏ Remove Community disclaimers; rewrite Cloud AI Consent copy to match BYOK.

## User Extensions / Scope Decisions

- **Explicit copy change**: replace every marketing-like tier mention with BYOK-forward language. Example Onboarding Slide 5 rewrite:
  > "You're Ready! This app uses your own AI keys. We don't charge you — you pay the providers directly. You can configure your keys in Settings at any time."
- **Debug Mode** (from Chat Controls) should surface error states inline in chat with full details (status code, request/response snippets) — massive UX win for BYOK users.
- **Key validation on save** for every BYOK field (not just Test Connection on demand). Make it cheap and automatic.
- **Respect browser prefers-reduced-motion** — disable the Typing Speed reveal animation when set.
- **Offer a "copy prompt" affordance** on every LLM error so users can retry outside the app (e.g., paste into the provider's playground).

## Open Questions

- Does PersonaLLM surface **token-cost estimates** before sending? Nothing observed.
- Streaming indicator shape (cursor blink, three-dot typing, etc.).
- Offline behavior — what works when there's no network?
- Crash / "please report" surface — is there an in-app feedback path?
- Is there a server-side rate-limit message pattern, or is this purely between the user and their provider (clone will be the latter)?
