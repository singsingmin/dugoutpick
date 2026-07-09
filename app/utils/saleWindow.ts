// 한정 판매 윈도우 — 서버(purchase_background/purchase_skin 게이트)가 실제로 강제하고,
// 클라는 상점 표시·탭 차단만 담당(표시용 날짜는 config에 중복 보관, 강제 SoT는 서버).
// available_from/until은 '+09:00' 오프셋 ISO 문자열. 상태·뱃지는 KST 기준으로 표기(기기 표준시 무관).
export type SaleStatus = 'permanent' | 'upcoming' | 'live' | 'ended';

export function saleStatus(from?: string | null, until?: string | null, now: number = Date.now()): SaleStatus {
  if (!from && !until) return 'permanent';
  if (from && now < Date.parse(from)) return 'upcoming';
  if (until && now >= Date.parse(until)) return 'ended';
  return 'live';
}

// KST 기준 "M/D" (기기 표준시와 무관하게 +9h 고정).
function mdKST(ms: number): string {
  const d = new Date(ms + 9 * 3600_000);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

// 상점 셀 뱃지 텍스트. upcoming="M/D 오픈", live="~M/D"(마지막 판매일=until 하루 전), 그 외 null.
export function saleBadgeText(status: SaleStatus, from?: string | null, until?: string | null): string | null {
  if (status === 'upcoming' && from) return `${mdKST(Date.parse(from))} 오픈`;
  if (status === 'live' && until) return `~${mdKST(Date.parse(until) - 86_400_000)}`;
  return null;
}

// 오픈 예정 상품 탭 시 안내 토스트.
export function upcomingToast(from: string): string {
  return `${mdKST(Date.parse(from))}부터 교환할 수 있어요`;
}
