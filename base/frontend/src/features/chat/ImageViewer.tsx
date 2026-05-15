import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Heart, RotateCw, SlidersHorizontal, Trash2, X } from "lucide-react";
import {
  deleteImage,
  displayUrl,
  labelForPreset,
  RESOLUTION_PRESETS,
  toggleFavorite,
  type GeneratedImage,
  type GenerationOverrides,
} from "../../lib/images";
import { Icon } from "../../lib/Icon";

type Props = {
  image: GeneratedImage;
  // Variant navigation within the same message (optional).
  prevImage?: GeneratedImage | null;
  nextImage?: GeneratedImage | null;
  canRegenerate: boolean;
  onClose: () => void;
  onChange: (image: GeneratedImage) => void;      // favorite toggle reflects back
  onDeleted: (image: GeneratedImage) => void;
  onRegenerate: (overrides?: GenerationOverrides) => void;
  onStep?: (image: GeneratedImage) => void;
};

// Cycle 0047 — per-regen override UI. "Inherit" lets the field fall
// back to the user's saved global pref; the other values force the
// setting for this one regen only.
type PovOverride = "inherit" | "first_person" | "third_person";
type ShotOverride = "inherit" | "auto" | "close-up" | "portrait" | "medium_shot" | "cowboy_shot" | "full_body";
type ResOverride = "inherit" | string;  // preset id when not inheriting

const POV_OPTIONS: ReadonlyArray<{ value: PovOverride; label: string }> = [
  { value: "inherit", label: "Inherit" },
  { value: "first_person", label: "First" },
  { value: "third_person", label: "Third" },
];
const SHOT_OPTIONS: ReadonlyArray<{ value: ShotOverride; label: string }> = [
  { value: "inherit",     label: "Inherit" },
  { value: "auto",        label: "Auto" },
  { value: "close-up",    label: "Close-up" },
  { value: "portrait",    label: "Portrait" },
  { value: "medium_shot", label: "Medium" },
  { value: "cowboy_shot", label: "Cowboy" },
  { value: "full_body",   label: "Full body" },
];

