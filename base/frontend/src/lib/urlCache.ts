type Entry = { url: string; exp: number };

const mem = new Map<string, string>();

export function urlCacheGet(key: string): string | null {
  const m = mem.get(key);
  if (m) return m;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { url, exp } = JSON.parse(raw) as Entry;
    if (Date.now() > exp) { localStorage.removeItem(key); return null; }
    mem.set(key, url);
    return url;
  } catch { return null; }
}

export function urlCacheSet(key: string, url: string, ttlSeconds: number): void {
  mem.set(key, url);
  try {
    localStorage.setItem(key, JSON.stringify({ url, exp: Date.now() + ttlSeconds * 1000 }));
  } catch {/* localStorage full — best-effort */}
}
