import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  IMAGE_REFINE_DEFAULTS,
  loadImageRefinePrefs,
  saveImageRefinePrefs,
  type ImageRefinePrefs,
} from "../lib/imageRefinePrefs";
import { useSession } from "../lib/session";
import {
  FAL_IMAGE_PREFS_DEFAULTS,
  IMAGE_PROVIDER_FAMILIES,
  listImageProviders,
  loadFalImagePrefs,
  loadRefinerDefaultPrompt,
  saveFalImagePrefs,
  setActiveImageProvider,
  testImageProvider,
  upsertImageProvider,
  upsertImageProviderForFamily,
  validateWorkflowShape,
  type FalImagePrefs,
  type TestImageResult,
} from "../lib/imageProvider";
import { RESOLUTION_PRESETS } from "../lib/images";
import type { ProviderConfig } from "../lib/providers";
import { supabase } from "../lib/supabase";
import { Spinner } from "../lib/Spinner";
import { StatusBanner } from "../lib/StatusBanner";
import { useDocumentTitle } from "../lib/useDocumentTitle";

type Status = "loading" | "ready" | "saving";

// Defaults follow the Animagine XL 4.0 prompting guide: Danbooru-style tag
// order (subject → series → rating → general → quality), with quality tags
// pushed to the end of the prompt as the model was trained. The refiner's
// per-image tags land between prefix and suffix.
//
// SFW guardrail tokens (nsfw / nude / explicit / etc.) are NOT in the static
// negative defaults. They are appended at request time by the backend
// (`append_sfw_negative` in comfyui.py) only when the user has SFW mode ON
// in Data & Security; toggling SFW off removes them.
const DEFAULT_POSITIVE_PREFIX = "";
const DEFAULT_POSITIVE_SUFFIX = "masterpiece, high score, great score, absurdres";
const DEFAULT_NEGATIVE_PREFIX = "lowres, bad anatomy, bad hands, text, error, missing finger, extra digits, fewer digits, cropped, worst quality, low quality, low score, bad score, average score, signature, watermark, username, blurry";

// Cycle 0090 — fal.ai default model. Seedream V5 Lite handles realism + anime
// with strong prose-style prompt-following. Other fal models that handle prose
// well (Flux, Imagen, etc.) can be set via the Model field.
const DEFAULT_FAL_MODEL = "fal-ai/bytedance/seedream/v5/lite";
const DEFAULT_FAL_T2I_ENDPOINT = `${DEFAULT_FAL_MODEL}/text-to-image`;
const DEFAULT_FAL_EDIT_ENDPOINT = `${DEFAULT_FAL_MODEL}/edit`;

type ProviderTab = "fal" | "comfyui";

// Tab → provider family. Centralized so the tab UI, save handlers, and
// activation flip all derive family the same way.
const TAB_FAMILY: Record<ProviderTab, string> = {
  fal: IMAGE_PROVIDER_FAMILIES.FAL,
  comfyui: IMAGE_PROVIDER_FAMILIES.COMFYUI,
};

const TAB_LABEL: Record<ProviderTab, string> = {
  fal: "fal.ai (Seedream)",
  comfyui: "ComfyUI",
};

