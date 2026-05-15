import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AVATAR_PREFIX_DEFAULT,
  AVATAR_SUFFIX_DEFAULT,
  PROMPT_EDITOR_DEFAULTS,
  loadPromptEditorPrefs,
  savePromptEditorPrefs,
  type PromptEditorPrefs,
} from "../lib/promptEditorPrefs";
import { useSession } from "../lib/session";
import {
  loadVisualRoleplayDefaultInstructions,
  loadVisualRoleplayPrefs,
  saveVisualRoleplayPov,
  saveVisualRoleplayShot,
  type VisualRoleplayPov,
  type VisualRoleplayShot,
} from "../lib/visualRoleplay";
import { Spinner } from "../lib/Spinner";
import { StatusBanner } from "../lib/StatusBanner";
import { useDocumentTitle } from "../lib/useDocumentTitle";

type Status = "loading" | "ready" | "saving" | "error";

// Single consolidated surface for every user-editable prompt template
// (cycle 0039). Three accordions — Roleplay / Image & Video / Memory.
// Editors that already live under their own route stay navigational
// (Writing Styles, Visual Roleplay, Image Engine, Memory Extraction);
// the Avatar Generation editor lives inline because it has no prior home.
//
// Internal prompts (SFW guardrail, grammar system, character refine,
// branch summary, image refiner system) are intentionally NOT exposed
// here — they're safety rails / machinery, not content the user should tune.
export function PromptEditor() {
  useDocumentTitle("Prompt Editor · Settings");
  const nav = useNavigate();
  const sess = useSession();
  const userId = sess.status === "ready" ? sess.session?.user.id ?? null : null;

  const [status, setStatus] = useState<Status>("loading");
  const [prefs, setPrefs] = useState<PromptEditorPrefs>(PROMPT_EDITOR_DEFAULTS);
  const [pov, setPov] = useState<VisualRoleplayPov>("first_person");
  const [shot, setShot] = useState<VisualRoleplayShot>("auto");
  const [vrDefault, setVrDefault] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sess.status !== "ready") return;
    if (!userId) { nav("/sign-in"); return; }
    let cancelled = false;
    (async () => {
      try {
        const [loaded, vr, vrDef] = await Promise.all([
          loadPromptEditorPrefs(userId),
          loadVisualRoleplayPrefs(userId),
          loadVisualRoleplayDefaultInstructions(),
        ]);
        if (cancelled) return;
        setPrefs(loaded);
        setPov(vr.pov);
        setShot(vr.shot_framing);
        setVrDefault(vrDef);
        setStatus("ready");
      } catch (e) {
        if (!cancelled) { setError(String(e)); setStatus("error"); }
      }
    })();
    return () => { cancelled = true; };
  }, [sess.status, userId, nav]);

  async function onPovChange(nextPov: VisualRoleplayPov) {
    setPov(nextPov);
    try {
      await saveVisualRoleplayPov(nextPov);
    } catch (e) {
      setError(String(e));
    }
  }

  async function onShotChange(nextShot: VisualRoleplayShot) {
    setShot(nextShot);
    try {
      await saveVisualRoleplayShot(nextShot);
    } catch (e) {
      setError(String(e));
    }
  }

  async function commit(patch: Partial<PromptEditorPrefs>) {
    if (!userId) return;
    setStatus("saving");
    setError(null);
    try {
      const saved = await savePromptEditorPrefs(userId, patch);
      setPrefs(saved);
      setStatus("ready");
    } catch (e) {
      setError(String(e));
      setStatus("error");
    }
  }

  if (status === "loading") {
    return <main style={mainStyle}><Spinner testId="prompt-editor-loading" /></main>;
  }

  return (
    <main data-testid="prompt-editor" style={mainStyle}>
      <header className="sp-settings-header" style={headerStyle}>
        <h1 className="sp-h2 sp-wordmark sp-page-h1">Prompt Editor</h1>
        <Link to="/settings" className="sp-back-btn">← Back</Link>
      </header>
      <p style={introStyle}>
        Templates that shape how the AI writes, generates images, and extracts memory.
        Safety rails (SFW content filter) are enforced internally and are not configurable here.
      </p>

      <Section title="Roleplay">
        <Row
          label="Writing Style Presets"
          hint="How the AI writes — perspective, tone, paragraph length, default author's note."
          to="/settings/writing-styles"
          testid="pe-writing-styles"
        />
        <VisualRoleplayPromptEditor
          pov={pov}
          onPovChange={onPovChange}
          shot={shot}
          onShotChange={onShotChange}
          prefs={prefs}
          defaultInstructions={vrDefault}
          saving={status === "saving"}
          onCommit={commit}
        />
        <Row
          label="Visual Roleplay Mode &amp; Auto-generate"
          hint="Manual / Auto toggle + auto-generate images on each reply."
          to="/settings/visual-roleplay"
          testid="pe-visual-roleplay"
        />
      </Section>

      <Section title="Image & Video">
        <AvatarPromptEditor
          prefs={prefs}
          saving={status === "saving"}
          onCommit={commit}
        />
        <Row
          label="Image Engine Prompt Wrap"
          hint="Provider-level positive / negative prefix and suffix wrapping every image request."
          to="/settings/image-engine"
          testid="pe-image-engine"
        />
        <p style={deferredHintStyle}>
          Video Generation prompt editor will land with the Video Engine (future cycle).
        </p>
      </Section>

      <Section title="Memory">
        <Row
          label="Memory Extraction Prompt"
          hint="How the LLM picks facts from a conversation turn to save as long-term memory."
          to="/settings/memory"
          testid="pe-memory"
        />
      </Section>

      {error && (
        <StatusBanner tone="error" testid="pe-error" role="alert">{error}</StatusBanner>
      )}
    </main>
  );
}

