import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { testConnection, type TestConnectionResult } from "../lib/chat";
import { useSession } from "../lib/session";
import { supabase } from "../lib/supabase";
import {
  TEXT_PROVIDERS,
  deleteProvider,
  isCloudProvider,
  listActiveTextProvider,
  upsertTextProvider,
  type ProviderConfig,
} from "../lib/providers";
import {
  CHARACTER_CREATION_PREFS_DEFAULTS,
  loadCharacterCreationPrefs,
  saveCharacterCreationPrefs,
  type CharacterCreationPrefs,
} from "../lib/characterCreationPrefs";
import {
  SAMPLER_PREFS_DEFAULTS,
  loadSamplerPrefs,
  saveSamplerPrefs,
  type SamplerPrefs,
} from "../lib/samplerPrefs";
import { Spinner } from "../lib/Spinner";
import { StatusBanner } from "../lib/StatusBanner";
import { useDocumentTitle } from "../lib/useDocumentTitle";

type Status = "loading" | "ready" | "saving" | "error";

export function TextEngineSettings() {
  useDocumentTitle("Text Engine · Settings");
  const nav = useNavigate();
  const sess = useSession();
  const userId = sess.status === "ready" ? sess.session?.user.id ?? null : null;

  const [status, setStatus] = useState<Status>("loading");
  const [existing, setExisting] = useState<ProviderConfig | null>(null);
  const [providerFamily, setProviderFamily] = useState("OpenRouter");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [modelId, setModelId] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(8192);
  const [contextLength, setContextLength] = useState(32768);
  const [thinkingMode, setThinkingMode] = useState(false);
  const [consentAck, setConsentAck] = useState(false);
  const [consentAt, setConsentAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);
  const [ccPrefs, setCcPrefs] = useState<CharacterCreationPrefs>(CHARACTER_CREATION_PREFS_DEFAULTS);
  const [samplerPrefs, setSamplerPrefs] = useState<SamplerPrefs>(SAMPLER_PREFS_DEFAULTS);

  useEffect(() => {
    if (sess.status !== "ready") return;
    if (!userId) { nav("/sign-in"); return; }
    let cancelled = false;
    (async () => {
      try {
        const [row, userRow, cc, sp] = await Promise.all([
          listActiveTextProvider(),
          supabase.from("users").select("preferences").eq("id", userId).single(),
          loadCharacterCreationPrefs(userId),
          loadSamplerPrefs(userId),
        ]);
        if (cancelled) return;
        setExisting(row);
        if (row) {
          setProviderFamily(row.provider_family);
          setBaseUrl(row.base_url ?? defaultBaseUrl(row.provider_family));
          setModelId(row.model_id ?? "");
          setTemperature(row.temperature ?? 0.7);
          setMaxTokens(row.max_tokens ?? 8192);
          setContextLength(row.context_length ?? 32768);
          setThinkingMode(row.thinking_mode);
        } else {
          setBaseUrl(defaultBaseUrl("OpenRouter"));
        }
        const prefs = userRow.data?.preferences as { security?: { cloud_consent_at?: string | null } } | null;
        setConsentAt(prefs?.security?.cloud_consent_at ?? null);
        setCcPrefs(cc);
        setSamplerPrefs(sp);
        setStatus("ready");
      } catch (e) {
        if (!cancelled) { setError(String(e)); setStatus("error"); }
      }
    })();
    return () => { cancelled = true; };
  }, [sess.status, userId]);

  function onProviderChange(next: string) {
    setProviderFamily(next);
    const oldDefault = defaultBaseUrl(providerFamily);
    if (!baseUrl || baseUrl === oldDefault) {
      setBaseUrl(defaultBaseUrl(next));
    }
  }

  const cloudPicked = isCloudProvider(providerFamily);
  const needsConsent = cloudPicked && !consentAt;

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    if (needsConsent && !consentAck) return;
    setStatus("saving"); setError(null);
    try {
      if (needsConsent && consentAck) {
        const { data: stampedAt, error: stampErr } = await supabase.rpc("stamp_cloud_consent");
        if (stampErr) throw stampErr;
        setConsentAt(stampedAt as string);
      }
      const trimmedModelId = modelId.trim();
      const saved = await upsertTextProvider({
        provider_family: providerFamily,
        base_url: baseUrl || null,
        api_key: apiKey.trim() === "" ? null : apiKey,
        model_id: trimmedModelId === "" ? null : trimmedModelId,
        temperature,
        max_tokens: maxTokens,
        context_length: contextLength,
        thinking_mode: thinkingMode,
      });
      // Cycle 0114 — bundle character_creation prefs into the same Save.
      // Independent storage (users.preferences vs provider_configs) but UX-wise
      // both belong to "how I want the text engine to behave."
      await saveCharacterCreationPrefs(userId, ccPrefs);
      // Cycle 0116 — sampler hygiene bundle save.
      await saveSamplerPrefs(userId, samplerPrefs);
      setExisting(saved);
      setApiKey("");
      setStatus("ready");
    } catch (e) {
      setError(String(e)); setStatus("error");
    }
  }

  async function onDelete() {
    if (!existing) return;
    if (!window.confirm("Delete this provider? The stored key will be erased.")) return;
    setStatus("saving"); setError(null);
    try {
      await deleteProvider(existing.id);
      setExisting(null);
      setApiKey("");
      setModelId("");
      setStatus("ready");
    } catch (e) {
      setError(String(e)); setStatus("error");
    }
  }

  if (status === "loading") return <main style={mainStyle}><Spinner testId="text-engine-loading" /></main>;

  const saving = status === "saving";
  const hasStoredKey = !!existing?.vault_secret_id;
  const canSave = !saving && (!needsConsent || consentAck);

  return (
    <main data-testid="text-engine" style={mainStyle}>
      <header className="sp-settings-header" style={headerStyle}>
        <h1 className="sp-h2 sp-wordmark sp-page-h1">Text Engine</h1>
        <Link to="/settings" className="sp-back-btn">← Back</Link>
      </header>
      <p style={{ color: "var(--sp-fg-3)", marginBottom: "1.25rem" }}>
        BYOK provider for chat. The Conversation Agent uses the selected model.
      </p>

      <form onSubmit={onSave} data-form="stack" style={{ display: "grid", gap: "0.85rem" }}>
        <div style={sectionCard}>
          <label>
            Provider
            <select data-testid="provider-family" value={providerFamily} onChange={(e) => onProviderChange(e.target.value)}>
              <optgroup label="Cloud">
                {TEXT_PROVIDERS.filter((p) => p.tier === "cloud").map((p) => (
                  <option key={p.family} value={p.family}>{p.label}</option>
                ))}
              </optgroup>
              <optgroup label="Local">
                {TEXT_PROVIDERS.filter((p) => p.tier === "local").map((p) => (
                  <option key={p.family} value={p.family}>{p.label}</option>
                ))}
              </optgroup>
            </select>
          </label>

          <label>
            Base URL
            <input
              data-testid="base-url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={defaultBaseUrl(providerFamily)}
            />
          </label>

          <label>
            API key
            <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
              <input
                data-testid="api-key"
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={hasStoredKey ? "•••••••• (leave blank to keep current key)" : "sk-..."}
                style={{ flex: 1, display: "block" }}
              />
              <button type="button" data-testid="reveal-key" onClick={() => setShowKey((v) => !v)} style={ghostBtnStyle}>
                {showKey ? "Hide" : "Show"}
              </button>
            </div>
            {hasStoredKey && apiKey === "" && (
              <span style={hintStyle}>A key is saved. Leave blank to keep it; type a new one to rotate.</span>
            )}
          </label>
        </div>

        <div style={sectionCard}>
          <label>
            Model id
            <input
              data-testid="model-id"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              placeholder="e.g. openai/gpt-4o or deepseek/deepseek-v3.2"
            />
          </label>

        <label>
          Temperature ({temperature.toFixed(2)})
          <input
            data-testid="temperature"
            type="range" min={0} max={2} step={0.05}
            className="sp-range"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
          />
        </label>

        <label>
          Max tokens
          <input
            data-testid="max-tokens"
            type="number" min={1} step={1}
            value={maxTokens}
            onChange={(e) => setMaxTokens(parseInt(e.target.value, 10) || 0)}
          />
        </label>

        <label>
          Context length
          <input
            data-testid="context-length"
            type="number" min={1} step={1}
            value={contextLength}
            onChange={(e) => setContextLength(parseInt(e.target.value, 10) || 0)}
          />
        </label>

          <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
            <span style={{ flex: 1 }}>
              <strong>Thinking mode</strong>
              <span style={{ ...hintStyle, display: "block" }}>
                Enable chain-of-thought for supported models. Uses more tokens and is slower.
              </span>
            </span>
            <input
              data-testid="thinking-mode"
              type="checkbox"
              className="sp-toggle"
              checked={thinkingMode}
              onChange={(e) => setThinkingMode(e.target.checked)}
            />
          </label>
        </div>

        {/* Cycle 0114 — Character creation override. Reasoning toggle scoped to
            the refiner call only; chat replies stay fast. */}
        <div style={sectionCard}>
          <div>
            <strong>Character creation</strong>
            <p style={{ margin: "0.35rem 0 0", color: "var(--sp-fg-3)", fontSize: "0.85rem" }}>
              Tune how the "Enrich with AI" refiner produces character cards. These knobs
              only affect character creation — chat replies use the settings above.
            </p>
          </div>
          <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
            <span style={{ flex: 1 }}>
              <strong>Use reasoning when refining cards</strong>
              <span style={{ ...hintStyle, display: "block" }}>
                When on, the model thinks before drafting — produces more specific, less
                generic fields. Best paired with a reasoning-capable model
                (DeepSeek V3.2, Gemini 2.5, GPT-5 with reasoning routed on).
                Silently ignored by non-reasoning models. Adds 10-30 s to the refine call;
                chat latency is unaffected.
              </span>
            </span>
            <input
              data-testid="cc-reasoning-enabled"
              type="checkbox"
              className="sp-toggle"
              checked={ccPrefs.reasoning_enabled}
              onChange={(e) => setCcPrefs((p) => ({ ...p, reasoning_enabled: e.target.checked }))}
            />
          </label>
        </div>

        {/* Cycle 0116 — Sampler hygiene. Doc §1.1 RP-validated values.
            User-global (apply across providers). Temperature and max_tokens
            stay per-provider (above). */}
        <div style={sectionCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
            <div>
              <strong>Sampler hygiene</strong>
              <p style={{ margin: "0.35rem 0 0", color: "var(--sp-fg-3)", fontSize: "0.85rem" }}>
                Doc-validated defaults for character-driven roleplay (top_p 0.95, top_k 40, min_p 0.01,
                no frequency or presence penalty). Apply to every chat call across providers. Providers
                that don't honor a key silently ignore it.
              </p>
            </div>
            <button
              type="button"
              data-testid="sampler-reset"
              onClick={() => setSamplerPrefs({ ...SAMPLER_PREFS_DEFAULTS })}
              style={resetBtnStyle}
            >
              Reset to RP defaults
            </button>
          </div>

          <label>
            top_p ({samplerPrefs.top_p.toFixed(2)})
            <input
              data-testid="sampler-top-p"
              type="range" min={0} max={1} step={0.01}
              className="sp-range"
              value={samplerPrefs.top_p}
              onChange={(e) => setSamplerPrefs((p) => ({ ...p, top_p: parseFloat(e.target.value) }))}
            />
          </label>

          <label>
            top_k ({samplerPrefs.top_k}) <span style={{ ...hintStyle, marginLeft: "0.5rem" }}>0 = disabled</span>
            <input
              data-testid="sampler-top-k"
              type="range" min={0} max={200} step={1}
              className="sp-range"
              value={samplerPrefs.top_k}
              onChange={(e) => setSamplerPrefs((p) => ({ ...p, top_k: parseInt(e.target.value, 10) }))}
            />
          </label>

          <label>
            min_p ({samplerPrefs.min_p.toFixed(2)})
            <input
              data-testid="sampler-min-p"
              type="range" min={0} max={0.5} step={0.005}
              className="sp-range"
              value={samplerPrefs.min_p}
              onChange={(e) => setSamplerPrefs((p) => ({ ...p, min_p: parseFloat(e.target.value) }))}
            />
          </label>

          <label>
            frequency_penalty ({samplerPrefs.frequency_penalty.toFixed(2)})
            <span style={{ ...hintStyle, display: "block" }}>
              Doc-mandated 0 for RP. Non-zero distorts character voice and breaks catchphrases.
            </span>
            <input
              data-testid="sampler-freq-penalty"
              type="range" min={-2} max={2} step={0.1}
              className="sp-range"
              value={samplerPrefs.frequency_penalty}
              onChange={(e) => setSamplerPrefs((p) => ({ ...p, frequency_penalty: parseFloat(e.target.value) }))}
            />
          </label>

          <label>
            presence_penalty ({samplerPrefs.presence_penalty.toFixed(2)})
            <span style={{ ...hintStyle, display: "block" }}>
              Same as frequency: doc-mandated 0 for RP.
            </span>
            <input
              data-testid="sampler-presence-penalty"
              type="range" min={-2} max={2} step={0.1}
              className="sp-range"
              value={samplerPrefs.presence_penalty}
              onChange={(e) => setSamplerPrefs((p) => ({ ...p, presence_penalty: parseFloat(e.target.value) }))}
            />
          </label>
        </div>

        {needsConsent && (
          <section data-testid="cloud-consent" style={consentCardStyle}>
            <strong>Cloud AI Consent</strong>
            <p style={{ margin: "0.5rem 0", color: "var(--sp-fg-3)", fontSize: "0.9rem" }}>
              Using a cloud provider means your messages, Character data, and Grammar text leave your device and go to the provider. Your API key is stored encrypted. You can delete it anytime.
            </p>
            <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <input
                data-testid="consent-ack"
                type="checkbox"
                className="sp-toggle"
                checked={consentAck}
                onChange={(e) => setConsentAck(e.target.checked)}
              />
              <span>I understand</span>
            </label>
          </section>
        )}
        {!needsConsent && consentAt && cloudPicked && (
          <span data-testid="consent-ack-line" style={hintStyle}>
            Cloud AI Consent acknowledged on {new Date(consentAt).toLocaleDateString()}.
          </span>
        )}

        {error && <StatusBanner tone="error" testid="te-error" role="alert">{error}</StatusBanner>}

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <button type="submit" data-testid="save" disabled={!canSave} style={saveBtnStyle(!canSave)}>
            {saving ? "Saving…" : existing ? "Save" : "Save & activate"}
          </button>
          <button
            type="button"
            data-testid="test-connection"
            disabled={testing || !existing}
            onClick={async () => {
              setTesting(true); setTestResult(null);
              const r = await testConnection();
              setTestResult(r); setTesting(false);
            }}
            style={ghostBtnStyle}
          >
            {testing ? "Testing…" : "Test Connection"}
          </button>
          {existing && (
            <button type="button" data-testid="delete" disabled={saving} onClick={onDelete} style={destructiveBtnStyle}>
              Delete
            </button>
          )}
        </div>

        {testResult && (
          <StatusBanner
            tone={testResult.ok ? "success" : "error"}
            testid="te-test-result"
            role="status"
          >
            {testResult.ok ? "✓ Connected" : `✗ ${testResult.error ?? "failed"}`}
          </StatusBanner>
        )}
      </form>
    </main>
  );
}

