// 라커룸 배경 데이터모델 — Stage 6(docs/stage6-cosmetics-design.md §3-3). 서버 backgrounds 테이블과 수동 동기화.
// 이미지 에셋 12종 실장 완료(2026-07-07, 941×1672 — stadium-bg.webp와 동일 규격).
// 신규 구매형 6종 추가 시 서버 backgrounds 테이블도 함께 시드해야 함(supabase/migrations/0009_locker_backgrounds_pack2.sql).
import { formatPeriod } from './titleConfig';

export type BackgroundUnlockType = 'currency' | 'monthly_rank' | 'season_rank';

export interface LockerBackground {
  id: string;
  label: string;
  description: string;
  unlockType: BackgroundUnlockType;
  price?: number;          // currency 타입만
  backgroundImage: number; // require(...) 소스
  sortOrder: number;
  // 한정 판매 윈도우(표시용, 강제 SoT는 서버 backgrounds.available_from/until). ISO '+09:00'.
  availableFrom?: string;
  availableUntil?: string;
}

export const LOCKER_BACKGROUNDS: LockerBackground[] = [
  {
    id: 'lockerbg.classic_dugout', label: '클래식 더그아웃', description: '기본 더그아웃 콘셉트',
    unlockType: 'currency', price: 40, sortOrder: 10,
    backgroundImage: require('../assets/lockerbg-classic-dugout.webp'),
  },
  {
    id: 'lockerbg.green_field', label: '그린 필드 라커', description: '그라운드 뷰 라커룸',
    unlockType: 'currency', price: 40, sortOrder: 20,
    backgroundImage: require('../assets/lockerbg-green-field.webp'),
  },
  {
    id: 'lockerbg.night_stadium', label: '야간 구장', description: '조명 켜진 야간 경기장',
    unlockType: 'currency', price: 50, sortOrder: 30,
    backgroundImage: require('../assets/lockerbg-night-stadium.webp'),
  },
  {
    id: 'lockerbg.lineup_boardroom', label: '라인업 보드룸', description: '작전판이 있는 회의실',
    unlockType: 'currency', price: 50, sortOrder: 40,
    backgroundImage: require('../assets/lockerbg-lineup-boardroom.webp'),
  },
  {
    id: 'lockerbg.rainy_dugout', label: '비 오는 더그아웃', description: '우천 취소된 조용한 더그아웃',
    unlockType: 'currency', price: 45, sortOrder: 50,
    backgroundImage: require('../assets/lockerbg-rainy-dugout.webp'),
  },
  {
    id: 'lockerbg.sunset_bullpen', label: '석양 불펜', description: '노을 지는 불펜',
    unlockType: 'currency', price: 50, sortOrder: 60,
    backgroundImage: require('../assets/lockerbg-sunset-bullpen.webp'),
  },
  {
    id: 'lockerbg.retro_scoreboard', label: '레트로 전광판 룸', description: '전구식 옛날 전광판',
    unlockType: 'currency', price: 55, sortOrder: 70,
    backgroundImage: require('../assets/lockerbg-retro-scoreboard.webp'),
  },
  {
    id: 'lockerbg.baseball_cafe', label: '야구 카페 라커', description: '아기자기한 야구 카페',
    unlockType: 'currency', price: 45, sortOrder: 80,
    backgroundImage: require('../assets/lockerbg-baseball-cafe.webp'),
  },
  {
    id: 'lockerbg.training_room', label: '트레이닝 룸', description: '웨이트·컨디셔닝 훈련실',
    unlockType: 'currency', price: 50, sortOrder: 90,
    backgroundImage: require('../assets/lockerbg-training-room.webp'),
  },
  {
    id: 'lockerbg.stove_league_office', label: '스토브리그 오피스', description: '겨울 스토브리그 사무실',
    unlockType: 'currency', price: 60, sortOrder: 95,
    backgroundImage: require('../assets/lockerbg-stove-league-office.webp'),
  },
  // ── 2026 하반기 한정 배경 6종 (판매 윈도우 = 서버 강제, 여기 날짜는 표시용) ──
  {
    id: 'lockerbg.stars_night_2026', label: '별들의 밤', description: '올스타 브레이크 · 별빛 야간 무대',
    unlockType: 'currency', price: 120, sortOrder: 200,
    availableFrom: '2026-07-15T00:00:00+09:00', availableUntil: '2026-08-03T00:00:00+09:00',
    backgroundImage: require('../assets/lockerbg-stars-night.webp'),
  },
  {
    id: 'lockerbg.midsummer_night_2026', label: '한여름 나이터', description: '열대야 야간경기 · 네온 조명',
    unlockType: 'currency', price: 120, sortOrder: 210,
    availableFrom: '2026-08-01T00:00:00+09:00', availableUntil: '2026-09-01T00:00:00+09:00',
    backgroundImage: require('../assets/lockerbg-midsummer-night.webp'),
  },
  {
    id: 'lockerbg.chuseok_2026', label: '한가위 구장', description: '보름달 뜬 명절 구장',
    unlockType: 'currency', price: 120, sortOrder: 220,
    availableFrom: '2026-09-18T00:00:00+09:00', availableUntil: '2026-10-05T00:00:00+09:00',
    backgroundImage: require('../assets/lockerbg-chuseok.webp'),
  },
  {
    id: 'lockerbg.autumn_baseball_2026', label: '가을야구', description: '단풍 · 포스트시즌 기대감',
    unlockType: 'currency', price: 150, sortOrder: 230,
    availableFrom: '2026-10-01T00:00:00+09:00', availableUntil: '2026-11-11T00:00:00+09:00',
    backgroundImage: require('../assets/lockerbg-autumn-baseball.webp'),
  },
  {
    id: 'lockerbg.championship_2026', label: '챔피언 시리즈', description: '우승 무대 · 트로피 조명',
    unlockType: 'currency', price: 200, sortOrder: 240,
    availableFrom: '2026-10-25T00:00:00+09:00', availableUntil: '2026-11-16T00:00:00+09:00',
    backgroundImage: require('../assets/lockerbg-championship.webp'),
  },
  {
    id: 'lockerbg.holiday_2026', label: '홀리데이 연말 구장', description: '크리스마스 조명 · 연말 구장',
    unlockType: 'currency', price: 150, sortOrder: 250,
    availableFrom: '2026-12-01T00:00:00+09:00', availableUntil: '2027-01-01T00:00:00+09:00',
    backgroundImage: require('../assets/lockerbg-holiday.webp'),
  },
  {
    id: 'lockerbg.monthly_champion', label: '월간 챔피언 룸', description: '이번 달 포인트 1위 전용',
    unlockType: 'monthly_rank', sortOrder: 100,
    backgroundImage: require('../assets/lockerbg-monthly-champion.webp'),
  },
  {
    id: 'lockerbg.season_trophy', label: '시즌 트로피룸', description: '시즌 포인트 1위 전용',
    unlockType: 'season_rank', sortOrder: 110,
    backgroundImage: require('../assets/lockerbg-season-trophy.webp'),
  },
];

export function findBackground(id: string | null | undefined): LockerBackground | undefined {
  return id ? LOCKER_BACKGROUNDS.find((b) => b.id === id) : undefined;
}

// 명예형 배경 인스턴스 라벨 — 이미지는 공용, 년월은 UI가 합성(0014).
//  예) ('lockerbg.monthly_champion','monthly','202607') → "2026.07 월간 챔피언 룸"
export function backgroundInstanceLabel(
  backgroundId: string,
  periodType?: string | null,
  periodLabel?: string | null,
): string {
  const base = findBackground(backgroundId)?.label ?? backgroundId;
  if ((periodType === 'monthly' || periodType === 'season') && periodLabel) {
    return `${formatPeriod(periodType, periodLabel)} ${base}`;
  }
  return base;
}
