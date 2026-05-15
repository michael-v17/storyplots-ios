import { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, Pause, Play } from "lucide-react";
import { applyPlaybackPrefs, audioUrl, generateAudioForMessage, loadPlaybackPrefs, speakWebSpeech, splitTextForTTS } from "../../lib/audio";
import { Icon } from "../../lib/Icon";
import { supabase } from "../../lib/supabase";
import { useIsMobile } from "../../lib/useIsMobile";

type Status = "idle" | "loading" | "playing" | "error";

// Module-scoped cancellation handle on the audio queue currently
// playing. Cycle 0020 plays N segment clips back-to-back through a
// single <audio> element — starting a new button cancels the whole
// queue, not just the current clip. Preserves the cycle-0017 UX
// contract ("only one audio plays at a time").
type ActiveQueue = {
  token: object;              // identity — compared with === to detect staleness
  audio: HTMLAudioElement;
  cleanup: () => void;
};
let activeQueue: ActiveQueue | null = null;

function stopCurrent() {
  if (!activeQueue) return;
  try { activeQueue.audio.pause(); } catch { /* best-effort */ }
  activeQueue.cleanup();
  activeQueue = null;
}

type Props = {
  messageId: string;
  disabled: boolean;
  // When rendered inside the assistant action rail (Cycle 0071) the
  // button adopts the 40×40 accent chip shape used by ↻/⑂/🖼.
  // Elsewhere (no current caller) it falls back to the legacy ghost
  // style so adopting the new look stays opt-in.
  accent?: boolean;
};

export function MessageAudioButton({ messageId, disabled, accent = false }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const queueTokenRef = useRef<object | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    // On unmount, stop the queue if it's still ours so the audio
    // doesn't outlive the button.
    return () => {
      if (activeQueue && activeQueue.token === queueTokenRef.current) stopCurrent();
    };
  }, []);

  async function onClick() {
    if (disabled || status === "loading") return;
    if (status === "playing") {
      stopCurrent();
      setStatus("idle");
      return;
    }
    setStatus("loading"); setError(null);
    try {
      const prefs = await loadPlaybackPrefs();
      const family = prefs.active_provider;

      // WebSpeech — fully client-side, no backend call.
      if (family === "webspeech") {
        stopCurrent();
        setStatus("playing");
        const { data: msg } = await supabase
          .from("messages")
          .select("active_variant_id")
          .eq("id", messageId)
          .single();
        if (!msg?.active_variant_id) throw new Error("no active variant");
        const { data: variant } = await supabase
          .from("message_variants")
          .select("content")
          .eq("id", msg.active_variant_id)
          .single();
        const text = variant?.content ?? "";
        const segments = prefs.dual_voice ? splitTextForTTS(text) : [{ kind: "narrator" as const, text: text.replace(/\[image:\s*[^\]]+?\s*\]/gi, "").trim() }];
        for (const seg of segments) {
          if (!seg.text) continue;
          await speakWebSpeech(seg.text, null, prefs, seg.kind);
        }
        setStatus("idle");
        return;
      }

      const rows = await generateAudioForMessage(messageId);
      if (rows.length === 0) throw new Error("no audio segments");
      const segments = await Promise.all(rows.map(async (r) => ({
        url: await audioUrl(r.storage_ref),
        kind: (r.provider_snapshot as Record<string, unknown>)?.kind as "narrator" | "character" | undefined,
      })));
      const resolved = segments.filter((s): s is { url: string; kind: "narrator" | "character" | undefined } => !!s.url);
      if (resolved.length === 0) throw new Error("no audio URL");

      stopCurrent();
      const token = {};
      queueTokenRef.current = token;

      const el = new Audio();
      const onErr = () => {
        if (activeQueue?.token !== token) return;
        setStatus("error");
        setError("playback failed");
        stopCurrent();
      };
      let idx = 0;
      const playNext = async () => {
        if (activeQueue?.token !== token) return;
        if (idx >= resolved.length) {
          stopCurrent();
          setStatus("idle");
          return;
        }
        const seg = resolved[idx];
        el.src = seg.url;
        applyPlaybackPrefs(el, prefs, seg.kind);
        idx += 1;
        try { await el.play(); } catch { onErr(); }
      };
      const onEnded = () => { void playNext(); };
      el.addEventListener("ended", onEnded);
      el.addEventListener("error", onErr);

      activeQueue = {
        token,
        audio: el,
        cleanup: () => {
          el.removeEventListener("ended", onEnded);
          el.removeEventListener("error", onErr);
        },
      };
      // Set "playing" BEFORE kicking the queue: a cached single-segment
      // clip can end synchronously on fast networks / cache hits, and
      // the onEnded → stopCurrent → setStatus("idle") sequence would
      // otherwise be clobbered by a later setStatus("playing") here,
      // leaving the button stuck on "playing" after audio stopped.
      setStatus("playing");
      await playNext();
    } catch (e) {
      setStatus("error");
      setError(String(e).slice(0, 140));
    }
  }

  const iconEl = status === "loading"
    ? <Icon icon={Loader2} size={17} style={{ animation: "sp-spin 1s linear infinite" }} />
    : status === "playing" ? <Icon icon={Pause} size={17} />
    : status === "error" ? <Icon icon={AlertCircle} size={17} />
    : <Icon icon={Play} size={17} />;
  const label = accent || isMobile ? null
    : status === "loading" ? "Loading…"
    : status === "playing" ? "Stop"
    : status === "error" ? "Retry"
    : "Play";

  const isDisabled = disabled || status === "loading";
  const style: React.CSSProperties = accent
    ? {
        width: 40,
        height: 40,
        borderRadius: "50%",
        background: "var(--sp-bg-3)",
        border: "1px solid var(--sp-border-soft)",
        color: status === "error" ? "var(--sp-destructive)" : "var(--char-accent)",
        cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: isDisabled ? 0.45 : 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 16,
        lineHeight: 1,
        padding: 0,
        transition: "transform 120ms var(--sp-ease), opacity 120ms var(--sp-ease)",
      }
    : {
        fontSize: "0.75em",
        padding: "0.125rem 0.5rem",
        opacity: 0.6,
        color: status === "error" ? "var(--sp-destructive)" : undefined,
      };

  const actionLabel = status === "playing" ? "Stop TTS"
    : status === "error" ? "Retry TTS"
    : status === "loading" ? "Loading TTS"
    : "Play TTS for this reply";

  return (
    <button
      type="button"
      data-testid={`msg-audio-${messageId}`}
      onClick={onClick}
      disabled={isDisabled}
      aria-label={actionLabel}
      style={{ ...style, display: "inline-flex", alignItems: "center", gap: label ? "0.3rem" : 0 }}
      title={status === "error" && error ? error : actionLabel}
    >
      {iconEl}{label}
    </button>
  );
}
