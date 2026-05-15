import {
  Bot,
  BookOpen,
  Brain,
  Camera,
  ChevronRight,
  Database,
  Drama,
  Feather,
  Image as ImageIcon,
  ShieldCheck,
  SquarePen,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { Icon } from "../lib/Icon";
import { useDocumentTitle } from "../lib/useDocumentTitle";

type Row = {
  to: string;
  testId: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
};

type Group = { label: string; rows: Row[] };

const GROUPS: Group[] = [
  {
    label: "Chat Experience",
    rows: [
      { to: "/settings/roleplay",         testId: "settings-roleplay",         title: "Roleplay",        subtitle: "Author framing, pacing, style anchor — applied to every character",       icon: Drama },
      { to: "/settings/prompt-editor",    testId: "settings-prompt-editor",    title: "Prompt Editor",   subtitle: "All editable prompt templates — Avatar, Roleplay, Memory — in one place", icon: SquarePen },
      { to: "/settings/writing-styles",   testId: "settings-writing-styles",   title: "Writing Styles",  subtitle: "Manage presets injected as prompt position 1",                            icon: Feather },
      { to: "/settings/grammar",          testId: "settings-grammar",          title: "Grammar",         subtitle: "Master toggle, inline mode, sidebar, reinforcement",                      icon: BookOpen },
      { to: "/settings/memory",           testId: "settings-memory",           title: "Memory",          subtitle: "Fact-memory RAG — cadence, top-K, threshold, notifications",             icon: Brain },
      { to: "/settings/visual-roleplay",  testId: "settings-visual-roleplay",  title: "Visual Roleplay", subtitle: "Auto [image: …] tags + auto-generate images",                             icon: Camera },
    ],
  },
  {
    label: "AI & Voice",
    rows: [
      { to: "/settings/text-engine",   testId: "settings-text-engine",   title: "Text Engine",    subtitle: "Model provider and Conversation Agent model",               icon: Bot },
      { to: "/settings/memory-engine", testId: "settings-memory-engine", title: "Memory Engine",  subtitle: "BYOK embedding provider (OpenAI default, Jina, Custom)",    icon: Database },
      { to: "/settings/image-engine",  testId: "settings-image-engine",  title: "Image Engine",   subtitle: "ComfyUI workflow + BYOK for image generation",              icon: ImageIcon },
      { to: "/settings/text-to-speech", testId: "settings-tts",          title: "Text-to-Speech", subtitle: "BYOK OpenAI TTS + auto-play assistant replies",             icon: Volume2 },
    ],
  },
  {
    label: "Account",
    rows: [
      { to: "/settings/data-security", testId: "settings-data-security", title: "Data & Security", subtitle: "SFW toggle, storage, sign out, delete account", icon: ShieldCheck },
    ],
  },
];

export function Settings() {
  useDocumentTitle("Settings");
  return (
    <nav data-testid="settings" aria-label="Settings sections" className="sp-page-content" style={mainStyle}>
      <header style={{ marginBottom: "1.25rem" }}>
        <h1 className="sp-h2 sp-wordmark sp-page-h1" style={{ margin: 0 }}>Settings</h1>
      </header>

      {GROUPS.map((group) => (
        <section key={group.label} style={{ marginBottom: 20 }}>
          <div style={sectionLabelStyle}>{group.label}</div>
          <div style={groupCardStyle}>
            {group.rows.map((row, i) => (
              <NavLink
                key={row.to}
                to={row.to}
                data-testid={row.testId}
                className={({ isActive }) => `sp-settings-row${isActive ? " sp-row-active" : ""}`}
                style={({ isActive }) => ({
                  ...rowStyle,
                  ...(i === group.rows.length - 1 ? { borderBottom: "none" } : null),
                  ...(isActive ? activeRowOverride : null),
                })}
              >
                <div style={iconTileStyle}>
                  <Icon icon={row.icon} size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={titleStyle}>{row.title}</div>
                  <div style={subtitleStyle}>{row.subtitle}</div>
                </div>
                <Icon icon={ChevronRight} size={16} style={{ color: "var(--sp-fg-3)", flexShrink: 0 }} />
              </NavLink>
            ))}
          </div>
        </section>
      ))}
    </nav>
  );
}

const mainStyle: React.CSSProperties = {
  maxWidth: 560,
  margin: "2rem auto",
  padding: "0 1rem",
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: "var(--sp-text-xs)",
  fontWeight: 600,
  letterSpacing: "var(--sp-tracking-caps)",
  textTransform: "uppercase",
  color: "var(--sp-fg-3)",
  marginBottom: 8,
  paddingLeft: 4,
};

const groupCardStyle: React.CSSProperties = {
  background: "var(--sp-bg-2)",
  border: "1px solid var(--sp-border)",
  borderRadius: "var(--sp-radius)",
  overflow: "hidden",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "13px 14px",
  borderBottom: "1px solid var(--sp-border-soft)",
  color: "inherit",
  textDecoration: "none",
  transition: "background 160ms var(--sp-ease), border-color 160ms var(--sp-ease)",
};

const activeRowOverride: React.CSSProperties = {
  background: "var(--sp-bg-3)",
  boxShadow: "inset 3px 0 0 var(--sp-brand-1)",
};

const iconTileStyle: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: "var(--sp-radius)",
  background: "var(--sp-bg-3)",
  color: "var(--sp-fg-2)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const titleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 500,
  color: "var(--sp-fg)",
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--sp-fg-3)",
  marginTop: 2,
};