function AvatarPromptEditor({
  prefs,
  saving,
  onCommit,
}: {
  prefs: PromptEditorPrefs;
  saving: boolean;
  onCommit: (patch: Partial<PromptEditorPrefs>) => void;
}) {
  const [prefix, setPrefix] = useState(prefs.avatar_prefix ?? AVATAR_PREFIX_DEFAULT);
  const [suffix, setSuffix] = useState(prefs.avatar_suffix ?? AVATAR_SUFFIX_DEFAULT);

  useEffect(() => {
    setPrefix(prefs.avatar_prefix ?? AVATAR_PREFIX_DEFAULT);
    setSuffix(prefs.avatar_suffix ?? AVATAR_SUFFIX_DEFAULT);
  }, [prefs.avatar_prefix, prefs.avatar_suffix]);

  function flush(field: "prefix" | "suffix") {
    // Save the literal typed string — never auto-null when it happens to
    // match the default. The user expressed intent by editing; "Reset to
    // default" is the only path back to null. Send only the changed field
    // as a patch so a concurrent blur on the other field can't clobber it.
    if (field === "prefix" && prefix !== prefs.avatar_prefix) {
      onCommit({ avatar_prefix: prefix });
    } else if (field === "suffix" && suffix !== prefs.avatar_suffix) {
      onCommit({ avatar_suffix: suffix });
    }
  }

  function reset(field: "prefix" | "suffix") {
    if (field === "prefix") {
      setPrefix(AVATAR_PREFIX_DEFAULT);
      if (prefs.avatar_prefix !== null) {
        onCommit({ avatar_prefix: null });
      }
    } else {
      setSuffix(AVATAR_SUFFIX_DEFAULT);
      if (prefs.avatar_suffix !== null) {
        onCommit({ avatar_suffix: null });
      }
    }
  }

  return (
    // data-form="stack" tokens the textareas via global reset (cycle 0070);
    // inline styles on checkbox label override display:block → stays flex.
    <div data-testid="pe-avatar" data-form="stack" style={rowStyle}>
      <div style={{ display: "grid", gap: "0.5rem" }}>
        <strong>Avatar Generation</strong>
        <small style={{ color: "var(--sp-fg-3)" }}>
          Wrapped around the character's physical attributes when generating an avatar portrait.
          Use prefix for framing / lighting / composition; suffix for quality boosters.
        </small>

        <label style={fieldLabel}>
          <span style={fieldLabelTop}>
            <span>Prefix</span>
            <button
              type="button"
              data-testid="pe-avatar-prefix-reset"
              onClick={() => reset("prefix")}
              disabled={saving || prefs.avatar_prefix === null}
              style={resetBtn}
            >
              ↻ Reset to default
            </button>
          </span>
          <textarea
            data-testid="pe-avatar-prefix"
            rows={2}
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            onBlur={() => flush("prefix")}
            disabled={saving}
          />
        </label>

        <label style={fieldLabel}>
          <span style={fieldLabelTop}>
            <span>Suffix</span>
            <button
              type="button"
              data-testid="pe-avatar-suffix-reset"
              onClick={() => reset("suffix")}
              disabled={saving || prefs.avatar_suffix === null}
              style={resetBtn}
            >
              ↻ Reset to default
            </button>
          </span>
          <textarea
            data-testid="pe-avatar-suffix"
            rows={2}
            value={suffix}
            onChange={(e) => setSuffix(e.target.value)}
            onBlur={() => flush("suffix")}
            disabled={saving}
          />
        </label>

        <label style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", paddingTop: "0.25rem" }}>
          <input
            type="checkbox"
            data-testid="pe-avatar-bg-refine"
            checked={prefs.avatar_background_refine_enabled}
            onChange={(e) => onCommit({ avatar_background_refine_enabled: e.target.checked })}
            disabled={saving}
            style={{ marginTop: "0.2rem" }}
          />
          <span style={{ display: "grid", gap: "0.15rem" }}>
            <strong style={{ fontSize: "0.95em" }}>Append background from character context</strong>
            <small style={{ color: "var(--sp-fg-3)" }}>
              Short LLM pass reads the character's system prompt, world, and scenario to pick Danbooru background
              tags (e.g. <code>office_setting, city_skyline, warm_lighting</code>). Off → a plain <code>simple background</code>.
            </small>
          </span>
        </label>

        <small style={{ color: "var(--sp-fg-3)" }}>
          Assembled as: <code>{"{gender tokens}, {prefix}, {character attrs}, {background tags}, {suffix}"}</code>
        </small>
      </div>
    </div>
  );
}

