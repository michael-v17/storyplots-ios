import { ArrowLeft, Menu, X } from "lucide-react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Link, Navigate, Outlet, useLocation, useMatch, useNavigate } from "react-router-dom";
import { Icon } from "../../lib/Icon";
import { useSession } from "../../lib/session";
import { loadSidebarPrefs, saveSidebarCollapsed } from "../../lib/sidebarPrefs";
import { useBreakpoint } from "../../lib/useBreakpoint";
import { Sidebar } from "./Sidebar";

// Mobile/drawer topbar title for non-home routes. Home renders the
// wordmark + slogan instead (see below). Returns empty string when no
// title applies (chat routes, sign-in, etc. — topbar is already hidden).
const SETTINGS_SUBS: Record<string, string> = {
  "prompt-editor": "Prompt Editor",
  "writing-styles": "Writing Styles",
  "grammar": "Grammar",
  "memory": "Memory",
  "visual-roleplay": "Visual Roleplay",
  "text-engine": "Text Engine",
  "memory-engine": "Memory Engine",
  "image-engine": "Image Engine",
  "text-to-speech": "Text-to-Speech",
  "data-security": "Data & Security",
};

function routeTitle(pathname: string): string {
  if (pathname === "/") return "";
  if (pathname === "/characters") return "Characters";
  if (pathname === "/gallery") return "Gallery";
  if (pathname === "/grammar") return "Grammar";
  if (pathname === "/profile") return "Profile";
  if (pathname === "/character/new/import") return "Import Character";
  if (pathname.startsWith("/character/new")) return "New Character";
  if (pathname.startsWith("/character/") && pathname.endsWith("/edit")) return "Edit Character";
  if (pathname === "/settings") return "Settings";
  if (pathname.startsWith("/settings/")) {
    const slug = pathname.slice("/settings/".length).split("/")[0] ?? "";
    return SETTINGS_SUBS[slug] ?? "Settings";
  }
  return "";
}

type ShellDrawerControls = { openDrawer: () => void };

const ShellDrawerContext = createContext<ShellDrawerControls | null>(null);

export function useShellDrawer(): ShellDrawerControls | null {
  return useContext(ShellDrawerContext);
}

