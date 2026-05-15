import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSession } from "../lib/session";
import { supabase } from "../lib/supabase";
import { Spinner } from "../lib/Spinner";
import { StatusBanner } from "../lib/StatusBanner";
import {
  type CharacterDraft,
  type Gender,
  createCharacter,
  freshSeed,
} from "../lib/characters";
import {
  NoTextEngineError,
  type RefinedDraft,
} from "../lib/characterRefine";
import {
  generateCharacter,
  type AgeRangeHint,
  type DramaLevel,
  type GenderHint,
  type ToneHint,
} from "../lib/characterGenerate";
import type { ImportState } from "../features/characters/CharacterForm";
import { useDocumentTitle } from "../lib/useDocumentTitle";

type Phase =
  | { kind: "idle" }
  | { kind: "generating"; abort: () => void }
  | { kind: "saving" }
  | { kind: "no_engine" }
  | { kind: "error"; message: string };

const TONE_OPTIONS: { value: ToneHint; label: string }[] = [
  { value: "any", label: "Surprise me" },
  { value: "slice_of_life", label: "Slice of life" },
  { value: "contemporary", label: "Contemporary" },
  { value: "historical", label: "Historical" },
  { value: "fantasy", label: "Fantasy" },
  { value: "scifi", label: "Sci-fi" },
  { value: "surreal", label: "Surreal" },
];

const DRAMA_OPTIONS: { value: DramaLevel; label: string; desc: string }[] = [
  { value: "none", label: "None", desc: "slice of life, no internal drama — small idiosyncrasies, no wounds" },
  { value: "light", label: "Light", desc: "uneven habits, no deep wounds, gentle conflicts" },
  { value: "medium", label: "Medium", desc: "formative experiences, real stakes, layered traits" },
  { value: "heavy", label: "Heavy", desc: "deep backstory, sharper edges, layered secrets" },
];

const GENDER_OPTIONS: { value: GenderHint; label: string }[] = [
  { value: "any", label: "Any" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "non_binary", label: "Non-binary" },
  { value: "unspecified", label: "Unspecified" },
];

const AGE_OPTIONS: { value: AgeRangeHint; label: string }[] = [
  { value: "any", label: "Any" },
  { value: "young_adult", label: "Young adult (18–25)" },
  { value: "adult", label: "Adult (25–40)" },
  { value: "mid_life", label: "Mid-life (40–60)" },
  { value: "older", label: "Older (60+)" },
];

function isGender(s: string | null | undefined): s is Gender {
  return s === "male" || s === "female" || s === "non_binary" || s === "unspecified";
}

/** Build a CharacterDraft from the generator's output. No baseline card to
 *  preserve — start from defaults and overlay everything the refiner produced. */
function buildDraftFromRefined(refined: RefinedDraft): CharacterDraft {
  const gender = isGender(refined.gender) ? refined.gender : null;
  return {
    name: refined.name,
    tagline: refined.tagline || null,
    system_prompt: refined.system_prompt,
    mode: "roleplay",
    avatar_ref: null,
    reference_ref: null,
    appearance_description: null,
    append_appearance_to_image_prompts: true,
    accent_color: "#475569",
    personality: refined.personality,
    goals: refined.goals,
    worldbuilding: refined.worldbuilding,
    default_writing_style_id: null,
    default_persona_id: null,
    character_memory_enabled: true,
    tags: refined.tags.length ? refined.tags : null,
    scenario: refined.scenario || null,
    english_style: "neutral_american",
    expertise_areas: null,
    communication_style_assistant: null,
    rules: null,
    pending_character_book: null,
    age: refined.age,
    gender,
    build: refined.build,
    height: refined.height,
    hair_color: refined.hair_color,
    hair_style: refined.hair_style,
    eye_color: refined.eye_color,
    skin_tone: refined.skin_tone,
    distinctive_features: refined.distinctive_features,
    signature_style: refined.signature_style,
    voice_style: refined.voice_style,
    greeting: refined.greeting || null,
    image_seed: freshSeed(),
    tts_narrator_voice_id: null,
    tts_character_voice_id: null,
    group_size: 1,
    group_members_description: null,
    dialogue_examples: refined.dialogue_examples?.length ? refined.dialogue_examples : null,
    rp_overrides: null,
  };
}