function VisualRoleplayPromptEditor({
  pov,
  onPovChange,
  shot,
  onShotChange,
  prefs,
  defaultInstructions,
  saving,
  onCommit,
}: {
  pov: VisualRoleplayPov;
  onPovChange: (p: VisualRoleplayPov) => void;
  shot: VisualRoleplayShot;
  onShotChange: (s: VisualRoleplayShot) => void;
  prefs: PromptEditorPrefs;
  defaultInstructions: string;
  saving: boolean;
  onCommit: (patch: Partial<PromptEditorPrefs>) => void;
}) {
  const hasCustom = prefs.visual_roleplay_instructions !== null;
  const [mode, setMode] = useState<"default" | "custom">(hasCustom ? "custom" : "default");
  const [custom, setCustom] = useState(
    prefs.visual_roleplay_instructions ?? defaultInstructions ?? "",
  );
  const [showDefault, setShowDefault] = useState(false);

  useEffect(() => {
    setMode(prefs.visual_roleplay_instructions !== null ? "custom" : "default");
    setCustom(prefs.visual_roleplay_instructions ?? defaultInstructions ?? "");
  }, [prefs.visual_roleplay_instructions, defaultInstructions]);

  function switchMode(next: "default" | "custom") {
    setMode(next);
    if (next === "default" && prefs.visual_roleplay_instructions !== null) {
      onCommit({ visual_roleplay_instructions: null });
    }
  }

  function flushCustom() {
    if (custom !== prefs.visual_roleplay_instructions) {
      onCommit({ visual_roleplay_instructions: custom });
    }
  }

  function loadDefault() {
    setCustom(defaultInstructions);
  }

  return (
    // data-form="stack" tokens the custom textarea; radio/checkbox labels
    // have inline display styles that override display:block from the reset.
    <div data-testid="pe-visual-roleplay-inline" data-form="stack" style={rowStyle}>
      <div style={{ display: "grid", gap: "0.5rem" }}>
        <strong>Visual Roleplay</strong>
        <small style={{ color: "var(--sp-fg-3)" }}>
          Steers the chat LLM to append <code>[image: …]</code> tags at the end of each reply when
          Visual Roleplay Mode is <em>Auto</em>. POV applies regardless of whether you use the
          default or a custom template.
        </small>

        <label style={fieldLabel}>
          <span style={{ fontWeight: 500 }}>POV</span>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <label style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
              <input
                type="radio"
                name="pe-vr-pov"
                data-testid="pe-vr-pov-first"
                checked={pov === "first_person"}
                onChange={() => onPovChange("first_person")}
                disabled={saving}
              />
              <span>First person <small style={{ color: "var(--sp-fg-3)" }}>(you see the character)</small></span>
            </label>
            <label style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
              <input
                type="radio"
                name="pe-vr-pov"
                data-testid="pe-vr-pov-third"
                checked={pov === "third_person"}
                onChange={() => onPovChange("third_person")}
                disabled={saving}
              />
              <span>Third person <small style={{ color: "var(--sp-fg-3)" }}>(both in frame)</small></span>
            </label>
          </div>
        </label>

        <label style={fieldLabel}>
          <span style={{ fontWeight: 500 }}>Shot framing</span>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            {SHOT_OPTIONS.map((opt) => (
              <label key={opt.value} style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                <input
                  type="radio"
                  name="pe-vr-shot"
                  data-testid={`pe-vr-shot-${opt.value}`}
                  checked={shot === opt.value}
                  onChange={() => onShotChange(opt.value)}
                  disabled={saving}
                />
                <span>{opt.label} {opt.hint && <small style={{ color: "var(--sp-fg-3)" }}>({opt.hint})</small>}</span>
              </label>
            ))}
          </div>
        </label>

        <label style={fieldLabel}>
          <span style={{ fontWeight: 500 }}>Instructions</span>
          <div style={{ display: "flex", gap: "1rem" }}>
            <label style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
              <input
                type="radio"
                name="pe-vr-mode"
                data-testid="pe-vr-mode-default"
                checked={mode === "default"}
                onChange={() => switchMode("default")}
                disabled={saving}
              />
              <span>Default</span>
            </label>
            <label style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
              <input
                type="radio"
                name="pe-vr-mode"
                data-testid="pe-vr-mode-custom"
                checked={mode === "custom"}
                onChange={() => switchMode("custom")}
                disabled={saving}
              />
              <span>Custom</span>
            </label>
          </div>
        </label>

        {mode === "default" ? (
          <div style={{ display: "grid", gap: "0.4rem" }}>
            <small style={{ color: "var(--sp-fg-3)" }}>
              Using the built-in Visual Roleplay prompt. It's tuned to produce faithful Danbooru
              tags at the end of each reply.
            </small>
            <button
              type="button"
              data-testid="pe-vr-view-default"
              onClick={() => setShowDefault((v) => !v)}
              style={resetBtn}
            >
              {showDefault ? "Hide default" : "View default"}
            </button>
            {showDefault && (
              <pre
                data-testid="pe-vr-default-preview"
                style={{
                  whiteSpace: "pre-wrap",
                  fontSize: "0.75em",
                  color: "var(--sp-fg-3)",
                  padding: "0.5rem 0.75rem",
                  background: "var(--sp-bg-3)",
                  borderRadius: "var(--sp-radius)",
                  margin: 0,
                }}
              >
                {defaultInstructions || "…"}
              </pre>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gap: "0.4rem" }}>
            <textarea
              data-testid="pe-vr-custom"
              rows={6}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onBlur={flushCustom}
              disabled={saving}
            />
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                data-testid="pe-vr-load-default"
                onClick={loadDefault}
                disabled={saving || !defaultInstructions}
                style={resetBtn}
              >
                Load default as starting point
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details open data-testid={`pe-section-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`} style={sectionStyle}>
      <summary style={summaryStyle}>{title}</summary>
      <div style={{ display: "grid", gap: "0.75rem", paddingTop: "0.75rem" }}>
        {children}
      </div>
    </details>
  );
}

function Row({
  label,
  hint,
  to,
  testid,
}: {
  label: string;
  hint: string;
  to: string;
  testid: string;
}) {
  return (
    <Link to={to} data-testid={testid} style={rowLinkStyle}>
      <div style={{ display: "grid", gap: "0.2rem" }}>
        <strong style={{ color: "var(--sp-fg)" }}>{label}</strong>
        <small style={{ color: "var(--sp-fg-3)" }}>{hint}</small>
      </div>
      <span aria-hidden style={{ color: "var(--sp-fg-3)" }}>→</span>
    </Link>
  );
}

// Cycle 0046 — shot framing canonical Danbooru tags. `auto` lets the
// refiner pick based on narrative context; the others force a specific
// camera distance regardless of scene description.
const SHOT_OPTIONS: ReadonlyArray<{ value: VisualRoleplayShot; label: string; hint?: string }> = [
  { value: "auto",        label: "Auto",        hint: "refiner decides" },
  { value: "close-up",    label: "Close-up",    hint: "face" },
  { value: "portrait",    label: "Portrait",    hint: "head + shoulders" },
  { value: "medium_shot", label: "Medium",      hint: "waist up" },
  { value: "cowboy_shot", label: "Cowboy",      hint: "thighs up" },
  { value: "full_body",   label: "Full body" },
];

const mainStyle: React.CSSProperties = {
  maxWidth: 640, margin: "2rem auto", padding: "0 1rem",
  display: "grid", gap: "1rem",
};
const headerStyle: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1.75rem",
};
const introStyle: React.CSSProperties = {
  margin: 0, color: "var(--sp-fg-3)", fontSize: "0.9rem",
};
const sectionStyle: React.CSSProperties = {
  background: "var(--sp-bg-2)",
  border: "1px solid var(--sp-border)",
  borderRadius: "var(--sp-radius)",
  padding: "0.75rem 1rem",
};
const summaryStyle: React.CSSProperties = {
  cursor: "pointer", fontWeight: 600, fontSize: "1rem", color: "var(--sp-fg)",
};
const rowStyle: React.CSSProperties = {
  padding: "0.75rem 0", borderTop: "1px solid var(--sp-border-soft)",
};
const rowLinkStyle: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: "0.75rem 0", borderTop: "1px solid var(--sp-border-soft)",
  textDecoration: "none",
};
const fieldLabel: React.CSSProperties = {
  display: "grid", gap: "0.3rem",
};
const fieldLabelTop: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "baseline",
};
const resetBtn: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--sp-border)",
  color: "var(--sp-fg-2)",
  borderRadius: "var(--sp-radius)",
  padding: "0.2rem 0.65rem",
  fontSize: "0.78em",
  fontFamily: "inherit",
  cursor: "pointer",
};
const deferredHintStyle: React.CSSProperties = {
  margin: "0.5rem 0 0", fontSize: "0.8rem", color: "var(--sp-fg-3)", fontStyle: "italic",
};