export function AppShell() {
  const bp = useBreakpoint();
  const sess = useSession();
  const userId = sess.status === "ready" ? sess.session?.user.id ?? null : null;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const isChatRoute = !!useMatch("/chat/*");
  const isHomeRoute = !!useMatch({ path: "/", end: true });
  const location = useLocation();
  const navigate = useNavigate();
  const pageTitle = routeTitle(location.pathname);

  useEffect(() => {
    if (!userId) return;
    loadSidebarPrefs(userId)
      .then((p) => setCollapsed(p.collapsed))
      .catch(() => {/* best-effort — default uncollapsed */});
  }, [userId]);

  // When resizing up to L the drawer concept no longer applies.
  useEffect(() => {
    if (bp === "L") setDrawerOpen(false);
  }, [bp]);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    if (userId) {
      saveSidebarCollapsed(userId, next).catch(() => {/* best-effort */});
    }
  }

  const drawerControls = useMemo<ShellDrawerControls>(() => ({
    openDrawer: () => setDrawerOpen(true),
  }), []);

  const persistent = bp === "L";
  // Chat manages its own internal scroll (the message feed), so the outlet
  // wrapper must not introduce a second scrollbar outside of it. Static
  // routes (Home/Settings/Gallery/Grammar/Characters/forms) rely on outer
  // scroll to page long content, so they keep `auto`.
  const outletOverflow = isChatRoute ? "hidden" : "auto";
  // Hide the shell topbar on Chat routes in non-persistent breakpoints — the
  // Chat's own header hosts a hamburger that opens the drawer via context.
  const showTopbar = !persistent && !isChatRoute;

  // v0.2: registered-only. Anonymous Supabase sessions are no longer auto-
  // created (see boot.ts deletion in cycle 0106). Any unauthenticated visitor
  // landing on a protected route gets bounced to the sign-in surface.
  // NOTE: this conditional return MUST stay AFTER every hook call above —
  // bailing earlier swaps the hook count between renders and triggers the
  // React "rendered fewer hooks than expected" invariant (#300).
  if (sess.status === "ready" && !sess.session) {
    return <Navigate to="/sign-in" replace />;
  }

  return (
    <ShellDrawerContext.Provider value={drawerControls}>
      {/* Plan 0108: chrome polarity inverted vs cycles 0101–0104. Desktop
          gets a lighter --sp-bg-2 outer frame around the dark --sp-bg
          content card. Mobile is single-tone --sp-bg end-to-end (creator
          asked for a uniform mobile surface — no two-tone topbar/sheet
          split). Sub-cards inside the card (--sp-bg-2) and inputs
          (--sp-bg-3) keep their elevation hierarchy because the local
          parent flipped, not the token semantics. */}
      {/* `height: 100%` inherits the locked html/body/#root chain from
          index.html. On iOS Safari this gives a stable shell that never
          scrolls the document — header pins to the top, composer pins
          above the keyboard, only the chat feed (or content card on
          static routes) scrolls internally. `100vh` was tried earlier
          but on iOS includes the area behind the URL bar and lets the
          document itself become scrollable; `100dvh` updated dynamically
          but did not always restore after the soft keyboard closed. The
          full-100% chain is the standard pattern across native-feeling
          iOS web apps. */}
      <div style={{ display: "flex", height: "100%", overflow: "hidden", background: persistent ? "var(--sp-bg-2)" : "var(--sp-bg)" }}>
        {persistent && (
          <Sidebar
            mode="persistent"
            collapsed={collapsed}
            onToggleCollapsed={toggleCollapsed}
          />
        )}

        {!persistent && (
          <>
            {/* Always-mounted backdrop + drawer with data-open driving the
                CSS transition (cycle 0109). Conditional mount caused the
                drawer to pop in/out instantly because there was no time
                for the from-state transform to settle before transitioning.
                Defined in tokens.css under `.sp-drawer-{backdrop,panel}`. */}
            <div
              className="sp-drawer-backdrop"
              data-testid="sidebar-backdrop"
              data-open={drawerOpen ? "true" : "false"}
              onClick={() => setDrawerOpen(false)}
              aria-hidden={!drawerOpen}
            />
            <div
              className="sp-drawer-panel"
              data-open={drawerOpen ? "true" : "false"}
              aria-hidden={!drawerOpen}
              // `inert` removes the closed drawer from the tab sequence
              // entirely — aria-hidden alone leaves keyboard users able
              // to Tab into off-screen nav links. (code-review F1)
              {...({ inert: drawerOpen ? undefined : "" } as Record<string, string | undefined>)}
            >
              <Sidebar mode="drawer" onClose={() => setDrawerOpen(false)} />
            </div>
          </>
        )}

        {/* Plan 0101 §2 (desktop) + 0104 (mobile): content wrapper.
            Desktop (persistent): inset card with margin all sides, all
            corners rounded — sidebar merges into outer bg. Mobile non-
            chat: topbar lives in the page-bg strip at the top, then a
            sheet card with rounded TOP corners only takes the rest of
            the viewport (iOS sheet pattern). Mobile chat: ChatShell
            owns its own header + card chrome internally; outlet stays
            transparent here. */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            minHeight: 0,
            margin: persistent ? "16px 16px 16px 0" : 0,
            // Plan 0108 invert: content card on desktop is now the dark
            // --sp-bg, sitting inside the lighter --sp-bg-2 outer frame.
            background: persistent ? "var(--sp-bg)" : "transparent",
            borderRadius: persistent ? "var(--sp-radius)" : 0,
            boxShadow: persistent ? "var(--sp-shadow-sm)" : "none",
            overflow: "hidden",
          }}
        >
          {showTopbar && (
              <header
                data-testid="shell-topbar"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.75rem",
                  padding: isHomeRoute ? "1rem 1rem 1.25rem" : "0.85rem 1rem 1.1rem",
                  // Plan 0108: mobile is single-tone --sp-bg. Topbar is
                  // solid sheet color so it merges seamlessly with the
                  // content below (no gradient, no light strip). Header
                  // identity comes from the logo / title / hamburger
                  // affordances, not from a chrome bg tint.
                  background: "var(--sp-bg)",
                  color: "var(--sp-fg)",
                  minHeight: 52,
                  position: "relative",
                }}
              >
                <button
                  type="button"
                  data-testid="sidebar-hamburger"
                  onClick={() => setDrawerOpen(true)}
                  aria-label="Open navigation"
                  style={{
                    position: "absolute",
                    left: "0.75rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: "0.35rem 0.5rem",
                    color: "var(--sp-fg)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "auto",
                  }}
                >
                  <Icon icon={Menu} size={22} />
                </button>
                {isHomeRoute ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, pointerEvents: "auto" }}>
                    <img
                      src="/logos/logo.png"
                      alt="StoryPlots"
                      style={{ height: 44, width: "auto", display: "block" }}
                    />
                    <span style={{ fontSize: "0.78em", color: "var(--sp-fg-3)", letterSpacing: "0.02em" }}>
                      Step into stories
                    </span>
                  </div>
                ) : (
                  <span
                    data-testid="shell-page-title"
                    style={{
                      fontSize: "1.25rem",
                      fontWeight: 600,
                      color: "var(--sp-fg)",
                      fontFamily: "var(--sp-font-display)",
                      letterSpacing: "var(--sp-tracking-tight)",
                      pointerEvents: "auto",
                    }}
                  >
                    {pageTitle}
                  </span>
                )}
                {location.pathname.startsWith("/settings/") && (
                  <Link
                    to="/settings"
                    aria-label="Back to Settings"
                    style={{
                      position: "absolute",
                      right: "0.75rem",
                      top: "50%",
                      transform: "translateY(-50%)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 36,
                      height: 36,
                      color: "var(--sp-fg-3)",
                      textDecoration: "none",
                      pointerEvents: "auto",
                    }}
                  >
                    <Icon icon={ArrowLeft} size={20} />
                  </Link>
                )}
                {location.pathname.startsWith("/character/") && (
                  <button
                    type="button"
                    data-testid="topbar-character-close"
                    onClick={() => navigate(-1)}
                    aria-label="Close"
                    style={{
                      position: "absolute",
                      right: "0.75rem",
                      top: "50%",
                      transform: "translateY(-50%)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 36,
                      height: 36,
                      background: "transparent",
                      border: "none",
                      color: "var(--sp-fg-2)",
                      cursor: "pointer",
                      pointerEvents: "auto",
                      padding: 0,
                    }}
                  >
                    <Icon icon={X} size={20} />
                  </button>
                )}
              </header>
            )}
            <div
              data-testid="content-card"
              style={{
                flex: 1,
                minHeight: 0,
                position: "relative",
                overflow: outletOverflow,
                // Plan 0108: mobile non-chat content sheet uses the dark
                // --sp-bg (single tone with the desktop content card).
                // Topbar fade ends in --sp-bg so the seam is invisible.
                background: (!persistent && !isChatRoute) ? "var(--sp-bg)" : "transparent",
                borderRadius: 0,
              }}
            >
              <Outlet />
            </div>
        </div>
      </div>
    </ShellDrawerContext.Provider>
  );
}
