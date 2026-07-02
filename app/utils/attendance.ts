// 야구공 재화 — 출석 보상·거래 내역 유틸. 날짜는 KST(UTC+9) 기준.
export type TxReason =
  | 'initial_grant'
  | 'attendance'
  | 'attendance_bonus'
  | 'skin_purchase'
  | 'debug_charge'
  | 'debug_reset';

export interface BaseballTx {
  id: string;
  type: 'earn' | 'spend';
  amount: number;           // 항상 양수(부호는 type으로)
  reason: TxReason;
  label: string;
  createdAt: string;        // ISO
  relatedSkinId?: string;
}

export const ATTENDANCE_REWARD = 5;   // 기본 출석
export const ATTENDANCE_BONUS = 20;   // 7일 연속 보너스
export const ATTENDANCE_CYCLE = 7;
export const TX_CAP = 100;             // 내역 보관 상한(화면은 최근 10개)

// KST 기준 YYYY-MM-DD
export function kstDateStr(d: Date = new Date()): string {
  return new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}
// dateStr(YYYY-MM-DD)의 하루 전
export function prevDateStr(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
export function newTxId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
// 현재 7일 주기 내 위치(1~7). streak 0이면 0.
export function cyclePosition(streak: number): number {
  return streak <= 0 ? 0 : ((streak - 1) % ATTENDANCE_CYCLE) + 1;
}
