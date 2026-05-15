import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSession } from "../lib/session";
import { supabase } from "../lib/supabase";
import {
  EMBEDDING_PROVIDERS,
  listActiveEmbeddingProvider,
  upsertEmbeddingProvider,
  type ProviderConfig,
} from "../lib/providers";
import { Spinner } from "../lib/Spinner";
import { StatusBanner } from "../lib/StatusBanner";
import { useDocumentTitle } from "../lib/useDocumentTitle";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://127.0.0.1:8000";

type Status = "loading" | "ready" | "saving" | "error";

type TestResult = {
  ok: boolean;
  status?: number | null;
  error?: string | null;
  dimension?: number | null;
};

function defaultsForFamily(family: string): { baseUrl: string; model: string } {
  const entry = EMBEDDING_PROVIDERS.find((p) => p.family === family);
  return {
    baseUrl: entry?.default_base_url ?? "",
    model: entry?.default_model ?? "text-embedding-3-small",
  };
}

// Cycle 0050 — default to OpenRouter for new Memory Engine configs. Users
// with an existing row keep whatever they already saved.
const DEFAULT_FAMILY = "OpenRouter";

export function MemoryEngineSettings() {
  useDocumentTitle("Memory Engine · Settings");
  const nav = useNavigate();
  const sess = useSession();
  const userId = sess.status === "ready" ? sess.session?.user.id ?? null : null;

  const [status, setStatus] = useState<Status>("loading");
  const [existing, setExisting] = useState<ProviderConfig | null>(null);
  const [providerFamily, setProviderFamily] = useState(DEFAULT_FAMILY);
  const [baseUrl, setBaseUrl] = useState(defaultsForFamily(DEFAULT_FAMILY).baseUrl);
  const [modelId, setModelId] = useState(defaultsForFamily(DEFAULT_FAMILY).model);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  useEffect(() => {
    if (sess.status !== "ready") return;
    if (!userId) { nav("/sign-in"); return; }
    let cancelled = false;
    (async () => {
      try {
        const row = await listActiveEmbeddingProvider();
        if (cancelled) return;
        setExisting(row);
        if (row) {
          setProviderFamily(row.provider_family);
          setBaseUrl(row.base_url ?? defaultsForFamily(row.provider_family).baseUrl);
          setModelId(row.model_id ?? defaultsForFamily(row.provider_family).model);
        }
        setStatus("ready");
      } catch (e) {
        if (!cancelled) { setError(String(e)); setStatus("error"); }
      }
    })();
    return () => { cancelled = true; };
  }, [sess.status, userId, nav]);

  function onFamilyChange(family: string) {
    setProviderFamily(family);
    const d = defaultsForFamily(family);
    setBaseUrl(d.baseUrl);
    setModelId(d.model);
    setSaveOk(false);
  }

  async function onTest() {
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      const { data: sessData } = await supabase.auth.getSession();
      const jwt = sessData.session?.access_token;
      if (!jwt) throw new Error("Not signed in");
      if (!apiKey && !existing) throw new Error("Enter an API key to test");

      // Cycle 0111 — when the user has a saved provider and didn't paste a new
      // key, probe the saved Vault key server-side (parity with Text Engine).
      // Otherwise, send the just-typed credentials to the legacy endpoint.
      const useSaved = !apiKey && !!existing;
      const url = useSaved
        ? `${BACKEND_URL}/providers/embedding/test-saved`
        : `${BACKEND_URL}/providers/embedding/test`;
      const init: RequestInit = useSaved
        ? {
            method: "POST",
            headers: { Authorization: `Bearer ${jwt}` },
          }
        : {
            method: "POST",
            headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
            body: JSON.stringify({ base_url: baseUrl, api_key: apiKey, model: modelId }),
          };
      const res = await fetch(url, init);
      const body = (await res.json()) as TestResult;
      setTestResult(body);
    } catch (e) {
      setTestResult({ ok: false, error: String(e) });
    } finally {
      setTesting(false);
    }
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError(null);
    setSaveOk(false);
    try {
      await upsertEmbeddingProvider({
        provider_family: providerFamily,
        base_url: baseUrl || null,
        api_key: apiKey || null,
        model_id: modelId || null,
      });
      const fresh = await listActiveEmbeddingProvider();
      setExisting(fresh);
      setApiKey("");
      setStatus("ready");
      setSaveOk(true);
    } catch (e) {
      setError(String(e));
      setStatus("error");
    }
  }

  const saving = status === "saving";

  function saveLabel(): string {
    if (saving) return "Saving…";
    if (existing) return "Update";
    return "Save";
  }

  if (status === "loading") return <main style={mainStyle}><Spinner testId="memory-engine-loading" /></main>;

  return (
    <main data-testid="memory-engine-settings" style={mainStyle}>
      <header className="sp-settings-header" style={headerStyle}>
        <h1 className="sp-h2 sp-wordmark sp-page-h1">Memory Engine</h1>
        <Link to="/settings" className="sp-back-btn">← Back</Link>
      </header>

      <p style={{ color: "var(--sp-fg-3)", marginBottom: "1.25rem" }}>
        The Memory Engine generates embeddings for Character Memory. Default = OpenRouter routing to
        <code> openai/text-embedding-3-small</code> (1536-dim, cheap, reliable) — same model you'd get
        from OpenAI direct, but billed through your existing OpenRouter account. You can switch to
        OpenAI direct, Jina, or a custom endpoint. <strong>Keys are encrypted at rest via Supabase Vault.</strong>
      </p>

      <form data-testid="memory-engine-form" onSubmit={onSave} data-form="stack" style={{ display: "grid", gap: "0.85rem", background: "var(--sp-bg-2)", border: "1px solid var(--sp-border)", borderRadius: "var(--sp-radius)", padding: "1rem" }}>
        <label>
          <span>Provider</span>
          <select
            data-testid="mem-provider-family"
            value={providerFamily}
            onChange={(e) => onFamilyChange(e.target.value)}
          >
            {EMBEDDING_PROVIDERS.map((p) => (
              <option key={p.family} value={p.family}>{p.label}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Base URL</span>
          <input
            data-testid="mem-base-url"
            value={baseUrl}
            onChange={(e) => { setBaseUrl(e.target.value); setSaveOk(false); }}
            placeholder="https://api.openai.com/v1"
          />
        </label>

        <label>
          <span>
            API key{" "}
            {existing && (
              <small style={{ color: "var(--sp-fg-3)" }}>
                (leave blank to keep saved key — Test verifies the saved key from Vault)
              </small>
            )}
          </span>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <input
              data-testid="mem-api-key"
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setSaveOk(false); }}
              placeholder={existing ? "••••••••" : "sk-..."}
              style={{ flex: 1, display: "block" }}
              autoComplete="off"
            />
            <button type="button" onClick={() => setShowKey(!showKey)} style={ghostBtnStyle}>
              {showKey ? "Hide" : "Show"}
            </button>
          </div>
        </label>

        <label>
          <span>Model</span>
          <input
            data-testid="mem-model-id"
            value={modelId}
            onChange={(e) => { setModelId(e.target.value); setSaveOk(false); }}
            placeholder="text-embedding-3-small"
          />
        </label>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" data-testid="mem-test" onClick={onTest} disabled={testing} style={ghostBtnStyle}>
            {testing ? "Testing…" : "Test connection"}
          </button>
          <button type="submit" data-testid="mem-save" disabled={saving} style={saveBtnStyle(saving)}>
            {saveLabel()}
          </button>
        </div>

        {testResult && (
          <StatusBanner
            tone={testResult.ok ? "success" : "error"}
            testid="mem-test-result"
            role="status"
          >
            {testResult.ok ? (
              <>
                Connected. Dimension: {testResult.dimension ?? "?"}
                {testResult.dimension !== 1536 && (
                  <strong> — non-1536 dim will not insert into the v0 schema.</strong>
                )}
              </>
            ) : (
              <>Failed ({testResult.status ?? "?"}): {testResult.error}</>
            )}
          </StatusBanner>
        )}

        {saveOk && (
          <StatusBanner tone="success" testid="mem-save-result" role="status">
            Memory Engine updated.
          </StatusBanner>
        )}

        {error && (
          <StatusBanner tone="error" testid="mem-engine-error" role="alert">{error}</StatusBanner>
        )}

        <p style={{ fontSize: "0.85rem", color: "var(--sp-fg-3)" }}>
          <strong>Note:</strong> v0 stores embeddings at fixed 1536 dimensions. Using a non-1536 model will
          silently fail at insert. Future cycles will support additional dims.
        </p>

        <p style={{ fontSize: "0.85rem", color: "var(--sp-fg-3)" }}>
          Want to configure memory behavior (cadence, top-K, threshold)?{" "}
          <Link to="/settings/memory">Settings → Memory</Link>
        </p>
      </form>
    </main>
  );
}

const mainStyle: React.CSSProperties = { maxWidth: 640, margin: "2rem auto", padding: "0 1rem" };
const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1.75rem" };

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
