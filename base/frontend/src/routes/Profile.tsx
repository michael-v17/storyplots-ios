import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSession } from "../lib/session";
import {
  avatarUrl,
  clearPersona,
  loadPersona,
  savePersona,
  uploadAvatar,
  type Appearance,
  type Persona,
  type PersonaDraft,
} from "../lib/persona";
import { generatePersonaAvatar, NoImageEngineError } from "../lib/avatarGenerate";
import { StatusBanner } from "../lib/StatusBanner";
import { Spinner } from "../lib/Spinner";
import { useDocumentTitle } from "../lib/useDocumentTitle";

type GenState =
  | { kind: "idle" }
  | { kind: "generating"; abort: () => void }
  | { kind: "no_engine" }
  | { kind: "error"; message: string };

type Status = "loading" | "ready" | "saving" | "error";

const GENDER_OPTIONS = ["", "Male", "Female", "Non-binary", "Prefer not to say"] as const;

const emptyAppearance: Appearance = { skin: "", eyes: "", hair: "", extras: "" };

function draftFrom(p: Persona | null): PersonaDraft {
  return {
    name: p?.name ?? "",
    gender: p?.gender ?? "",
    appearance: p?.appearance ?? { ...emptyAppearance },
    background_story: p?.background_story ?? "",
    photo_ref: p?.photo_ref ?? null,
  };
}

