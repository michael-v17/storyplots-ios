import { useEffect, useState } from "react";
import {
  clearChatControlsState,
  loadChatControlsState,
  upsertChatControlsState,
  type ChatControlsState,
} from "../../lib/chatControlsState";
import { RESOLUTION_PRESETS, labelForPreset } from "../../lib/images";
import { supabase } from "../../lib/supabase";
import { panelBackBtnStyle, panelFieldStyle, panelTitleStyle, primaryPillStyle } from "./panelStyles";
import { Spinner } from "../../lib/Spinner";

type ImageProvider = {
  id: string;
  provider_family: string;
  base_url: string | null;
  is_active: boolean;
};

type Props = {
  conversationId: string;
  userId: string;
  onBack: () => void;
  onChanged: (state: ChatControlsState | null) => void;
};

export function GenerationOverridePanel({ conversationId, userId, onBack, onChanged }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [providers, setProviders] = useState<ImageProvider[]>([]);
  const [override, setOverride] = useState<string>("");            // empty = use active
  const [preset, setPreset] = useState<string>("");                // empty = inherit default
  const [customPreset, setCustomPreset] = useState<string>("");    // used when preset === "custom"
  const [autoImages, setAutoImages] = useState<"inherit" | "on" | "off">("inherit");
  const [autoTts, setAutoTts] = useState<"inherit" | "on" | "off">("inherit");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [state, provRows] = await Promise.all([
        loadChatControlsState(conversationId),
        supabase
          .from("provider_configs")
          .select("id, provider_family, base_url, is_active")
          .eq("kind", "image"),
      ]);
      if (cancelled) return;
      setProviders((provRows.data as ImageProvider[] | null) ?? []);
      if (state) {
        setOverride(state.image_provider_override_id ?? "");
        if (state.resolution_preset?.startsWith("custom_")) {
          setPreset("custom");
          setCustomPreset(state.resolution_preset.slice("custom_".length));
        } else {
          setPreset(state.resolution_preset ?? "");
        }
        if (state.auto_images === true) setAutoImages("on");
        else if (state.auto_images === false) setAutoImages("off");
        else setAutoImages("inherit");
        if (state.auto_tts === true) setAutoTts("on");
        else if (state.auto_tts === false) setAutoTts("off");
        else setAutoTts("inherit");
      }
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [conversationId]);

  async function onSave() {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const resolution_preset =
        preset === "custom"
          ? (customPreset.trim() ? `custom_${customPreset.trim()}` : null)
          : (preset || null);
      const auto_images =
        autoImages === "on" ? true :
        autoImages === "off" ? false :
        null;
      const auto_tts =
        autoTts === "on" ? true :
        autoTts === "off" ? false :
        null;
      const state = await upsertChatControlsState(userId, conversationId, {
        image_provider_override_id: override || null,
        resolution_preset,
        auto_images,
        auto_tts,
      });
      onChanged(state);
      onBack();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onReset() {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      await clearChatControlsState(conversationId);
      onChanged(null);
      onBack();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return <aside style={panelStyle}><Spinner testId="gen-override-loading" /></aside>;

  return (
    <aside data-testid="generation-override-panel" style={panelStyle}>
      <header style={headerStyle}>
        <button type="button" data-testid="gen-override-back" onClick={onBack} style={panelBackBtnStyle}>← Back</button>
        <h3 style={panelTitleStyle}>Generation overrides</h3>
      </header>
      <p style={{ margin: 0, color: "var(--sp-fg-3)", fontSize: "0.85em" }}>
        Per-Conversation overrides for image generation. Global defaults
        apply when a field is left blank.
      </p>

      <label style={{ display: "grid", gap: "0.25rem" }}>
        <span>Image provider</span>
        <select
          data-testid="gen-override-provider"
          value={override}
          onChange={(e) => setOverride(e.target.value)}
          style={panelFieldStyle}
        >
          <option value="">Use active provider</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.provider_family} · {p.base_url || "(no URL)"}{p.is_active ? "" : " (inactive)"}
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: "grid", gap: "0.25rem" }}>
        <span>Resolution preset</span>
        <select
          data-testid="gen-override-resolution"
          value={preset}
          onChange={(e) => setPreset(e.target.value)}
          style={panelFieldStyle}
        >
          <option value="">Use default ({labelForPreset(null)})</option>
          {RESOLUTION_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>{p.label} ({p.dims[0]}×{p.dims[1]})</option>
          ))}
          <option value="custom">Custom…</option>
        </select>
      </label>

      {preset === "custom" && (
        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span>Custom dimensions (e.g. <code>1536x1024</code>)</span>
          <input
            type="text"
            data-testid="gen-override-custom"
            value={customPreset}
            onChange={(e) => setCustomPreset(e.target.value)}
            placeholder="WIDTHxHEIGHT"
            style={panelFieldStyle}
          />
        </label>
      )}

      <label style={{ display: "grid", gap: "0.25rem" }}>
        <span>Auto-generate images for this conversation</span>
        <select
          data-testid="gen-override-auto-images"
          value={autoImages}
          onChange={(e) => setAutoImages(e.target.value as "inherit" | "on" | "off")}
          style={panelFieldStyle}
        >
          <option value="inherit">Inherit default (from Visual Roleplay settings)</option>
          <option value="on">Force on</option>
          <option value="off">Force off</option>
        </select>
      </label>

      <label style={{ display: "grid", gap: "0.25rem" }}>
        <span>Auto-play TTS for this conversation</span>
        <select
          data-testid="gen-override-auto-tts"
          value={autoTts}
          onChange={(e) => setAutoTts(e.target.value as "inherit" | "on" | "off")}
          style={panelFieldStyle}
        >
          <option value="inherit">Inherit default (from Text-to-Speech settings)</option>
          <option value="on">Force on</option>
          <option value="off">Force off</option>
        </select>
      </label>

      {error && <p role="alert" style={{ color: "var(--sp-destructive)", margin: 0 }}>{error}</p>}

      <div style={actionRowStyle}>
        <button type="button" data-testid="gen-override-reset" onClick={onReset} disabled={busy} style={ghostPillStyle(busy)}>
          Use defaults
        </button>
        <button type="button" data-testid="gen-override-save" onClick={onSave} disabled={busy} style={primaryPillStyle(busy)}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </aside>
  );
}

// Action row sits a touch lower than the form gap and pins right — the
// destructive/commit pair reads as a footer, not another field.
const actionRowStyle: React.CSSProperties = {
  display: "flex", gap: "0.5rem", justifyContent: "flex-end",
  marginTop: "0.5rem", flexWrap: "wrap",
};
const panelStyle: React.CSSProperties = {
  position: "relative", display: "grid", gap: "0.75rem",
  // alignContent:start so the grid doesn't stretch its rows to fill the
  // height:100% panel — that stretching was a chunk of the "inputs muy
  // altos" the creator flagged.
  alignContent: "start",
  padding: "1rem", background: "var(--sp-bg-2)",
  borderLeft: "1px solid var(--sp-border)",
  color: "var(--sp-fg)",
  width: 360, height: "100%", overflowY: "auto",
};
const headerStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "0.5rem",
};
function ghostPillStyle(disabled: boolean): React.CSSProperties {
  return {
    background: "transparent",
    border: "1px solid var(--sp-border)",
    color: "var(--sp-fg-2)",
    borderRadius: "var(--sp-radius)",
    padding: "0.45rem 1rem", fontWeight: 600, fontFamily: "inherit",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
  };
}