function defaultBaseUrl(family: string): string {
  return TEXT_PROVIDERS.find((p) => p.family === family)?.default_base_url ?? "";
}

const mainStyle: React.CSSProperties = { maxWidth: 640, margin: "2rem auto", padding: "0 1rem" };
const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1.75rem" };
const sectionCard: React.CSSProperties = { background: "var(--sp-bg-2)", border: "1px solid var(--sp-border)", borderRadius: "var(--sp-radius)", padding: "1rem", display: "grid", gap: "0.85rem" };
const hintStyle: React.CSSProperties = { fontSize: "0.8rem", color: "var(--sp-fg-3)" };

const resetBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--sp-border)",
  color: "var(--sp-fg-2)",
  borderRadius: "var(--sp-radius)",
  padding: "0.25rem 0.7rem",
  fontSize: "0.8em",
  fontFamily: "inherit",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const consentCardStyle: React.CSSProperties = {
  background: "var(--sp-warning-soft)",
  border: "1px solid var(--sp-warning)",
  borderRadius: "var(--sp-radius)",
  padding: "0.75rem 1rem",
  display: "grid",
  gap: "0.25rem",
};

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

const destructiveBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--sp-destructive-soft)",
  color: "var(--sp-destructive)",
  borderRadius: "var(--sp-radius)",
  padding: "0.45rem 1rem",
  fontWeight: 500,
  fontFamily: "inherit",
  fontSize: "0.9em",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

function saveBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    background: disabled ? "var(--sp-bg-3)" : "var(--sp-brand-1)",
    color: disabled ? "var(--sp-fg-4)" : "var(--sp-fg-on-brand)",
    border: "none",
    borderRadius: "var(--sp-radius)",
    padding: "0.45rem 1.25rem",
    fontWeight: 600,
    fontFamily: "inherit",
    fontSize: "0.9em",
    cursor: disabled ? "not-allowed" : "pointer",
  };
}