export function Profile() {
  useDocumentTitle("Profile");
  const nav = useNavigate();
  const sess = useSession();
  const session = sess.status === "ready" ? sess.session : null;

  const [status, setStatus] = useState<Status>("loading");
  const [persona, setPersona] = useState<Persona | null>(null);
  const [draft, setDraft] = useState<PersonaDraft>(draftFrom(null));
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [genState, setGenState] = useState<GenState>({ kind: "idle" });
  const [avatarLightbox, setAvatarLightbox] = useState(false);

  useEffect(() => {
    if (sess.status !== "ready") return;
    if (!session) { nav("/sign-in"); return; }
    let cancelled = false;
    (async () => {
      try {
        const p = await loadPersona(session.user.id);
        if (cancelled) return;
        setPersona(p);
        setDraft(draftFrom(p));
        setPhotoUrl(await avatarUrl(p?.photo_ref ?? null));
        setStatus("ready");
      } catch (e) {
        if (!cancelled) { setError(String(e)); setStatus("error"); }
      }
    })();
    return () => { cancelled = true; };
  }, [sess.status, session?.user.id]);

  function fail(err: unknown) {
    setError(String(err));
    setStatus("error");
  }

  if (status === "loading") {
    return <main style={{ maxWidth: 560, margin: "2rem auto", padding: "0 1rem" }}><Spinner testId="profile-loading" /></main>;
  }
  if (!session) return null;

  const isEmpty = persona === null;
  const appearance = draft.appearance ?? emptyAppearance;

  function setAppearance(patch: Partial<Appearance>) {
    setDraft((d) => ({ ...d, appearance: { ...(d.appearance ?? emptyAppearance), ...patch } }));
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !session) return;
    setStatus("saving"); setError(null);
    try {
      const path = await uploadAvatar(session.user.id, file, draft.photo_ref);
      setDraft((d) => ({ ...d, photo_ref: path }));
      setPhotoUrl(await avatarUrl(path));
      setStatus("ready");
    } catch (err) {
      fail(err);
    }
  }

  async function onGenerateAvatar() {
    if (!session) return;
    // Persona must exist server-side so the endpoint can update its
    // photo_ref. If the user is still drafting a fresh persona, save it
    // first with whatever fields they've typed.
    if (!persona) {
      if (!draft.name.trim()) {
        setError("Enter a name first, then try Generate.");
        return;
      }
      try {
        const saved = await savePersona(session.user.id, {
          ...draft,
          name: draft.name.trim(),
          gender: draft.gender || null,
        });
        setPersona(saved);
      } catch (e) { fail(e); return; }
    }
    const abortCtrl = new AbortController();
    setGenState({ kind: "generating", abort: () => abortCtrl.abort() });
    setError(null);
    try {
      const result = await generatePersonaAvatar(abortCtrl.signal);
      setDraft((d) => ({ ...d, photo_ref: result.photo_ref }));
      setPhotoUrl(await avatarUrl(result.photo_ref));
      setPersona((p) => p ? { ...p, photo_ref: result.photo_ref } : p);
      setGenState({ kind: "idle" });
    } catch (err) {
      if (abortCtrl.signal.aborted) { setGenState({ kind: "idle" }); return; }
      if (err instanceof NoImageEngineError) { setGenState({ kind: "no_engine" }); return; }
      setGenState({ kind: "error", message: (err as Error).message });
    }
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !draft.name.trim()) return;
    setStatus("saving"); setError(null);
    try {
      const saved = await savePersona(session.user.id, {
        ...draft,
        name: draft.name.trim(),
        gender: draft.gender || null,
      });
      setPersona(saved);
      setDraft(draftFrom(saved));
      setStatus("ready");
    } catch (err) {
      fail(err);
    }
  }

  async function onClear() {
    if (!session || !persona) return;
    if (!window.confirm("Clear your persona? This cannot be undone.")) return;
    setStatus("saving"); setError(null);
    try {
      await clearPersona(session.user.id, persona.photo_ref);
      setPersona(null);
      setDraft(draftFrom(null));
      setPhotoUrl(null);
      setStatus("ready");
    } catch (err) {
      fail(err);
    }
  }

  const saving = status === "saving";
  const generating = genState.kind === "generating";
  const canSave = !saving && draft.name.trim().length > 0;

  return (
    <main data-testid="profile" className="sp-page-content" style={{ maxWidth: 560, margin: "2rem auto", padding: "0 1rem" }}>
      <h1 className="sp-h2 sp-wordmark sp-page-h1">{isEmpty ? "Set up your persona" : "Your persona"}</h1>

      <form onSubmit={onSave} data-form="stack" style={{ display: "grid", gap: "0.75rem" }}>
        <section style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
          <AvatarPreview
            photoUrl={photoUrl}
            onOpen={() => { if (photoUrl) setAvatarLightbox(true); }}
          />
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
            <label
              data-testid="upload-photo"
              style={{
                ...ghostPillStyle,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.5 : 1,
              }}
            >
              Upload photo
              <input type="file" accept="image/*" disabled={saving} onChange={onUpload} style={{ display: "none" }} />
            </label>
            <button
              type="button"
              data-testid="generate-photo"
              onClick={onGenerateAvatar}
              disabled={saving || generating}
              style={primaryPillStyle(saving || generating)}
            >
              {generating ? "Generating…" : "🎨 Generate with AI"}
            </button>
            {generating && (
              <button
                type="button"
                data-testid="generate-photo-cancel"
                onClick={genState.abort}
                style={ghostPillStyle}
              >
                Cancel
              </button>
            )}
          </div>
          {genState.kind === "no_engine" && (
            <StatusBanner tone="warning" testid="generate-photo-no-engine">
              Configure an image engine in <Link to="/settings/image-engine">Settings → Image Engine</Link> first.
            </StatusBanner>
          )}
          {genState.kind === "error" && (
            <StatusBanner tone="error" testid="generate-photo-error" role="alert">
              Generation failed: {genState.message}
            </StatusBanner>
          )}
        </section>

        <label>
          Name
          <input
            data-testid="name"
            required
            placeholder="What should characters call you?"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
        </label>

        <label>
          Gender
          <select
            data-testid="gender"
            value={draft.gender ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, gender: e.target.value }))}
          >
            {GENDER_OPTIONS.map((g) => (
              <option key={g} value={g}>{g === "" ? "—" : g}</option>
            ))}
          </select>
        </label>

        <fieldset style={{ display: "grid", gap: "0.5rem" }}>
          <legend>Appearance</legend>
          <label>Skin<input data-testid="skin" value={appearance.skin ?? ""} onChange={(e) => setAppearance({ skin: e.target.value })} /></label>
          <label>Eyes<input data-testid="eyes" value={appearance.eyes ?? ""} onChange={(e) => setAppearance({ eyes: e.target.value })} /></label>
          <label>Hair<input data-testid="hair" value={appearance.hair ?? ""} onChange={(e) => setAppearance({ hair: e.target.value })} /></label>
          <label>Extras<input data-testid="extras" value={appearance.extras ?? ""} onChange={(e) => setAppearance({ extras: e.target.value })} /></label>
        </fieldset>

        <label>
          Background story
          <textarea
            data-testid="background"
            rows={4}
            value={draft.background_story ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, background_story: e.target.value }))}
          />
        </label>

        {error && (
          <StatusBanner tone="error" testid="profile-error" role="alert">{error}</StatusBanner>
        )}

        <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap", marginTop: "0.25rem" }}>
          <button type="submit" data-testid="save" disabled={!canSave} style={primaryPillStyle(!canSave)}>
            {saving ? "Saving…" : "Save"}
          </button>
          {!isEmpty && (
            <button type="button" data-testid="clear" disabled={saving} onClick={onClear} style={destructivePillStyle}>
              Clear persona
            </button>
          )}
          <Link to="/" style={{ fontSize: "0.9em" }}>Cancel</Link>
        </div>
      </form>

      {avatarLightbox && photoUrl && (
        <AvatarLightbox src={photoUrl} onClose={() => setAvatarLightbox(false)} />
      )}
    </main>
  );
}

