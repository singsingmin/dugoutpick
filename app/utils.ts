// 공용 유틸.

// 팀 컬러 hex → 연한 rgba (내 팀 행 강조 배경용)
export function teamColorLight(hex: string, alpha = 0.13): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// KST 기준 월요일인가 (월요 리포트 노출 판단)
const FORCE_MONDAY = false; // 임시 미리보기용 플래그(평시 false)
export function isKstMonday(): boolean {
  if (FORCE_MONDAY) return true;
  const k = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return k.getUTCDay() === 1; // 0=일, 1=월
}

// YYYYMMDD → "M/D"
export function shortDate(ymd: string): string {
  return `${+ymd.slice(4, 6)}/${+ymd.slice(6, 8)}`;
}

const DOW = ['일', '월', '화', '수', '목', '금', '토'];
// YYYYMMDD → "M/D(요일)"
export function shortDateDow(ymd: string): string {
  const d = new Date(Date.UTC(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8)));
  return `${+ymd.slice(4, 6)}/${+ymd.slice(6, 8)}(${DOW[d.getUTCDay()]})`;
}
// 시작~끝 날짜 범위(같으면 단일). 예: "5/29(목)~5/31(토)"
export function dateRangeDow(a: string, b: string): string {
  return a === b ? shortDateDow(a) : `${shortDateDow(a)}~${shortDateDow(b)}`;
}

// ISO(UTC) → 지금으로부터 경과("방금 전"/"N분 전"/"N시간 N분 전"). 갱신 신선도 직관 표시용.
export function relativeFromNow(iso: string): string {
  const t = new Date(iso).getTime();
  if (isNaN(t)) return '';
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 1) return '방금 전';
  if (mins < 60) return `${mins}분 전`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `${hrs}시간 ${rem}분 전` : `${hrs}시간 전`;
}

// ISO(UTC) → KST(UTC+9) "YYYY-MM-DD HH:MM (KST)". +9h 후 getUTC*로 KST 벽시계 추출(Intl 의존 회피).
export function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const k = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${k.getUTCFullYear()}-${p(k.getUTCMonth() + 1)}-${p(k.getUTCDate())} ${p(k.getUTCHours())}:${p(k.getUTCMinutes())} (KST)`;
}

// ISO(UTC) → KST "YYYY년 M월 D일 HH:MM"
export function kstDatetime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const k = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${k.getUTCFullYear()}년 ${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일 ${p(k.getUTCHours())}:${p(k.getUTCMinutes())}`;
}
