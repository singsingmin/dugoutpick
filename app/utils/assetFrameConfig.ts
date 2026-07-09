// imageFrame 에셋 스킨 설정 — 고정 PNG + 점수 숫자만 오버레이하는 에셋의 레이아웃.
// 새 이미지형 에셋(티켓·포스터·엽서 등)은 여기 한 항목만 추가하면 됨(assetKey로 조회).
// 전광판(scoreboard)은 B/S/O 등 전용 로직이 있어 별도 컴포넌트 유지 — 여기 미포함.
import type { ImageSourcePropType } from 'react-native';

export interface ImageFrameConfig {
  source: ImageSourcePropType;
  aspect: number;          // 이미지 가로/세로 비율
  // 숫자 중심 위치(이미지 대비 비율 0~1). 스텁이 있는 티켓은 좌측 패널 중심이라 0.5가 아님.
  numberCenterX: number;
  numberCenterY: number;
  numberColor: string;
  fontRatio: number;       // 폰트 크기 = 렌더 높이 × fontRatio
  threeDigitScale: number; // 3자리(100)만 축소 배율
  centerOffset: number;    // 세로 중앙 보정 = lineHeight 절반(≈0.52)
  fontFamily: string;
  // 숫자 그림자(두께감·눌림 효과). 다크톤 아래 offset이면 종이에 눌린 엠보스 느낌.
  shadowColor: string;
  shadowDy: number;
  shadowRadius: number;
  // variant별 렌더 폭(px). compact도 숫자가 읽히도록 여유있게.
  widths: { hero: number; compact: number; detail: number; preview: number };
}

