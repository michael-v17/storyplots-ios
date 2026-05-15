---
id: 0116
slug: sampler-hygiene
status: in-progress
created: 2026-05-13
---

# Cycle 0116 — Sampler hygiene (top_p / top_k / min_p / freq+presence=0)

## Driver

Audit §1.1: `ProviderCallConfig` only forwards `temperature` + `max_tokens` + `reasoning`. Doc-validated RP defaults — temp 1.0, top_p 0.95, top_k 40, min_p 0.01, **frequency_penalty and presence_penalty MUST be 0** (distort voice + break catchphrases) — cannot be enforced today. Provider defaults vary; some default freq_penalty to non-zero.

## Shape

- **Storage:** `users.preferences.sampler = {top_p, top_k, min_p, frequency_penalty, presence_penalty}` with doc-recommended defaults. `temperature` and `max_tokens` stay per-provider (existing `provider_configs.temperature`); these new knobs are user-global and apply across providers.
- **Backend:** `ProviderCallConfig` extended with optional fields. `_load_bundle` reads prefs with coalesce. `stream_completion` only adds keys that are non-None — providers that don't honor a key silently ignore the absent field.
- **Frontend:** new subsection in `/settings/text-engine` "Sampler hygiene" with five sliders (top_p / top_k / min_p / freq_penalty / presence_penalty). Defaults pre-populated. "Reset to RP defaults" pill mirrors cycle 0081's Animagine pattern.

No migration. `users.preferences` already jsonb. Coalesce reads cover missing keys.

## Verification

Live: send a chat request with defaults applied; log the upstream payload; confirm `top_p`, `top_k`, `min_p`, `frequency_penalty`, `presence_penalty` keys present with doc-recommended values.
