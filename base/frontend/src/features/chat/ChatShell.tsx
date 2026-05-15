import { useEffect, useRef, useState } from "react";
import { Keyboard, Menu, MoreHorizontal, Pencil } from "lucide-react";
import { Icon } from "../../lib/Icon";
import { Link, useNavigate } from "react-router-dom";
import type { Character } from "../../lib/characters";
import { streamChat } from "../../lib/chat";
import type { Conversation } from "../../lib/conversations";
import {
  listCorrectionsForConversation,
  readGrammarPrefs,
  type GrammarCorrection,
  type GrammarPrefs,
} from "../../lib/grammar";
import {
  generateImageForMessage,
  type GenerationOverrides,
  listImagesForMessage,
  type GeneratedImage,
} from "../../lib/images";
import { SkeletonMessages } from "../../lib/SkeletonMessages";
import { ImageViewer } from "./ImageViewer";
import {
  deleteMessage,
  editUserMessage,
  listMessages,
  listVariantsForMessage,
  sendUserMessage,
  setActiveVariant,
  type Message,
  type MessageVariant,
} from "../../lib/messages";
import { applyPlaybackPrefs, audioUrl, generateAudioForMessage, loadPlaybackPrefs } from "../../lib/audio";
import { loadChatControlsState } from "../../lib/chatControlsState";
import { loadAuthorsNote, type AuthorsNote } from "../../lib/notes";
import { loadTTSMode } from "../../lib/ttsProvider";
import { extractImageTag, loadVisualRoleplayPrefs } from "../../lib/visualRoleplay";
import { loadPersona, type Persona } from "../../lib/persona";
import { listActiveTextProvider, type ProviderConfig } from "../../lib/providers";
import { supabase } from "../../lib/supabase";
import { loadMemoryPrefs, MEMORY_PREFS_DEFAULTS, type MemoryPrefs } from "../../lib/memoryPrefs";
import { subscribeMemorySaves, type MemoryToast } from "../../lib/memoryToast";
import { BranchBreadcrumb } from "./BranchBreadcrumb";
import { MessageAvatar } from "./MessageAvatar";
import { ChatControlsPanel } from "./ChatControlsPanel";
import { useBreakpoint } from "../../lib/useBreakpoint";
import { useShellDrawer } from "../shell/AppShell";
import { Composer } from "./Composer";
import { ConversationSwitcher } from "./ConversationSwitcher";
import { EditTrimDialog } from "./EditTrimDialog";
import { ForkDialog, pickAnchorPreview } from "./ForkDialog";
import { GrammarSidebarPanel } from "./GrammarSidebarPanel";
import { MessageFeed } from "./MessageFeed";
import { RewriteGate } from "./RewriteGate";