export const IMAGE_FRAME_ASSETS: Record<string, ImageFrameConfig> = {
  ticketRetro: {
    source: require('../assets/ticket-frame.webp'),
    aspect: 1176 / 714,        // ≈1.647 (2D 교체본, 크롭 실측)
    numberCenterX: 0.42,       // 좌측 메인 패널 중심(우측 스텁 제외, 살짝 우측)
    numberCenterY: 0.49,       // 상단 꿀잼지수 배너 아래 ~ 하단 엠블럼 위 빈칸(살짝 아래)
    numberColor: '#B23A2E',    // 크림 바탕 → 레트로 레드 스탬프
    fontRatio: 0.40,           // 빈칸 대비 스탬프 존재감(+약 5%)
    threeDigitScale: 0.72,
    centerOffset: 0.52,
    fontFamily: 'Galmuri11Bold',
    shadowColor: 'rgba(90,25,18,0.5)',  // 다크레드 아래 그림자 → 두께감 + 약한 눌림
    shadowDy: 1.2,
    shadowRadius: 0.8,
    // 히어로 카드 팀명 잘림 방지 위해 전광판(128) footprint에 맞춤(넓은 티켓이라 같은 폭이면 128×73).
    widths: { compact: 64, hero: 128, detail: 156, preview: 168 },
  },
  homePlate: {
    source: require('../assets/homeplate-frame.webp'),
    aspect: 1078 / 1033,       // ≈1.044 (2D 교체본, 거의 정사각)
    numberCenterX: 0.52,       // 살짝 우측
    numberCenterY: 0.51,       // 상단 HOME PLATE 배너 아래 ~ 하단 야구공 위 크림 빈칸
    numberColor: '#2C3E6B',    // 크림 바탕 + 네이비 테두리 → 네이비 스탬프
    fontRatio: 0.34,
    threeDigitScale: 0.72,
    centerOffset: 0.52,
    fontFamily: 'Galmuri11Bold',
    shadowColor: 'rgba(20,28,55,0.45)',  // 네이비 아래 그림자 → 두께감·눌림
    shadowDy: 1.2,
    shadowRadius: 0.8,
    // 폭은 전광판(128) footprint에 맞춤. 정사각이라 같은 폭이면 128×119(세로만 조금 큼).
    widths: { compact: 64, hero: 128, detail: 156, preview: 168 },
  },
  medalSpecial: {
    source: require('../assets/medal-frame.webp'),
    aspect: 1153 / 1234,       // ≈0.934 (2D 교체본, 월계관 링·세로형)
    numberCenterX: 0.52,       // 살짝 우측
    numberCenterY: 0.55,       // 투명 링 홀 중심 — 상단 꿀잼지수 배너 아래(살짝 아래)
    numberColor: '#26365F',    // 투명 링 뒤=크림 카드 → 네이비(메달 네이비 밴드와 조화)
    fontRatio: 0.30,           // 링 원 안에 여유있게
    threeDigitScale: 0.72,
    centerOffset: 0.52,
    fontFamily: 'Galmuri11Bold',
    shadowColor: 'rgba(15,22,50,0.45)',
    shadowDy: 1.2,
    shadowRadius: 0.9,
    widths: { compact: 64, hero: 128, detail: 156, preview: 168 },
  },

  // ── 야구장 5종 (2D 교체본, 핑크 크로마키 제거 후 crop 실측 aspect) ──
  nameplateDugout: {
    source: require('../assets/nameplate-frame.webp'),
    aspect: 1192 / 612,        // ≈1.948 (가로형 명패)
    numberCenterX: 0.50,
    numberCenterY: 0.57,       // 상단 공·별 장식 아래 크림 명패 중심(살짝 아래)
    numberColor: '#2F4A32',    // 크림 명패 → 더그아웃 그린 잉크
    fontRatio: 0.34,
    threeDigitScale: 0.72,
    centerOffset: 0.52,
    fontFamily: 'Galmuri11Bold',
    shadowColor: 'rgba(20,40,24,0.45)',
    shadowDy: 1.2,
    shadowRadius: 0.8,
    widths: { compact: 64, hero: 128, detail: 156, preview: 168 },
  },
  lineupCard: {
    source: require('../assets/lineup-frame.webp'),
    aspect: 1054 / 935,        // ≈1.127
    numberCenterX: 0.50,
    numberCenterY: 0.54,       // 상단 클립 아래 카드 중심(살짝 아래)
    numberColor: '#2C3E6B',    // 크림 카드 → 네이비 펜 잉크
    fontRatio: 0.36,
    threeDigitScale: 0.72,
    centerOffset: 0.52,
    fontFamily: 'Galmuri11Bold',
    shadowColor: 'rgba(18,26,52,0.42)',
    shadowDy: 1.2,
    shadowRadius: 0.8,
    widths: { compact: 64, hero: 128, detail: 156, preview: 168 },
  },
  tacticBoard: {
    source: require('../assets/tacticboard-frame.webp'),
    aspect: 1108 / 905,        // ≈1.224
    numberCenterX: 0.51,
    numberCenterY: 0.46,       // 상단 크림 보드 중심(하단 작전 다이어그램 제외)
    numberColor: '#26402C',    // 크림 보드 → 딥 그린 분필
    fontRatio: 0.32,
    threeDigitScale: 0.72,
    centerOffset: 0.52,
    fontFamily: 'Galmuri11Bold',
    shadowColor: 'rgba(16,30,20,0.42)',
    shadowDy: 1.2,
    shadowRadius: 0.8,
    widths: { compact: 64, hero: 128, detail: 156, preview: 168 },
  },
  ballparkGate: {
    source: require('../assets/gate-frame.webp'),
    aspect: 1118 / 863,        // ≈1.296
    numberCenterX: 0.51,       // 미세 좌측
    numberCenterY: 0.51,       // 상단 깃발·아치 아래 크림 사인 중심(미세 아래)
    numberColor: '#2C3E6B',    // 크림 사인 → 네이비 잉크
    fontRatio: 0.30,
    threeDigitScale: 0.72,
    centerOffset: 0.52,
    fontFamily: 'Galmuri11Bold',
    shadowColor: 'rgba(18,26,52,0.42)',
    shadowDy: 1.2,
    shadowRadius: 0.8,
    widths: { compact: 64, hero: 128, detail: 156, preview: 168 },
  },
  speedgunBoard: {
    source: require('../assets/speedgun-frame.webp'),
    aspect: 1074 / 833,        // ≈1.289
    numberCenterX: 0.52,       // 살짝 우측
    numberCenterY: 0.50,       // 검은 도트매트릭스 디스플레이 중심(살짝 위, 하단 MPH 라벨 위)
    numberColor: '#8DF06A',    // 어두운 디스플레이 → 밝은 LED 그린(유일한 밝은 숫자)
    fontRatio: 0.34,
    threeDigitScale: 0.72,
    centerOffset: 0.52,
    fontFamily: 'Galmuri11Bold',
    shadowColor: 'rgba(80,220,60,0.7)',  // LED 글로우(눌림 대신 발광)
    shadowDy: 0,
    shadowRadius: 3,
    widths: { compact: 64, hero: 128, detail: 156, preview: 168 },
  },

  // ── 스페셜 2종 ──
  mvpTrophy: {
    source: require('../assets/trophy-frame.webp'),
    aspect: 969 / 1031,        // ≈0.940 (2D 교체본, 세로형)
    numberCenterX: 0.52,       // 살짝 우측
    numberCenterY: 0.45,       // 상단 타원 명판 중심(살짝 위, 하단 트로피·배트·명패 위)
    numberColor: '#26365F',    // 크림 명판 → 네이비 잉크
    fontRatio: 0.30,
    threeDigitScale: 0.72,
    centerOffset: 0.52,
    fontFamily: 'Galmuri11Bold',
    shadowColor: 'rgba(15,22,50,0.45)',
    shadowDy: 1.2,
    shadowRadius: 0.9,
    widths: { compact: 64, hero: 128, detail: 156, preview: 168 },
  },
  champRing: {
    source: require('../assets/ring-frame.webp'),
    aspect: 982 / 995,         // ≈0.987 (2D 교체본)
    numberCenterX: 0.51,       // 미세 좌측
    numberCenterY: 0.51,       // 다이아 링 중앙 크림 명판
    numberColor: '#26365F',    // 크림 명판 → 네이비 잉크
    fontRatio: 0.26,
    threeDigitScale: 0.72,
    centerOffset: 0.52,
    fontFamily: 'Galmuri11Bold',
    shadowColor: 'rgba(15,22,50,0.45)',
    shadowDy: 1.2,
    shadowRadius: 0.9,
    widths: { compact: 64, hero: 128, detail: 156, preview: 168 },
  },

  // ── 2026 하반기 한정 스킨 2종 (마젠타 크로마키 crop 실측 aspect) ──
  stoveWinter: {
    source: require('../assets/stove-frame.webp'),
    aspect: 1173 / 919,        // ≈1.276 (가로형 프레임)
    numberCenterX: 0.50,
    numberCenterY: 0.54,       // WINTER 배너 아래 ~ 하단 배너 위 큰 크림 패널 중심
    numberColor: '#26365F',    // 크림 패널 → 네이비 잉크(네이비 프레임 조화)
    fontRatio: 0.34,
    threeDigitScale: 0.72,
    centerOffset: 0.52,
    fontFamily: 'Galmuri11Bold',
    shadowColor: 'rgba(15,22,50,0.45)',
    shadowDy: 1.2,
    shadowRadius: 0.8,
    widths: { compact: 64, hero: 128, detail: 156, preview: 168 },
  },
  goldGlove: {
    source: require('../assets/goldglove-frame.webp'),
    aspect: 1110 / 981,        // ≈1.131
    numberCenterX: 0.50,
    numberCenterY: 0.60,       // 글러브·배너가 위를 차지 → 크림 실드 중심(살짝 아래)
    numberColor: '#4A3A1E',    // 크림 명판 → 다크 브론즈 각인
    fontRatio: 0.32,
    threeDigitScale: 0.72,
    centerOffset: 0.52,
    fontFamily: 'Galmuri11Bold',
    shadowColor: 'rgba(60,40,15,0.45)',
    shadowDy: 1.2,
    shadowRadius: 0.9,
    widths: { compact: 64, hero: 128, detail: 156, preview: 168 },
  },
};

export function getImageFrameConfig(assetKey: string): ImageFrameConfig | undefined {
  return IMAGE_FRAME_ASSETS[assetKey];
}
