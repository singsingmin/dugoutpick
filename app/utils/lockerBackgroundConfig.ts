// 라커룸 배경 데이터모델 — Stage 6(docs/stage6-cosmetics-design.md §3-3). 서버 backgrounds 테이블과 수동 동기화.
// 실제 이미지 에셋은 아직 없음(설계문서 §11 체크리스트 6번, 별도 제작 예정) — 그때까진 previewColor로
// 단색 배경 렌더링. 나중에 backgroundImage(require 소스)만 채우면 렌더러가 자동으로 이미지를 우선 사용.
export type BackgroundUnlockType = 'currency' | 'monthly_rank' | 'season_rank';

export interface LockerBackground {
  id: string;
  label: string;
  description: string;
  unlockType: BackgroundUnlockType;
  price?: number;          // currency 타입만
  previewColor: string;    // 실제 에셋 나오기 전 단색 폴백
  backgroundImage?: number; // require(...) 소스 — 에셋 준비되면 채움
  sortOrder: number;
}

export const LOCKER_BACKGROUNDS: LockerBackground[] = [
  {
    id: 'lockerbg.classic_dugout', label: '클래식 더그아웃', description: '기본 더그아웃 콘셉트',
    unlockType: 'currency', price: 40, previewColor: '#3A3530', sortOrder: 10,
  },
  {
    id: 'lockerbg.green_field', label: '그린 필드 라커', description: '그라운드 뷰 라커룸',
    unlockType: 'currency', price: 40, previewColor: '#2E8B57', sortOrder: 20,
  },
  {
    id: 'lockerbg.night_stadium', label: '야간 구장', description: '조명 켜진 야간 경기장',
    unlockType: 'currency', price: 50, previewColor: '#1B2A4A', sortOrder: 30,
  },
  {
    id: 'lockerbg.lineup_boardroom', label: '라인업 보드룸', description: '작전판이 있는 회의실',
    unlockType: 'currency', price: 50, previewColor: '#4A3B2A', sortOrder: 40,
  },
  {
    id: 'lockerbg.monthly_champion', label: '월간 챔피언 룸', description: '이번 달 포인트 1위 전용',
    unlockType: 'monthly_rank', previewColor: '#B8860B', sortOrder: 100,
  },
  {
    id: 'lockerbg.season_trophy', label: '시즌 트로피룸', description: '시즌 포인트 1위 전용',
    unlockType: 'season_rank', previewColor: '#8B6914', sortOrder: 110,
  },
];

export function findBackground(id: string | null | undefined): LockerBackground | undefined {
  return id ? LOCKER_BACKGROUNDS.find((b) => b.id === id) : undefined;
}