export function CharacterGenerate() {
  useDocumentTitle("AI Generate");
  const nav = useNavigate();
  const sess = useSession();
  const userId = sess.status === "ready" ? sess.session?.user.id ?? null : null;

  const [idea, setIdea] = useState("");
  const [drama, setDrama] = useState<DramaLevel>("medium");
  const [tone, setTone] = useState<ToneHint>("any");
  const [gender, setGender] = useState<GenderHint>("any");
  const [age, setAge] = useState<AgeRangeHint>("any");
  const [nsfwAllowed, setNsfwAllowed] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  // Read users.sfw_disabled to gate the NSFW toggle.
  const [sfwDisabled, setSfwDisabled] = useState<boolean | null>(null);
  useEffect(() => {
    if (sess.status !== "ready") return;
    if (!userId) {
      nav("/sign-in");
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("users")
        .select("sfw_disabled")
        .eq("id", userId)
        .single();
      if (!cancelled) setSfwDisabled(Boolean(data?.sfw_disabled));
    })();
    return () => {
      cancelled = true;
    };
  }, [sess.status, userId, nav]);

  const nsfwEnabled = sfwDisabled === true;
  const ideaTrimmed = idea.trim();
  const ideaValid = ideaTrimmed.length >= 20 && ideaTrimmed.length <= 2000;
  const canGenerate = ideaValid && phase.kind !== "generating";

  async function onGenerate(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!canGenerate || !userId) return;
    const abortCtrl = new AbortController();
    setPhase({ kind: "generating", abort: () => abortCtrl.abort() });
    let refined;
    try {
      refined = await generateCharacter(
        {
          idea: ideaTrimmed,
          drama_level: drama,
          tone_hint: tone,
          gender_hint: gender,
          age_range_hint: age,
          nsfw_allowed: nsfwAllowed && nsfwEnabled,
        },
        abortCtrl.signal,
      );
    } catch (err) {
      if (abortCtrl.signal.aborted) {
        setPhase({ kind: "idle" });
        return;
      }
      if (err instanceof NoTextEngineError) {
        setPhase({ kind: "no_engine" });
        return;
      }
      setPhase({ kind: "error", message: (err as Error).message });
      return;
    }
    // Generation succeeded — persist immediately so the user doesn't risk
    // losing the draft if they navigate away from the editor mid-review
    // (creator-feedback after first ship). On persist failure, fall back to
    // the ImportState handoff so the draft is still loaded somewhere the
    // user can act on it.
    const draft = buildDraftFromRefined(refined);
    setPhase({ kind: "saving" });
    try {
      const character = await createCharacter(userId, draft);
      nav(`/character/${character.id}/edit`);
    } catch (err) {
      const state: ImportState = {
        draft,
        pendingCharacterBook: null,
        avatarBlob: null,
        rawCard: null,
        refineSource: "llm",
      };
      // Best-effort fallback — surface a banner so the user knows the
      // auto-save failed and they need to click Save in the editor.
      console.error("auto-save after generate failed; falling back to ImportState", err);
      nav("/character/new/manual", { state });
    }
  }

  const currentDramaDesc = DRAMA_OPTIONS.find((o) => o.value === drama)?.desc ?? "";
  const isBusy = phase.kind === "generating" || phase.kind === "saving";

  // While generating or saving, take over the whole form area with a
  // centered loading card so the user clearly sees the page is in wait
  // state (creator-feedback after first ship — the previous mid-form
  // spinner felt like only the bottom of the page was loading).
  if (isBusy) {
    const isGen = phase.kind === "generating";
    return (
      <main data-testid="character-generate" style={mainStyle}>
        <header className="sp-settings-header" style={headerStyle}>
          <h1 className="sp-h2 sp-wordmark sp-page-h1">AI Generate</h1>
          <span style={{ color: "var(--sp-fg-3)", fontSize: "0.9rem" }}>
            {isGen ? "generating…" : "saving…"}
          </span>
        </header>
        <div style={loadingCardStyle}>
          <Spinner
            testId="generate-spinner"
            label={
              isGen
                ? "Generating character — this can take 20–60 seconds. Drama + tone + your idea are being woven into a complete person…"
                : "Saving the new character…"
            }
          />
          {isGen && (
            <button
              type="button"
              data-testid="generate-cancel"
              onClick={() => phase.abort()}
              style={ghostBtnStyle}
            >
              Cancel
            </button>
          )}
        </div>
      </main>
    );
  }

  return (
    <main data-testid="character-generate" style={mainStyle}>
      <header className="sp-settings-header" style={headerStyle}>
        <h1 className="sp-h2 sp-wordmark sp-page-h1">AI Generate</h1>
        <Link to="/character/new" className="sp-back-btn">← Back</Link>
      </header>

      <p style={{ color: "var(--sp-fg-3)", marginBottom: "1.25rem", lineHeight: 1.55 }}>
        Describe the character you want — concept, physical traits, story hint, mood. The AI invents
        a complete person from your seed, then drops you into the editor to refine. Drama level,
        tone, and gender/age hints shape what gets emphasized; the idea text always wins on direct
        contradictions.
      </p>

      <form
        data-form="stack"
        onSubmit={onGenerate}
        style={{ display: "grid", gap: "1.25rem" }}
      >
        {/* Idea — full-width textarea via the data-form="stack" global reset */}
        <section>
          <div style={ideaHeaderRow}>
            <p style={sectionLabel}>Your idea</p>
            <small style={{ ...subStyle, color: idea.length > 2000 ? "var(--sp-destructive)" : "var(--sp-fg-3)" }}>
              {idea.length} / 2000 (min 20)
            </small>
          </div>
          <label aria-label="Character idea">
            <textarea
              data-testid="generate-idea"
              aria-label="Character idea"
              rows={6}
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder={`e.g. A retired forensic pathologist who now runs a small antique bookshop in Frankfurt's Westend. The white coat still hangs behind the office door. Quietly observant, dry humor, won't talk about old cases.\n\nMix freely: concept + physical traits + tone + a hook.`}
            />
          </label>
        </section>

        {/* Drama — compact: label + segmented + active description */}
        <section>
          <p style={sectionLabel}>Drama level</p>
          <div style={compactCard}>
            <div role="radiogroup" aria-label="Drama level" style={segmentedTrackStyle}>
              {DRAMA_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={drama === opt.value}
                  data-testid={`generate-drama-${opt.value}`}
                  onClick={() => setDrama(opt.value)}
                  style={segmentedBtnStyle(drama === opt.value)}
                  title={opt.desc}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p style={dramaDescStyle}>{currentDramaDesc}</p>
          </div>
        </section>

        {/* Tone — pill row */}
        <section>
          <p style={sectionLabel}>Tone</p>
          <div style={compactCard}>
            <div style={pillRowStyle}>
              {TONE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  data-testid={`generate-tone-${opt.value}`}
                  onClick={() => setTone(opt.value)}
                  style={pillBtnStyle(tone === opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Hints — gender + age, paired in one card. data-form="stack" tokenizes the selects. */}
        <section>
          <p style={sectionLabel}>Hints (optional)</p>
          <div style={hintsCard}>
            <label style={hintRowStyle}>
              <span style={hintLabelStyle}>Gender</span>
              <select
                data-testid="generate-gender"
                value={gender}
                onChange={(e) => setGender(e.target.value as GenderHint)}
                style={inlineSelectStyle}
              >
                {GENDER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
            <label style={{ ...hintRowStyle, borderTop: "1px solid var(--sp-border-soft)" }}>
              <span style={hintLabelStyle}>Age range</span>
              <select
                data-testid="generate-age"
                value={age}
                onChange={(e) => setAge(e.target.value as AgeRangeHint)}
                style={inlineSelectStyle}
              >
                {AGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {/* Mature content — NSFW toggle gated on users.sfw_disabled */}
        <section>
          <p style={sectionLabel}>Mature content</p>
          <div style={compactCard}>
            <div style={{ ...toggleRowStyle, ...(nsfwEnabled ? null : { cursor: "default" }) }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <strong>Allow NSFW themes for this generation</strong>
                <span style={{ ...subStyle, display: "block", marginTop: "0.25rem" }}>
                  When ON, the model may include mature content if your idea invites it. The
                  anti-romance-shortcut rule still applies — the character remains a person with
                  integrity beyond any trope.
                  {!nsfwEnabled && (
                    <>
                      {" "}<em>
                        NSFW is locked at the account level —{" "}
                        <Link to="/settings/data-security" style={{ color: "var(--sp-brand-1)" }}>
                          enable mature content in Data &amp; Security
                        </Link>{" "}
                        first.
                      </em>
                    </>
                  )}
                </span>
              </span>
              <input
                type="checkbox"
                className="sp-toggle"
                data-testid="generate-nsfw"
                checked={nsfwEnabled && nsfwAllowed}
                disabled={!nsfwEnabled}
                onChange={(e) => setNsfwAllowed(e.target.checked)}
              />
            </div>
          </div>
        </section>

        {/* Status banners */}
        {phase.kind === "no_engine" && (
          <StatusBanner tone="warning" testid="generate-no-engine" role="status">
            No active Text Engine. Configure one at{" "}
            <Link to="/settings/text-engine" style={{ color: "var(--sp-brand-1)" }}>Settings → Text Engine</Link>{" "}
            before generating.
          </StatusBanner>
        )}
        {phase.kind === "error" && (
          <StatusBanner tone="error" testid="generate-error" role="alert">
            {phase.message}
          </StatusBanner>
        )}

        {/* Submit row */}
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", marginTop: "0.5rem" }}>
          <button
            type="submit"
            data-testid="generate-submit"
            disabled={!canGenerate}
            style={primaryBtnStyle(!canGenerate)}
          >
            ✨ Generate character
          </button>
          <Link to="/character/new" style={{ fontSize: "0.9em", color: "var(--sp-fg-2)" }}>Cancel</Link>
        </div>

        <p style={{ fontSize: "0.85rem", color: "var(--sp-fg-3)", marginTop: "0.25rem" }}>
          <strong>Tip:</strong> the character is saved automatically once generation finishes,
          and you land in the editor to refine anything by hand. The avatar is generated
          separately — head to the Avatar tab when you want a portrait.
        </p>
      </form>
    </main>
  );
}

const mainStyle: React.CSSProperties = {
  maxWidth: 640,
  margin: "2rem auto",
  padding: "0 1rem",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  marginBottom: "1.75rem",
};

const sectionLabel: React.CSSProperties = {
  fontSize: "var(--sp-text-xs)",
  fontWeight: 600,
  letterSpacing: "var(--sp-tracking-caps)",
  textTransform: "uppercase",
  color: "var(--sp-fg-3)",
  paddingLeft: 4,
  margin: 0,
};

const ideaHeaderRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: "0.75rem",
  marginBottom: "0.4rem",
};

const compactCard: React.CSSProperties = {
  background: "var(--sp-bg-2)",
  border: "1px solid var(--sp-border)",
  borderRadius: "var(--sp-radius)",
  padding: "0.75rem 0.85rem",
  marginTop: "0.4rem",
  display: "grid",
  gap: "0.5rem",
};

const segmentedTrackStyle: React.CSSProperties = {
  display: "flex",
  background: "var(--sp-bg-3)",
  border: "1px solid var(--sp-border)",
  borderRadius: 999,
  padding: 4,
  gap: 2,
  width: "100%",
};

function segmentedBtnStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    appearance: "none",
    border: "none",
    background: active ? "var(--sp-brand-1)" : "transparent",
    color: active ? "var(--sp-fg-on-brand)" : "var(--sp-fg-2)",
    fontWeight: active ? 600 : 500,
    fontFamily: "inherit",
    fontSize: "0.88rem",
    padding: "0.4rem 0.5rem",
    borderRadius: 999,
    cursor: "pointer",
    transition: "background 160ms var(--sp-ease), color 160ms var(--sp-ease)",
  };
}

const dramaDescStyle: React.CSSProperties = {
  fontSize: "0.82rem",
  color: "var(--sp-fg-3)",
  margin: 0,
  paddingLeft: "0.15rem",
  lineHeight: 1.45,
};

const pillRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

function pillBtnStyle(active: boolean): React.CSSProperties {
  return {
    appearance: "none",
    background: active ? "var(--sp-brand-1)" : "var(--sp-bg-3)",
    color: active ? "var(--sp-fg-on-brand)" : "var(--sp-fg-2)",
    border: "1px solid " + (active ? "var(--sp-brand-1)" : "var(--sp-border)"),
    fontWeight: active ? 600 : 500,
    fontFamily: "inherit",
    fontSize: "0.85rem",
    padding: "0.35rem 0.85rem",
    borderRadius: 999,
    cursor: "pointer",
    transition: "background 160ms var(--sp-ease), border-color 160ms var(--sp-ease), color 160ms var(--sp-ease)",
  };
}

const hintsCard: React.CSSProperties = {
  background: "var(--sp-bg-2)",
  border: "1px solid var(--sp-border)",
  borderRadius: "var(--sp-radius)",
  overflow: "hidden",
  marginTop: "0.4rem",
};

const hintRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "0.6rem 0.85rem",
  gap: "1rem",
  margin: 0,
};

const hintLabelStyle: React.CSSProperties = {
  fontWeight: 500,
  color: "var(--sp-fg)",
  fontSize: "0.92rem",
};

const inlineSelectStyle: React.CSSProperties = {
  // Override the data-form="stack" full-width treatment for inline use.
  width: "auto",
  minWidth: 170,
  margin: 0,
  padding: "0.4rem 0.55rem",
  background: "var(--sp-bg-inset)",
  color: "var(--sp-fg)",
  border: "1px solid var(--sp-border)",
  borderRadius: "var(--sp-radius-sm)",
  fontFamily: "inherit",
  fontSize: "0.88rem",
};

const toggleRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "1rem",
};

