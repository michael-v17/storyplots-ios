import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { avatarUrl } from "../../lib/avatars";
import type { Character } from "../../lib/characters";
import { findOrCreateForCharacter } from "../../lib/conversations";
import { useSession } from "../../lib/session";

export type CharacterOpen = {
  avatarSrc: string | null;
  initial: string;
  busy: boolean;
  href: string;
  onClick: (e: React.MouseEvent) => void;
};

export function useCharacterOpen(character: Character): CharacterOpen {
  const nav = useNavigate();
  const sess = useSession();
  const userId = sess.status === "ready" ? sess.session?.user.id ?? null : null;
  const [busy, setBusy] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setAvatarSrc(null);
    if (!character.avatar_ref) return;
    avatarUrl(character.avatar_ref).then((u) => { if (!cancelled) setAvatarSrc(u); }).catch(() => {});
    return () => { cancelled = true; };
  }, [character.avatar_ref]);

  const initial = (character.name || "?").trim().charAt(0).toUpperCase();

  async function onClick(e: React.MouseEvent): Promise<void> {
    e.preventDefault();
    if (!userId || busy) return;
    setBusy(true);
    try {
      const conv = await findOrCreateForCharacter(userId, character);
      nav(`/chat/${character.id}/${conv.id}`);
    } finally {
      setBusy(false);
    }
  }

  return {
    avatarSrc,
    initial,
    busy,
    href: `/chat/${character.id}/resolve`,
    onClick,
  };
}
