// liveHeat v1.1 — 앱 클라이언트 표시(display) 레이어.
//
// Worker/파이프라인은 무상태 raw 값(live.heat, live.label)만 계산한다(ADR-021).
// momentumBonus·smoothLiveHeat 는 "직전 상태"가 필요하므로 여기(앱)에서만 처리한다.
// 앱은 LIVE 경기를 30초마다 폴링하므로 직전 폴의 점수·직전 표시값을 가진다.
//
// raw(Worker) = 절대 상황 점수, display(앱) = raw + momentum + smooth.
import { useEffect, useRef } from 'react';
import type { Game } from '../types';

const SMOOTH_MAX_DROP = 15; // 30초 폴링 기준 하락폭(스펙 v1.1: 8→15).

export function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

// 추격(점수차 좁힘) — 역전/동점이 아닌 일반 추격 가산(즉시, decay 없음).
export function chaseBonus(prevDiff: number | null, currDiff: number): { bonus: number; label: string | null } {
  if (prevDiff == null) return { bonus: 0, label: null };
  const narrowed = prevDiff - currDiff;
  if (narrowed >= 3) return { bonus: 7, label: '추격전 불붙는 중' };
  if (narrowed >= 2) return { bonus: 5, label: '추격전 불붙는 중' };
  return { bonus: 0, label: null };
}

// ── 역전/동점 "순간 드라마" 이벤트 (부호 있는 점수차 기반, 2분 decay) ──
// 역전 기본 보너스(이닝별). half='B'(말).
function reversalBase(inning: number | null, half: string | null): number {
  const inn = inning ?? 0;
  if (inn >= 9 && half === 'B') return 22;   // 9회말/연장말
  if (inn >= 9) return 18;                    // 9회/연장
  if (inn >= 7) return 14;                    // 후반
  return 10;                                  // 일반
}
// 역전 라벨 — leadChange 이벤트는 최상위 raw 라벨보다 우선(force=true, 결정 1).
function reversalLabel(inning: number | null, half: string | null): { label: string; force: boolean } {
  const inn = inning ?? 0;
  if (inn >= 9 && half === 'B') return { label: '끝내기 역전극', force: true };   // 9회말/연장말
  if (inn >= 10) return { label: '연장 역전극', force: true };                     // 연장초
  if (inn >= 9) return { label: '9회 역전극', force: true };                        // 9회초
  if (inn >= 7) return { label: '후반 역전 드라마', force: true };                  // 후반
  return { label: '방금 역전!', force: true };                                     // 그 외
}

// ── 끝내기 역전 post-game highlight (결정 2) ──
// 9회말/연장말 역전으로 홈팀이 리드하며 끝난 경기는 FINAL 전환 후에도 2분간 라벨 유지.
// 모듈 레벨 레지스트리(컴포넌트 언마운트에도 생존, 시간 만료로 자동 정리).
const WALKOFF_HOLD_MS = 120_000;
const walkoffHighlights = new Map<string, { label: string; expiresAt: number }>();
export function getActiveWalkoff(gameId: string): string | null {
  const w = walkoffHighlights.get(gameId);
  if (!w) return null;
  if (Date.now() >= w.expiresAt) { walkoffHighlights.delete(gameId); return null; }
  return w.label;
}
// 역전 후 점수차 multiplier(0=동점도 1.0 — 최대 긴장).
function gapMultiplier(diff: number): number {
  if (diff <= 1) return 1.0;
  if (diff === 2) return 0.8;
  if (diff === 3) return 0.55;
  return 0.25;
}
// 이벤트 발생 후 경과 시간(ms)별 decay — 30초 폴링 기준 ~2분.
function decayFactor(elapsedMs: number): number {
  const s = elapsedMs / 1000;
  if (s < 30) return 1.0;
  if (s < 60) return 0.7;
  if (s < 90) return 0.45;
  if (s < 120) return 0.25;
  return 0;
}

// 상승은 빠르게, 하락은 한 번에 최대 SMOOTH_MAX_DROP 까지만. 역전 시 숫자 급락 체감 완화.
export function smoothLiveHeat(prevDisplay: number | null, raw: number): number {
  if (prevDisplay == null) return raw;
  if (raw >= prevDisplay) return Math.round(prevDisplay * 0.35 + raw * 0.65);
  return Math.max(raw, prevDisplay - SMOOTH_MAX_DROP);
}

// momentum 라벨은 raw 라벨보다 우선하되, 9회/연장/끝내기 최상위 라벨은 덮어쓰지 않는다(단 역전 force는 예외).
const TOP_PRIORITY_LABELS = new Set(['끝내기 한 방 찬스', '연장 혈투 진행 중', '9회 1점 승부']);

export interface LiveDisplay {
  heat: number;
  label: string;
}

