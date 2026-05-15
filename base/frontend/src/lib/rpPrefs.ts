import { supabase } from "./supabase";

// Cycle 0113 — Roleplay scaffolding defaults. Mirrors backend/app/prompt_assembly.py
// constants verbatim for the Settings preview. Keep in sync: changes to either
// side need a matching edit on the other.

export type Pacing = "off" | "slow_burn" | "warm";

export type RoleplayPrefs = {
  author_framing: boolean;
  pacing: Pacing;
  style_anchor: boolean;
};

// Cycle 0130 — per-character override of the three RP settings. Stored on
// characters.rp_overrides (jsonb). Any omitted key = inherit that key from the
// user's global RoleplayPrefs; null / {} = inherit everything. The backend
// (chat.py _load_bundle) merges this over the global per-key.
export type RpOverrides = {
  author_framing?: boolean;
  pacing?: Pacing;
  style_anchor?: boolean;
};

export const ROLEPLAY_PREFS_DEFAULTS: RoleplayPrefs = {
  author_framing: true,
  pacing: "slow_burn",
  style_anchor: true,
};

const PACING_VALUES: ReadonlyArray<Pacing> = ["off", "slow_burn", "warm"];

export function mergeRoleplayDefaults(raw: Partial<RoleplayPrefs> | null | undefined): RoleplayPrefs {
  if (!raw || typeof raw !== "object") return { ...ROLEPLAY_PREFS_DEFAULTS };
  const out: RoleplayPrefs = { ...ROLEPLAY_PREFS_DEFAULTS };
  if (typeof raw.author_framing === "boolean") out.author_framing = raw.author_framing;
  if (typeof raw.pacing === "string" && (PACING_VALUES as ReadonlyArray<string>).includes(raw.pacing)) {
    out.pacing = raw.pacing as Pacing;
  }
  if (typeof raw.style_anchor === "boolean") out.style_anchor = raw.style_anchor;
  return out;
}

export async function loadRoleplayPrefs(userId: string): Promise<RoleplayPrefs> {
  const { data, error } = await supabase
    .from("users")
    .select("preferences")
    .eq("id", userId)
    .single();
  if (error) throw error;
  const rawRp = (data?.preferences as Record<string, unknown> | null)?.rp;
  return mergeRoleplayDefaults(rawRp as Partial<RoleplayPrefs> | null);
}

export async function saveRoleplayPrefs(userId: string, prefs: RoleplayPrefs): Promise<void> {
  // Read-modify-write of users.preferences.rp. Same pattern as saveMemoryPrefs;
  // single-user single-device v0 — concurrent edits not protected.
  const { data: row, error: readErr } = await supabase
    .from("users")
    .select("preferences")
    .eq("id", userId)
    .single();
  if (readErr) throw readErr;
  const prefsObj = (row?.preferences as Record<string, unknown>) || {};
  const next = { ...prefsObj, rp: prefs };
  const { error: updateErr } = await supabase
    .from("users")
    .update({ preferences: next })
    .eq("id", userId);
  if (updateErr) throw updateErr;
}

// Source-of-truth strings — mirror backend constants verbatim. These are
// rendered in the Settings preview only; the actual injection happens
// server-side in prompt_assembly.py. If you edit one, edit the other.

export const AUTHOR_FRAMING_TEXT = `You are a skilled, imaginative author collaborating on an interactive story with the user. You give voice to {{char}} fully and without restraint, maintaining their established personality and voice across the narrative.

- Never speak, act, or describe thoughts for {{user}}.
- Stay in {{char}}'s established voice. If {{char}} would not say it, you do not write it.
- Do not narrate as a generic AI assistant. Avoid markdown formatting, bullet lists, summaries, idealized emotional affirmation, omniscient knowledge of things {{char}} has no way to know, or text that resembles a Wikipedia entry.
- Advance the story at a slow, natural tempo. Do not rush conflicts, resolutions, or intimacy.
- {{char}} is allowed to disagree, push back, refuse, be bored, or be unhappy with the user. Their default is not to please.`;

export const PACING_SLOW_BURN_TEXT = `{{char}}'s feelings for {{user}} develop gradually. Attraction, affection, and intimacy emerge only when these conditions are met:

- Trust: built through meaningful dialogue and actions over time.
- Shared experiences: {{char}} and {{user}} have faced something together — challenges, vulnerable conversations, time spent.
- Emotional depth: {{user}} has shown genuine vulnerability, and {{char}} has voluntarily let {{user}} see parts they don't show others.

{{char}} starts neutral, skeptical, or reserved — especially toward sudden physical or emotional advances. This default persists until the conditions above are met. Compliments and flattery do not substitute for any of the three.`;

export const PACING_WARM_TEXT = `{{char}}'s feelings for {{user}} develop gradually. Attraction, affection, and intimacy emerge only when these conditions are met:

- Trust: built through meaningful dialogue and actions over time.
- Shared experiences: {{char}} and {{user}} have faced something together — challenges, vulnerable conversations, time spent.
- Emotional depth: {{user}} has shown genuine vulnerability, and {{char}} has voluntarily let {{user}} see parts they don't show others.

{{char}} is warm but bounded by default. They are friendly toward {{user}} without being available for romance or intimacy until the conditions above are met. Compliments and flattery do not substitute for any of the three.`;

export const STYLE_ANCHOR_TEXT = `[System note: Write one reply only. Do not speak or act for {{user}}. Stay in {{char}}'s established voice and pace.]`;
