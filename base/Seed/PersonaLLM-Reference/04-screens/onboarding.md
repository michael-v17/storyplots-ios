# Screen — Onboarding

## Observed in PersonaLLM

Source folder: [Onboarding/](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Onboarding/) — IMG_4105, IMG_4106, IMG_4108, IMG_4109, IMG_4111 (five slides, one gap at IMG_4107/4110 presumed transitional).

### Structure
Five-slide linear flow. Page indicator (five dots) at top center; current slide highlighted purple. Status bar shows "App Store" back-chevron on slides 1–2 (confirming launch-from-App-Store context).

### Slide 1 — Welcome ([IMG_4105](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Onboarding/IMG_4105.PNG))
- Heading: **"Welcome to PersonaLLM"**
- Subtitle: "Your AI Companions, brought to life."
- Three feature rows, each with a purple icon + title + one-line description:
  - **Visual Roleplay** — "AI-generated images bring your conversations to life."
  - **Intelligent Memory** — "Characters remember across conversations and deep lore."
  - **Deep Customization** — "Tweak scenarios, lore, personalities, and settings."
- Bottom CTA (gradient pill): **"Continue"**.

### Slide 2 — Age Verification ([IMG_4106](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Onboarding/IMG_4106.PNG))
- Purple shield-check icon.
- Heading: **"Age Verification"**
- Body: "You must be 18 or older to use PersonaLLM. PersonaLLM contains mature AI-generated content including roleplay, images, and video. Age verification is required to continue."
- Two toggle rows (off by default):
  - "I agree to the **Terms of Service**" (link)
  - "I agree to the **Privacy Policy**" (link)
- Bottom CTA: **"Verify with Apple"** (gradient pill, Apple logo) — disabled until both toggles on `(inferred)`.
- Microcopy: "Your exact age is never shared with PersonaLLM."

### Slide 3 — Cloud AI Services ([IMG_4108](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Onboarding/IMG_4108.PNG))
- Purple cloud icon.
- Heading: **"Cloud AI Services"**
- Body: "PersonaLLM uses third-party AI services to power chat, image generation, and video creation. Your messages and prompts are sent to these providers when using cloud features:"
- Provider list (card with four rows, each with a document-check icon):
  - **OpenRouter** — "Chat & text generation"
  - **RunPod** — "Image generation"
  - **Atlas Cloud** — "Video generation"
  - **Alibaba Cloud** — "Video generation (backup)"
- Microcopy: "You can revoke this consent anytime in Settings. On-device features (memory, TTS) work without cloud access."
- Link: **Privacy Policy** (purple).
- Primary CTA: **"I Understand & Agree"** (gradient pill).
- Secondary link: **"Skip for Now"** (underscores that cloud features are optional).

### Slide 4 — Entertainment Only ([IMG_4109](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Onboarding/IMG_4109.PNG))
- Purple theater-masks icon.
- Heading: **"For Entertainment Only"**
- Subtitle: "PersonaLLM is a creative fiction platform powered by AI."
- **Fiction Disclaimer** card (green info icon):
  - "All characters are fictional AI constructs — they are not real people."
  - "All conversations are AI-generated and should not be taken as fact."
  - "AI-generated images and videos are synthetic — not real photographs."
- **Content Guidelines** card (orange warning icon):
  - "Do not create characters impersonating real people."
  - "Do not generate illegal, exploitative, or harmful content."
  - "Do not use this app to harass, threaten, or deceive others."
  - "Creating characters depicting anyone under 21 is strictly prohibited. Any content involving persons under 21 is not permitted."
- Microcopy: "Content that violates these guidelines may be removed."
- CTA: **"I Understand"**.

### Slide 5 — You're Ready ([IMG_4111](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Onboarding/IMG_4111.PNG))
- Purple gift-box icon.
- Heading: **"You're Ready!"**
- Tier card (two rows with dividers):
  - ✅ **Standard** — "Unlimited free chat."
  - ✨ **Premium** — "$7.99/mo" · "Smarter AI for deeper roleplay."
- **500 Starter Credits** card — "For images & video."
- **Auto Image Generation** toggle row — "AI generates scene images as you chat. Uses credits." (toggle shown **off** by default).
- Microcopy: "Change anytime in Settings."
- CTA: **"Start Exploring"** → [Home](home.md).

### Pattern notes
- Consistent single-primary-CTA + gradient pill visual across slides.
- Slides 2 & 4 are **gated** (consent required); slide 3 is **optional** ("Skip for Now"); slides 1 & 5 are pure info.
- Deferred setup: UserPersona creation is **not** in onboarding; user is taken to Home and UserPersona is set later from the Menu (evidence: Menu's "Your Persona · Tap to set up" row).

## User Extensions / Scope Decisions

Rewrite for the clone's scope (multi-user web, BYOK, no credits, no community):

- **Keep:** Welcome slide, Age Verification (adapted — email/OAuth instead of Sign in with Apple), Content-Guidelines disclaimer.
- **Rewrite Slide 3 (Cloud AI Services):** Show that the app does **not** proxy any LLM/image provider — user must configure their own API keys. Replace provider list with the actual BYOK targets the clone supports (OpenRouter, direct providers, user-hosted ComfyUI). Keep the same "revoke anytime in Settings" reassurance, but point at a "Providers & Keys" settings page instead.
- **Remove/rewrite Slide 5:** No Standard/Premium tiers, no Credits, no Starter Credits card. Replace with a **"Bring your keys"** step: optional inline fields for OpenRouter key + ComfyUI endpoint URL (skippable), plus "Auto Image Generation" toggle retained (but now gated on ComfyUI being configured).
- **Add:** UserPersona quick-setup slide between Slide 4 and Slide 5 (optional; skippable) to reduce friction vs. PersonaLLM's "set it up later in Menu" approach.
- **Consent records:** Persist ToS/Privacy acceptance per-user-account (not per-device) since the clone is multi-user.

## Open Questions

- Does slide 2 fully block the user without both toggles? Exact gating logic.
- What happens if the user taps "Skip for Now" on slide 3 then later tries a cloud feature — is there a just-in-time prompt?
- Is there a re-onboarding path (e.g., after logout / guideline update)?
- In the clone: is Age Verification required at sign-up, or deferrable until first chat?
