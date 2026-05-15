import { supabase } from "./supabase";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://127.0.0.1:8000";

export type CorrectionPayload = {
  user_message_id: string;
  // The raw user message text — needed so the inline row's word-diff
  // highlights only the changed span live, matching the reloaded state
  // (which reads original_text from the persisted grammar_corrections row).
  original_text: string;
  already_correct: boolean;
  corrected_text: string;
  explanation: string | null;
  error_categories: string[];
};

export type ChatStreamEvent =
  | { type: "start"; message_id: string; variant_id: string }
  | { type: "token"; text: string }
  | { type: "done"; message_id: string; variant_id: string }
  | { type: "error"; message: string }
  | { type: "correction" } & CorrectionPayload
  | { type: "rewrite_required" } & CorrectionPayload
  | { type: "grammar_error"; message: string };

export type StreamOpts = {
  conversation_id: string;
  regenerate_message_id?: string;
  reinforcement_pass?: boolean;
  reinforcement_exhausted?: boolean;
  reinforcement_user_message_id?: string;
  reinforcement_failures?: number;
};

export async function* streamChat(opts: StreamOpts): AsyncGenerator<ChatStreamEvent> {
  const { data } = await supabase.auth.getSession();
  const jwt = data.session?.access_token;
  if (!jwt) { yield { type: "error", message: "not authenticated" }; return; }

  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/chat`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${jwt}`, "Content-Type": "application/json" },
      body: JSON.stringify(opts),
    });
  } catch (e) {
    yield { type: "error", message: String(e) };
    return;
  }

  if (!res.body || !res.ok) {
    const text = await res.text().catch(() => "");
    yield { type: "error", message: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    return;
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    // SSE frames are separated by blank lines ("\n\n").
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const ev = parseFrame(frame);
      if (ev) yield ev;
    }
  }
}

function parseFrame(frame: string): ChatStreamEvent | null {
  let eventName = "message";
  const dataLines: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("event: ")) eventName = line.slice(7).trim();
    else if (line.startsWith("data: ")) dataLines.push(line.slice(6));
  }
  if (dataLines.length === 0) return null;
  try {
    const payload = JSON.parse(dataLines.join("\n"));
    return { type: eventName, ...payload } as ChatStreamEvent;
  } catch {
    return null;
  }
}

export type TestConnectionResult = { ok: boolean; error?: string; model?: string; status?: number };

export async function testConnection(): Promise<TestConnectionResult> {
  const { data } = await supabase.auth.getSession();
  const jwt = data.session?.access_token;
  if (!jwt) return { ok: false, error: "not authenticated" };
  const res = await fetch(`${BACKEND_URL}/providers/test`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${jwt}`, "Content-Type": "application/json" },
  });
  return res.json();
}
