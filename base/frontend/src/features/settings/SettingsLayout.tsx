import { Navigate, Outlet, useMatch } from "react-router-dom";
import { useBreakpoint } from "../../lib/useBreakpoint";
import { Settings } from "../../routes/Settings";

// Two-pane on L (Seed/ux.md §3): persistent section list on the left,
// active detail (or placeholder on the index route) on the right.
// S/M keeps the current drill-through where the active route takes the full
// main area — on those breakpoints the index route renders the section list
// and the user picks one.
//
// On L the empty placeholder felt like a dead screen, so we redirect the
// index route to the first chat-experience entry (Prompt Editor). Mobile
// keeps the picker behavior intact.
export function SettingsLayout() {
  const bp = useBreakpoint();
  const isIndex = !!useMatch({ path: "/settings", end: true });

  if (bp !== "L") return <Outlet />;

  if (isIndex) return <Navigate to="/settings/prompt-editor" replace />;

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      <aside
        data-testid="settings-section-list"
        style={{
          width: 320,
          borderRight: "1px solid var(--sp-border)",
          background: "var(--sp-bg-1)",
          overflowY: "auto",
          flexShrink: 0,
        }}
      >
        <Settings />
      </aside>
      <div style={{ flex: 1, overflowY: "auto", minWidth: 0 }}>
        <Outlet />
      </div>
    </div>
  );
}
