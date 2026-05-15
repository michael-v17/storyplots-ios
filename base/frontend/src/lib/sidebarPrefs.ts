import { supabase } from "./supabase";

export type SidebarPrefs = {
  collapsed: boolean;
};

export const SIDEBAR_PREFS_DEFAULTS: SidebarPrefs = {
  collapsed: false,
};

export function readSidebarPrefs(
  preferences: Record<string, unknown> | null | undefined,
): SidebarPrefs {
  const raw = (preferences as { sidebar?: Partial<SidebarPrefs> } | null | undefined)?.sidebar;
  if (!raw || typeof raw !== "object") return { ...SIDEBAR_PREFS_DEFAULTS };
  return {
    collapsed: typeof raw.collapsed === "boolean" ? raw.collapsed : false,
  };
}

export async function loadSidebarPrefs(userId: string): Promise<SidebarPrefs> {
  const { data, error } = await supabase
    .from("users")
    .select("preferences")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return readSidebarPrefs(data?.preferences as Record<string, unknown> | null);
}

export async function saveSidebarCollapsed(userId: string, collapsed: boolean): Promise<void> {
  const { data: row, error: readErr } = await supabase
    .from("users")
    .select("preferences")
    .eq("id", userId)
    .single();
  if (readErr) throw readErr;
  const prefsObj = (row?.preferences as Record<string, unknown>) || {};
  const curr = (prefsObj.sidebar as Record<string, unknown> | undefined) || {};
  const next = { ...prefsObj, sidebar: { ...curr, collapsed } };
  const { error: updateErr } = await supabase
    .from("users")
    .update({ preferences: next })
    .eq("id", userId);
  if (updateErr) throw updateErr;
}
