// 공용 유틸.

// KST 기준 월요일인가 (월요 리포트 노출 판단)
export function isKstMonday(): boolean {
  const k = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return k.getUTCDay() === 1; // 0=일, 1=월
}

// YYYYMMDD → "M/D"
export function shortDate(ymd: string): string {
  return `${+ymd.slice(4, 6)}/${+ymd.slice(6, 8)}`;
}

// ISO(UTC) → KST(UTC+9) "YYYY-MM-DD HH:MM (KST)". +9h 후 getUTC*로 KST 벽시계 추출(Intl 의존 회피).
export function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const k = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${k.getUTCFullYear()}-${p(k.getUTCMonth() + 1)}-${p(k.getUTCDate())} ${p(k.getUTCHours())}:${p(k.getUTCMinutes())} (KST)`;
}
