export function relativeTime(iso: string): string {
  const diffSec = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return "now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d`;
  return `${Math.floor(diffSec / 604800)}w`;
}
