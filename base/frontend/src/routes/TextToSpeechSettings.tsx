import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSession } from "../lib/session";
import {
  ELEVENLABS_DEFAULT_SLOTS,
  OPENAI_DEFAULT_SLOTS,
  OPENAI_VOICES,
  SPEED_MAX,
  SPEED_MIN,
  listAllTTSProviders,
  listElevenLabsVoices,
  loadTTSPrefs,
  saveTTSPrefs,
  saveTTSVoices,
  setActiveProvider,
  testTTSProvider,
  upsertTTSProvider,
  type ElevenLabsVoice,
  type ProviderFamily,
  type TTSPrefs,
  type TestTTSResult,
  type VoiceSlots,
} from "../lib/ttsProvider";
import type { ProviderConfig } from "../lib/providers";
import { Spinner } from "../lib/Spinner";
import { StatusBanner } from "../lib/StatusBanner";
import { useDocumentTitle } from "../lib/useDocumentTitle";

type Status = "loading" | "ready" | "saving";

const SLOTS: { key: keyof VoiceSlots; label: string; hint: string }[] = [
  { key: "narrator",      label: "Narrator voice",             hint: "*italic* and plain narration segments." },
  { key: "char_male",     label: "Character voice · male",     hint: "character.gender = male." },
  { key: "char_female",   label: "Character voice · female",   hint: "character.gender = female." },
  { key: "char_fallback", label: "Character voice · fallback", hint: "non-binary / unspecified / unset gender." },
];

