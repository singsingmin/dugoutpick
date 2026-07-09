// 한정 판매 윈도우 — 서버(purchase_background/purchase_skin 게이트)가 실제로 강제하고,
// 클라는 상점 표시·탭 차단만 담당(표시용 날짜는 config에 중복 보관, 강제 SoT는 서버).
// 노출 정책: 각 상점은 "지금 볼 만한 한정 상품 1개"만 전용 카드로 노출(그리드엔 상시+보유만).
// available_from/until은 '+09:00' 오프셋 ISO 문자열. 상태·문구는 KST 기준으로 표기(기기 표준시 무관).
const DAY = 86_400_000;
const KST = 9 * 3600_000;

// 오픈 예고 노출 한도(일). 이보다 더 남은 상품은 상점에 표시하지 않음.
export const UPCOMING_WINDOW_DAYS = 14;

export type SaleStatus = 'permanent' | 'upcoming' | 'live' | 'ended';

export interface LimitedItem {
  availableFrom?: string;
  availableUntil?: string;
}

export function isLimited(item: LimitedItem): boolean {
  return !!(item.availableFrom || item.availableUntil);
}

export function saleStatus(from?: string | null, until?: string | null, now: number = Date.now()): SaleStatus {
  if (!from && !until) return 'permanent';
  if (from && now < Date.parse(from)) return 'upcoming';
  if (until && now >= Date.parse(until)) return 'ended';
  return 'live';
}

// 상점에 노출할 "지금 볼 만한 한정 상품" 1개 선택(미보유 후보 중).
// 우선순위: 판매 중(가장 빨리 마감되는 것) → 14일 이내 오픈 예정(가장 가까운 것) → 없으면 null.
export function pickFeaturedLimited<T extends LimitedItem>(candidates: T[], now: number = Date.now()): T | null {
  const live = candidates
    .filter((c) => saleStatus(c.availableFrom, c.availableUntil, now) === 'live')
    .sort((a, b) => Date.parse(a.availableUntil ?? '') - Date.parse(b.availableUntil ?? ''));
  if (live.length) return live[0];
  const upcoming = candidates
    .filter((c) =>
      saleStatus(c.availableFrom, c.availableUntil, now) === 'upcoming' &&
      c.availableFrom != null &&
      Date.parse(c.availableFrom) - now <= UPCOMING_WINDOW_DAYS * DAY,
    )
    .sort((a, b) => Date.parse(a.availableFrom ?? '') - Date.parse(b.availableFrom ?? ''));
  return upcoming.length ? upcoming[0] : null;
}

// KST 기준 "M/D" (기기 표준시와 무관하게 +9h 고정).
function mdFromMs(ms: number): string {
  const d = new Date(ms + KST);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

// 오픈일 "M/D" (예고 카드용).
export function openMD(from: string): string {
  return mdFromMs(Date.parse(from));
}

// 마지막 판매일 "M/D" (판매중 카드용 = until 하루 전).
export function lastSaleMD(until: string): string {
  return mdFromMs(Date.parse(until) - DAY);
}

// 오픈 예정 상품 탭 시 안내 문구("아직 오픈 전이에요. 7월 15일부터 교환할 수 있어요.").
export function upcomingNotice(from: string): string {
  const d = new Date(Date.parse(from) + KST);
  return `아직 오픈 전이에요. ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일부터 교환할 수 있어요.`;
}