export function ImageEngineSettings() {
  useDocumentTitle("Image Engine · Settings");
  const nav = useNavigate();
  const sess = useSession();
  const userId = sess.status === "ready" ? sess.session?.user.id ?? null : null;

  const [status, setStatus] = useState<Status>("loading");
  const [existing, setExisting] = useState<ProviderConfig | null>(null);
  const [falRow, setFalRow] = useState<ProviderConfig | null>(null);
  const [activeFamily, setActiveFamily] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProviderTab>("fal");
  const [baseUrl, setBaseUrl] = useState("http://localhost:8188");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [falApiKey, setFalApiKey] = useState("");
  const [showFalKey, setShowFalKey] = useState(false);
  // Cycle 0093 follow-up — split the single Model field into two,
  // matching the underlying fal endpoint pair. Avatars + the white-bg
  // reference use the t2i endpoint; chat scenes (Cycle 0094) with a
  // reference image use the edit endpoint. Different fal models can
  // be best at each job (e.g. Imagen for clean t2i avatars, Seedream
  // for character-anchored scene edits).
  const [falT2iEndpoint, setFalT2iEndpoint] = useState(DEFAULT_FAL_T2I_ENDPOINT);
  const [falEditEndpoint, setFalEditEndpoint] = useState(DEFAULT_FAL_EDIT_ENDPOINT);
  // Cycle 0095 — fal style picker + history-refs stepper. Persists to
  // users.preferences.image.{style, custom_template, use_chat_history_refs}.
  const [falPrefs, setFalPrefs] = useState<FalImagePrefs>(FAL_IMAGE_PREFS_DEFAULTS);
  const [falStatus, setFalStatus] = useState<"idle" | "saving">("idle");
  const [falError, setFalError] = useState<string | null>(null);
  const [workflowText, setWorkflowText] = useState("");
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [positivePrefix, setPositivePrefix] = useState(DEFAULT_POSITIVE_PREFIX);
  const [positiveSuffix, setPositiveSuffix] = useState(DEFAULT_POSITIVE_SUFFIX);
  const [negativePrefix, setNegativePrefix] = useState(DEFAULT_NEGATIVE_PREFIX);
  const [negativeSuffix, setNegativeSuffix] = useState("");
  const [checkpointOverride, setCheckpointOverride] = useState("");
  const [refinerSystem, setRefinerSystem] = useState("");
  const [refinerSystemPlaceholder, setRefinerSystemPlaceholder] = useState("");
  const [refinePrefs, setRefinePrefs] = useState<ImageRefinePrefs>(IMAGE_REFINE_DEFAULTS);
  const [refinerMode, setRefinerMode] = useState<"default" | "custom">("default");
  const [showRefinerDefault, setShowRefinerDefault] = useState(false);
  const [defaultResolution, setDefaultResolution] = useState<string>("square_1024");
  const [customResolution, setCustomResolution] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestImageResult | null>(null);

  useEffect(() => {
    if (sess.status !== "ready") return;
    if (!userId) { nav("/sign-in"); return; }
    let cancelled = false;
    (async () => {
      try {
        const [allRows, defaultPrompt, userRow, loadedRefine, loadedFalPrefs] = await Promise.all([
          listImageProviders(),
          loadRefinerDefaultPrompt(),
          supabase.from("users").select("preferences").eq("id", userId!).single(),
          loadImageRefinePrefs(userId!),
          loadFalImagePrefs(userId!),
        ]);
        if (cancelled) return;
        const comfyRow = allRows.find((p) => p.provider_family === IMAGE_PROVIDER_FAMILIES.COMFYUI) ?? null;
        const fr = allRows.find((p) => p.provider_family === IMAGE_PROVIDER_FAMILIES.FAL) ?? null;
        const active = allRows.find((p) => p.is_active) ?? null;
        setExisting(comfyRow);
        setFalRow(fr);
        setActiveFamily(active?.provider_family ?? null);
        // Tab selection: follow the active provider; if neither set, default to fal.
        if (active?.provider_family === IMAGE_PROVIDER_FAMILIES.COMFYUI) setActiveTab("comfyui");
        else setActiveTab("fal");
        // Fal model: read persisted slug from workflow_config, fall back to default.
        const falConfig = (fr?.workflow_config ?? {}) as Record<string, unknown>;
        // Hydrate t2i + edit endpoints. New shape stores them
        // explicitly; legacy rows have only `model_slug` (the base
        // form) — derive endpoints by appending the fixed suffixes.
        const legacyBase = String(falConfig.model_slug ?? DEFAULT_FAL_MODEL).replace(/\/$/, "");
        setFalT2iEndpoint(String(falConfig.t2i_model_endpoint ?? `${legacyBase}/text-to-image`));
        setFalEditEndpoint(String(falConfig.edit_model_endpoint ?? `${legacyBase}/edit`));
        setRefinerSystemPlaceholder(defaultPrompt);
        setRefinePrefs(loadedRefine);
        setFalPrefs(loadedFalPrefs);
        const imagePrefs = ((userRow.data?.preferences as Record<string, unknown> | null)?.image as Record<string, unknown> | undefined) ?? {};
        const savedRes = imagePrefs.default_resolution_preset as string | undefined;
        if (savedRes?.startsWith("custom_")) {
          setDefaultResolution("custom");
          setCustomResolution(savedRes.slice("custom_".length));
        } else if (savedRes) {
          setDefaultResolution(savedRes);
        }
        syncComfyFormFields(comfyRow);
        setStatus("ready");
      } catch (e) {
        setError(String(e));
        setStatus("ready");
      }
    })();
    return () => { cancelled = true; };
  }, [sess.status, userId, nav]);

  // Hydrate the ComfyUI form fields (base URL, workflow JSON, prompt wrap,
  // checkpoint override, refiner system prompt) from a fetched comfy row.
  // Called from both initial load and post-save refresh so the visible form
  // never diverges from the DB-confirmed state. No-op if comfyRow is null.
  function syncComfyFormFields(comfyRow: ProviderConfig | null) {
    if (!comfyRow) return;
    setBaseUrl(comfyRow.base_url ?? "http://localhost:8188");
    if (!comfyRow.workflow_config) return;
    const wf = comfyRow.workflow_config as Record<string, unknown>;
    const wrap = (wf._prompt_wrap as Record<string, unknown> | undefined) ?? {};
    const clean = { ...wf };
    delete clean._prompt_wrap;
    delete clean._refiner_system_prompt;
    setWorkflowText(JSON.stringify(clean, null, 2));
    setPositivePrefix(String(wrap.positive_prefix ?? DEFAULT_POSITIVE_PREFIX));
    setPositiveSuffix(String(wrap.positive_suffix ?? DEFAULT_POSITIVE_SUFFIX));
    setNegativePrefix(String(wrap.negative_prefix ?? DEFAULT_NEGATIVE_PREFIX));
    setNegativeSuffix(String(wrap.negative_suffix ?? ""));
    setCheckpointOverride(String(wrap.checkpoint ?? ""));
    const existingRefiner = String(wf._refiner_system_prompt ?? "");
    setRefinerSystem(existingRefiner);
    setRefinerMode(existingRefiner.trim() ? "custom" : "default");
  }

  async function refreshProviders() {
    const allRows = await listImageProviders();
    const comfyRow = allRows.find((p) => p.provider_family === IMAGE_PROVIDER_FAMILIES.COMFYUI) ?? null;
    const fr = allRows.find((p) => p.provider_family === IMAGE_PROVIDER_FAMILIES.FAL) ?? null;
    const active = allRows.find((p) => p.is_active) ?? null;
    setExisting(comfyRow);
    setFalRow(fr);
    setActiveFamily(active?.provider_family ?? null);
    const falConfig = (fr?.workflow_config ?? {}) as Record<string, unknown>;
    if (falConfig.t2i_model_endpoint) setFalT2iEndpoint(String(falConfig.t2i_model_endpoint));
    if (falConfig.edit_model_endpoint) setFalEditEndpoint(String(falConfig.edit_model_endpoint));
    // Re-hydrate comfy form fields from the freshly fetched row so post-save
    // edits reflect any DB-side normalization (e.g. unknown fields stripped).
    syncComfyFormFields(comfyRow);
  }

  async function onSaveFal(e: React.FormEvent) {
    e.preventDefault();
    setFalError(null);
    const trimmedT2i = falT2iEndpoint.trim() || DEFAULT_FAL_T2I_ENDPOINT;
    const trimmedEdit = falEditEndpoint.trim() || DEFAULT_FAL_EDIT_ENDPOINT;
    if (!falApiKey.trim() && !falRow) {
      setFalError("Paste your fal.ai API key to save.");
      return;
    }
    setFalStatus("saving");
    try {
      // Preserve any other workflow_config fields future cycles may add
      // (style, refs, resolution preset, etc.) — only overwrite the
      // endpoint fields. Drop the legacy `model_slug` when both new
      // fields are present so the row stays clean.
      const { model_slug: _legacy, ...baseConfig } = (falRow?.workflow_config as Record<string, unknown>) ?? {};
      void _legacy;
      await upsertImageProviderForFamily(IMAGE_PROVIDER_FAMILIES.FAL, {
        base_url: null,
        api_key: falApiKey.trim() || null,
        workflow_config: {
          ...baseConfig,
          t2i_model_endpoint: trimmedT2i,
          edit_model_endpoint: trimmedEdit,
        },
      });
      // Cycle 0095 — also persist the style + history-refs prefs in
      // the same Save action. The prefs blob is user-level, not
      // provider-level, but the Save button is on the fal tab so it's
      // natural to flush them together.
      await saveFalImagePrefs(userId!, falPrefs);
      await refreshProviders();
      setFalApiKey("");
      setFalT2iEndpoint(trimmedT2i);
      setFalEditEndpoint(trimmedEdit);
    } catch (err) {
      setFalError(String(err));
    } finally {
      setFalStatus("idle");
    }
  }

  // Switching tabs only reveals the corresponding form. Activation happens on
  // save (or via a future toggle if both are configured and the user wants to
  // flip without re-saving). For this cycle, save = activate.
  function onTabChange(next: ProviderTab) {
    setActiveTab(next);
    setFalError(null);
    setError(null);
  }

  async function onSwitchActiveToTab() {
    // When the user is on the inactive tab and the row exists, expose a
    // one-click activation that doesn't rotate the key.
    setFalError(null);
    setError(null);
    try {
      await setActiveImageProvider(TAB_FAMILY[activeTab]);
      await refreshProviders();
    } catch (err) {
      if (activeTab === "fal") setFalError(String(err));
      else setError(String(err));
    }
  }

  async function onPickWorkflowFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    setWorkflowText(text);
  }

  function parseWorkflow(): Record<string, unknown> | null {
    setWorkflowError(null);
    if (!workflowText.trim()) { setWorkflowError("Paste or upload a workflow JSON."); return null; }
    let parsed: unknown;
    try { parsed = JSON.parse(workflowText); } catch { setWorkflowError("Not valid JSON."); return null; }
    const check = validateWorkflowShape(parsed);
    if (!check.ok) { setWorkflowError(check.error); return null; }
    return parsed as Record<string, unknown>;
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    const workflow = parseWorkflow();
    if (!workflow) return;
    if (!baseUrl.trim()) { setError("Base URL is required."); return; }
    setStatus("saving"); setError(null); setTestResult(null);
    try {
      const withWrap: Record<string, unknown> = {
        ...workflow,
        _prompt_wrap: {
          positive_prefix: positivePrefix,
          positive_suffix: positiveSuffix,
          negative_prefix: negativePrefix,
          negative_suffix: negativeSuffix,
          checkpoint: checkpointOverride.trim(),
        },
      };
      if (refinerMode === "custom" && refinerSystem.trim()) {
        withWrap._refiner_system_prompt = refinerSystem;
      }
      await upsertImageProvider({
        base_url: baseUrl.trim(),
        api_key: apiKey || null,
        workflow_config: withWrap,
      });
      await refreshProviders();
      setApiKey("");

      let presetToSave: string | null;
      if (defaultResolution === "custom") {
        const trimmed = customResolution.trim();
        const match = /^(\d{3,4})x(\d{3,4})$/.exec(trimmed);
        if (!match) {
          setError("Custom resolution must be WIDTHxHEIGHT (e.g. 1536x1024), each 256–4096.");
          return;
        }
        const w = Number(match[1]);
        const h = Number(match[2]);
        if (w < 256 || w > 4096 || h < 256 || h > 4096) {
          setError("Custom resolution width and height must be between 256 and 4096.");
          return;
        }
        presetToSave = `custom_${trimmed}`;
      } else {
        presetToSave = defaultResolution || null;
      }
      const { error: prefErr } = await supabase.rpc("set_user_image_preset", {
        p_preset: presetToSave,
      });
      if (prefErr) throw prefErr;

      const savedRefine = await saveImageRefinePrefs(userId!, refinePrefs);
      setRefinePrefs(savedRefine);
    } catch (err) {
      setError(String(err));
    } finally {
      setStatus("ready");
    }
  }

  async function onTest() {
    setTesting(true); setTestResult(null);
    try {
      setTestResult(await testImageProvider());
    } finally {
      setTesting(false);
    }
  }

  if (status === "loading") return <main style={mainStyle}><Spinner testId="image-engine-loading" /></main>;

  const falSaveDisabled = falStatus !== "idle" || (!falApiKey.trim() && !falRow);
  const tabRowExists = activeTab === "fal" ? Boolean(falRow) : Boolean(existing);
  const tabIsInactive = tabRowExists && activeFamily !== TAB_FAMILY[activeTab];

  return (
    <main data-testid="image-engine-settings" style={mainStyle}>
      <header className="sp-settings-header" style={headerStyle}>
        <h1 className="sp-h2 sp-wordmark sp-page-h1">Image Engine</h1>
        <Link to="/settings" className="sp-back-btn">← Back</Link>
      </header>

      <p style={{ color: "var(--sp-fg-3)", marginBottom: "1rem" }}>
        Pick an image generation provider. Your API key stays encrypted in the vault. Only one provider runs at a time —
        switching tabs and saving activates that provider; the other's config stays preserved for when you flip back.
      </p>

      {/* Provider tabs — segmented pill control matching the kit pattern (cycle 0072) */}
      <div role="tablist" aria-label="Image provider" data-testid="image-provider-tabs" style={tabsContainerStyle}>
        {(["fal", "comfyui"] as const).map((tab) => {
          const isSelected = activeTab === tab;
          const isActiveProvider = activeFamily === TAB_FAMILY[tab];
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={isSelected}
              data-testid={`image-tab-${tab}`}
              onClick={() => onTabChange(tab)}
              style={tabButtonStyle(isSelected)}
            >
              {TAB_LABEL[tab]}
              {isActiveProvider && <span style={tabActiveDotStyle} aria-label="(currently active)" />}
            </button>
          );
        })}
      </div>

      {/* If the user is viewing a tab whose provider exists but isn't active,
          surface a one-click flip that doesn't rotate the key. */}
      {tabIsInactive && (
        <div style={inactiveBannerStyle} data-testid="inactive-tab-banner">
          <span>This provider is configured but not currently active.</span>
          <button
            type="button"
            data-testid="switch-active-button"
            onClick={onSwitchActiveToTab}
            style={ghostSmallBtnStyle}
          >
            Set as active
          </button>
        </div>
      )}

      {/* fal.ai (Seedream) — Cycle 0090 BYOK section */}
      {activeTab === "fal" && (
        <form
          onSubmit={onSaveFal}
          data-form="stack"
          data-testid="fal-section"
          style={{ display: "grid", gap: "1.25rem" }}
        >
          <div>
            <p style={sectionLabel}>fal.ai BYOK</p>
            <div style={sectionCard}>
              <p style={{ color: "var(--sp-fg-3)", fontSize: "0.85em", margin: 0 }}>
                BYOK — paste your fal.ai key (encrypted in Vault, same as your OpenRouter key). Get a key at{" "}
                <a href="https://fal.ai/dashboard/keys" target="_blank" rel="noreferrer" style={{ color: "var(--sp-fg-2)" }}>
                  fal.ai → Dashboard → Keys
                </a>
                .
              </p>

              <label>
                <span>API key</span>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <input
                    data-testid="fal-api-key"
                    type={showFalKey ? "text" : "password"}
                    placeholder={falRow?.vault_secret_id ? "••• key stored — paste new to rotate" : "Paste your fal.ai API key"}
                    value={falApiKey}
                    onChange={(e) => setFalApiKey(e.target.value)}
                    style={{ flex: 1, display: "block" }}
                    autoComplete="off"
                  />
                  <button type="button" onClick={() => setShowFalKey((v) => !v)} style={ghostBtnStyle}>
                    {showFalKey ? "Hide" : "Show"}
                  </button>
                </div>
              </label>
            </div>
          </div>

          <div>
            <p style={sectionLabel}>Models</p>
            <div style={sectionCard}>
              <p style={{ color: "var(--sp-fg-3)", fontSize: "0.85em", margin: 0 }}>
                Default is Seedream V5 Lite — handles realism + anime with strong prose-style prompt following.
                You can configure the two endpoints separately if a different model fits each job better
                (e.g. Imagen for clean t2i avatars, Seedream for character-anchored scene edits).
              </p>
              <label>
                <span>
                  Text-to-image model <span style={hintStyle}>(avatars + reference image)</span>
                </span>
                <input
                  data-testid="fal-model-t2i"
                  type="text"
                  value={falT2iEndpoint}
                  onChange={(e) => setFalT2iEndpoint(e.target.value)}
                  placeholder={DEFAULT_FAL_T2I_ENDPOINT}
                  spellCheck={false}
                  autoCapitalize="off"
                  style={{ display: "block", fontFamily: "ui-monospace, SFMono-Regular, monospace", fontSize: "0.85em" }}
                />
                <span style={hintStyle}>
                  Used when no reference image is passed — avatar generation and the white-bg reference creation.
                  Default: <code>{DEFAULT_FAL_T2I_ENDPOINT}</code>.
                </span>
              </label>
              <label>
                <span>
                  Image-to-image (edit) model <span style={hintStyle}>(chat scenes with references)</span>
                </span>
                <input
                  data-testid="fal-model-edit"
                  type="text"
                  value={falEditEndpoint}
                  onChange={(e) => setFalEditEndpoint(e.target.value)}
                  placeholder={DEFAULT_FAL_EDIT_ENDPOINT}
                  spellCheck={false}
                  autoCapitalize="off"
                  style={{ display: "block", fontFamily: "ui-monospace, SFMono-Regular, monospace", fontSize: "0.85em" }}
                />
                <span style={hintStyle}>
                  Used when a reference image is passed — chat scene generation and per-image regen with edits.
                  Default: <code>{DEFAULT_FAL_EDIT_ENDPOINT}</code>.
                </span>
              </label>
            </div>
          </div>

          {/* Cycle 0095 — Style picker. Drives the prompt-template suffix
              that fal/Seedream lacks as an API parameter. New characters'
              avatar generation reads this; chat scenes for an existing
              character read the per-character `avatar_style` snapshot
              (Cycle 0093) instead, so flipping this doesn't restyle
              characters who were generated under a different setting. */}
          <div>
            <p style={sectionLabel}>Default style</p>
            <div style={sectionCard}>
              <p style={{ color: "var(--sp-fg-3)", fontSize: "0.85em", margin: 0 }}>
                Drives the look of newly-generated avatars and references. Each character also stores its own snapshot
                of this setting so existing characters keep their original style when you change the global default — to
                update an existing character to a new style, regenerate its avatar.
              </p>
              <div style={{ display: "grid", gap: "0.4rem" }}>
                {(["realistic", "anime", "custom"] as const).map((opt) => (
                  <label
                    key={opt}
                    style={{ display: "flex", gap: "0.5rem", alignItems: "center", cursor: "pointer" }}
                  >
                    <input
                      type="radio"
                      name="fal-style"
                      data-testid={`fal-style-${opt}`}
                      checked={falPrefs.style === opt}
                      onChange={() => setFalPrefs((p) => ({ ...p, style: opt }))}
                    />
                    <span style={{ textTransform: "capitalize" }}>{opt}</span>
                    {opt === "anime" && (
                      <span style={{ ...hintStyle, marginLeft: "0.4rem" }}>
                        (default — Seedream's anime mode + cel shading)
                      </span>
                    )}
                    {opt === "realistic" && (
                      <span style={{ ...hintStyle, marginLeft: "0.4rem" }}>
                        (photorealistic + sharp focus + natural lighting)
                      </span>
                    )}
                    {opt === "custom" && (
                      <span style={{ ...hintStyle, marginLeft: "0.4rem" }}>
                        (your own suffix appended to every prompt)
                      </span>
                    )}
                  </label>
                ))}
              </div>
              {falPrefs.style === "custom" && (
                <label>
                  <span>Custom style suffix</span>
                  <textarea
                    data-testid="fal-custom-template"
                    rows={3}
                    value={falPrefs.custom_template}
                    onChange={(e) => setFalPrefs((p) => ({ ...p, custom_template: e.target.value }))}
                    placeholder="e.g. watercolor painting, dreamy soft palette, illustrated like a Studio Ghibli still"
                  />
                  <span style={hintStyle}>
                    Appended to the refined paragraph. Pure prose — Seedream lacks a style enum, this is how the look is steered.
                  </span>
                </label>
              )}
            </div>
          </div>

          {/* Cycle 0095 — Reference history stepper. Default 0 keeps the
              cost minimum (1 image_urls = the character's reference). >0
              appends the last N chat-scene CDN URLs as additional refs
              for stronger continuity at extra cost. */}
          <div>
            <p style={sectionLabel}>Reference continuity</p>
            <div style={sectionCard}>
              <p style={{ color: "var(--sp-fg-3)", fontSize: "0.85em", margin: 0 }}>
                Chat-scene generation always passes the character's white-bg reference image as the primary anchor. You
                can also append the last few chat-scene images as extra refs — useful when scenes share a setting and
                you want continuity (lighting, outfit changes, props). Off (0) by default to keep token / latency cost
                minimal.
              </p>
              <label>
                <span>
                  Use last N chat images as refs <span style={hintStyle}>(0–5, default 0)</span>
                </span>
                <input
                  type="number"
                  data-testid="fal-history-refs"
                  min={0}
                  max={5}
                  value={falPrefs.use_chat_history_refs}
                  onChange={(e) => {
                    const n = Math.max(0, Math.min(5, Math.round(Number(e.target.value) || 0)));
                    setFalPrefs((p) => ({ ...p, use_chat_history_refs: n }));
                  }}
                  style={{ width: "6rem", display: "block" }}
                />
              </label>
            </div>
          </div>

          {falError && (
            <StatusBanner tone="error" testid="fal-error" role="alert">{falError}</StatusBanner>
          )}

          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="submit"
              data-testid="fal-save"
              disabled={falSaveDisabled}
              style={saveBtnStyle(falSaveDisabled)}
            >
              {falStatus === "saving" ? "Saving…" : falRow ? "Save changes" : "Save & activate"}
            </button>
            <span style={{ color: "var(--sp-fg-3)", fontSize: "0.85em" }}>
              Saving activates fal.ai. ComfyUI's row stays preserved.
            </span>
          </div>
        </form>
      )}

      {activeTab === "comfyui" && (
      <form onSubmit={onSave} data-form="stack" style={{ display: "grid", gap: "1.25rem" }}>

        {/* Connection */}
        <div>
          <p style={sectionLabel}>Connection</p>
          <div style={sectionCard}>
            <label>
              <span>Base URL</span>
              <input
                data-testid="img-base-url"
                type="url"
                required
                placeholder="http://127.0.0.1:8188"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
              <span style={hintStyle}>Your local or remote ComfyUI instance (default port 8188).</span>
            </label>

            <label>
              <span>
                API key <span style={hintStyle}>(optional)</span>
              </span>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input
                  data-testid="img-api-key"
                  type={showKey ? "text" : "password"}
                  placeholder={existing?.vault_secret_id ? "••• key stored — enter new to rotate" : "Most local ComfyUI instances need none"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  style={{ flex: 1, display: "block" }}
                />
                <button type="button" onClick={() => setShowKey((v) => !v)} style={ghostBtnStyle}>
                  {showKey ? "Hide" : "Show"}
                </button>
              </div>
            </label>
          </div>
        </div>

        {/* Workflow overrides */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.5rem" }}>
            <p style={{ ...sectionLabel, margin: 0 }}>Workflow overrides</p>
            <button
              type="button"
              data-testid="img-wrap-reset"
              onClick={() => {
                setPositivePrefix(DEFAULT_POSITIVE_PREFIX);
                setPositiveSuffix(DEFAULT_POSITIVE_SUFFIX);
                setNegativePrefix(DEFAULT_NEGATIVE_PREFIX);
                setNegativeSuffix("");
              }}
              style={ghostSmallBtnStyle}
              title="Replace the four wrap fields with the current Animagine XL 4.0 defaults. Save to persist."
            >
              Reset to defaults
            </button>
          </div>
          <div style={sectionCard}>
            <p style={{ color: "var(--sp-fg-3)", fontSize: "0.85em", margin: 0 }}>
              These values override the workflow JSON on every run — tune here
              instead of editing the JSON by hand. Prefixes are spliced before
              the refined scene tags; suffixes after. Defaults follow the
              Animagine XL 4.0 prompting guide.
            </p>
            <label>
              <span>Positive prefix</span>
              <textarea
                data-testid="img-pos-prefix"
                rows={2}
                value={positivePrefix}
                onChange={(e) => setPositivePrefix(e.target.value)}
              />
            </label>
            <label>
              <span>Positive suffix</span>
              <textarea
                data-testid="img-pos-suffix"
                rows={2}
                value={positiveSuffix}
                onChange={(e) => setPositiveSuffix(e.target.value)}
                placeholder="Optional trailing tags (e.g. specific style boosters)"
              />
            </label>
            <label>
              <span>Negative prefix</span>
              <textarea
                data-testid="img-neg-prefix"
                rows={2}
                value={negativePrefix}
                onChange={(e) => setNegativePrefix(e.target.value)}
              />
            </label>
            <label>
              <span>Negative suffix</span>
              <textarea
                data-testid="img-neg-suffix"
                rows={2}
                value={negativeSuffix}
                onChange={(e) => setNegativeSuffix(e.target.value)}
                placeholder="Optional trailing tags (e.g. model-specific negatives)"
              />
            </label>
            <p style={{ fontSize: "0.85em", color: "var(--sp-fg-3)", margin: 0 }}>
              SFW guardrail tokens (<code>nsfw, nude, explicit, …</code>) are appended
              automatically at request time when SFW mode is ON in{" "}
              <Link to="/settings/data-security" style={{ color: "var(--sp-fg-2)" }}>
                Data &amp; Security
              </Link>
              . Toggling SFW off removes them — you do not need to add or remove them here.
            </p>
            <label>
              <span>Checkpoint (optional)</span>
              <input
                data-testid="img-checkpoint"
                type="text"
                value={checkpointOverride}
                onChange={(e) => setCheckpointOverride(e.target.value)}
                placeholder="e.g. novaAnimeXL_ilV110.safetensors — leave blank to use the workflow JSON's baked model"
              />
              <span style={hintStyle}>
                Filename as it appears in ComfyUI's <code>models/checkpoints/</code> folder.
                Blank → the model inside the workflow JSON wins.
              </span>
            </label>
          </div>
        </div>

        {/* Default resolution */}
        <div>
          <p style={sectionLabel}>Default resolution</p>
          <div style={sectionCard}>
            <p style={{ color: "var(--sp-fg-3)", fontSize: "0.85em", margin: 0 }}>
              The base resolution for every image you generate. Per-Conversation
              overrides (Chat Controls → Generation overrides) take priority over
              this when set.
            </p>
            <label>
              <span>Preset</span>
              <select
                data-testid="img-default-resolution"
                value={defaultResolution}
                onChange={(e) => setDefaultResolution(e.target.value)}
              >
                {RESOLUTION_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} ({p.dims[0]}×{p.dims[1]})
                  </option>
                ))}
                <option value="custom">Custom…</option>
              </select>
            </label>
            {defaultResolution === "custom" && (
              <label>
                <span>Custom dimensions (e.g. <code>1536x1024</code>)</span>
                <input
                  type="text"
                  data-testid="img-default-resolution-custom"
                  value={customResolution}
                  onChange={(e) => setCustomResolution(e.target.value)}
                  placeholder="WIDTHxHEIGHT"
                />
              </label>
            )}
          </div>
        </div>

        {/* Image prompt refinement */}
        <div>
          <p style={sectionLabel}>Image prompt refinement</p>
          <div style={sectionCard}>
            <p style={{ color: "var(--sp-fg-3)", fontSize: "0.85em", margin: 0 }}>
              A second LLM pass that rewrites the chat's scene description into a
              rich diffusion prompt using recent conversation context. Off →
              the <code>[image: …]</code> text flows through unchanged.
            </p>

            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
              <span style={{ flex: 1 }}>
                <strong>Enable refinement</strong>
                <span style={{ ...hintStyle, display: "block" }}>
                  While SFW mode is on (Settings → Data &amp; Security), the refiner
                  always runs — it also performs the semantic safety check. Turning
                  this off only takes effect when NSFW content is allowed.
                </span>
              </span>
              <input
                type="checkbox"
                className="sp-toggle"
                data-testid="img-refine-enabled"
                checked={refinePrefs.enabled}
                onChange={(e) => setRefinePrefs((p) => ({ ...p, enabled: e.target.checked }))}
              />
            </label>

            <label>
              <span>Context messages <span style={hintStyle}>(0–10 pairs)</span></span>
              <input
                type="number"
                data-testid="img-refine-context"
                min={0}
                max={10}
                value={refinePrefs.context_messages}
                disabled={!refinePrefs.enabled}
                onChange={(e) => {
                  const n = Math.max(0, Math.min(10, Math.round(Number(e.target.value) || 0)));
                  setRefinePrefs((p) => ({ ...p, context_messages: n }));
                }}
                style={{ width: "6rem", display: "block" }}
              />
            </label>

            <div style={{ display: "grid", gap: "0.5rem", opacity: refinePrefs.enabled ? 1 : 0.5 }}>
              <p style={{ ...sectionLabel, margin: 0 }}>System prompt</p>
              <div style={{ display: "flex", gap: "1rem" }}>
                <label style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                  <input
                    type="radio"
                    name="img-refiner-mode"
                    data-testid="img-refiner-mode-default"
                    checked={refinerMode === "default"}
                    onChange={() => { setRefinerMode("default"); setRefinerSystem(""); }}
                    disabled={!refinePrefs.enabled}
                  />
                  <span>Default</span>
                </label>
                <label style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                  <input
                    type="radio"
                    name="img-refiner-mode"
                    data-testid="img-refiner-mode-custom"
                    checked={refinerMode === "custom"}
                    onChange={() => setRefinerMode("custom")}
                    disabled={!refinePrefs.enabled}
                  />
                  <span>Custom</span>
                </label>
              </div>

              {refinerMode === "default" ? (
                <div style={{ display: "grid", gap: "0.4rem" }}>
                  <p style={{ color: "var(--sp-fg-3)", fontSize: "0.8rem", margin: 0 }}>
                    Using the refiner prompt bundled with this image provider
                    (currently tuned for anime SDXL / Danbooru tags). Different
                    providers ship different defaults — switching to Flux or
                    DALL-E would bring its own prompt here.
                  </p>
                  <button
                    type="button"
                    data-testid="img-refiner-view-default"
                    onClick={() => setShowRefinerDefault((v) => !v)}
                    disabled={!refinerSystemPlaceholder}
                    style={{ ...ghostBtnStyle, alignSelf: "start" }}
                  >
                    {showRefinerDefault ? "Hide default" : "View default"}
                  </button>
                  {showRefinerDefault && (
                    <pre
                      data-testid="img-refiner-default-preview"
                      style={previewPreStyle}
                    >
                      {refinerSystemPlaceholder || "(loading…)"}
                    </pre>
                  )}
                </div>
              ) : (
                <div style={{ display: "grid", gap: "0.4rem" }}>
                  <textarea
                    data-testid="img-refiner-system"
                    rows={10}
                    value={refinerSystem}
                    placeholder={refinerSystemPlaceholder || "(load default to see the built-in prompt)"}
                    onChange={(e) => setRefinerSystem(e.target.value)}
                  />
                  <button
                    type="button"
                    data-testid="img-refiner-load-default"
                    onClick={() => setRefinerSystem(refinerSystemPlaceholder)}
                    disabled={!refinerSystemPlaceholder}
                    style={{ ...ghostBtnStyle, alignSelf: "start" }}
                  >
                    Load default as starting point
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Workflow JSON */}
        <div>
          <p style={sectionLabel}>Default style workflow (API-format JSON)</p>
          <div style={sectionCard}>
            <p style={{ color: "var(--sp-fg-3)", fontSize: "0.85em", margin: 0 }}>
              Export via ComfyUI → Save (API Format). Works out-of-the-box for any
              workflow with a single KSampler wired to positive / negative
              CLIPTextEncode nodes. (Optional override: title nodes
              <code> positive</code>, <code>negative</code>, <code>sampler</code>.)
            </p>
            <input
              type="file"
              data-testid="img-workflow-file"
              accept="application/json,.json"
              onChange={onPickWorkflowFile}
            />
            <textarea
              data-testid="img-workflow-json"
              rows={10}
              value={workflowText}
              onChange={(e) => setWorkflowText(e.target.value)}
              placeholder='{"3": {"class_type": "KSampler", "_meta": {"title": "sampler"}, ...}}'
            />
            {workflowError && (
              <StatusBanner tone="error" testid="img-workflow-error" role="alert">{workflowError}</StatusBanner>
            )}
          </div>
        </div>

        {error && (
          <StatusBanner tone="error" testid="img-error" role="alert">{error}</StatusBanner>
        )}

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <button type="submit" data-testid="img-save" disabled={status === "saving"} style={saveBtnStyle(status === "saving")}>
            {status === "saving"
              ? "Saving…"
              : activeFamily === IMAGE_PROVIDER_FAMILIES.COMFYUI
                ? "Save changes"
                : "Save & activate"}
          </button>
          <button
            type="button"
            data-testid="img-test"
            onClick={onTest}
            disabled={testing || !existing}
            title={!existing ? "Save first, then test" : undefined}
            style={ghostBtnStyle}
          >
            {testing ? "Testing…" : "Test Connection"}
          </button>
        </div>

        {testResult && (
          <StatusBanner
            tone={testResult.ok ? "success" : "error"}
            testid="img-test-result"
            role="status"
          >
            {testResult.ok ? "OK — ComfyUI responded" : `Failed: ${testResult.error ?? testResult.status}`}
          </StatusBanner>
        )}
      </form>
      )}
    </main>
  );
}