const subStyle: React.CSSProperties = {
  fontSize: "0.82rem",
  color: "var(--sp-fg-3)",
  lineHeight: 1.5,
};

const loadingCardStyle: React.CSSProperties = {
  display: "grid",
  gap: "1.25rem",
  justifyItems: "center",
  alignContent: "center",
  background: "var(--sp-bg-2)",
  border: "1px solid var(--sp-border)",
  borderRadius: "var(--sp-radius)",
  padding: "3.5rem 1.5rem",
  minHeight: "55vh",
  textAlign: "center",
};

const ghostBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--sp-border)",
  color: "var(--sp-fg-2)",
  borderRadius: "var(--sp-radius)",
  padding: "0.45rem 1.1rem",
  fontWeight: 500,
  fontFamily: "inherit",
  fontSize: "0.9em",
  cursor: "pointer",
};

function primaryBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    background: disabled ? "var(--sp-bg-3)" : "var(--sp-brand-1)",
    color: disabled ? "var(--sp-fg-4)" : "var(--sp-fg-on-brand)",
    border: "none",
    borderRadius: "var(--sp-radius)",
    padding: "0.6rem 1.4rem",
    fontWeight: 600,
    fontFamily: "inherit",
    fontSize: "0.95rem",
    cursor: disabled ? "not-allowed" : "pointer",
  };
}
