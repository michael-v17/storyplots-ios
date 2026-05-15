import { useEffect, useRef, useState } from "react";
import { Sparkles, Upload, Wand2, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "../../lib/Icon";
import {
  type Character,
  type CharacterDraft,
  type CharacterMode,
  type DialogueExample,
  type DialogueExampleKind,
  type EnglishStyle,
  DIALOGUE_EXAMPLE_KINDS,
  createCharacter,
  deleteCharacter,
  freshSeed,
  updateCharacter,
} from "../../lib/characters";
import { findOrCreateForCharacter } from "../../lib/conversations";
import { avatarUrl, uploadCharacterAvatar } from "../../lib/avatars";
import type { CharacterBookEntry } from "../import/parseCharacterCard";
import { loadPersona, type Persona } from "../../lib/persona";
import { useSession } from "../../lib/session";
import { supabase } from "../../lib/supabase";
import { listWritingStyles, type WritingStyle } from "../../lib/writingStyles";
import {
  ROLEPLAY_PREFS_DEFAULTS,
  loadRoleplayPrefs,
  type RoleplayPrefs,
  type RpOverrides,
} from "../../lib/rpPrefs";
import {
  NoTextEngineError,
  buildFakeV2CardFromDraft,
  refineCharacterCard,
  type RefinedDraft,
} from "../../lib/characterRefine";
import {
  NoImageEngineError,
  generateCharacterAvatar,
} from "../../lib/avatarGenerate";
import { ACCENT_PRESETS, AccentPicker } from "./AccentPicker";
import { StatusBanner } from "../../lib/StatusBanner";
import { Spinner } from "../../lib/Spinner";

export type RefineSource = "llm" | "heuristic";
export type RefineReason = "no_engine" | "llm_error" | "skipped" | "aborted";

export type ImportState = {
  draft: CharacterDraft;
  pendingCharacterBook: CharacterBookEntry[] | null;
  avatarBlob: Blob | null;
  rawCard: { file: File; format: "v1" | "v2" | "v3" } | null;
  refineSource?: RefineSource;
  refineReason?: RefineReason;
  refineDetail?: string;
};

const ENGLISH_STYLE_OPTS: { value: EnglishStyle; label: string }[] = [
  { value: "formal_american", label: "Formal American" },
  { value: "neutral_american", label: "Neutral American (default)" },
  { value: "casual_american", label: "Casual American" },
];

type Tab = "avatar" | "info" | "settings";

function emptyDraft(): CharacterDraft {
  return {
    name: "",
    tagline: null,
    system_prompt: "",
    mode: "roleplay",
    avatar_ref: null,
    reference_ref: null,
    appearance_description: null,
    append_appearance_to_image_prompts: true,
    accent_color: ACCENT_PRESETS[0],
    personality: null,
    goals: null,
    worldbuilding: null,
    default_writing_style_id: null,
    default_persona_id: null,
    character_memory_enabled: true,
    tags: null,
    scenario: null,
    english_style: "neutral_american",
    expertise_areas: null,
    communication_style_assistant: null,
    rules: null,
    pending_character_book: null,
    age: null,
    gender: null,
    build: null,
    height: null,
    hair_color: null,
    hair_style: null,
    eye_color: null,
    skin_tone: null,
    distinctive_features: null,
    signature_style: null,
    voice_style: null,
    greeting: null,
    image_seed: freshSeed(),
    tts_narrator_voice_id: null,
    tts_character_voice_id: null,
    group_size: 1,
    group_members_description: null,
    dialogue_examples: null,
    rp_overrides: null,
  };
}

function draftFrom(c: Character): CharacterDraft {
  const { id: _id, user_id: _u, is_example: _e, created_at: _c, updated_at: _up, ...rest } = c;
  return rest;
}

function tagsText(tags: string[] | null): string {
  return (tags ?? []).join(", ");
}

// Cycle 0130 — set or clear one key of the per-character RP override. Clearing
// the last key collapses rp_overrides back to null so the row reads as "inherit
// everything" — identical to a character that never set an override.
function patchRpOverride<K extends keyof RpOverrides>(
  current: RpOverrides | null,
  key: K,
  value: RpOverrides[K] | undefined,
): RpOverrides | null {
  const next: RpOverrides = { ...(current ?? {}) };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return Object.keys(next).length > 0 ? next : null;
}

function pacingLabel(p: RoleplayPrefs["pacing"]): string {
  return p === "off" ? "Off" : p === "warm" ? "Warm" : "Slow-burn";
}

function parseTags(text: string): string[] | null {
  const parts = text.split(",").map((t) => t.trim()).filter(Boolean);
  return parts.length === 0 ? null : parts;
}

export function CharacterForm({ character, importState }: { character?: Character; importState?: ImportState }) {
  const nav = useNavigate();
  const sess = useSession();
  const userId = sess.status === "ready" ? sess.session?.user.id ?? null : null;

  const editing = !!character;
  const [draft, setDraft] = useState<CharacterDraft>(() =>
    character ? draftFrom(character) : importState?.draft ?? emptyDraft(),
  );
  const [tab, setTab] = useState<Tab>("info");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userPersona, setUserPersona] = useState<Persona | null>(null);
  const [writingStyles, setWritingStyles] = useState<WritingStyle[]>([]);
  // Cycle 0130 — the user's global Roleplay defaults, shown as the "inherited"
  // value in each per-character override select.
  const [globalRp, setGlobalRp] = useState<RoleplayPrefs>(ROLEPLAY_PREFS_DEFAULTS);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  // Cycle 0093 — white-bg reference image (fal dual-gen). Loaded on
  // demand when the user clicks "View reference image".
  const [referenceUrl, setReferenceUrl] = useState<string | null>(null);
  const [referenceLightbox, setReferenceLightbox] = useState(false);
  // Cycle 0049 — click avatar thumbnail to inspect the full-size image.
  const [avatarLightbox, setAvatarLightbox] = useState(false);

  // Cycle 0134 — the state shapes are the module-level `EnrichUiState` /
  // `AvatarGenUiState` (defined alongside the components that consume them);
  // previously these were duplicated as local types here and reconciled via
  // structural typing. One source of truth keeps the contract obvious.
  const [enrichState, setEnrichState] = useState<EnrichUiState>({ kind: "idle" });
  const [avatarGenState, setAvatarGenState] = useState<AvatarGenUiState>({ kind: "idle" });
  const [hasImageEngine, setHasImageEngine] = useState(false);

  // Preserve the seed across uncheck→recheck of the seed-lock toggle so
  // toggling isn't destructive. Falls back to a fresh seed if the user
  // re-checks on a character whose seed was never set.
  const lastSeedRef = useRef<number>(draft.image_seed ?? freshSeed());

  useEffect(() => {
    if (!userId) return;
    loadPersona(userId).then(setUserPersona).catch(() => setUserPersona(null));
    listWritingStyles().then(setWritingStyles).catch(() => setWritingStyles([]));
    loadRoleplayPrefs(userId).then(setGlobalRp).catch(() => setGlobalRp(ROLEPLAY_PREFS_DEFAULTS));
    // Check for active image engine (gates the Generate Avatar button).
    supabase
      .from("provider_configs")
      .select("id")
      .eq("kind", "image")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setHasImageEngine(!!data))
      .then(() => undefined, () => setHasImageEngine(false));
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    setAvatarPreviewUrl(null);
    if (draft.avatar_ref) {
      avatarUrl(draft.avatar_ref).then((u) => { if (!cancelled) setAvatarPreviewUrl(u); }).catch(() => {});
      return () => { cancelled = true; };
    }
    // Imported cards without a saved avatar yet — show the embedded PNG directly
    // so the user can see what will be uploaded when they save.
    if (importState?.avatarBlob) {
      const url = URL.createObjectURL(importState.avatarBlob);
      setAvatarPreviewUrl(url);
      return () => { cancelled = true; URL.revokeObjectURL(url); };
    }
    return () => { cancelled = true; };
  }, [draft.avatar_ref, importState?.avatarBlob]);

  useEffect(() => {
    let cancelled = false;
    setReferenceUrl(null);
    if (!draft.reference_ref) return () => { cancelled = true; };
    avatarUrl(draft.reference_ref).then((u) => { if (!cancelled) setReferenceUrl(u); }).catch(() => {});
    return () => { cancelled = true; };
  }, [draft.reference_ref]);

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    // Editing an existing character uses its real id as the upload prefix so
    // the object naming survives rename/edit. During "create" we don't have
    // an id yet, so we tag the upload with a draft sentinel; the Character
    // insert below will capture the path into avatar_ref regardless.
    const cid = character?.id ?? `draft-${Date.now()}`;
    setUploadingAvatar(true);
    try {
      const path = await uploadCharacterAvatar(userId, cid, file, draft.avatar_ref);
      setDraft((d) => ({ ...d, avatar_ref: path }));
      if (character) {
        await updateCharacter(character.id, { avatar_ref: path });
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setUploadingAvatar(false);
    }
  }

  if (sess.status !== "ready") return <main><Spinner testId="char-form-loading" /></main>;
  if (!userId) {
    // shouldn't happen — route guards redirect unauthed away; defensive no-op.
    nav("/sign-in");
    return null;
  }

  function patch<K extends keyof CharacterDraft>(key: K, value: CharacterDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function applyRefined(refined: RefinedDraft) {
    const gender = (refined.gender ?? "") as string;
    const genderValid = gender === "male" || gender === "female" || gender === "non_binary" || gender === "unspecified";
    setDraft((d) => {
      const isGroup = (d.group_size ?? 1) > 1;
      return {
        ...d,
        name: refined.name || d.name,
        tagline: refined.tagline || d.tagline,
        system_prompt: refined.system_prompt || d.system_prompt,
        personality: refined.personality || d.personality,
        goals: refined.goals || d.goals,
        worldbuilding: refined.worldbuilding || d.worldbuilding,
        scenario: refined.scenario || d.scenario,
        greeting: refined.greeting || d.greeting,
        tags: refined.tags.length ? refined.tags : d.tags,
        // Cycle 0115 — accept refiner's Ali:Chat voice samples (3-5 entries
        // with ≥1 refusal). Replaces existing dialogue_examples if any.
        dialogue_examples: (refined.dialogue_examples && refined.dialogue_examples.length > 0)
          ? refined.dialogue_examples
          : d.dialogue_examples,
        // Group: populate group_members_description; single: populate physical attributes
        ...(isGroup ? {
          group_members_description: refined.group_members_description ?? d.group_members_description,
        } : {
          age: refined.age ?? d.age,
          gender: genderValid ? (gender as CharacterDraft["gender"]) : d.gender,
          build: refined.build ?? d.build,
          height: refined.height ?? d.height,
          hair_color: refined.hair_color ?? d.hair_color,
          hair_style: refined.hair_style ?? d.hair_style,
          eye_color: refined.eye_color ?? d.eye_color,
          skin_tone: refined.skin_tone ?? d.skin_tone,
          distinctive_features: refined.distinctive_features ?? d.distinctive_features,
          signature_style: refined.signature_style ?? d.signature_style,
          voice_style: refined.voice_style ?? d.voice_style,
        }),
      };
    });
  }

  async function onEnrichClick() {
    if (!draft.name.trim() || !draft.system_prompt.trim()) {
      setEnrichState({ kind: "error", message: "Add a name and a system prompt before enriching." });
      return;
    }
    const ok = window.confirm(
      "Enrich with AI will replace personality / goals / worldbuilding / scenario / first message / tagline with AI-expanded versions. Your current values will be overwritten. Continue?",
    );
    if (!ok) return;

    const abortCtrl = new AbortController();
    setEnrichState({ kind: "refining", abort: () => abortCtrl.abort() });
    try {
      const fakeCard = buildFakeV2CardFromDraft(draft);
      const refined = await refineCharacterCard(fakeCard, "v2", draft.group_size ?? 1, abortCtrl.signal);
      applyRefined(refined);
      setEnrichState({ kind: "success" });
    } catch (e) {
      if (abortCtrl.signal.aborted) {
        setEnrichState({ kind: "idle" });
        return;
      }
      if (e instanceof NoTextEngineError) {
        setEnrichState({ kind: "no_engine" });
        return;
      }
      setEnrichState({ kind: "error", message: (e as Error).message });
    }
  }

  async function onGenerateAvatarClick() {
    if (!character) return;
    const abortCtrl = new AbortController();
    setAvatarGenState({ kind: "generating", abort: () => abortCtrl.abort() });
    try {
      const result = await generateCharacterAvatar(character.id, abortCtrl.signal);
      patch("avatar_ref", result.avatar_ref);
      // fal.ai dual-gen also produces the white-bg reference image; reflect it
      // in the draft so "View reference image" enables without a page reload.
      if (result.reference_ref) patch("reference_ref", result.reference_ref);
      setAvatarGenState({ kind: "idle" });
    } catch (e) {
      if (abortCtrl.signal.aborted) {
        setAvatarGenState({ kind: "idle" });
        return;
      }
      if (e instanceof NoImageEngineError) {
        setAvatarGenState({ kind: "no_engine" });
        return;
      }
      setAvatarGenState({ kind: "error", message: (e as Error).message });
    }
  }

  function patchJson<T extends "personality" | "goals" | "worldbuilding">(
    key: T,
    field: string,
    value: string,
  ) {
    setDraft((d) => {
      const prev = (d[key] ?? {}) as Record<string, string>;
      const next = { ...prev, [field]: value };
      const nonEmpty = Object.fromEntries(Object.entries(next).filter(([, v]) => v));
      return { ...d, [key]: Object.keys(nonEmpty).length ? nonEmpty : null } as CharacterDraft;
    });
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.name.trim() || !draft.system_prompt.trim()) return;
    setSaving(true); setError(null);
    try {
      if (editing && character) {
        const { mode: _dropMode, ...updatable } = draft;
        await updateCharacter(character.id, updatable);
      } else {
        // Conflict resolution: if the user already has a Character with the
        // same name, suffix " (imported)" so the import doesn't silently
        // shadow their existing work (resolution committed in plan 0013).
        let finalName = draft.name;
        if (importState) {
          const { data: dupes } = await supabase
            .from("characters")
            .select("id")
            .eq("user_id", userId!)
            .eq("name", draft.name)
            .limit(1);
          if (dupes && dupes.length > 0) finalName = `${draft.name} (imported)`;
        }
        const created = await createCharacter(userId!, {
          ...draft,
          name: finalName,
          pending_character_book: importState?.pendingCharacterBook ?? null,
        });
        if (importState?.avatarBlob) {
          try {
            const file = new File(
              [importState.avatarBlob],
              `${created.id}-imported.png`,
              { type: "image/png" },
            );
            const path = await uploadCharacterAvatar(userId!, created.id, file, null);
            await updateCharacter(created.id, { avatar_ref: path });
          } catch {
            // Best-effort; the Character row is already saved.
          }
        }
        if (importState?.rawCard) {
          try {
            const isPng = importState.rawCard.file.name.toLowerCase().endsWith(".png");
            const ext = isPng ? "png" : (importState.rawCard.file.name.split(".").pop() ?? "json");
            const path = `${userId}/${created.id}/card.${ext}`;
            await supabase.storage
              .from("character-imports")
              .upload(path, importState.rawCard.file, { upsert: true });
          } catch {
            // Non-fatal: raw-card retention is audit-only.
          }
        }
        nav(`/character/${created.id}/edit`);
        return;
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!character) return;
    if (!window.confirm(`Delete "${character.name}"? This cannot be undone.`)) return;
    setSaving(true); setError(null);
    if (character.avatar_ref) {
      try {
        await supabase.storage.from("avatars").remove([character.avatar_ref]);
      } catch {
        // Best-effort; never block the DB delete on a storage hiccup.
      }
    }
    try {
      await deleteCharacter(character.id);
      nav("/characters");
    } catch (err) {
      setError(String(err)); setSaving(false);
    }
  }


  const promptLen = draft.system_prompt.length;
  const canSave = !saving && draft.name.trim() && draft.system_prompt.trim();

  // Cycle 0121 — soft validation. Non-blocking warnings surfaced just above
  // the Save button. The user can still Save (these are hints, not gates)
  // but the warnings catch the doc §3.4 anti-patterns at authoring time.
  const validationWarnings: string[] = [];
  {
    const exs = draft.dialogue_examples ?? [];
    const hasRefusal = exs.some((e) => e.kind === "refusal");
    if (exs.length === 0) {
      validationWarnings.push(
        "No voice samples yet. Without dialogue examples, the model imitates from the description alone — usually less in-voice. Add 3–5 short exchanges including at least one refusal.",
      );
    } else if (!hasRefusal) {
      validationWarnings.push(
        "Voice samples have no \"refusal\" example. Without one, the model defaults to compliance regardless of the trait list.",
      );
    }
    const greeting = (draft.greeting ?? "").trim();
    if (greeting) {
      // Greeting has dialogue? Look for "..." or '...' patterns.
      const hasDialogue = /["'][^"']{3,}["']/.test(greeting);
      if (!hasDialogue) {
        validationWarnings.push(
          "Greeting has no dialogue (no quoted speech). The first message sets voice — consider adding at least one line the character says.",
        );
      }
      // Greeting narrates user? Match second-person action/perception verbs.
      if (/\byou (walk|feel|look|take|sit|stand|breathe|notice|see|hear|think|smell|sense|enter|step|move|nod|smile|frown|tense|relax)\b/i.test(greeting)) {
        validationWarnings.push(
          "Greeting may narrate the user's actions or feelings (e.g. 'you walk in nervous'). The model should never speak for the user — establish only the character's stance.",
        );
      }
    }
  }

  async function handleClose() {
    if (editing && character && userId) {
      try {
        const conv = await findOrCreateForCharacter(userId, character);
        nav(`/chat/${character.id}/${conv.id}`);
        return;
      } catch {
        // fall through to characters list if conv resolution fails
      }
    }
    nav("/characters");
  }

  return (
    <main data-testid={editing ? "character-edit" : "character-create"} style={{ maxWidth: 720, margin: "1.5rem auto", padding: "0 1rem" }}>
      <header className="sp-main-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 className="sp-h2 sp-wordmark" style={{ margin: 0 }}>{editing ? "Edit Character" : "New Character · Manual"}</h1>
        <button
          type="button"
          data-testid="character-form-close"
          onClick={handleClose}
          aria-label={editing ? "Close and return to chat" : "Close"}
          title={editing ? "Close" : "Close"}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--sp-fg-2)",
            width: 36,
            height: 36,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            cursor: "pointer",
          }}
        >
          <Icon icon={X} size={20} />
        </button>
      </header>

      <ImportFallbackBanner importState={importState} />

      {/* Cycle 0134: toolbar band — tabs anchor to the same left edge as the
          title, and the global "Enrich with AI" action pins right on the same
          baseline. flexWrap so on narrow viewports Enrich drops below the tabs
          rather than overflowing. The borderBottom delimits the toolbar from
          the form content underneath. */}
      <div style={toolbarRowStyle}>
        <nav role="tablist" style={tabsContainerStyle}>
          {(["avatar", "info", "settings"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              data-testid={`tab-${t}`}
              onClick={() => setTab(t)}
              style={tabButtonStyle(tab === t)}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </nav>
        <EnrichControls state={enrichState} onEnrich={onEnrichClick} />
      </div>

      <EnrichStatusBanners
        state={enrichState}
        onDismiss={() => setEnrichState({ kind: "idle" })}
      />

      <form onSubmit={onSave} data-form="stack" style={{ display: "grid", gap: "0.75rem" }}>
        {tab === "avatar" && (
          <section style={{ display: "grid", gap: "1rem" }}>
            {/* Cycle 0134: side-by-side block — avatar hero on the left, its
                three actions stacked at uniform width to the right, caption +
                status banners below the block. Replaces the centered column
                that had Generate Avatar zig-zagging left while everything
                else was centered. flexWrap so on a narrow viewport the
                actions column drops below the avatar (preserves usability). */}
            <div style={avatarBlockStyle}>
              <button
                type="button"
                data-testid="avatar-preview-open"
                aria-label={avatarPreviewUrl ? "Open full-size avatar" : "Avatar placeholder"}
                onClick={() => { if (avatarPreviewUrl) setAvatarLightbox(true); }}
                disabled={!avatarPreviewUrl}
                style={{
                  width: 120, height: 120, borderRadius: "50%", flexShrink: 0,
                  backgroundColor: avatarPreviewUrl ? "var(--sp-bg-3)" : draft.accent_color,
                  backgroundImage: avatarPreviewUrl ? `url(${avatarPreviewUrl})` : undefined,
                  backgroundSize: avatarPreviewUrl ? "cover" : undefined,
                  backgroundPosition: avatarPreviewUrl ? "center" : undefined,
                  opacity: avatarPreviewUrl ? 1 : 0.55,
                  padding: 0, border: "none",
                  boxShadow: `0 0 0 3px var(--sp-bg), 0 0 0 5px ${draft.accent_color}`,
                  cursor: avatarPreviewUrl ? "zoom-in" : "default",
                }}
                title={avatarPreviewUrl ? "Click to view full size" : undefined}
              />
              <div style={avatarActionsStyle}>
                <label
                  data-testid="avatar-upload-trigger"
                  style={{
                    ...avatarActionPillStyle,
                    gap: "0.4rem", marginTop: 0,
                    cursor: uploadingAvatar ? "not-allowed" : "pointer",
                    opacity: uploadingAvatar ? 0.5 : 1,
                  }}
                >
                  <Icon icon={Upload} size={16} />
                  {uploadingAvatar ? "Uploading…" : "Upload image"}
                  <input
                    type="file"
                    data-testid="avatar-upload"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={onPickAvatar}
                    disabled={uploadingAvatar}
                    style={{ display: "none" }}
                  />
                </label>
                <AvatarGenerateControls
                  visible={editing && hasImageEngine}
                  state={avatarGenState}
                  onGenerate={onGenerateAvatarClick}
                />
                {/* Cycle 0093 — fal.ai dual-gen exposes a white-bg reference
                    image used as image_urls[0] in chat scene generation. The
                    button stays visible for all characters so the feature is
                    discoverable; legacy chars without a reference_ref render
                    disabled with the explanatory title. */}
                <button
                  type="button"
                  data-testid="reference-view"
                  onClick={() => { if (referenceUrl) setReferenceLightbox(true); }}
                  disabled={!draft.reference_ref || !referenceUrl}
                  style={avatarActionPillStyle}
                  title={
                    draft.reference_ref
                      ? "See the white-bg reference image used to anchor chat scenes"
                      : "No reference image yet — generate an avatar with the fal.ai engine to enable scene anchoring."
                  }
                >
                  View reference image
                </button>
                {/* Caption lives inside the actions column so its width
                    matches the buttons above (creator feedback: it used to
                    span the full block width and read as a separate paragraph
                    instead of a button-group footnote). */}
                {editing && hasImageEngine && (
                  <small style={{ color: "var(--sp-fg-3)", lineHeight: 1.45 }}>
                    Generate Avatar uses the active image engine and reuses the character's locked seed for consistency.
                  </small>
                )}
              </div>
            </div>

            <AvatarGenerateStatus
              visible={editing && hasImageEngine}
              state={avatarGenState}
              onDismiss={() => setAvatarGenState({ kind: "idle" })}
            />

            {/* Group size — 1 = single NPC (default, existing path). > 1 = group. */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <span style={{ fontSize: "0.82em", color: "var(--sp-fg-3)", fontWeight: 500 }}>
                Number of characters
                <small style={{ fontWeight: 400, marginLeft: "0.4rem" }}>
                  — use &gt;1 for group characters
                </small>
              </span>
              <div style={{ display: "flex", gap: "0.25rem" }}>
                {([1, 2, 3, 4] as const).map((n) => {
                  const active = draft.group_size === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      data-testid={`group-size-${n}`}
                      onClick={() => patch("group_size", n)}
                      style={{
                        padding: "3px 12px",
                        borderRadius: "var(--sp-radius)",
                        border: active ? "none" : "1px solid var(--sp-border)",
                        background: active ? "var(--sp-brand-1)" : "transparent",
                        color: active ? "var(--sp-fg-on-brand)" : "var(--sp-fg-2)",
                        fontSize: "0.85em",
                        fontWeight: active ? 600 : 400,
                        cursor: "pointer",
                      }}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>

            {draft.group_size === 1 ? (
            <fieldset style={{ display: "grid", gap: "0.5rem" }}>
              <legend>Physical attributes</legend>
              <p style={{ margin: 0, color: "var(--sp-fg-3)", fontSize: "0.85em" }}>
                Canonical identity — stays stable across the whole character.
                Dynamic state (current outfit, pose, location) comes from
                the conversation instead and overrides signature style when
                the scene mentions different attire.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <label style={attrLabel}>
                  <span>Age</span>
                  <input
                    data-testid="attr-age"
                    placeholder="40 / mid-30s / elderly / mature / young adult"
                    value={draft.age ?? ""}
                    onChange={(e) => patch("age", e.target.value || null)}
                  />
                </label>
                <label style={attrLabel}>
                  <span>Gender</span>
                  <select
                    data-testid="attr-gender"
                    value={draft.gender ?? ""}
                    onChange={(e) => patch("gender", (e.target.value as "" | "male" | "female" | "non_binary" | "unspecified") || null)}
                  >
                    <option value="">—</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="non_binary">Non-binary</option>
                    <option value="unspecified">Unspecified</option>
                  </select>
                </label>

                <label style={attrLabel}>
                  <span>Hair color</span>
                  <input
                    data-testid="attr-hair-color"
                    value={draft.hair_color ?? ""}
                    onChange={(e) => patch("hair_color", e.target.value || null)}
                  />
                </label>
                <label style={attrLabel}>
                  <span>Hair style</span>
                  <input
                    data-testid="attr-hair-style"
                    placeholder="short / long braid / buzz cut"
                    value={draft.hair_style ?? ""}
                    onChange={(e) => patch("hair_style", e.target.value || null)}
                  />
                </label>

                <label style={attrLabel}>
                  <span>Eye color</span>
                  <input
                    data-testid="attr-eye-color"
                    value={draft.eye_color ?? ""}
                    onChange={(e) => patch("eye_color", e.target.value || null)}
                  />
                </label>
                <label style={attrLabel}>
                  <span>Skin tone</span>
                  <input
                    data-testid="attr-skin-tone"
                    value={draft.skin_tone ?? ""}
                    onChange={(e) => patch("skin_tone", e.target.value || null)}
                  />
                </label>

                <label style={attrLabel}>
                  <span>Build</span>
                  <input
                    data-testid="attr-build"
                    placeholder="athletic / petite / plus-size"
                    value={draft.build ?? ""}
                    onChange={(e) => patch("build", e.target.value || null)}
                  />
                </label>
                <label style={attrLabel}>
                  <span>Height</span>
                  <input
                    data-testid="attr-height"
                    placeholder="5'7&quot; / tall / short"
                    value={draft.height ?? ""}
                    onChange={(e) => patch("height", e.target.value || null)}
                  />
                </label>
              </div>

              <label style={attrLabel}>
                <span>Signature style</span>
                <textarea
                  data-testid="attr-signature-style"
                  rows={2}
                  placeholder="Default attire — overridden by whatever the scene describes"
                  value={draft.signature_style ?? ""}
                  onChange={(e) => patch("signature_style", e.target.value || null)}
                />
              </label>

              <label style={attrLabel}>
                <span>Distinctive features</span>
                <textarea
                  data-testid="attr-distinctive-features"
                  rows={2}
                  placeholder="Scars, tattoos, glasses, permanent marks"
                  value={draft.distinctive_features ?? ""}
                  onChange={(e) => patch("distinctive_features", e.target.value || null)}
                />
              </label>

              <label style={attrLabel}>
                <span>Voice style (for TTS)</span>
                <input
                  data-testid="attr-voice-style"
                  placeholder="warm / gravelly / formal / breathy"
                  value={draft.voice_style ?? ""}
                  onChange={(e) => patch("voice_style", e.target.value || null)}
                />
              </label>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <input
                    type="checkbox"
                    data-testid="attr-seed-lock"
                    checked={draft.image_seed != null}
                    onChange={(e) => {
                      if (e.target.checked) {
                        patch("image_seed", lastSeedRef.current);
                      } else {
                        if (draft.image_seed != null) lastSeedRef.current = draft.image_seed;
                        patch("image_seed", null);
                      }
                    }}
                  />
                  <span>Lock seed for visual consistency</span>
                </label>
                {draft.image_seed != null && (
                  <span style={{ color: "var(--sp-fg-3)", fontFamily: "monospace", fontSize: "0.85rem" }}>
                    seed: <span data-testid="attr-seed-value">{draft.image_seed}</span>
                    {" "}
                    <button
                      type="button"
                      data-testid="attr-seed-roll"
                      onClick={() => {
                        const next = freshSeed();
                        lastSeedRef.current = next;
                        patch("image_seed", next);
                      }}
                    >
                      roll new
                    </button>
                  </span>
                )}
              </div>
            </fieldset>
            ) : (
            /* Group mode — replace individual physical fields with one structured textarea */
            <fieldset style={{ display: "grid", gap: "0.5rem" }}>
              <legend>Group members</legend>
              <p style={{ margin: 0, color: "var(--sp-fg-3)", fontSize: "0.85em" }}>
                One line per member: <code>Name | gender | age | appearance details</code>
              </p>
              <textarea
                data-testid="group-members-description"
                rows={(draft.group_size ?? 2) * 2 + 1}
                placeholder={
                  "1. Alex | male | 28 | short brown hair, athletic build, tan skin, beard\n" +
                  "2. Mia | female | 25 | long black hair, slender, olive skin, freckles"
                }
                value={draft.group_members_description ?? ""}
                onChange={(e) => patch("group_members_description", e.target.value || null)}
              />
            </fieldset>
            )}

            <fieldset>
              <legend>Accent color</legend>
              <AccentPicker
                value={draft.accent_color}
                onChange={(hex) => patch("accent_color", hex)}
              />
            </fieldset>
          </section>
        )}

        {tab === "info" && (
          <section style={{ display: "grid", gap: "0.75rem" }}>
            <label>
              Name
              <input
                data-testid="name"
                required
                value={draft.name}
                onChange={(e) => patch("name", e.target.value)}
              />
            </label>

            <label>
              Tagline
              <input
                data-testid="tagline"
                value={draft.tagline ?? ""}
                onChange={(e) => patch("tagline", e.target.value || null)}
              />
            </label>

            <label>
              System prompt
              <textarea
                data-testid="system_prompt"
                rows={5}
                required
                value={draft.system_prompt}
                onChange={(e) => patch("system_prompt", e.target.value)}
              />
              <small style={{ color: promptLen > 2000 ? "var(--sp-destructive)" : "var(--sp-fg-3)" }}>
                {promptLen} / 2000 {promptLen > 2000 && "(soft limit)"}
              </small>
            </label>

            <label>
              English style
              <select
                data-testid="english_style"
                value={draft.english_style}
                onChange={(e) => patch("english_style", e.target.value as EnglishStyle)}
              >
                {ENGLISH_STYLE_OPTS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <small style={{ color: "var(--sp-fg-3)" }}>Affects how the NPC speaks. Never affects grammar correction.</small>
            </label>

            <label>
              Scenario <small style={{ color: "var(--sp-fg-3)" }}>(scene intro shown at the top of chat)</small>
              <textarea
                data-testid="scenario"
                rows={3}
                placeholder="Describe the opening scene — this appears as a styled card before the first message."
                value={draft.scenario ?? ""}
                onChange={(e) => patch("scenario", e.target.value || null)}
              />
            </label>

            <label>
              First Message <small style={{ color: "var(--sp-fg-3)" }}>(what the character says or does when the chat opens — a greeting, a line, a narration. Leave empty to open straight into the scenario.)</small>
              <textarea
                data-testid="greeting"
                rows={3}
                placeholder="The character's opening message. Optional. Use {{user}} and {{char}} to substitute the User Persona and Character names."
                value={draft.greeting ?? ""}
                onChange={(e) => patch("greeting", e.target.value || null)}
              />
            </label>

            <label>
              Tags (comma-separated)
              <input
                data-testid="tags"
                value={tagsText(draft.tags)}
                onChange={(e) => patch("tags", parseTags(e.target.value))}
              />
            </label>

            {draft.mode === "assistant" && (
              <fieldset>
                <legend>Assistant</legend>
                <label>Expertise areas
                  <textarea data-testid="expertise_areas" rows={2}
                    value={draft.expertise_areas ?? ""}
                    onChange={(e) => patch("expertise_areas", e.target.value || null)} />
                </label>
                <label>Communication style
                  <textarea data-testid="communication_style_assistant" rows={2}
                    value={draft.communication_style_assistant ?? ""}
                    onChange={(e) => patch("communication_style_assistant", e.target.value || null)} />
                </label>
                <label>Rules
                  <textarea data-testid="rules" rows={2}
                    value={draft.rules ?? ""}
                    onChange={(e) => patch("rules", e.target.value || null)} />
                </label>
              </fieldset>
            )}

            <DeepDive title="Personality" keyName="personality" data={draft.personality}
              fields={["core_traits", "fears_insecurities", "communication_style", "quirks_habits"]}
              onPatch={patchJson} />
            <DeepDive title="Goals & Motivations" keyName="goals" data={draft.goals}
              fields={["primary_goal", "secret_desire", "fears_to_overcome", "would_sacrifice"]}
              onPatch={patchJson} />
            <DeepDive title="Worldbuilding" keyName="worldbuilding" data={draft.worldbuilding}
              fields={["origin_birthplace", "backstory", "world_setting", "special_abilities"]}
              onPatch={patchJson} />

            <VoiceSamples
              value={draft.dialogue_examples ?? []}
              onChange={(next) => patch("dialogue_examples", next.length ? next : null)}
              charName={draft.name || "the character"}
            />
          </section>
        )}

        {tab === "settings" && (
          <section style={{ display: "grid", gap: "0.75rem" }}>
            <fieldset>
              <legend>Character mode</legend>
              {editing ? (
                <p data-testid="mode-readonly">
                  <strong>{draft.mode}</strong> · Mode is set at creation and cannot be changed.
                </p>
              ) : (
                (["roleplay", "assistant"] as CharacterMode[]).map((m) => (
                  <label key={m} style={{ marginRight: "1rem" }}>
                    <input
                      type="radio"
                      name="mode"
                      data-testid={`mode-${m}`}
                      checked={draft.mode === m}
                      onChange={() => patch("mode", m)}
                    />
                    {m}
                  </label>
                ))
              )}
            </fieldset>

            <label>
              Default writing style
              <select
                data-testid="writing_style"
                value={draft.default_writing_style_id ?? ""}
                onChange={(e) => patch("default_writing_style_id", e.target.value || null)}
              >
                <option value="">None · Use Roleplay default</option>
                {writingStyles.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.is_built_in ? `${s.name} (built-in)` : s.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Default persona
              <select
                data-testid="default_persona"
                value={draft.default_persona_id ?? ""}
                onChange={(e) => patch("default_persona_id", e.target.value || null)}
              >
                <option value="">None · Use app default</option>
                {userPersona && <option value={userPersona.id}>{userPersona.name}</option>}
              </select>
            </label>

            <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <input
                type="checkbox"
                data-testid="character_memory_enabled"
                checked={draft.character_memory_enabled}
                onChange={(e) => patch("character_memory_enabled", e.target.checked)}
              />
              Character memory enabled
            </label>

            <fieldset style={{ display: "grid", gap: "0.5rem" }} data-testid="rp-overrides">
              <legend>Roleplay scaffolding</legend>
              <small style={{ color: "var(--sp-fg-3)" }}>
                Override the global Roleplay defaults for this character. Leave a
                field on <em>Inherit</em> to follow Settings → Roleplay.
              </small>

              <label style={attrLabel}>
                <span>Author framing</span>
                <select
                  data-testid="rp-override-author-framing"
                  value={
                    draft.rp_overrides?.author_framing === undefined
                      ? ""
                      : draft.rp_overrides.author_framing ? "on" : "off"
                  }
                  onChange={(e) =>
                    patch("rp_overrides", patchRpOverride(
                      draft.rp_overrides, "author_framing",
                      e.target.value === "" ? undefined : e.target.value === "on",
                    ))
                  }
                >
                  <option value="">Inherit ({globalRp.author_framing ? "On" : "Off"})</option>
                  <option value="on">On</option>
                  <option value="off">Off</option>
                </select>
              </label>

              <label style={attrLabel}>
                <span>Relationship pacing</span>
                <select
                  data-testid="rp-override-pacing"
                  value={draft.rp_overrides?.pacing ?? ""}
                  onChange={(e) =>
                    patch("rp_overrides", patchRpOverride(
                      draft.rp_overrides, "pacing",
                      e.target.value === "" ? undefined : (e.target.value as RpOverrides["pacing"]),
                    ))
                  }
                >
                  <option value="">Inherit ({pacingLabel(globalRp.pacing)})</option>
                  <option value="off">Off</option>
                  <option value="slow_burn">Slow-burn</option>
                  <option value="warm">Warm</option>
                </select>
              </label>

              <label style={attrLabel}>
                <span>Style anchor</span>
                <select
                  data-testid="rp-override-style-anchor"
                  value={
                    draft.rp_overrides?.style_anchor === undefined
                      ? ""
                      : draft.rp_overrides.style_anchor ? "on" : "off"
                  }
                  onChange={(e) =>
                    patch("rp_overrides", patchRpOverride(
                      draft.rp_overrides, "style_anchor",
                      e.target.value === "" ? undefined : e.target.value === "on",
                    ))
                  }
                >
                  <option value="">Inherit ({globalRp.style_anchor ? "On" : "Off"})</option>
                  <option value="on">On</option>
                  <option value="off">Off</option>
                </select>
              </label>
            </fieldset>

            <fieldset style={{ display: "grid", gap: "0.5rem" }}>
              <legend>TTS voice override</legend>
              <small style={{ color: "var(--sp-fg-3)" }}>
                Pin specific voices for this character. Leave blank to use
                the global gender-matched defaults from TTS settings.
              </small>
              <label style={attrLabel}>
                <span>Narrator voice ID</span>
                <input
                  data-testid="tts-narrator-override"
                  placeholder="Leave blank for global default"
                  value={draft.tts_narrator_voice_id ?? ""}
                  onChange={(e) => patch("tts_narrator_voice_id", e.target.value || null)}
                />
              </label>
              <label style={attrLabel}>
                <span>Character voice ID</span>
                <input
                  data-testid="tts-character-override"
                  placeholder="Leave blank for global default"
                  value={draft.tts_character_voice_id ?? ""}
                  onChange={(e) => patch("tts_character_voice_id", e.target.value || null)}
                />
              </label>
            </fieldset>
          </section>
        )}

        {error && <p role="alert" style={{ color: "var(--sp-destructive)" }}>{error}</p>}

        {validationWarnings.length > 0 && (
          <div data-testid="validation-warnings" style={{
            background: "var(--sp-warning-soft)",
            border: "1px solid var(--sp-warning)",
            borderRadius: "var(--sp-radius)",
            padding: "0.75rem 1rem",
            marginTop: "1rem",
            color: "var(--sp-fg-2)",
            fontSize: "0.85em",
          }}>
            <strong style={{ color: "var(--sp-fg)" }}>Soft check — you can save anyway</strong>
            <ul style={{ margin: "0.4rem 0 0", paddingLeft: "1.2rem" }}>
              {validationWarnings.map((w, i) => (
                <li key={i} style={{ marginBottom: "0.3rem" }}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginTop: "1.25rem", flexWrap: "wrap" }}>
          <button type="submit" data-testid="save" disabled={!canSave} style={primaryPillStyle(!canSave)}>
            {saving ? "Saving…" : editing ? "Save" : "Create"}
          </button>
          {editing && (
            <button type="button" data-testid="delete" disabled={saving} onClick={onDelete} style={destructivePillStyle}>
              Delete
            </button>
          )}
          <Link to="/characters" style={{ fontSize: "0.9em" }}>Cancel</Link>
        </div>
        {editing && <small style={{ color: "var(--sp-fg-3)", marginTop: "0.5rem", display: "block" }}>Edits apply to new Conversations only.</small>}
      </form>

      {/* Cycle 0049 — full-size avatar lightbox. Click outside or the X
          to close; Esc closes too. Separate from the chat ImageViewer
          because characters.avatar_ref isn't a generated_images row
          (no regenerate / delete / favorite semantics here). */}
      {avatarLightbox && avatarPreviewUrl && (
        <AvatarLightbox src={avatarPreviewUrl} onClose={() => setAvatarLightbox(false)} />
      )}
      {referenceLightbox && referenceUrl && (
        <AvatarLightbox src={referenceUrl} onClose={() => setReferenceLightbox(false)} />
      )}
    </main>
  );
}

function AvatarLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Avatar preview"
      data-testid="avatar-lightbox"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        // Opaque `--sp-bg` (#0D0A15) — matches ImageViewer 0075 post-ship fix.
        // Earlier rgba(0,0,0,0.92) let underlying form chrome bleed at ~8%.
        background: "var(--sp-bg)",
        display: "flex", flexDirection: "column", color: "var(--sp-fg)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "0.75rem 1rem" }}>
        <button
          type="button"
          data-testid="avatar-lightbox-close"
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          aria-label="Close preview"
          style={{
            // Square 40×40 circular chip with Lucide X centered — consistent
            // with the ImageViewer close (cycle 0075). The previous
            // 0.35rem×0.65rem padding made the button visibly wider than tall
            // and the `×` glyph wasn't centered on the chip baseline.
            width: 40, height: 40, borderRadius: "50%",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            background: "var(--sp-bg-2)", color: "var(--sp-fg)",
            border: "1px solid var(--sp-border)",
            padding: 0, cursor: "pointer", fontFamily: "inherit",
          }}
        >
          <Icon icon={X} size={18} />
        </button>
      </div>
      <div
        style={{
          flex: 1, minHeight: 0, overflow: "hidden",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "0 1rem 1rem",
        }}
      >
        <img
          src={src}
          alt="Character avatar full size"
          onClick={(e) => e.stopPropagation()}
          decoding="async"
          style={{
            maxWidth: "100%", maxHeight: "100%",
            objectFit: "contain", borderRadius: "var(--sp-radius)",
          }}
        />
      </div>
    </div>
  );
}

function DeepDive({
  title, keyName, data, fields, onPatch,
}: {
  title: string;
  keyName: "personality" | "goals" | "worldbuilding";
  data: Record<string, string | undefined> | null;
  fields: string[];
  onPatch: (k: "personality" | "goals" | "worldbuilding", f: string, v: string) => void;
}) {
  return (
    <details>
      <summary>{title}</summary>
      <div style={{ display: "grid", gap: "0.5rem", marginTop: "0.5rem" }}>
        {fields.map((f) => (
          <label key={f}>
            {f.replace(/_/g, " ")}
            <textarea
              data-testid={`${keyName}_${f}`}
              rows={2}
              value={data?.[f] ?? ""}
              onChange={(e) => onPatch(keyName, f, e.target.value)}
            />
          </label>
        ))}
      </div>
    </details>
  );
}

const attrLabel: React.CSSProperties = { display: "grid", gap: "0.15rem" };

function ImportFallbackBanner({ importState }: { importState?: ImportState }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || !importState || importState.refineSource !== "heuristic") return null;
  const reason = importState.refineReason;
  if (reason === "skipped" || reason === "aborted") return null;

  const isNoEngine = reason === "no_engine";
  const testId = isNoEngine ? "import-banner-no-engine" : "import-banner-llm-error";
  const message = isNoEngine
    ? "Import used the heuristic parser. Configure a text engine in Settings → Text Engine to enable AI refinement on future imports."
    : `AI refinement failed; fields were filled with a heuristic parser. Edit any field as needed.${importState.refineDetail ? ` (${importState.refineDetail})` : ""}`;

  return (
    <div style={{ marginTop: "0.75rem" }}>
      <StatusBanner tone="warning" testid={testId} dismissTestid="import-banner-dismiss" onDismiss={() => setDismissed(true)}>
        {message}
      </StatusBanner>
    </div>
  );
}

type EnrichUiState =
  | { kind: "idle" }
  | { kind: "refining"; abort: () => void }
  | { kind: "success" }
  | { kind: "no_engine" }
  | { kind: "error"; message: string };

// Cycle 0134: the button lives in the toolbar row (tabs left, Enrich right).
// Banners moved to `EnrichStatusBanners` so they can render in the form's
// dedicated status area below the toolbar instead of floating with the button.
function EnrichControls({
  state,
  onEnrich,
}: {
  state: EnrichUiState;
  onEnrich: () => void;
}) {
  const refining = state.kind === "refining";
  return (
    <div style={{ display: "inline-flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
      <button
        type="button"
        data-testid="enrich-ai"
        onClick={onEnrich}
        disabled={refining}
        style={{
          ...primaryPillStyle(refining),
          // Match the segmented tabs' inner pill dimensions so the two
          // toolbar siblings sit on the same visual baseline (cycle 0134
          // creator feedback: Enrich was visibly chunkier than the tabs).
          padding: "0.5rem 1rem", fontSize: 13,
          display: "inline-flex", alignItems: "center", gap: "0.4rem",
        }}
      >
        <Icon icon={Sparkles} size={16} />
        {refining ? "Refining…" : "Enrich with AI"}
      </button>
      {refining && (
        <button
          type="button"
          data-testid="enrich-cancel"
          onClick={state.abort}
          style={ghostPillStyle}
        >
          Cancel
        </button>
      )}
    </div>
  );
}

function EnrichStatusBanners({
  state,
  onDismiss,
}: {
  state: EnrichUiState;
  onDismiss: () => void;
}) {
  if (state.kind === "idle" || state.kind === "refining") return null;
  return (
    <>
      {state.kind === "success" && (
        <StatusBanner tone="success" testid="enrich-success" onDismiss={onDismiss}>
          Character enriched — review and save.
        </StatusBanner>
      )}
      {state.kind === "no_engine" && (
        <StatusBanner tone="warning" testid="enrich-no-engine" onDismiss={onDismiss}>
          Configure a text engine in Settings → Text Engine to enable AI enrichment.
        </StatusBanner>
      )}
      {state.kind === "error" && (
        <StatusBanner tone="error" testid="enrich-error" onDismiss={onDismiss} role="alert">
          Enrichment failed: {state.message}
        </StatusBanner>
      )}
    </>
  );
}

type AvatarGenUiState =
  | { kind: "idle" }
  | { kind: "generating"; abort: () => void }
  | { kind: "no_engine" }
  | { kind: "error"; message: string };

// Cycle 0134: the button (+ Cancel) lives in the avatar block's actions column.
// The "uses the active image engine…" caption and the banners moved to
// `AvatarGenerateStatus` so they render below the block instead of beside a
// button (the old layout left "Generate Avatar" alone on the left with the
// caption trailing off to the right — the zig-zag the creator flagged).
function AvatarGenerateControls({
  visible,
  state,
  onGenerate,
}: {
  visible: boolean;
  state: AvatarGenUiState;
  onGenerate: () => void;
}) {
  if (!visible) return null;
  const generating = state.kind === "generating";
  return (
    <>
      <button
        type="button"
        data-testid="avatar-generate"
        onClick={onGenerate}
        disabled={generating}
        style={{ ...avatarActionPillStyle, gap: "0.4rem" }}
      >
        <Icon icon={Wand2} size={16} />
        {generating ? "Generating…" : "Generate Avatar"}
      </button>
      {generating && (
        <button
          type="button"
          data-testid="avatar-generate-cancel"
          onClick={state.abort}
          style={{ ...ghostPillStyle, width: "100%" }}
        >
          Cancel
        </button>
      )}
    </>
  );
}

// Banners for the Generate Avatar flow. The descriptive caption now lives
// inside the avatar actions column so its width matches the buttons; this
// component is just the conditional status banners.
function AvatarGenerateStatus({
  visible,
  state,
  onDismiss,
}: {
  visible: boolean;
  state: AvatarGenUiState;
  onDismiss: () => void;
}) {
  if (!visible) return null;
  if (state.kind !== "no_engine" && state.kind !== "error") return null;
  return (
    <>
      {state.kind === "no_engine" && (
        <StatusBanner tone="warning" testid="avatar-generate-no-engine">
          Configure an image engine in Settings → Image Engine first.
        </StatusBanner>
      )}
      {state.kind === "error" && (
        <StatusBanner tone="error" testid="avatar-generate-error" onDismiss={onDismiss} role="alert">
          Generation failed: {state.message}
        </StatusBanner>
      )}
    </>
  );
}

const toolbarRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "0.75rem",
  flexWrap: "wrap",
  padding: "0 0 0.85rem",
  marginBottom: "1rem",
  borderBottom: "1px solid var(--sp-border-soft)",
};

// Cycle 0134: side-by-side avatar block — hero circle pinned left, uniform
// actions column on the right. `minWidth: 0` on the actions column keeps it
// shrinkable; `flexWrap` lets it drop below the avatar on narrow viewports.
const avatarBlockStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "1.25rem",
  flexWrap: "wrap",
  marginTop: "0.5rem",
};
const avatarActionsStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.6rem",
  flex: 1,
  minWidth: 0,
  // Cap the column so the buttons don't stretch across the full 720px modal
  // — they sit narrow next to the avatar with empty space to their right.
  maxWidth: 320,
};

const tabsContainerStyle: React.CSSProperties = {
  display: "inline-flex",
  gap: 4,
  background: "var(--sp-bg-2)",
  border: "1px solid var(--sp-border)",
  borderRadius: "var(--sp-radius)",
  padding: 4,
};

function tabButtonStyle(active: boolean): React.CSSProperties {
  return {
    padding: "0.5rem 1rem",
    border: "none",
    borderRadius: "var(--sp-radius)",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: active ? 600 : 500,
    background: active ? "var(--sp-brand-1)" : "transparent",
    color: active ? "var(--sp-fg-on-brand)" : "var(--sp-fg-2)",
    transition: "background 160ms var(--sp-ease), color 160ms var(--sp-ease)",
    fontFamily: "inherit",
  };
}

function primaryPillStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "0.6rem 1.25rem",
    border: "none",
    borderRadius: "var(--sp-radius)",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 600,
    fontSize: 14,
    fontFamily: "inherit",
    background: disabled ? "var(--sp-bg-3)" : "var(--sp-brand-grad)",
    color: disabled ? "var(--sp-fg-4)" : "var(--sp-fg-on-brand)",
    transition: "background 160ms var(--sp-ease), color 160ms var(--sp-ease)",
  };
}

const basePillStyle: React.CSSProperties = {
  padding: "0.45rem 0.95rem",
  borderRadius: "var(--sp-radius)",
  background: "transparent",
  cursor: "pointer",
  fontSize: 13,
  fontFamily: "inherit",
  transition: "border-color 160ms var(--sp-ease), color 160ms var(--sp-ease)",
};

const ghostPillStyle: React.CSSProperties = {
  ...basePillStyle,
  border: "1px solid var(--sp-border)",
  color: "var(--sp-fg-2)",
};

// Shared shape for the three full-width pills in the avatar actions column
// (Upload, Generate Avatar, View reference). Per-button extras — icon `gap`,
// upload's dynamic cursor/opacity — stay inline so the differences are visible
// where they live.
const avatarActionPillStyle: React.CSSProperties = {
  ...ghostPillStyle,
  width: "100%",
  boxSizing: "border-box",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const destructivePillStyle: React.CSSProperties = {
  ...basePillStyle,
  border: "1px solid var(--sp-destructive)",
  color: "var(--sp-destructive)",
};

// Cycle 0115 — Ali:Chat voice samples editor. Renders an editable list of
// {user_msg, char_reply, kind} entries with add/delete/reorder. The author
// is encouraged to include ≥1 refusal kind; we surface a hint when missing
// but do not block save (cycle 0119 will turn this into a validation gate).
function VoiceSamples({
  value,
  onChange,
  charName,
}: {
  value: DialogueExample[];
  onChange: (next: DialogueExample[]) => void;
  charName: string;
}) {
  const refusalCount = value.filter((e) => e.kind === "refusal").length;
  const hasMissingRefusal = value.length > 0 && refusalCount === 0;

  function update(idx: number, patch: Partial<DialogueExample>) {
    onChange(value.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  }
  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }
  function add(kind: DialogueExampleKind) {
    onChange([...value, { user_msg: "", char_reply: "", kind }]);
  }

  return (
    <details data-testid="voice-samples" open={value.length > 0} style={{ marginTop: "0.5rem" }}>
      <summary style={{ cursor: "pointer", fontWeight: 600 }}>
        Voice samples ({value.length})
        <span style={{ color: "var(--sp-fg-3)", fontWeight: 400, marginLeft: "0.5rem", fontSize: "0.85em" }}>
          — short example exchanges that demonstrate {charName}'s voice
        </span>
      </summary>
      <div style={{ display: "grid", gap: "0.85rem", marginTop: "0.75rem" }}>
        <p style={{ color: "var(--sp-fg-3)", fontSize: "0.85em", margin: 0 }}>
          The model imitates voice samples more reliably than declarative trait text.
          Aim for 3–5 short exchanges. <strong>At least one should be a "refusal"</strong>
          — the character pushing back or saying no — otherwise the model defaults to compliance.
          Use "everyday" for mundane voice and "unguarded" for a quiet glimpse of what's underneath.
        </p>

        {hasMissingRefusal && (
          <div data-testid="voice-samples-no-refusal" style={{
            background: "var(--sp-warning-soft)",
            border: "1px solid var(--sp-warning)",
            borderRadius: "var(--sp-radius)",
            padding: "0.5rem 0.75rem",
            color: "var(--sp-fg-2)",
            fontSize: "0.85em",
          }}>
            Heads-up: no "refusal" sample yet. Adding one significantly improves how {charName} pushes back in chat.
          </div>
        )}

        {value.map((entry, idx) => (
          <fieldset key={idx} data-testid={`voice-sample-${idx}`} style={{
            border: "1px solid var(--sp-border)",
            borderRadius: "var(--sp-radius)",
            padding: "0.65rem 0.85rem",
            display: "grid",
            gap: "0.5rem",
          }}>
            <legend style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0 0.4rem" }}>
              <select
                data-testid={`voice-sample-kind-${idx}`}
                value={entry.kind}
                onChange={(e) => update(idx, { kind: e.target.value as DialogueExampleKind })}
                style={{ fontSize: "0.85em" }}
              >
                {DIALOGUE_EXAMPLE_KINDS.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => remove(idx)}
                data-testid={`voice-sample-remove-${idx}`}
                style={{ ...destructivePillStyle, padding: "0.25rem 0.65rem", fontSize: "0.8em" }}
              >
                Remove
              </button>
            </legend>
            <label style={attrLabel}>
              <span>User says</span>
              <textarea
                data-testid={`voice-sample-user-${idx}`}
                rows={2}
                value={entry.user_msg}
                onChange={(e) => update(idx, { user_msg: e.target.value })}
                placeholder='e.g. "Are you sure? You seem upset."'
              />
            </label>
            <label style={attrLabel}>
              <span>{charName} replies</span>
              <textarea
                data-testid={`voice-sample-char-${idx}`}
                rows={3}
                value={entry.char_reply}
                onChange={(e) => update(idx, { char_reply: e.target.value })}
                placeholder={`e.g. *She doesn't look up from the book.* I'm fine. Drop it.`}
              />
            </label>
          </fieldset>
        ))}

        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          <button type="button" data-testid="voice-sample-add-everyday" onClick={() => add("everyday")} style={ghostPillStyle}>+ everyday</button>
          <button type="button" data-testid="voice-sample-add-refusal" onClick={() => add("refusal")} style={ghostPillStyle}>+ refusal</button>
          <button type="button" data-testid="voice-sample-add-unguarded" onClick={() => add("unguarded")} style={ghostPillStyle}>+ unguarded</button>
        </div>
      </div>
    </details>
  );
}
