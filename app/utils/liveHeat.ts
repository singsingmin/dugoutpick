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

// 직전 점수차 대비 좁혀진 정도로 가산. 역전은 현재 입력만으론 알기 어려워 점수차 변화 중심.
export function getMomentumBonus(prevDiff: number | null, currDiff: number): number {
  if (prevDiff == null) return 0;
  const narrowed = prevDiff - currDiff;
  if (prevDiff > 0 && currDiff === 0) return 6; // 방금 동점
  if (narrowed >= 3) return 7;                  // 큰 추격
  if (narrowed >= 2) return 5;                  // 의미 있는 추격
  return 0;
}

// 상승은 빠르게, 하락은 한 번에 최대 SMOOTH_MAX_DROP 까지만. 역전 시 숫자 급락 체감 완화.
export function smoothLiveHeat(prevDisplay: number | null, raw: number): number {
  if (prevDisplay == null) return raw;
  if (raw >= prevDisplay) return Math.round(prevDisplay * 0.35 + raw * 0.65);
  return Math.max(raw, prevDisplay - SMOOTH_MAX_DROP);
}

// momentum 라벨은 raw 라벨보다 우선하되, 9회/연장/끝내기 최상위 라벨은 덮어쓰지 않는다.
const TOP_PRIORITY_LABELS = new Set(['끝내기 한 방 찬스', '연장 혈투 진행 중', '9회 1점 승부']);

export function momentumLabel(prevDiff: number | null, currDiff: number): string | null {
  if (prevDiff == null) return null;
  if (prevDiff > 0 && currDiff === 0) return '방금 동점, 흐름 요동';
  if (prevDiff - currDiff >= 2) return '추격전 불붙는 중';
  return null;
}

export interface LiveDisplay {
  heat: number;
  label: string;
}

// LIVE 경기의 표시용 heat/label. 컴포넌트 인스턴스가 gameId별로 직전 상태를 보유(useRef).
// 카드가 key={gameId}로 렌더되어 30초 폴링 사이에도 인스턴스가 유지된다.
export function useLiveHeatDisplay(game: Game): LiveDisplay {
  const ref = useRef<{ prevAway: number | null; prevHome: number | null; prevDisplay: number | null }>({
    prevAway: null,
    prevHome: null,
    prevDisplay: null,
  });

  const lv = game.live;
  const away = game.away.score ?? 0;
  const home = game.home.score ?? 0;

  let heat = lv?.heat ?? 0;
  let label = lv?.label ?? '';

  if (lv) {
    const prev = ref.current;
    const currDiff = Math.abs(away - home);
    const prevDiff =
      prev.prevAway != null && prev.prevHome != null ? Math.abs(prev.prevAway - prev.prevHome) : null;

    const rawWithMom = clamp(Math.round(lv.heat + getMomentumBonus(prevDiff, currDiff)));
    // 경기 종료(LIVE 아님) 상태에서는 smoothing 미적용 — raw 그대로.
    heat = game.status === 'LIVE' ? smoothLiveHeat(prev.prevDisplay, rawWithMom) : rawWithMom;

    const mom = momentumLabel(prevDiff, currDiff);
    label = mom && !TOP_PRIORITY_LABELS.has(lv.label) ? mom : lv.label;
  }

  // 렌더 후 직전 상태 갱신(다음 폴 비교용). 표시값 계산은 갱신 전 ref를 읽는다.
  useEffect(() => {
    if (lv) ref.current = { prevAway: away, prevHome: home, prevDisplay: heat };
  }, [lv, away, home, heat]);

  return { heat, label };
}