export function TextToSpeechSettings() {
  useDocumentTitle("Text-to-Speech · Settings");
  const nav = useNavigate();
  const sess = useSession();
  const userId = sess.status === "ready" ? sess.session?.user.id ?? null : null;

  const [status, setStatus] = useState<Status>("loading");
  const [openaiRow, setOpenaiRow] = useState<ProviderConfig | null>(null);
  const [elevenRow, setElevenRow] = useState<ProviderConfig | null>(null);
  const [activeTab, setActiveTab] = useState<ProviderFamily>("openai");

  const [apiKeyOpenAI, setApiKeyOpenAI] = useState("");
  const [apiKeyEleven, setApiKeyEleven] = useState("");
  const [showKeyOpenAI, setShowKeyOpenAI] = useState(false);
  const [showKeyEleven, setShowKeyEleven] = useState(false);

  const [openaiLegacyVoice, setOpenaiLegacyVoice] = useState<string>(OPENAI_DEFAULT_SLOTS.narrator);
  const [elevenLegacyVoice, setElevenLegacyVoice] = useState<string>(ELEVENLABS_DEFAULT_SLOTS.narrator);

  const [prefs, setPrefs] = useState<TTSPrefs>({
    mode: "manual",
    dual_voice: false,
    speed: 1.0,
    volume: 1.0,
    narrator_volume: 1.0,
    character_volume: 1.0,
    openai: { ...OPENAI_DEFAULT_SLOTS },
    elevenlabs: { ...ELEVENLABS_DEFAULT_SLOTS },
  });

  const [elevenVoices, setElevenVoices] = useState<ElevenLabsVoice[] | null>(null);
  const [elevenVoicesLoading, setElevenVoicesLoading] = useState(false);
  const [elevenVoicesErr, setElevenVoicesErr] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestTTSResult | null>(null);

  useEffect(() => {
    if (sess.status !== "ready") return;
    if (!userId) { nav("/sign-in"); return; }
    let cancelled = false;
    (async () => {
      const [rows, loadedPrefs] = await Promise.all([
        listAllTTSProviders(userId),
        loadTTSPrefs(userId),
      ]);
      if (cancelled) return;
      setOpenaiRow(rows.openai);
      setElevenRow(rows.elevenlabs);
      setActiveTab(rows.active ?? "openai");
      setPrefs(loadedPrefs);
      if (rows.openai?.model_id && (OPENAI_VOICES as readonly string[]).includes(rows.openai.model_id)) {
        setOpenaiLegacyVoice(rows.openai.model_id);
      }
      if (rows.elevenlabs?.model_id) {
        setElevenLegacyVoice(rows.elevenlabs.model_id);
      }
      setStatus("ready");
    })();
    return () => { cancelled = true; };
  }, [sess.status, userId, nav]);

  async function onSwitchTab(family: ProviderFamily) {
    setActiveTab(family);
    if (family !== "webspeech") {
      const hasRow = family === "openai" ? openaiRow : elevenRow;
      if (!hasRow) return;
    }
    try {
      await setActiveProvider(family);
    } catch (err) {
      setError(String(err));
    }
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving"); setError(null); setTestResult(null);
    try {
      if (activeTab === "openai") {
        const apiKeyBlank = apiKeyOpenAI.trim().length === 0;
        if (!openaiRow && apiKeyBlank) throw new Error("Enter your OpenAI API key first.");
        const row = await upsertTTSProvider({
          provider_family: "openai",
          api_key: apiKeyBlank ? null : apiKeyOpenAI,
          voice_id: openaiLegacyVoice,
        });
        setOpenaiRow(row);
        setApiKeyOpenAI("");
      } else {
        const apiKeyBlank = apiKeyEleven.trim().length === 0;
        if (!elevenRow && apiKeyBlank) throw new Error("Enter your ElevenLabs API key first.");
        const row = await upsertTTSProvider({
          provider_family: "elevenlabs",
          api_key: apiKeyBlank ? null : apiKeyEleven,
          voice_id: elevenLegacyVoice,
        });
        setElevenRow(row);
        setApiKeyEleven("");
      }

      await saveTTSPrefs({
        mode: prefs.mode,
        dual_voice: prefs.dual_voice,
        speed: prefs.speed,
        volume: prefs.volume,
      });
      await saveTTSVoices("openai", prefs.openai);
      await saveTTSVoices("elevenlabs", prefs.elevenlabs);
    } catch (err) {
      setError(String(err));
    } finally {
      setStatus("ready");
    }
  }

  async function onTest() {
    setTesting(true); setTestResult(null);
    try { setTestResult(await testTTSProvider()); }
    finally { setTesting(false); }
  }

  async function onFetchElevenVoices() {
    setElevenVoicesLoading(true); setElevenVoicesErr(null);
    try {
      setElevenVoices(await listElevenLabsVoices());
    } catch (err) {
      setElevenVoicesErr(String(err));
    } finally {
      setElevenVoicesLoading(false);
    }
  }

  function patchPref<K extends keyof TTSPrefs>(key: K, value: TTSPrefs[K]): void {
    setPrefs((p) => ({ ...p, [key]: value }));
  }
  function patchSlot(family: "openai" | "elevenlabs", slot: keyof VoiceSlots, value: string): void {
    setPrefs((p) => ({ ...p, [family]: { ...p[family], [slot]: value } }));
  }

  if (status === "loading") return <main style={mainStyle}><Spinner testId="tts-loading" /></main>;

  return (
    <main data-testid="tts-settings" style={mainStyle}>
      <header className="sp-settings-header" style={headerStyle}>
        <h1 className="sp-h2 sp-wordmark sp-page-h1">Text-to-Speech</h1>
        <Link to="/settings" className="sp-back-btn">← Back</Link>
      </header>

      <p style={{ color: "var(--sp-fg-3)", marginBottom: "1.25rem" }}>
        Bring your own API key. Keys stay encrypted in the vault and never
        leave the backend unencrypted. The selected tab is the active
        provider for synthesis.
      </p>

      <form onSubmit={onSave} style={{ display: "grid", gap: "1.25rem" }}>

        {/* Provider tabs */}
        <div>
          <p style={sectionLabel}>Provider</p>
          <div style={tabBarStyle} role="tablist">
            {(["openai", "elevenlabs", "webspeech"] as ProviderFamily[]).map((family) => (
              <button
                key={family}
                type="button"
                role="tab"
                data-testid={`tts-tab-${family}`}
                aria-selected={activeTab === family}
                onClick={() => onSwitchTab(family)}
                style={tabBtnStyle(activeTab === family)}
              >
                {family === "openai" ? "OpenAI TTS" : family === "elevenlabs" ? "ElevenLabs" : "WebSpeech"}
              </button>
            ))}
          </div>
        </div>

        {/* OpenAI panel */}
        {activeTab === "openai" && (
          <div data-testid="tts-panel-openai" style={sectionCard} data-form="stack">
            <p style={hintStyle}>
              <code>tts-1</code> model · $15 per 1M chars · 10 standard voices.
            </p>

            <label>
              <span>OpenAI API key</span>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input
                  data-testid="tts-api-key"
                  type={showKeyOpenAI ? "text" : "password"}
                  placeholder={openaiRow?.vault_secret_id ? "••• key stored — enter new to rotate" : "sk-…"}
                  value={apiKeyOpenAI}
                  onChange={(e) => setApiKeyOpenAI(e.target.value)}
                  style={{ flex: 1, display: "block" }}
                />
                <button type="button" onClick={() => setShowKeyOpenAI((v) => !v)} style={ghostSmallBtnStyle}>
                  {showKeyOpenAI ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            <label>
              <span>Voice <span style={hintStyle}>(single-voice fallback)</span></span>
              <select
                data-testid="tts-voice"
                value={openaiLegacyVoice}
                onChange={(e) => setOpenaiLegacyVoice(e.target.value)}
              >
                {OPENAI_VOICES.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              <span style={hintStyle}>Used when dual-voice is off.</span>
            </label>

            {prefs.dual_voice && (
              <div style={{ display: "grid", gap: "0.5rem", paddingLeft: "0.75rem", borderLeft: "2px solid var(--sp-border)" }}>
                <strong style={{ fontSize: "0.9rem" }}>Dual-voice slots</strong>
                {SLOTS.map(({ key, label, hint }) => (
                  <label key={key}>
                    <span>{label}</span>
                    <select
                      data-testid={`tts-openai-${key.replace(/_/g, "-")}`}
                      value={prefs.openai[key]}
                      onChange={(e) => patchSlot("openai", key, e.target.value)}
                    >
                      {OPENAI_VOICES.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                    <span style={hintStyle}>{hint}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ElevenLabs panel */}
        {activeTab === "elevenlabs" && (
          <div data-testid="tts-panel-elevenlabs" style={sectionCard} data-form="stack">
            <p style={hintStyle}>
              <code>eleven_multilingual_v2</code> model · richer voices · ~12× cost vs OpenAI.
            </p>

            <label>
              <span>ElevenLabs API key</span>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input
                  data-testid="tts-api-key-elevenlabs"
                  type={showKeyEleven ? "text" : "password"}
                  placeholder={elevenRow?.vault_secret_id ? "••• key stored — enter new to rotate" : "sk_…"}
                  value={apiKeyEleven}
                  onChange={(e) => setApiKeyEleven(e.target.value)}
                  style={{ flex: 1, display: "block" }}
                />
                <button type="button" onClick={() => setShowKeyEleven((v) => !v)} style={ghostSmallBtnStyle}>
                  {showKeyEleven ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                data-testid="tts-fetch-eleven-voices"
                onClick={onFetchElevenVoices}
                disabled={!elevenRow || elevenVoicesLoading}
                title={!elevenRow ? "Save a key first" : undefined}
                style={ghostBtnStyle}
              >
                {elevenVoicesLoading ? "Fetching…" : "Fetch my voices"}
              </button>
              <span style={hintStyle}>
                {elevenVoices
                  ? `${elevenVoices.length} voices available`
                  : "Optional: fetches your catalog to enumerate in the pickers."}
              </span>
            </div>
            {elevenVoicesErr && (
              <StatusBanner tone="error" testid="tts-eleven-voices-error" role="alert">{elevenVoicesErr}</StatusBanner>
            )}

            <ElevenLabsSlotInput
              testid="tts-voice-elevenlabs"
              label="Voice (single-voice fallback)"
              hint="Used when dual-voice is off."
              value={elevenLegacyVoice}
              onChange={setElevenLegacyVoice}
              voices={elevenVoices}
            />

            {prefs.dual_voice && (
              <div style={{ display: "grid", gap: "0.5rem", paddingLeft: "0.75rem", borderLeft: "2px solid var(--sp-border)" }}>
                <strong style={{ fontSize: "0.9rem" }}>Dual-voice slots</strong>
                {SLOTS.map(({ key, label, hint }) => (
                  <ElevenLabsSlotInput
                    key={key}
                    testid={`tts-elevenlabs-${key.replace(/_/g, "-")}`}
                    label={label}
                    hint={hint}
                    value={prefs.elevenlabs[key]}
                    onChange={(v) => patchSlot("elevenlabs", key, v)}
                    voices={elevenVoices}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* WebSpeech panel */}
        {activeTab === "webspeech" && (
          <div data-testid="tts-panel-webspeech" style={{ ...sectionCard, gap: "0.5rem" }}>
            <p style={hintStyle}>
              Free · on-device · uses your browser&apos;s built-in speech synthesis.
              No API key needed. Voice catalog depends on your browser + OS.
              Audio is not cached in the cloud — re-synthesized each play.
            </p>
            <StatusBanner tone="success" testid="tts-webspeech-ready" role="status">
              WebSpeech is ready — no configuration needed. Voices come from
              your browser. Speed and volume sliders below apply.
            </StatusBanner>
          </div>
        )}

        {/* Playback mode */}
        <div>
          <p style={sectionLabel}>Playback mode</p>
          <div style={groupCard}>
            <label className="sp-row-interactive" style={radioRowStyle(false)}>
              <input
                type="radio"
                name="tts-mode"
                data-testid="tts-mode-manual"
                checked={prefs.mode === "manual"}
                onChange={() => patchPref("mode", "manual")}
              />
              <span><strong>Manual</strong></span>
              <span style={hintStyle}>— tap ▶ on each reply</span>
            </label>
            <label className="sp-row-interactive" style={radioRowStyle(true)}>
              <input
                type="radio"
                name="tts-mode"
                data-testid="tts-mode-auto"
                checked={prefs.mode === "auto"}
                onChange={() => patchPref("mode", "auto")}
              />
              <span><strong>Auto</strong></span>
              <span style={hintStyle}>— auto-play every new assistant reply</span>
            </label>
          </div>
        </div>

        {/* Dual-voice */}
        <div>
          <p style={sectionLabel}>Dual-voice routing</p>
          <div style={groupCard}>
            <label className="sp-row-interactive" style={toggleRowStyle}>
              <span style={{ flex: 1 }}>
                <strong>Use different voices for narration and dialogue</strong>
                <span style={{ ...hintStyle, display: "block" }}>
                  <code>*italic*</code> narration plays in the narrator voice.
                  <code> "quoted dialogue"</code> plays in the character voice,
                  matched by <code>character.gender</code>.
                </span>
              </span>
              <input
                type="checkbox"
                className="sp-toggle"
                data-testid="tts-dual-voice"
                checked={prefs.dual_voice}
                onChange={(e) => patchPref("dual_voice", e.target.checked)}
              />
            </label>
          </div>
        </div>

        {/* Speed + volume */}
        <div>
          <p style={sectionLabel}>Playback controls</p>
          <div style={groupCard} data-form="stack">
            <label style={sliderRowStyle(false)}>
              <span>
                Speed · <strong data-testid="tts-speed-val">{prefs.speed.toFixed(2)}×</strong>
                <span style={{ ...hintStyle, display: "block" }}>Applied at playback ({SPEED_MIN}×–{SPEED_MAX}×). Pitch preserved.</span>
              </span>
              <input
                data-testid="tts-speed"
                type="range"
                className="sp-range"
                min={SPEED_MIN} max={SPEED_MAX} step={0.05}
                value={prefs.speed}
                onChange={(e) => patchPref("speed", Number(e.target.value))}
              />
            </label>

            {!prefs.dual_voice ? (
              <label style={sliderRowStyle(true)}>
                <span>Volume · <strong data-testid="tts-volume-val">{Math.round(prefs.volume * 100)}%</strong></span>
                <input
                  data-testid="tts-volume"
                  type="range"
                  className="sp-range"
                  min={0} max={1} step={0.05}
                  value={prefs.volume}
                  onChange={(e) => patchPref("volume", Number(e.target.value))}
                />
              </label>
            ) : (
              <>
                <label style={sliderRowStyle(false)}>
                  <span>
                    Narrator volume · <strong data-testid="tts-narrator-volume-val">{Math.round(prefs.narrator_volume * 100)}%</strong>
                    <span style={{ ...hintStyle, display: "block" }}>Volume for *italic* narration segments.</span>
                  </span>
                  <input
                    data-testid="tts-narrator-volume"
                    type="range"
                    className="sp-range"
                    min={0} max={1} step={0.05}
                    value={prefs.narrator_volume}
                    onChange={(e) => patchPref("narrator_volume", Number(e.target.value))}
                  />
                </label>
                <label style={sliderRowStyle(true)}>
                  <span>
                    Character volume · <strong data-testid="tts-character-volume-val">{Math.round(prefs.character_volume * 100)}%</strong>
                    <span style={{ ...hintStyle, display: "block" }}>Volume for &quot;quoted dialogue&quot; segments.</span>
                  </span>
                  <input
                    data-testid="tts-character-volume"
                    type="range"
                    className="sp-range"
                    min={0} max={1} step={0.05}
                    value={prefs.character_volume}
                    onChange={(e) => patchPref("character_volume", Number(e.target.value))}
                  />
                </label>
              </>
            )}
          </div>
        </div>

        {error && <StatusBanner tone="error" testid="tts-error" role="alert">{error}</StatusBanner>}

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <button type="submit" data-testid="tts-save" disabled={status === "saving"} style={saveBtnStyle(status === "saving")}>
            {status === "saving" ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            data-testid="tts-test"
            onClick={onTest}
            disabled={testing || !(activeTab === "openai" ? openaiRow : elevenRow)}
            title={!(activeTab === "openai" ? openaiRow : elevenRow) ? "Save a key first, then test" : undefined}
            style={ghostBtnStyle}
          >
            {testing ? "Testing…" : "Test voice"}
          </button>
        </div>

        {testResult && (
          <StatusBanner
            tone={testResult.ok ? "success" : "error"}
            testid="tts-test-result"
            role="status"
          >
            {testResult.ok ? "OK — audio played" : `Failed: ${testResult.error ?? "unknown"}`}
          </StatusBanner>
        )}
      </form>
    </main>
  );
}

/** ElevenLabs voice input — dropdown when catalogue fetched, text input as fallback. */
function ElevenLabsSlotInput(props: {
  testid: string;
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  voices: ElevenLabsVoice[] | null;
}): JSX.Element {
  const { testid, label, hint, value, onChange, voices } = props;
  return (
    <label>
      <span>{label}</span>
      {voices && voices.length > 0 ? (
        <select
          data-testid={testid}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {!voices.some((v) => v.voice_id === value) && value && (
            <option value={value}>{value} (custom)</option>
          )}
          {voices.map((v) => (
            <option key={v.voice_id} value={v.voice_id}>
              {v.name}{v.gender ? ` (${v.gender})` : ""}
            </option>
          ))}
        </select>
      ) : (
        <input
          data-testid={testid}
          placeholder="voice_id (e.g. 21m00Tcm4TlvDq8ikWAM)"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      <span style={hintStyle}>{hint}</span>
    </label>
  );
}

const mainStyle: React.CSSProperties = { maxWidth: 640, margin: "2rem auto", padding: "0 1rem" };
const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1.75rem" };
const hintStyle: React.CSSProperties = { fontSize: "0.8rem", color: "var(--sp-fg-3)" };

const sectionLabel: React.CSSProperties = {
  fontSize: "var(--sp-text-xs)",
  fontWeight: 600,
  letterSpacing: "var(--sp-tracking-caps)",
  textTransform: "uppercase",
  color: "var(--sp-fg-3)",
  paddingLeft: 4,
  margin: "0 0 0.5rem",
};

const sectionCard: React.CSSProperties = { background: "var(--sp-bg-2)", border: "1px solid var(--sp-border)", borderRadius: "var(--sp-radius)", padding: "1rem", display: "grid", gap: "0.85rem" };

const groupCard: React.CSSProperties = {
  background: "var(--sp-bg-2)",
  border: "1px solid var(--sp-border)",
  borderRadius: "var(--sp-radius)",
  overflow: "hidden",
};

const tabBarStyle: React.CSSProperties = {
  display: "flex",
  background: "var(--sp-bg-2)",
  border: "1px solid var(--sp-border)",
  borderRadius: "var(--sp-radius)",
  padding: 3,
  gap: 2,
  alignSelf: "start",
};

function tabBtnStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? "var(--sp-bg)" : "transparent",
    color: active ? "var(--sp-fg)" : "var(--sp-fg-3)",
    border: active ? "1px solid var(--sp-border)" : "1px solid transparent",
    borderRadius: "var(--sp-radius)",
    padding: "0.35rem 0.9rem",
    fontWeight: active ? 600 : 400,
    fontFamily: "inherit",
    fontSize: "0.9em",
    cursor: "pointer",
    transition: "background 160ms var(--sp-ease)",
  };
}

const toggleRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "0.85rem 1rem",
  gap: "1rem",
  cursor: "pointer",
};

function radioRowStyle(isLast: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: "0.65rem",
    padding: "0.75rem 1rem",
    borderBottom: isLast ? "none" : "1px solid var(--sp-border-soft)",
    cursor: "pointer",
  };
}

function sliderRowStyle(isLast: boolean): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "1fr 160px",
    gap: "0.75rem",
    alignItems: "center",
    padding: "0.85rem 1rem",
    borderBottom: isLast ? "none" : "1px solid var(--sp-border-soft)",
  };
}

const ghostBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--sp-border)",
  color: "var(--sp-fg-2)",
  borderRadius: "var(--sp-radius)",
  padding: "0.45rem 1rem",
  fontWeight: 500,
  fontFamily: "inherit",
  fontSize: "0.9em",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const ghostSmallBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--sp-border)",
  color: "var(--sp-fg-2)",
  borderRadius: "var(--sp-radius)",
  padding: "0.25rem 0.7rem",
  fontWeight: 500,
  fontFamily: "inherit",
  fontSize: "0.8em",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

function saveBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    background: disabled ? "var(--sp-bg-3)" : "var(--sp-brand-1)",
    color: disabled ? "var(--sp-fg-4)" : "var(--sp-fg-on-brand)",
    border: "none",
    borderRadius: "var(--sp-radius)",
    padding: "0.5rem 1.25rem",
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: disabled ? "not-allowed" : "pointer",
  };
}
