// 공용 유틸.

// ISO(UTC) → KST(UTC+9) "YYYY-MM-DD HH:MM (KST)". +9h 후 getUTC*로 KST 벽시계 추출(Intl 의존 회피).
export function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const k = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${k.getUTCFullYear()}-${p(k.getUTCMonth() + 1)}-${p(k.getUTCDate())} ${p(k.getUTCHours())}:${p(k.getUTCMinutes())} (KST)`;
}