export function ChatShell({
  character,
  conversation,
  conversations,
  userId,
  onConversationsChange,
}: {
  character: Character;
  conversation: Conversation;
  conversations: Conversation[];
  userId: string;
  onConversationsChange: (next: Conversation[]) => void;
}) {
  const bp = useBreakpoint();
  const shellDrawer = useShellDrawer();
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [variantsByMessage, setVariantsByMessage] = useState<Record<string, MessageVariant[]>>({});
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [streamErrorByMessage, setStreamErrorByMessage] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Message | null>(null);
  const [provider, setProvider] = useState<ProviderConfig | null>(null);
  const [grammarPrefs, setGrammarPrefs] = useState<GrammarPrefs | null>(null);
  const [imageEnabled, setImageEnabled] = useState(false);
  const [corrections, setCorrections] = useState<Record<string, GrammarCorrection>>({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rewriteGate, setRewriteGate] = useState<{
    correctedText: string;
    explanation: string | null;
    userMessageId: string;
  } | null>(null);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [authorsNote, setAuthorsNote] = useState<AuthorsNote | null>(null);
  const [forking, setForking] = useState<Message | null>(null);
  const [userPersona, setUserPersona] = useState<Persona | null>(null);
  const [imagesByMessage, setImagesByMessage] = useState<Record<string, GeneratedImage[]>>({});
  const [imageGeneratingFor, setImageGeneratingFor] = useState<string | null>(null);
  const [viewerImage, setViewerImage] = useState<GeneratedImage | null>(null);
  const [autoGenerateEffective, setAutoGenerateEffective] = useState<boolean>(false);
  // Mirror of `autoGenerateEffective` as a ref so startStream closures can read
  // the latest value even when the pref finished loading *after* the closure
  // was captured (user hits Send during the mount race).
  const autoGenerateRef = useRef<boolean>(false);
  useEffect(() => { autoGenerateRef.current = autoGenerateEffective; }, [autoGenerateEffective]);
  const [autoTtsEffective, setAutoTtsEffective] = useState<boolean>(false);
  const autoTtsRef = useRef<boolean>(false);
  useEffect(() => { autoTtsRef.current = autoTtsEffective; }, [autoTtsEffective]);
  // Track which (messageId + variantId) pairs already fired an auto-generate
  // so React StrictMode double-invocation doesn't queue a second image.
  const autoFiredRef = useRef<Set<string>>(new Set());
  // Flip to true when the user navigates away mid-stream. startStream checks
  // this on SSE `done` before firing any auto-generate so that a stale
  // in-flight reply doesn't write state into the newly-loaded conversation.
  const conversationAbortRef = useRef<string | null>(null);
  useEffect(() => {
    conversationAbortRef.current = conversation.id;
    return () => { conversationAbortRef.current = null; };
  }, [conversation.id]);
  const navigate = useNavigate();

  // Cycle 0029 — memory save toasts. Subscribe while the chat is mounted.
  const [memoryPrefs, setMemoryPrefs] = useState<MemoryPrefs>(MEMORY_PREFS_DEFAULTS);
  const [memoryToasts, setMemoryToasts] = useState<MemoryToast[]>([]);
  const memoryPrefsRef = useRef<MemoryPrefs>(MEMORY_PREFS_DEFAULTS);
  useEffect(() => { memoryPrefsRef.current = memoryPrefs; }, [memoryPrefs]);

  useEffect(() => {
    let cancelled = false;
    loadMemoryPrefs(userId).then((p) => { if (!cancelled) setMemoryPrefs(p); }).catch(() => {});
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    const unsub = subscribeMemorySaves(conversation.id, (toast) => {
      const p = memoryPrefsRef.current;
      if (!p.enabled || !p.notifications_enabled) return;
      setMemoryToasts((prev) => [...prev, toast]);
      window.setTimeout(() => {
        setMemoryToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 4000);
    });
    return unsub;
  }, [conversation.id]);

  function dismissMemoryToast(id: string) {
    setMemoryToasts((prev) => prev.filter((t) => t.id !== id));
  }

  useEffect(() => {
    let cancelled = false;
    // Clear the previous conversation's grammar corrections immediately on
    // conversation change. ChatShell is not remounted between conversations
    // (no `key=`), so without this the sidebar + inline feed would show the
    // prior conversation's rows during the load window. The query below is
    // already conversation-scoped; this just kills the stale-display flash
    // and reinforces the per-Conversation scoping invariant.
    setCorrections({});
    (async () => {
      const list = await listMessages(conversation.id);
      if (cancelled) return;
      // Load variants for every assistant message BEFORE revealing the
      // feed. Setting messages first would paint assistant bubbles with
      // empty content (variants arrive a tick later) and pop the action
      // rail in afterwards — content + rail should land in one paint.
      // The skeleton holds until both resolve.
      const assistantIds = list.filter((m) => m.role === "assistant").map((m) => m.id);
      let variantMap: Record<string, MessageVariant[]> = {};
      try {
        const entries = await Promise.all(assistantIds.map(async (id) => [id, await listVariantsForMessage(id)] as const));
        variantMap = Object.fromEntries(entries);
      } catch {
        // A variant fetch failed — still reveal the feed (messages are
        // readable; the rail just won't have variant state). Gating
        // setMessages behind this would hang the skeleton forever.
      }
      if (cancelled) return;
      setVariantsByMessage(variantMap);
      setMessages(list);
    })();
    listActiveTextProvider()
      .then((p) => { if (!cancelled) setProvider(p); })
      .catch(() => { if (!cancelled) setProvider(null); });
    supabase.from("users").select("preferences").eq("id", userId).single()
      .then(({ data }) => {
        if (!cancelled) {
          setGrammarPrefs(readGrammarPrefs(data?.preferences as Record<string, unknown> | null));
          const imgPrefs = (data?.preferences as Record<string, unknown> | null)?.image;
          setImageEnabled(typeof imgPrefs === "object" && imgPrefs !== null && (imgPrefs as Record<string, unknown>).enabled === true);
        }
      });
    listCorrectionsForConversation(conversation.id)
      .then((list) => {
        if (!cancelled) {
          setCorrections(Object.fromEntries(list.map((c) => [c.user_message_id, c])));
        }
      });
    loadAuthorsNote(conversation.id)
      .then((n) => { if (!cancelled) setAuthorsNote(n); })
      .catch(() => { if (!cancelled) setAuthorsNote(null); });
    loadPersona(userId)
      .then((p) => { if (!cancelled) setUserPersona(p); })
      .catch(() => { if (!cancelled) setUserPersona(null); });
    // Effective auto-generate + auto-TTS = user defaults, overridden
    // by per-Conv toggles if the user set either explicitly.
    (async () => {
      const [vr, tts, ccs] = await Promise.all([
        loadVisualRoleplayPrefs(userId),
        loadTTSMode(userId),
        loadChatControlsState(conversation.id).catch(() => null),
      ]);
      if (cancelled) return;
      const imgOverride = ccs?.auto_images;
      setAutoGenerateEffective(
        imgOverride === true ? true : imgOverride === false ? false : vr.auto_generate_images,
      );
      const ttsOverride = ccs?.auto_tts;
      const ttsGlobal = tts === "auto";
      setAutoTtsEffective(
        ttsOverride === true ? true : ttsOverride === false ? false : ttsGlobal,
      );
    })();
    return () => { cancelled = true; };
  }, [conversation.id, userId]);

  // Load already-generated images when the message list settles. Keyed on
  // the stable set of assistant message ids so remounts don't refetch.
  useEffect(() => {
    let cancelled = false;
    if (!messages) return;
    const assistantIds = messages.filter((m) => m.role === "assistant").map((m) => m.id);
    (async () => {
      const entries = await Promise.all(
        assistantIds.map(async (id) => [id, await listImagesForMessage(id)] as const),
      );
      if (cancelled) return;
      setImagesByMessage((prev) => {
        const next = { ...prev };
        for (const [id, imgs] of entries) next[id] = imgs;
        return next;
      });
    })();
    return () => { cancelled = true; };
  }, [messages?.map((m) => m.id).join(",")]);

  async function startStream(
    regenerateMessageId?: string,
    reinforcementPass?: boolean,
    reinforcementExhausted?: boolean,
    reinforcementUserMessageId?: string,
    reinforcementFailures?: number,
  ) {
    setStreamErrorByMessage((e) => {
      if (!regenerateMessageId) return e;
      const { [regenerateMessageId]: _, ...rest } = e;
      return rest;
    });

    let messageId: string | null = regenerateMessageId ?? null;
    let variantId: string | null = null;
    let accumulated = "";

    try {
      for await (const ev of streamChat({
        conversation_id: conversation.id,
        regenerate_message_id: regenerateMessageId,
        reinforcement_pass: reinforcementPass,
        reinforcement_exhausted: reinforcementExhausted,
        reinforcement_user_message_id: reinforcementUserMessageId,
        reinforcement_failures: reinforcementFailures,
      })) {
        if (ev.type === "start") {
          messageId = ev.message_id;
          variantId = ev.variant_id;
          setStreamingMessageId(messageId);
          // Insert optimistic placeholder variant + message if new.
          const newVariant: MessageVariant = {
            id: variantId,
            message_id: messageId,
            content: "",
            model_snapshot: "",
            generation_params_snapshot: {},
            created_at: new Date().toISOString(),
          };
          setVariantsByMessage((prev) => ({
            ...prev,
            [messageId!]: [...(prev[messageId!] ?? []), newVariant],
          }));
          if (!regenerateMessageId) {
            const newMsg: Message = {
              id: messageId,
              conversation_id: conversation.id,
              role: "assistant",
              text: null,
              active_variant_id: variantId,
              created_at: new Date().toISOString(),
              edited_at: null,
            };
            setMessages((prev) => [...(prev ?? []), newMsg]);
          } else {
            setMessages((prev) =>
              (prev ?? []).map((m) => (m.id === messageId ? { ...m, active_variant_id: variantId } : m))
            );
          }
        } else if (ev.type === "token" && messageId && variantId) {
          accumulated += ev.text;
          setVariantsByMessage((prev) => {
            const list = prev[messageId!] ?? [];
            return {
              ...prev,
              [messageId!]: list.map((v) => v.id === variantId ? { ...v, content: v.content + ev.text } : v),
            };
          });
        } else if (ev.type === "done") {
          setStreamingMessageId(null);
          // Auto-fire image generation when Visual Roleplay auto-mode is
          // effective AND the assistant actually emitted an [image: …] tag
          // AND this was a fresh reply (not a regenerate — regenerate stays
          // chat-only so users can replay text without double-billing the
          // image backend). We read the final variant content through the
          // functional setter so we see the post-token-accumulation state
          // instead of the stale closure from startStream's render.
          if (autoGenerateRef.current && !regenerateMessageId && messageId && variantId
              && conversationAbortRef.current === conversation.id) {
            const mid = messageId; const vid = variantId;
            const fireKey = `${mid}:${vid}`;
            if (!autoFiredRef.current.has(fireKey) && extractImageTag(accumulated).imagePrompt) {
              autoFiredRef.current.add(fireKey);
              void onGenerateImage({
                id: mid, conversation_id: conversation.id, role: "assistant",
                text: null, active_variant_id: vid,
                created_at: new Date().toISOString(), edited_at: null,
              });
            }
          }
          // Auto-TTS plays the fresh reply when the effective flag is true.
          // Regenerate deliberately does NOT auto-play (mirrors the image
          // auto-mode convention). Separate fireKey tracking so image and
          // audio don't block each other.
          if (autoTtsRef.current && !regenerateMessageId && messageId && variantId
              && conversationAbortRef.current === conversation.id) {
            const mid = messageId; const vid = variantId;
            const fireKey = `tts:${mid}:${vid}`;
            if (!autoFiredRef.current.has(fireKey)) {
              autoFiredRef.current.add(fireKey);
              void (async () => {
                try {
                  const [rows, prefs] = await Promise.all([
                    generateAudioForMessage(mid),
                    loadPlaybackPrefs(),
                  ]);
                  if (rows.length === 0) return;
                  const urls = (await Promise.all(rows.map((r) => audioUrl(r.storage_ref))))
                    .filter((u): u is string => !!u);
                  if (urls.length === 0 || conversationAbortRef.current !== conversation.id) return;
                  // Sequential play — same pattern as MessageAudioButton. No
                  // cancellation on conversation-abort mid-queue; the user can
                  // navigate away and the audio stops via beforeunload.
                  const el = new Audio();
                  let idx = 0;
                  const playNext = () => {
                    if (idx >= urls.length) return;
                    el.src = urls[idx];
                    applyPlaybackPrefs(el, prefs);
                    idx += 1;
                    void el.play();
                  };
                  el.addEventListener("ended", playNext);
                  playNext();
                } catch {
                  // Auto-TTS failures shouldn't interrupt the chat — the user
                  // can hit ▶ manually to surface the error message.
                }
              })();
            }
          }
        } else if (ev.type === "correction" && !ev.already_correct) {
          setCorrections((prev) => ({
            ...prev,
            [ev.user_message_id]: {
              id: "",
              user_message_id: ev.user_message_id,
              conversation_id: conversation.id,
              user_id: userId,
              original_text: ev.original_text,
              corrected_text: ev.corrected_text,
              explanation: ev.explanation,
              error_categories: ev.error_categories,
              edit_distance: null,
              reinforcement_failures_count: 0,
              created_at: new Date().toISOString(),
            },
          }));
        } else if (ev.type === "rewrite_required") {
          setRewriteGate({
            correctedText: ev.corrected_text,
            explanation: ev.explanation,
            userMessageId: ev.user_message_id,
          });
          return;
        } else if (ev.type === "error") {
          setStreamingMessageId(null);
          const target = messageId ?? "__pending__";
          setStreamErrorByMessage((prev) => ({ ...prev, [target]: ev.message }));
          return;
        }
      }
    } catch (e) {
      setStreamingMessageId(null);
      const target = messageId ?? "__pending__";
      setStreamErrorByMessage((prev) => ({ ...prev, [target]: String(e) }));
    }
  }

  async function onSend(text: string) {
    const saved = await sendUserMessage(conversation.id, text);
    setMessages((prev) => [...(prev ?? []), saved]);
    await startStream();
  }

  async function onRewritePass(failuresBeforePass: number) {
    const gate = rewriteGate;
    setRewriteGate(null);
    await startStream(undefined, true, false, gate?.userMessageId, failuresBeforePass);
  }

  async function onRewriteExhausted(totalFailures: number) {
    const gate = rewriteGate;
    setRewriteGate(null);
    await startStream(undefined, true, true, gate?.userMessageId, totalFailures);
  }

  async function onRegenerate(m: Message) {
    // Rewind-in-place: if there are messages after the target assistant
    // reply, confirm + trim + regenerate. The trimmed messages (user turns
    // + assistant replies + their variants + inline_media + grammar
    // corrections) cascade away via ON DELETE CASCADE. Generated images
    // intentionally SURVIVE in Gallery per plan 0015 — message_id is set
    // to NULL and the user can curate/delete them from /gallery. A
    // regenerate on the LAST assistant keeps today's "add variant, no
    // trim" behavior.
    //
    // Delete strictly by `id IN (...)` rather than `created_at > m.created_at`
    // because two messages can share a created_at timestamp (clock coarseness
    // on rapid sends) — the gt predicate would then leak the duplicate.
    const list = messages ?? [];
    const idx = list.findIndex((x) => x.id === m.id);
    const after = idx >= 0 ? list.slice(idx + 1) : [];
    if (after.length > 0) {
      const label = after.length === 1 ? "1 message" : `${after.length} messages`;
      if (!window.confirm(`Regenerate from this reply? ${label} after it will be deleted. This can't be undone.`)) return;
      const idsToDelete = after.map((x) => x.id);
      const { error } = await supabase
        .from("messages")
        .delete()
        .in("id", idsToDelete);
      if (error) { window.alert(String(error)); return; }
      const keepIds = new Set(list.slice(0, idx + 1).map((x) => x.id));
      setMessages((prev) => (prev ?? []).filter((x) => keepIds.has(x.id)));
      setVariantsByMessage((prev) =>
        Object.fromEntries(Object.entries(prev).filter(([mid]) => keepIds.has(mid))),
      );
      setImagesByMessage((prev) =>
        Object.fromEntries(Object.entries(prev).filter(([mid]) => keepIds.has(mid))),
      );
      setCorrections((prev) =>
        Object.fromEntries(Object.entries(prev).filter(([mid]) => keepIds.has(mid))),
      );
    }
    await startStream(m.id);
  }

  async function onGenerateImage(m: Message, overrides?: GenerationOverrides) {
    if (imageGeneratingFor) return;
    setImageGeneratingFor(m.id);
    try {
      const img = await generateImageForMessage(m.id, overrides);
      setImagesByMessage((prev) => ({ ...prev, [m.id]: [...(prev[m.id] ?? []), img] }));
    } catch (e) {
      window.alert(String(e));
    } finally {
      setImageGeneratingFor(null);
    }
  }

  async function onSelectVariant(m: Message, variantId: string) {
    await setActiveVariant(m.id, variantId);
    setMessages((prev) => (prev ?? []).map((x) => (x.id === m.id ? { ...x, active_variant_id: variantId } : x)));
  }

  async function onDelete(m: Message) {
    if (!window.confirm("Delete this message?")) return;
    await deleteMessage(m.id);
    setMessages((prev) => (prev ?? []).filter((x) => x.id !== m.id));
    setVariantsByMessage((prev) => {
      const { [m.id]: _, ...rest } = prev;
      return rest;
    });
  }

  async function onEditConfirm(newText: string) {
    if (!editing) return;
    const updated = await editUserMessage(editing, newText);
    setMessages((prev) => {
      const list = prev ?? [];
      const idx = list.findIndex((x) => x.id === editing.id);
      if (idx === -1) return [...list, updated];
      return [...list.slice(0, idx), updated];
    });
    // DB DELETE of the later rows cascades into message_variants AND
    // grammar_corrections; reflect both locally so the feed + grammar
    // sidebar don't keep showing trimmed-away rows until a reload.
    const toDrop = new Set((messages ?? []).filter((m) => m.created_at > editing.created_at).map((m) => m.id));
    setVariantsByMessage((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([mid]) => !toDrop.has(mid))),
    );
    setCorrections((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([mid]) => !toDrop.has(mid))),
    );
    setEditing(null);
  }

  let subsequentCount = 0;
  if (editing && messages) {
    const idx = messages.findIndex((m) => m.id === editing.id);
    if (idx !== -1) subsequentCount = messages.length - idx - 1;
  }

  const forkAnchorPreview = forking ? pickAnchorPreview(forking, variantsByMessage[forking.id]) : "";

  const hasActiveKey = !!provider?.vault_secret_id;
  const isStreaming = streamingMessageId !== null;
  // Visible reason: only when there is something the user must do to
  // unblock (configure a provider, finish a rewrite). Streaming is a
  // transient state with its own visual signal (typing dots in the
  // empty bubble) so it gates the composer silently — adding "Waiting
  // for the assistant to finish…" text undermines the realism of the
  // chat flow.
  const composerDisabledReason =
    rewriteGate ? "Complete the rewrite first." :
    hasActiveKey ? undefined :
    <>Add a model provider in <Link to="/settings/text-engine" data-testid="chat-gate-cta">Settings → Text Engine</Link>.</>;

  const showInline = !!(grammarPrefs?.master && grammarPrefs?.inline_enabled);
  const showSidebarToggle = !!(grammarPrefs?.master && grammarPrefs?.sidebar_enabled);
  // Always overlay (modal). Was inline on desktop, but the inline panel
  // visually "cut" the chat content. Overlay is consistent across mobile
  // and desktop and floats over the chat without restructuring layout.
  const inspectorMode: "modal" = "modal";

  return (
    <div
      data-testid="chat-shell"
      style={{
        "--char-accent": character.accent_color,
        display: "flex", flexDirection: "column", height: "100%",
        position: "relative",
      } as React.CSSProperties}
    >
      {memoryToasts.length > 0 && (
        <div
          style={{
            position: "fixed", top: "4rem", right: "1rem", zIndex: 1000,
            display: "flex", flexDirection: "column", gap: "0.4rem",
            maxWidth: "min(360px, 80vw)",
          }}
        >
          {memoryToasts.map((t) => (
            <div
              key={t.id}
              data-testid="memory-toast"
              role="status"
              style={{
                padding: "0.75rem 1rem",
                background: "var(--sp-bg-2)",
                color: "var(--sp-fg)",
                border: "1px solid var(--char-accent-border)",
                borderRadius: "var(--sp-radius)",
                boxShadow: "0 10px 24px rgba(0,0,0,0.4)",
                display: "flex", alignItems: "flex-start", gap: "0.6rem",
                fontSize: "0.85rem",
              }}
            >
              <span style={{ color: "var(--sp-fg-2)" }}>💾</span>
              <span style={{ flex: 1 }}>
                <strong style={{ display: "block", marginBottom: "0.2rem", color: "var(--sp-fg)" }}>Memory saved</strong>
                <span style={{ color: "var(--sp-fg-2)" }}>{t.fact}</span>
              </span>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => dismissMemoryToast(t.id)}
                style={{
                  background: "transparent", border: "none", color: "var(--sp-fg-3)",
                  cursor: "pointer", fontSize: "1rem", padding: 0,
                }}
              >×</button>
            </div>
          ))}
        </div>
      )}
      <header
        data-testid="chat-header"
        style={{
          display: "flex", alignItems: "center", gap: 6,
          // Extra top padding on mobile so the avatar + name don't crash
          // into the iOS safe area / Safari address bar.
          padding: bp === "L" ? "10px 12px" : "20px 12px 14px",
          // Plan 0108: chat surface is single-tone --sp-bg on mobile and
          // inherits the AppShell dark card on desktop (transparent). A
          // hairline border-bottom on desktop keeps the header visually
          // separate from the feed; mobile drops it for a uniform look.
          background: bp === "L" ? "transparent" : "var(--sp-bg)",
          borderBottom: bp === "L" ? "1px solid var(--sp-border-soft)" : "none",
          color: "var(--sp-fg)",
        }}
      >
        {bp !== "L" && shellDrawer && (
          <button
            type="button"
            data-testid="chat-sidebar-hamburger"
            onClick={shellDrawer.openDrawer}
            aria-label="Open navigation"
            style={headerIconBtnStyle(false)}
          >
            <Icon icon={Menu} size={20} />
          </button>
        )}
        <Link
          to={`/character/${character.id}/edit`}
          aria-label={`Edit ${character.name}`}
          title={`Edit ${character.name}`}
          style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0, textDecoration: "none", color: "inherit" }}
        >
          <MessageAvatar
            role="assistant"
            avatarRef={character.avatar_ref}
            accentColor={character.accent_color}
            name={character.name}
            size={36}
          />
          <div style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
            <strong
              data-testid="chat-char-name"
              style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--sp-fg)", fontWeight: 600 }}
            >
              {character.name}
            </strong>
            {character.tagline && (
              <div
                style={{
                  fontSize: "0.85em", color: "var(--sp-fg-3)",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}
              >
                {character.tagline}
              </div>
            )}
            {conversation.branch_parent_conversation_id && (
              <div style={{ marginTop: "0.25rem" }}>
                <BranchBreadcrumb conversation={conversation} />
              </div>
            )}
          </div>
        </Link>
        <ConversationSwitcher
          character={character}
          active={conversation}
          conversations={conversations}
          userId={userId}
          onChange={onConversationsChange}
          compact={bp !== "L"}
        />
        {authorsNote?.notes_text && (
          <span
            data-testid="notes-active-badge"
            title={`Author's note active: ${authorsNote.notes_text.slice(0, 60)}`}
            aria-label="Author's note active"
            style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--char-accent)", flexShrink: 0, display: "block" }}
          />
        )}
        {showSidebarToggle && (
          <button
            type="button"
            data-testid="grammar-sidebar-toggle"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label={sidebarOpen ? "Close grammar sidebar" : "Open grammar sidebar"}
            aria-pressed={sidebarOpen}
            title={sidebarOpen ? "Close grammar" : "Grammar corrections"}
            style={headerIconBtnStyle(sidebarOpen)}
          >
            <Icon icon={Keyboard} size={18} />
          </button>
        )}
        <Link
          to={`/character/${character.id}/edit`}
          data-testid="chat-edit-character"
          aria-label="Edit character"
          title="Edit character"
          style={{ ...headerIconBtnStyle(false), textDecoration: "none" }}
        >
          <Icon icon={Pencil} size={17} />
        </Link>
        <button
          type="button"
          data-testid="chat-controls-open"
          onClick={() => setControlsOpen(true)}
          style={headerIconBtnStyle(false)}
          aria-label="Open chat controls"
          title="Chat controls"
        >
          <Icon icon={MoreHorizontal} size={20} />
        </button>
      </header>

      {controlsOpen && inspectorMode === "modal" && (
        <ChatControlsPanel
          conversationId={conversation.id}
          userId={userId}
          onClose={() => setControlsOpen(false)}
          onNoteChanged={setAuthorsNote}
          mode="modal"
        />
      )}

      <div
        style={{
          display: "flex", flex: 1, overflow: "hidden", minHeight: 0,
          // Plan 0108: chat surface is single-tone --sp-bg on mobile so
          // header + feed read as one continuous canvas. Desktop stays
          // transparent — inherits the AppShell dark card surface.
          background: bp === "L" ? "transparent" : "var(--sp-bg)",
          borderRadius: 0,
          position: "relative",
        }}
      >
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {messages === null ? (
            <SkeletonMessages testId="chat-feed-loading" />
          ) : (
            <MessageFeed
              messages={messages}
              variantsByMessage={variantsByMessage}
              streamingMessageId={streamingMessageId}
              streamErrorByMessage={streamErrorByMessage}
              accentColor={character.accent_color}
              characterName={character.name}
              characterAvatarRef={character.avatar_ref}
              userName={userPersona?.name ?? "You"}
              userAvatarRef={userPersona?.photo_ref ?? null}
              imagesByMessage={imagesByMessage}
              imageGeneratingFor={imageGeneratingFor}
              onEditRequest={setEditing}
              onDelete={onDelete}
              onRegenerate={onRegenerate}
              onSelectVariant={onSelectVariant}
              onFork={setForking}
              onGenerateImage={onGenerateImage}
              onOpenImage={setViewerImage}
              imageEnabled={imageEnabled}
              scenario={character.scenario}
              characterGreeting={character.greeting}
              corrections={showInline ? corrections : {}}
              grammarMode={grammarPrefs?.inline_mode ?? "A"}
            />
          )}

          {rewriteGate ? (
            <RewriteGate
              correctedText={rewriteGate.correctedText}
              explanation={rewriteGate.explanation}
              onPass={onRewritePass}
              onExhausted={onRewriteExhausted}
            />
          ) : (
            <Composer
              onSend={onSend}
              disabledReason={composerDisabledReason}
              disabled={isStreaming}
            />
          )}
        </div>

        {sidebarOpen && grammarPrefs && (
          <GrammarSidebarPanel
            corrections={Object.values(corrections)}
            prefs={grammarPrefs}
            conversationId={conversation.id}
            onClear={() => setCorrections({})}
            mode="overlay"
            onClose={() => setSidebarOpen(false)}
          />
        )}

      </div>

      {editing && (
        <EditTrimDialog
          target={editing}
          subsequentCount={subsequentCount}
          onCancel={() => setEditing(null)}
          onConfirm={onEditConfirm}
        />
      )}

      {viewerImage && (() => {
        const msgId = viewerImage.message_id;
        const siblings = msgId ? imagesByMessage[msgId] ?? [] : [];
        const idx = siblings.findIndex((s) => s.id === viewerImage.id);
        const prev = idx > 0 ? siblings[idx - 1] : null;
        const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;
        return (
          <ImageViewer
            image={viewerImage}
            prevImage={prev}
            nextImage={next}
            canRegenerate={!!msgId && imageGeneratingFor === null}
            onClose={() => setViewerImage(null)}
            onStep={(img) => setViewerImage(img)}
            onChange={(updated) => {
              setViewerImage(updated);
              if (msgId) {
                setImagesByMessage((prev) => ({
                  ...prev,
                  [msgId]: (prev[msgId] ?? []).map((s) => s.id === updated.id ? updated : s),
                }));
              }
            }}
            onDeleted={(deleted) => {
              if (msgId) {
                setImagesByMessage((prev) => {
                  const filtered = (prev[msgId] ?? []).filter((s) => s.id !== deleted.id);
                  return { ...prev, [msgId]: filtered };
                });
              }
              setViewerImage(null);
            }}
            onRegenerate={async (overrides) => {
              if (!msgId) return;
              setViewerImage(null);
              // Find the Message so onGenerateImage can run.
              const m = (messages ?? []).find((x) => x.id === msgId);
              if (m) await onGenerateImage(m, overrides);
            }}
          />
        );
      })()}

      {forking && (
        <ForkDialog
          conversationId={conversation.id}
          anchor={forking}
          anchorPreview={forkAnchorPreview}
          onCancel={() => setForking(null)}
          onForked={(result) => {
            // Reset per-conversation state so a stale rewriteGate or correction
            // row from the parent doesn't bleed into the child's feed before
            // the useEffect on `conversation.id` reloads fresh data.
            setForking(null);
            setRewriteGate(null);
            setStreamingMessageId(null);
            setStreamErrorByMessage({});
            setCorrections({});
            navigate(`/chat/${character.id}/${result.conversation_id}`);
          }}
        />
      )}
    </div>
  );
}

// Unified chrome for every icon button in the chat header (hamburger, back,
// grammar-toggle, notes badge, edit, ⋯). Square 36×36 tap target keeps the
// header cohesive on mobile where buttons were cramped after Cycle 0071.
// The active path lights the button with a soft accent tint when a toggle
// is on (grammar sidebar open, notes present).
function headerIconBtnStyle(active: boolean): React.CSSProperties {
  return {
    width: 36,
    height: 36,
    borderRadius: "var(--sp-radius)",
    background: active ? "var(--char-accent-soft)" : "transparent",
    border: active ? "1px solid var(--char-accent-border)" : "1px solid transparent",
    color: active ? "var(--char-accent)" : "var(--sp-fg-2)",
    cursor: "pointer",
    padding: 0,
    fontSize: "1.1rem",
    lineHeight: 1,
    fontFamily: "inherit",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    transition: "background 120ms var(--sp-ease), color 120ms var(--sp-ease), border-color 120ms var(--sp-ease)",
  };
}
