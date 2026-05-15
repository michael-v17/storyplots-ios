import { supabase } from "./supabase";

export type ProviderKind = "text" | "image" | "video" | "tts" | "stt" | "embedding";

export type ProviderConfig = {
  id: string;
  user_id: string;
  kind: ProviderKind;
  provider_family: string;
  base_url: string | null;
  vault_secret_id: string | null;
  api_key_encrypted: string | null;
  model_id: string | null;
  temperature: number | null;
  max_tokens: number | null;
  context_length: number | null;
  thinking_mode: boolean;
  workflow_config: Record<string, unknown> | null;
  last_tested_ok: boolean | null;
  last_tested_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type TextProviderDraft = {
  provider_family: string;
  base_url: string | null;
  api_key: string | null;                 // blank to keep existing
  model_id: string | null;
  temperature: number | null;
  max_tokens: number | null;
  context_length: number | null;
  thinking_mode: boolean;
};

// schema.md §2.17 enumerates the provider_family strings. Default base_url
// hints live client-side so the user doesn't have to look them up.
export const TEXT_PROVIDERS: Array<{
  family: string;
  label: string;
  tier: "cloud" | "local";
  default_base_url: string;
}> = [
  { family: "OpenRouter",     label: "OpenRouter (200+ models, one key)", tier: "cloud", default_base_url: "https://openrouter.ai/api/v1" },
  { family: "OpenAI",         label: "OpenAI",                             tier: "cloud", default_base_url: "https://api.openai.com/v1" },
  { family: "Google",         label: "Google / Gemini",                    tier: "cloud", default_base_url: "https://generativelanguage.googleapis.com/v1beta" },
  { family: "xAI",            label: "xAI (Grok)",                         tier: "cloud", default_base_url: "https://api.x.ai/v1" },
  { family: "Atlas Cloud",    label: "Atlas Cloud",                        tier: "cloud", default_base_url: "" },
  { family: "Alibaba Cloud",  label: "Alibaba Cloud",                      tier: "cloud", default_base_url: "" },
  { family: "Ollama",         label: "Ollama (local)",                     tier: "local", default_base_url: "http://localhost:11434/v1" },
  { family: "LM Studio",      label: "LM Studio (local)",                  tier: "local", default_base_url: "http://localhost:1234/v1" },
  { family: "KoboldCpp",      label: "KoboldCpp (local)",                  tier: "local", default_base_url: "http://localhost:5001/v1" },
  { family: "llama.cpp",      label: "llama.cpp (local)",                  tier: "local", default_base_url: "http://localhost:8080/v1" },
  { family: "Text Gen WebUI", label: "Text Gen WebUI (local)",             tier: "local", default_base_url: "http://localhost:5000/v1" },
  { family: "vLLM",           label: "vLLM (local)",                       tier: "local", default_base_url: "http://localhost:8000/v1" },
];

export function isCloudProvider(family: string): boolean {
  return TEXT_PROVIDERS.find((p) => p.family === family)?.tier === "cloud";
}

// Cycle 0029 — Memory Engine provider families. 1536-dim fixed (OpenAI text-embedding-3-small standard).
// Cycle 0050 — OpenRouter added first and marked recommended: same model, single
// BYOK account alongside the text provider. OpenRouter namespaces models by
// upstream owner, so the model id is `openai/text-embedding-3-small` (with the
// `openai/` prefix); OpenAI-direct uses the bare `text-embedding-3-small`.
export const EMBEDDING_PROVIDERS: Array<{
  family: string;
  label: string;
  default_base_url: string;
  default_model: string;
}> = [
  { family: "OpenRouter", label: "OpenRouter (recommended)", default_base_url: "https://openrouter.ai/api/v1", default_model: "openai/text-embedding-3-small" },
  { family: "OpenAI",     label: "OpenAI",                   default_base_url: "https://api.openai.com/v1",    default_model: "text-embedding-3-small" },
  { family: "Jina",       label: "Jina AI",                  default_base_url: "https://api.jina.ai/v1",       default_model: "jina-embeddings-v3" },
  { family: "Custom",     label: "Custom / self-hosted",     default_base_url: "",                             default_model: "text-embedding-3-small" },
];

export type EmbeddingProviderDraft = {
  provider_family: string;
  base_url: string | null;
  api_key: string | null;   // blank to keep existing
  model_id: string | null;
};

export async function listActiveEmbeddingProvider(): Promise<ProviderConfig | null> {
  const { data, error } = await supabase
    .from("provider_configs")
    .select("*")
    .eq("kind", "embedding")
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return data as ProviderConfig | null;
}

export async function upsertEmbeddingProvider(draft: EmbeddingProviderDraft): Promise<ProviderConfig> {
  const { data, error } = await supabase.rpc("upsert_embedding_provider", {
    p_provider_family: draft.provider_family,
    p_base_url: draft.base_url,
    p_api_key: draft.api_key,
    p_model_id: draft.model_id,
  });
  if (error) throw error;
  return data as ProviderConfig;
}

export async function listActiveTextProvider(): Promise<ProviderConfig | null> {
  const { data, error } = await supabase
    .from("provider_configs")
    .select("*")
    .eq("kind", "text")
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return data as ProviderConfig | null;
}

export async function upsertTextProvider(draft: TextProviderDraft): Promise<ProviderConfig> {
  const { data, error } = await supabase.rpc("upsert_text_provider", {
    p_provider_family: draft.provider_family,
    p_base_url: draft.base_url,
    p_api_key: draft.api_key,
    p_model_id: draft.model_id,
    p_temperature: draft.temperature,
    p_max_tokens: draft.max_tokens,
    p_context_length: draft.context_length,
    p_thinking_mode: draft.thinking_mode,
  });
  if (error) throw error;
  return data as ProviderConfig;
}

export async function deleteProvider(id: string): Promise<void> {
  const { error } = await supabase.rpc("delete_provider", { p_id: id });
  if (error) throw error;
}