export function ImageViewer({
  image, prevImage, nextImage, canRegenerate,
  onClose, onChange, onDeleted, onRegenerate, onStep,
}: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFullPrompt, setShowFullPrompt] = useState(false);
  const [showRegenPanel, setShowRegenPanel] = useState(false);
  const [ovPov, setOvPov] = useState<PovOverride>("inherit");
  const [ovShot, setOvShot] = useState<ShotOverride>("inherit");
  const [ovRes, setOvRes] = useState<ResOverride>("inherit");
  // Cycle 0097 — per-regen style override (fal only). Inherit means
  // "use the character's avatar_style snapshot". Selecting a different
  // value produces a new variant with that style; the original variants
  // keep their original style snapshot.
  const [ovStyle, setOvStyle] = useState<"inherit" | "realistic" | "anime" | "custom">("inherit");
  const originalPrompt = image.refined_prompt || image.prompt || "";
  const [promptDraft, setPromptDraft] = useState<string>(originalPrompt);

  // Reset the editable prompt whenever the user steps to a different image.
  useEffect(() => {
    setPromptDraft(image.refined_prompt || image.prompt || "");
  }, [image.id, image.refined_prompt, image.prompt]);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    if (image.sfw_blocked) return;
    // Plan 0123: use displayUrl (cycle 0094) so fresh fal images render
    // via external_url (fal CDN, <24h) before the dual-store sweeper has
    // had a chance to populate storage_ref. Previously called imageUrl
    // directly which left the viewer stuck on the loading spinner whenever
    // a chat-generated image was opened seconds after generation.
    displayUrl(image).then((u) => { if (!cancelled) setUrl(u); }).catch(() => {});
    return () => { cancelled = true; };
  }, [image.id, image.storage_ref, image.external_url, image.sfw_blocked]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && prevImage && onStep) onStep(prevImage);
      else if (e.key === "ArrowRight" && nextImage && onStep) onStep(nextImage);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // image.id in deps: if the parent reuses prevImage/nextImage references
  // after a step, we still want a fresh handler bound to the new state.
  }, [image.id, onClose, onStep, prevImage, nextImage]);

  async function onFav() {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      await toggleFavorite(image.id, !image.favorite);
      onChange({ ...image, favorite: !image.favorite });
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (busy) return;
    if (!window.confirm("Delete this image? This cannot be undone.")) return;
    setBusy(true); setError(null);
    try {
      await deleteImage(image.id);
      onDeleted(image);
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  }

  const promptPreview = originalPrompt.length > 120 ? originalPrompt.slice(0, 120).trimEnd() + "…" : originalPrompt;

  const promptChanged = !!promptDraft.trim() && promptDraft.trim() !== originalPrompt.trim();
  const hasOverrides =
    ovPov !== "inherit" || ovShot !== "inherit" || ovRes !== "inherit" || ovStyle !== "inherit" || promptChanged;

  // Portal to <body>: the route's `.sp-page-content` wrapper carries an
  // `sp-fade-in` animation whose `both` fill-mode leaves a persistent
  // `transform` on the element. A non-`none` transform makes that wrapper
  // the containing block for `position: fixed` descendants — so without
  // the portal the overlay's `inset: 0` was clipped to the content card
  // (sidebar still visible, "se ve cortado"). Rendering into <body>
  // escapes that subtree so the lightbox truly covers the viewport.
  return createPortal(
    <div role="dialog" aria-modal="true" data-testid="image-viewer" style={overlay}>
      <div style={topBar}>
        <button type="button" data-testid="viewer-close" onClick={onClose} style={iconBtn} aria-label="Close">
          <Icon icon={X} size={20} />
        </button>
        <span style={datePillStyle}>
          {new Date(image.created_at).toLocaleString()} · {labelForPreset(image.resolution_preset)}
        </span>
        <button
          type="button"
          data-testid="viewer-favorite"
          onClick={onFav}
          disabled={busy}
          style={{ ...iconBtn, color: image.favorite ? "var(--sp-destructive)" : "var(--sp-fg)" }}
          aria-pressed={image.favorite}
          aria-label={image.favorite ? "Unfavorite" : "Favorite"}
        >
          <Icon icon={Heart} size={20} fill={image.favorite ? "currentColor" : "none"} />
        </button>
      </div>

      <div style={imageWrap}>
        {prevImage && onStep && (
          <button type="button" data-testid="viewer-prev" onClick={() => onStep(prevImage)} style={{ ...navBtn, left: "1rem" }} aria-label="Previous image">
            <Icon icon={ChevronLeft} size={24} />
          </button>
        )}
        {image.sfw_blocked ? (
          <div style={blockedCard}>
            <strong>Blocked by SFW filter.</strong>
            <div style={{ color: "var(--sp-fg-2)", marginTop: "0.35rem" }}>Disable SFW in Profile to allow this scene.</div>
          </div>
        ) : url ? (
          <img src={url} alt={originalPrompt} decoding="async" style={imageStyle} />
        ) : (
          <div
            role="status"
            aria-label="Loading"
            style={{
              color: "rgba(255,255,255,0.7)",
              padding: "2rem 1rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <span className="sp-typing-dot" />
            <span className="sp-typing-dot" />
            <span className="sp-typing-dot" />
          </div>
        )}
        {nextImage && onStep && (
          <button type="button" data-testid="viewer-next" onClick={() => onStep(nextImage)} style={{ ...navBtn, right: "1rem" }} aria-label="Next image">
            <Icon icon={ChevronRight} size={24} />
          </button>
        )}
      </div>

      <div style={footer}>
        <button
          type="button"
          data-testid="viewer-prompt-toggle"
          onClick={() => setShowFullPrompt((v) => !v)}
          style={promptToggleStyle}
        >
          <div style={promptLabelStyle}>Prompt</div>
          <div style={{ marginTop: "0.25rem", fontSize: "0.9em", whiteSpace: showFullPrompt ? "pre-wrap" : "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {showFullPrompt ? originalPrompt : promptPreview}
          </div>
        </button>

        {error && <p role="alert" style={{ color: "var(--sp-destructive)", margin: 0 }}>{error}</p>}

        {showRegenPanel && (
          <div data-testid="viewer-regen-panel" style={regenPanel}>
            <small style={{ color: "rgba(255,255,255,0.7)" }}>
              Per-regen overrides. Inherit leaves your global prefs alone.
            </small>
            <label style={{ display: "grid", gap: "0.25rem" }}>
              <span style={regenLabel}>Prompt</span>
              <textarea
                data-testid="viewer-regen-prompt"
                value={promptDraft}
                onChange={(e) => setPromptDraft(e.target.value)}
                rows={3}
                style={{ ...regenInput, resize: "vertical", minHeight: "3.5rem", fontFamily: "inherit" }}
              />
              <small style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.75em" }}>
                Edit to override — uses your tags verbatim (skips the AI refiner).
              </small>
            </label>
            <label style={regenRow}>
              <span style={regenLabel}>POV</span>
              <select
                data-testid="viewer-regen-pov"
                value={ovPov}
                onChange={(e) => setOvPov(e.target.value as PovOverride)}
                style={regenInput}
              >
                {POV_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label style={regenRow}>
              <span style={regenLabel}>Shot</span>
              <select
                data-testid="viewer-regen-shot"
                value={ovShot}
                onChange={(e) => setOvShot(e.target.value as ShotOverride)}
                style={regenInput}
              >
                {SHOT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label style={regenRow}>
              <span style={regenLabel}>Resolution</span>
              <select
                data-testid="viewer-regen-res"
                value={ovRes}
                onChange={(e) => setOvRes(e.target.value)}
                style={regenInput}
              >
                <option value="inherit">Inherit</option>
                {RESOLUTION_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label} ({p.dims[0]}×{p.dims[1]})</option>
                ))}
              </select>
            </label>
            <label style={regenRow}>
              <span style={regenLabel}>Style</span>
              <select
                data-testid="viewer-regen-style"
                value={ovStyle}
                onChange={(e) => setOvStyle(e.target.value as typeof ovStyle)}
                style={regenInput}
                title="fal only — no-op when the active provider is ComfyUI. Inherit uses the character's stored avatar_style."
              >
                <option value="inherit">Inherit</option>
                <option value="realistic">Realistic</option>
                <option value="anime">Anime</option>
                <option value="custom">Custom (uses your saved template)</option>
              </select>
            </label>
          </div>
        )}

        <div style={actionRowStyle}>
          <button
            type="button"
            data-testid="viewer-regenerate-toggle"
            onClick={() => setShowRegenPanel((v) => !v)}
            disabled={busy}
            style={actionBtn}
          >
            <Icon icon={showRegenPanel ? X : SlidersHorizontal} size={16} />
            {showRegenPanel ? "Hide overrides" : "Regenerate with…"}
          </button>
          <button
            type="button"
            data-testid="viewer-regenerate"
            onClick={() => {
              const ov: GenerationOverrides = {};
              if (ovPov !== "inherit") ov.pov = ovPov;
              if (ovShot !== "inherit") ov.shot_framing = ovShot;
              if (ovRes !== "inherit") ov.resolution_preset = ovRes;
              if (promptChanged) ov.prompt_override = promptDraft.trim();
              if (ovStyle !== "inherit") ov.style_override = ovStyle;
              onRegenerate(hasOverrides ? ov : undefined);
            }}
            disabled={!canRegenerate || busy}
            style={actionBtn}
          >
            <Icon icon={RotateCw} size={16} />
            {hasOverrides ? "Regenerate with overrides" : "Regenerate"}
          </button>
          <button
            type="button"
            data-testid="viewer-delete"
            onClick={onDelete}
            disabled={busy}
            style={{
              ...actionBtn,
              color: "var(--sp-destructive)",
              borderColor: "var(--sp-destructive)",
            }}
          >
            <Icon icon={Trash2} size={16} />
            Delete
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// Fully opaque `--sp-bg` (#0D0A15). Earlier rgba(0,0,0,0.92) let the
// underlying Gallery chrome bleed through at ~8% on mobile, breaking the
// fullscreen-lightbox feel ("se ve cortado"). Solid bg fixes it.
// Tokens fg-3/4 are tuned for `--sp-bg-2`; chips/labels here use literal
// rgba(255,255,255,*) because they sit over the deeper `--sp-bg` layer.
const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "var(--sp-bg)",
  display: "flex", flexDirection: "column", zIndex: 200, color: "var(--sp-fg)",
};
const topBar: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "0.75rem 1rem", gap: "0.5rem",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};
const datePillStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.18)",
  color: "rgba(255,255,255,0.82)",
  borderRadius: "var(--sp-radius)",
  padding: "0.3rem 0.75rem",
  fontSize: "0.85em",
};
const imageWrap: React.CSSProperties = {
  flex: 1, minHeight: 0, position: "relative", display: "flex",
  alignItems: "center", justifyContent: "center",
  padding: "0 1rem",
  overflow: "hidden",
};
const imageStyle: React.CSSProperties = {
  maxWidth: "100%", maxHeight: "100%", objectFit: "contain",
  borderRadius: "var(--sp-radius)",
};
// flex column (not grid) — `display:grid` default `grid-template-columns:auto`
// expands the column to fit the widest child, so on mobile the action-row
// would grow to its content's natural width (~740px) and overflow the
// 375px viewport, defeating the inner `flex-wrap`. Flex column constrains
// each child to the container width, letting their internal flex-wrap work.
const footer: React.CSSProperties = {
  padding: "0.75rem 1rem 1rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
  background: "rgba(0,0,0,0.5)",
  flexShrink: 0,
  minWidth: 0,
};
const promptToggleStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--sp-fg)",
  textAlign: "left",
  cursor: "pointer",
  padding: 0,
  width: "100%",
};
const promptLabelStyle: React.CSSProperties = {
  fontSize: "var(--sp-text-xs)",
  color: "rgba(255,255,255,0.7)",
  textTransform: "uppercase",
  letterSpacing: "var(--sp-tracking-caps)",
  fontWeight: 600,
};
// 40×40 circular chips (kit ActionRail pattern from cycle 0071).
const iconBtn: React.CSSProperties = {
  background: "rgba(255,255,255,0.08)",
  color: "var(--sp-fg)",
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: "50%",
  width: 40,
  height: 40,
  padding: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  fontSize: "1.2em",
};
// Action row centers buttons + wraps to a new line when they exceed the
// viewport width on mobile (justify-content: center keeps them visually
// balanced when wrapped, vs flex-end which would push the wrapped row
// off-screen right). flexBasis auto + min-width 0 lets each pill shrink.
const actionRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.5rem",
  justifyContent: "center",
};
// Ghost pill consistent with CharacterForm 0072 ghost pill — adapted with
// literal whites because the panel sits over the opaque-black overlay.
// inline-flex + gap for the leading Lucide icon.
const actionBtn: React.CSSProperties = {
  background: "rgba(255,255,255,0.08)",
  color: "var(--sp-fg)",
  border: "1px solid rgba(255,255,255,0.22)",
  borderRadius: "var(--sp-radius)",
  padding: "0.55rem 1rem",
  cursor: "pointer",
  fontSize: "0.9em",
  fontWeight: 500,
  display: "inline-flex",
  alignItems: "center",
  gap: "0.4rem",
};
const navBtn: React.CSSProperties = {
  position: "absolute", top: "50%", transform: "translateY(-50%)",
  background: "rgba(255,255,255,0.08)",
  color: "var(--sp-fg)",
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: "50%",
  width: 44, height: 44,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "1.5em",
  cursor: "pointer",
};
const blockedCard: React.CSSProperties = {
  color: "var(--sp-fg)",
  padding: "1.25rem",
  border: "1px solid var(--sp-warning)",
  borderRadius: "var(--sp-radius)",
  background: "var(--sp-warning-soft)",
  maxWidth: 360,
  textAlign: "center",
};
const regenPanel: React.CSSProperties = {
  display: "grid", gap: "0.4rem",
  padding: "0.6rem 0.75rem",
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: "var(--sp-radius)",
  background: "rgba(255,255,255,0.05)",
  marginBottom: "0.25rem",
};
const regenRow: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "90px 1fr", gap: "0.5rem", alignItems: "center",
};
const regenLabel: React.CSSProperties = {
  fontSize: "0.8em",
  color: "rgba(255,255,255,0.75)",
};
const regenInput: React.CSSProperties = {
  background: "rgba(0,0,0,0.4)",
  color: "var(--sp-fg)",
  border: "1px solid rgba(255,255,255,0.22)",
  borderRadius: "var(--sp-radius)",
  padding: "0.35rem 0.5rem",
  fontSize: "0.85em",
};
