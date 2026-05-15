import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Home as HomeIcon,
  Image as ImageIcon,
  Settings as SettingsIcon,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { Icon } from "../../lib/Icon";
import { CollapsedUserAvatar } from "./CollapsedUserAvatar";
import { RecentChats } from "./RecentChats";
import { UserSection } from "./UserSection";
import { YourPersonaCard } from "./YourPersonaCard";

type Item = { to: string; label: string; icon: LucideIcon; testId: string; end?: boolean };

const ITEMS: Item[] = [
  { to: "/",           label: "Home",       icon: HomeIcon,  testId: "nav-home", end: true },
  { to: "/characters", label: "Characters", icon: Users,     testId: "nav-characters" },
  { to: "/gallery",    label: "Gallery",    icon: ImageIcon, testId: "nav-gallery" },
  { to: "/grammar",    label: "Grammar",    icon: BookOpen,  testId: "nav-grammar" },
];

type Props =
  | {
      mode: "persistent";
      collapsed: boolean;
      onToggleCollapsed: () => void;
    }
  | { mode: "drawer"; onClose: () => void };

export function Sidebar(props: Props) {
  const location = useLocation();
  const isSettingsActive = location.pathname.startsWith("/settings");
  const collapsed = props.mode === "persistent" && props.collapsed;
  const width = collapsed ? 64 : 280;
  // Drawer mode dismisses on nav click. Persistent mode does nothing —
  // the user explicitly toggles collapse via the chevron when they want
  // more space (no surprise auto-collapse on big screens).
  const onNavClick = props.mode === "drawer" ? props.onClose : undefined;
  // Mobile drawer rows scale up so they feel native-app sized rather than
  // shrunk-desktop. Persistent (desktop L) keeps the tighter 18 px / 0.5rem
  // rhythm so the inset card has room to breathe.
  const isDrawer = props.mode === "drawer";
  const navIconSize = isDrawer ? 22 : 18;

  return (
    <nav
      data-testid="sidebar"
      data-mode={props.mode}
      data-collapsed={collapsed ? "true" : "false"}
      aria-label="Primary"
      style={{
        width,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        // Plan 0101 §2: sidebar shares the outer page bg so it visually
        // merges with the gutter around the inset content card. No fill
        // and no border-right.
        background: "transparent",
        color: "var(--sp-fg)",
        // Anchor for the floating collapse/close control which sticks out
        // past the sidebar edge.
        position: "relative",
      }}
    >
      {/* Brand header — logo + tagline left-aligned to share the same
          column anchor as the nav items + footer rows below it. The
          collapse/close control lives outside this row (absolute, sibling)
          so the logo never has to share horizontal space in collapsed
          mode. */}
      <div
        style={{
          display: "flex",
          // Logo always anchors to the TOP of the header so the absolutely
          // positioned chevron below has predictable space. Expanded
          // pulls left so the wordmark column lines up with the nav rows;
          // collapsed centers horizontally in the 64px column.
          alignItems: "flex-start",
          justifyContent: collapsed ? "center" : "flex-start",
          padding: collapsed ? "0.85rem 0.5rem 0.5rem" : "1rem 0.75rem 0.85rem 1rem",
          // Expanded: tight 48px header. Collapsed: 84 — just enough to
          // fit logo (36px tall, anchored at y=13.6) + chevron centered
          // at top:60 (ends y=78) + 6px buffer. Tight enough that the
          // first nav icon sits ~18px below the chevron — the same
          // breathing room as between Grammar and Recent Chats.
          minHeight: collapsed ? 84 : 48,
        }}
      >
        {!collapsed ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
            <img
              src="/logos/logo.png"
              alt="StoryPlots"
              style={{ height: 40, width: "auto", display: "block" }}
            />
            <span style={{ fontSize: "0.72em", color: "var(--sp-fg-3)", letterSpacing: "0.02em" }}>
              Step into stories
            </span>
          </div>
        ) : (
          <img
            src="/logos/logo-reduced.png"
            alt="StoryPlots"
            title="StoryPlots"
            style={{ width: 36, height: 36, display: "block", objectFit: "contain" }}
          />
        )}
      </div>

      {/* Toggle/close control. Lives INSIDE the sidebar in all states so it
          never overlaps the inset content card or the mobile drawer
          backdrop. When collapsed it shrinks and drops to vertical center
          of the sidebar so the brand area gets the spotlight; when
          expanded or in drawer it sits in the top-right corner like a
          standard close affordance. */}
      {props.mode === "persistent" ? (
        <button
          type="button"
          data-testid="sidebar-collapse"
          onClick={props.onToggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          style={controlStyle(collapsed ? "below-logo" : "corner")}
        >
          <Icon icon={collapsed ? ChevronRight : ChevronLeft} size={collapsed ? 12 : 16} />
        </button>
      ) : (
        <button
          type="button"
          data-testid="sidebar-close"
          onClick={props.onClose}
          aria-label="Close navigation"
          style={controlStyle("corner")}
        >
          <Icon icon={X} size={16} />
        </button>
      )}

      {/* Middle area: primary nav + recent chats. The persona card moved to
          the footer (alongside Settings + Sign out) so identity controls
          cluster at the bottom. Persistent (desktop) scrolls if tall; the
          mobile drawer never scrolls — RecentChats fits itself to the space
          left below the nav items (cycle 0132). */}
      <div style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflowY: isDrawer ? "hidden" : "auto",
        paddingTop: "0.25rem",
      }}>
        <div style={{ padding: "0.5rem 0" }}>
          {ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              data-testid={item.testId}
              end={item.end}
              onClick={onNavClick}
              title={collapsed ? item.label : undefined}
              aria-label={collapsed ? item.label : undefined}
              style={({ isActive }) => ({
                ...itemStyle(collapsed, isActive, isDrawer),
                color: "inherit",
                textDecoration: "none",
              })}
            >
              <Icon icon={item.icon} size={navIconSize} />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </div>

        <RecentChats collapsed={collapsed} fitToHeight={isDrawer} />
      </div>

      {/* Footer: Persona → Settings → Sign out. Persona leads as the
          identity anchor (heavier card chrome); Settings + Sign out are
          uniform itemStyle ghost rows. Same horizontal inset as the
          middle nav so selected fills line up across the whole sidebar. */}
      <div
        style={{
          padding: "0.75rem 0",
          display: "flex",
          flexDirection: "column",
          // Persona has a bigger avatar (36) than the 18px icons of
          // Settings + Sign out — without breathing room between rows
          // the heavier Persona feels glued to the active Settings fill
          // below it. 0.5rem gap restores the visual separation.
          gap: "0.5rem",
        }}
      >
        {collapsed
          ? <CollapsedUserAvatar onNavClick={onNavClick} />
          : <YourPersonaCard onNavClick={onNavClick} />}
        <NavLink
          to="/settings"
          data-testid="nav-settings"
          onClick={onNavClick}
          title={collapsed ? "Settings" : undefined}
          aria-label={collapsed ? "Settings" : undefined}
          style={({ isActive }) => ({
            ...itemStyle(collapsed, isActive || isSettingsActive, isDrawer),
            color: "inherit",
            textDecoration: "none",
          })}
        >
          <Icon icon={SettingsIcon} size={navIconSize} />
          {!collapsed && <span>Settings</span>}
        </NavLink>
        <UserSection collapsed={collapsed} isDrawer={isDrawer} onNavClick={onNavClick} />
      </div>
    </nav>
  );
}

