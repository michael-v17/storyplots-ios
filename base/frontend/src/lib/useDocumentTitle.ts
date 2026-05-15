import { useEffect } from "react";

const BRAND = "StoryPlots";

/**
 * Sets `document.title` to `${title} · StoryPlots` while mounted (or just
 * `StoryPlots` when `title` is null/empty — used by the home route).
 *
 * Convention: middle-dot separator, section first so truncated tab strips
 * still surface the unique identity. Dynamic values (character names in
 * chat/edit) flow in once data resolves — the hook accepts changing input.
 */
export function useDocumentTitle(title: string | null | undefined): void {
  useEffect(() => {
    const next = title && title.trim().length > 0
      ? `${title.trim()} · ${BRAND}`
      : BRAND;
    document.title = next;
  }, [title]);
}
