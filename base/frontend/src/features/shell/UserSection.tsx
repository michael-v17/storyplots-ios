import { LogIn, LogOut, UserPlus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "../../lib/Icon";
import { supabase } from "../../lib/supabase";
import { isAnonymous, useSession } from "../../lib/session";

// Sign-out / sign-in footer entry. Mirrors the shape of the Settings nav
// item so the three footer rows (Settings / Persona / Sign out) read as
// one stack regardless of collapsed state.
export function UserSection({
  collapsed = false,
  isDrawer = false,
  onNavClick,
}: { collapsed?: boolean; isDrawer?: boolean; onNavClick?: () => void }) {
  const nav = useNavigate();
  const sess = useSession();

  if (sess.status !== "ready") return null;
  const session = sess.session;

  // Match the nav rows' icon size: Sidebar uses 22 in the drawer, 18 in the
  // persistent rail. A hardcoded 18 here left the Sign out glyph visibly
  // smaller (and the row's content shifted) next to the 22px nav icons.
  const iconSize = isDrawer ? 22 : 18;

  async function onSignOut() {
    onNavClick?.();
    await supabase.auth.signOut();
    nav("/sign-in");
  }

  // Signed-out + anonymous both get the sign-in entry; anonymous additionally
  // shows the upgrade-to-account CTA when expanded (the icon-only collapsed
  // mode keeps a single row to match the rest of the footer).
  if (!session || isAnonymous(session)) {
    const upgrade = !!session && isAnonymous(session);
    return (
      <div data-testid="user-section" style={sectionStyle}>
        <Link
          to="/sign-in"
          data-testid="sign-in-cta"
          onClick={onNavClick}
          title={collapsed ? "Sign in" : undefined}
          aria-label={collapsed ? "Sign in" : undefined}
          style={rowStyle(collapsed, isDrawer)}
        >
          <Icon icon={LogIn} size={iconSize} />
          {!collapsed && <span>Sign in</span>}
        </Link>
        {!collapsed && upgrade && (
          <Link
            to="/sign-up"
            data-testid="upgrade-cta"
            onClick={onNavClick}
            style={rowStyle(false, isDrawer)}
          >
            <Icon icon={UserPlus} size={iconSize} />
            <span>Create account</span>
          </Link>
        )}
      </div>
    );
  }

  return (
    <div data-testid="user-section" style={sectionStyle}>
      <button
        type="button"
        data-testid="sign-out"
        onClick={onSignOut}
        title={collapsed ? "Sign out" : undefined}
        aria-label={collapsed ? "Sign out" : undefined}
        style={rowStyle(collapsed, isDrawer)}
      >
        <Icon icon={LogOut} size={iconSize} />
        {!collapsed && <span>Sign out</span>}
      </button>
    </div>
  );
}

const sectionStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.35rem",
  alignItems: "stretch",
};

// Mirrors itemStyle in Sidebar.tsx so Sign out / Sign in line up
// pixel-perfect with Settings + the primary nav — including the roomier
// drawer (mobile) padding/gap, otherwise the Sign out icon sits ~4px
// left of Settings. The base color is bumped to --sp-fg (white) because
// Lucide's LogOut shape has fewer strokes than Settings' gear and reads
// dimmer at the same color — matching luma here keeps the icons
// visually consistent.
function rowStyle(collapsed: boolean, drawer = false): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: drawer ? "0.85rem" : "0.75rem",
    padding: collapsed ? "0.5rem" : drawer ? "0.75rem 1rem" : "0.5rem 0.75rem",
    margin: collapsed ? "0 4px" : "0 0.5rem",
    justifyContent: collapsed ? "center" : "flex-start",
    background: "transparent",
    border: "none",
    borderRadius: "var(--sp-radius)",
    color: "var(--sp-fg)",
    fontWeight: 500,
    cursor: "pointer",
    textDecoration: "none",
    transition: "background 120ms var(--sp-ease), color 120ms var(--sp-ease)",
  };
}