// Two variants of the chrome control:
//   "corner"      — top-right inside the sidebar (24×24). Used for the
//                   close affordance in the mobile drawer and the
//                   collapse arrow when the sidebar is expanded.
//   "below-logo"  — small (18×18) horizontally centered in the 64px
//                   collapsed column, just below the logo. Stays inside
//                   the sidebar so it doesn't fight the inset content
//                   card edge from cycle 0101.
function controlStyle(variant: "corner" | "below-logo"): React.CSSProperties {
  const centered = variant === "below-logo";
  return {
    position: "absolute",
    top: centered ? 60 : 24,
    left: centered ? "50%" : undefined,
    right: centered ? undefined : 14,
    transform: centered ? "translateX(-50%)" : undefined,
    width: centered ? 18 : 24,
    height: centered ? 18 : 24,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    // Plan 0108: outer frame is now --sp-bg-2, so this control needs to
    // step one level up to remain visible against it. Same step the
    // active-nav fill uses, kept consistent across chrome.
    background: "var(--sp-bg-3)",
    border: "1px solid var(--sp-border)",
    borderRadius: "var(--sp-radius)",
    color: "var(--sp-fg-2)",
    cursor: "pointer",
    padding: 0,
    transition: "color 120ms var(--sp-ease), background 120ms var(--sp-ease)",
  };
}

function itemStyle(collapsed: boolean, active: boolean, drawer = false): React.CSSProperties {
  // Drawer (mobile) rows are roomier so taps feel native-app — 0.75rem 1rem
  // padding + slightly larger font weight. Persistent desktop sidebar keeps
  // the tight 0.5rem rhythm to fit RecentChats + footer comfortably.
  const padding = collapsed
    ? "0.5rem"
    : drawer
      ? "0.75rem 1rem"
      : "0.5rem 0.75rem";
  return {
    display: "flex",
    alignItems: "center",
    gap: drawer ? "0.85rem" : "0.75rem",
    padding,
    // 4px L/R margin in collapsed so active fill never touches the
    // sidebar edges; 0.5rem in expanded preserves the existing rhythm.
    margin: collapsed ? "0 4px" : "0 0.5rem",
    justifyContent: collapsed ? "center" : "flex-start",
    background: active ? "var(--sp-bg-3)" : "transparent",
    borderRadius: "var(--sp-radius)",
    color: active ? "var(--sp-fg)" : "var(--sp-fg-2)",
    fontWeight: active ? 600 : 500,
    fontSize: drawer ? "1.05rem" : undefined,
    transition: "background 120ms var(--sp-ease), color 120ms var(--sp-ease)",
  };
}