function AvatarPreview({ photoUrl, onOpen }: { photoUrl: string | null; onOpen: () => void }) {
  const ringStyle: React.CSSProperties = {
    width: 120,
    height: 120,
    borderRadius: "50%",
    // Double-shadow: inner `--sp-bg` 3px gap, outer `--sp-brand-1` 5px ring.
    // Persona has no `--char-accent`, so brand-1 is the canonical fallback
    // (matches kit wordmark + primary CTA accent hierarchy).
    boxShadow: "0 0 0 3px var(--sp-bg), 0 0 0 5px var(--sp-brand-1)",
    border: "none",
    padding: 0,
    display: "block",
    ...(photoUrl
      ? {
          backgroundImage: `url(${photoUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          cursor: "zoom-in",
        }
      : { background: "var(--sp-bg-3)", cursor: "default" }),
  };

  if (photoUrl) {
    return (
      <button
        type="button"
        data-testid="profile-avatar-open"
        aria-label="View persona photo full size"
        onClick={onOpen}
        style={ringStyle}
      />
    );
  }
  return (
    <div
      data-testid="profile-avatar-empty"
      aria-label="No persona photo yet"
      role="img"
      style={{
        ...ringStyle,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--sp-fg-3)",
        fontSize: 36,
      }}
    >
      ＋
    </div>
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
      aria-label="Persona avatar preview"
      data-testid="profile-avatar-lightbox"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        // Opaque `--sp-bg` — matches ImageViewer 0075 + CharacterForm 0076 carry-over.
        background: "var(--sp-bg)",
        display: "flex", flexDirection: "column", color: "var(--sp-fg)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "0.75rem 1rem" }}>
        <button
          type="button"
          data-testid="profile-avatar-lightbox-close"
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          style={{
            background: "transparent", color: "var(--sp-fg)",
            border: "1px solid var(--sp-border)", borderRadius: "var(--sp-radius)",
            padding: "0.35rem 0.65rem", cursor: "pointer", fontSize: "1.1em",
            fontFamily: "inherit",
          }}
        >
          ×
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
          alt="Persona avatar full size"
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

const destructivePillStyle: React.CSSProperties = {
  ...basePillStyle,
  border: "1px solid var(--sp-destructive-soft)",
  color: "var(--sp-destructive)",
};