const mainStyle: React.CSSProperties = { maxWidth: 640, margin: "2rem auto", padding: "0 1rem" };
const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1.75rem" };

const sectionLabel: React.CSSProperties = {
  fontSize: "var(--sp-text-xs)",
  fontWeight: 600,
  letterSpacing: "var(--sp-tracking-caps)",
  textTransform: "uppercase",
  color: "var(--sp-fg-3)",
  paddingLeft: 4,
  margin: "0 0 0.5rem",
};

const sectionCard: React.CSSProperties = {
  background: "var(--sp-bg-2)",
  border: "1px solid var(--sp-border)",
  borderRadius: "var(--sp-radius)",
  padding: "1rem",
  display: "grid",
  gap: "0.85rem",
};

const hintStyle: React.CSSProperties = { fontSize: "0.8rem", color: "var(--sp-fg-3)" };

const previewPreStyle: React.CSSProperties = {
  whiteSpace: "pre-wrap",
  fontSize: "0.75em",
  color: "var(--sp-fg-3)",
  padding: "0.5rem 0.75rem",
  background: "var(--sp-bg-3)",
  borderRadius: "var(--sp-radius)",
  margin: 0,
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

// Segmented pill tab strip — matches the kit Mode toggle pattern (cycle 0072
// CharacterForm tabs). Container is a soft pill, active button gets the brand
// gradient fill; inactive buttons stay transparent over the container surface.
const tabsContainerStyle: React.CSSProperties = {
  display: "inline-flex",
  gap: 4,
  padding: 4,
  background: "var(--sp-bg-2)",
  border: "1px solid var(--sp-border)",
  borderRadius: "var(--sp-radius)",
  marginBottom: "1.25rem",
};

function tabButtonStyle(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.4rem",
    padding: "0.45rem 1rem",
    background: active ? "var(--sp-brand-1)" : "transparent",
    color: active ? "var(--sp-fg-on-brand)" : "var(--sp-fg-2)",
    border: "none",
    borderRadius: "var(--sp-radius)",
    fontWeight: active ? 600 : 500,
    fontFamily: "inherit",
    fontSize: "0.9rem",
    cursor: "pointer",
  };
}

const tabActiveDotStyle: React.CSSProperties = {
  display: "inline-block",
  width: 6,
  height: 6,
  borderRadius: "var(--sp-radius)",
  background: "currentColor",
  opacity: 0.75,
};

const inactiveBannerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "0.75rem",
  padding: "0.6rem 0.85rem",
  background: "var(--sp-bg-2)",
  border: "1px solid var(--sp-border)",
  borderRadius: "var(--sp-radius)",
  marginBottom: "1rem",
  fontSize: "0.85em",
  color: "var(--sp-fg-3)",
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