// LIVE 경기의 표시용 heat/label. 컴포넌트 인스턴스가 gameId별로 직전 상태를 보유(useRef).
// 카드가 key={gameId}로 렌더되어 30초 폴링 사이에도 인스턴스가 유지된다.
interface HeatRef {
  prevAway: number | null;
  prevHome: number | null;
  prevDisplay: number | null;
  // 역전/동점 이벤트(2분 decay). evtAt=null이면 활성 이벤트 없음.
  evtAt: number | null;
  evtBonus: number;          // gapMultiplier 적용된 기본 보너스(decay 전)
  evtLabel: string | null;
  evtForce: boolean;         // 최상위 raw 라벨까지 덮어쓸지(9회말/연장말 역전)
}

export function useLiveHeatDisplay(game: Game): LiveDisplay {
  const ref = useRef<HeatRef>({
    prevAway: null, prevHome: null, prevDisplay: null,
    evtAt: null, evtBonus: 0, evtLabel: null, evtForce: false,
  });

  const lv = game.live;
  const away = game.away.score ?? 0;
  const home = game.home.score ?? 0;

  let heat = lv?.heat ?? 0;
  let label = lv?.label ?? '';

  if (lv) {
    const prev = ref.current;
    const now = Date.now();
    const currSigned = home - away;                     // 부호 있는 점수차(홈 기준)
    const currDiff = Math.abs(currSigned);
    const havePrev = prev.prevAway != null && prev.prevHome != null;
    const prevSigned = havePrev ? (prev.prevHome as number) - (prev.prevAway as number) : null;
    const prevDiff = prevSigned != null ? Math.abs(prevSigned) : null;

    // 1) 이번 폴에서 새 이벤트(역전/동점) 감지 — 부호 기반.
    if (prevSigned != null) {
      const leadChange = prevSigned !== 0 && currSigned !== 0 && Math.sign(prevSigned) !== Math.sign(currSigned);
      const tieMade = prevSigned !== 0 && currSigned === 0;
      if (leadChange) {
        const { label: rl, force } = reversalLabel(lv.inning, lv.half);
        prev.evtAt = now;
        prev.evtBonus = reversalBase(lv.inning, lv.half) * gapMultiplier(currDiff);
        prev.evtLabel = rl;
        prev.evtForce = force;
        // 끝내기 역전(9회말/연장말 + 홈 리드) → 종료 후 2분 highlight 등록
        if ((lv.inning ?? 0) >= 9 && lv.half === 'B' && currSigned > 0) {
          walkoffHighlights.set(game.gameId, { label: '끝내기 역전극', expiresAt: now + WALKOFF_HOLD_MS });
        }
      } else if (tieMade) {
        prev.evtAt = now;
        prev.evtBonus = 6 * gapMultiplier(0);            // 동점 +6
        prev.evtLabel = '방금 동점!';
        prev.evtForce = false;
      }
    }

    // 2) 활성 이벤트 decay 적용(경과시간 기준). >2분이면 소멸.
    let evtBonus = 0;
    let evtLabel: string | null = null;
    let evtForce = false;
    if (prev.evtAt != null) {
      const d = decayFactor(now - prev.evtAt);
      if (d > 0) { evtBonus = prev.evtBonus * d; evtLabel = prev.evtLabel; evtForce = prev.evtForce; }
      else { prev.evtAt = null; prev.evtBonus = 0; prev.evtLabel = null; prev.evtForce = false; }
    }

    // 3) 추격(일반) — 이벤트가 없을 때만.
    const chase = evtBonus > 0 ? { bonus: 0, label: null } : chaseBonus(prevDiff, currDiff);

    const momBonus = evtBonus > 0 ? Math.round(evtBonus) : chase.bonus;
    const rawWithMom = clamp(Math.round(lv.heat + momBonus));
    // 경기 종료(LIVE 아님)에는 smoothing 미적용 — raw 그대로.
    heat = game.status === 'LIVE' ? smoothLiveHeat(prev.prevDisplay, rawWithMom) : rawWithMom;

    // 4) 라벨 — 역전 force면 최상위 라벨도 덮어씀. 그 외는 최상위 raw 라벨 유지.
    const momLabel = evtBonus > 0 ? evtLabel : chase.label;
    if (momLabel && (evtForce || !TOP_PRIORITY_LABELS.has(lv.label))) label = momLabel;
    else label = lv.label;
  } else {
    // 라이브 종료(live=null)여도 끝내기 역전 highlight 창(2분) 내면 라벨/직전 heat 유지(결정 2).
    const w = getActiveWalkoff(game.gameId);
    if (w) {
      heat = ref.current.prevDisplay ?? heat;
      label = w;
    }
  }

  // 렌더 후 직전 점수/표시값 갱신(다음 폴 비교용). 이벤트 상태는 위에서 즉시 갱신.
  useEffect(() => {
    if (lv) {
      ref.current.prevAway = away;
      ref.current.prevHome = home;
      ref.current.prevDisplay = heat;
    }
  }, [lv, away, home, heat]);

  return { heat, label };
}
