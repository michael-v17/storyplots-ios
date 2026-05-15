import { supabase } from "./supabase";

export type HomeLayout = "grid" | "circles" | "list";

export type HomePrefs = {
  layout: HomeLayout;
};

export const HOME_PREFS_DEFAULTS: HomePrefs = {
  layout: "grid",
};

const VALID_LAYOUTS: HomeLayout[] = ["grid", "circles", "list"];

export function readHomePrefs(
  preferences: Record<string, unknown> | null | undefined,
): HomePrefs {
  const raw = (preferences as { home?: Partial<HomePrefs> } | null | undefined)?.home;
  if (!raw || typeof raw !== "object") return { ...HOME_PREFS_DEFAULTS };
  const layout = VALID_LAYOUTS.includes(raw.layout as HomeLayout) ? raw.layout as HomeLayout : "grid";
  return { layout };
}

export async function loadHomePrefs(userId: string): Promise<HomePrefs> {
  const { data, error } = await supabase
    .from("users")
    .select("preferences")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return readHomePrefs(data?.preferences as Record<string, unknown> | null);
}

export async function saveHomeLayout(userId: string, layout: HomeLayout): Promise<void> {
  const { data: row, error: readErr } = await supabase
    .from("users")
    .select("preferences")
    .eq("id", userId)
    .single();
  if (readErr) throw readErr;
  const prefsObj = (row?.preferences as Record<string, unknown>) || {};
  const curr = (prefsObj.home as Record<string, unknown> | undefined) || {};
  const next = { ...prefsObj, home: { ...curr, layout } };
  const { error: updateErr } = await supabase
    .from("users")
    .update({ preferences: next })
    .eq("id", userId);
  if (updateErr) throw updateErr;
}
