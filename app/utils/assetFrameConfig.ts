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
    aspect: 1166 / 664,        // ≈1.756 (크롭 후 실측)
    numberCenterX: 0.41,       // 좌측 메인 패널 중심(우측 스텁 제외)
    numberCenterY: 0.47,       // 상단 리본 아래 ~ 하단 엠블럼 위 빈칸
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
    aspect: 1058 / 981,        // ≈1.078 (크롭 후 실측, 거의 정사각)
    numberCenterX: 0.5,        // 좌우 대칭 → 중앙
    numberCenterY: 0.50,       // 상단 배너 아래 ~ 하단 야구공 위 크림 빈칸
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
    aspect: 1168 / 1213,       // ≈0.963 (크롭 후 실측, 리본 포함 세로가 조금 김)
    numberCenterX: 0.5,
    numberCenterY: 0.546,      // 링 중심 — 상단 리본이 솟아 중앙보다 약간 아래
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
};

export function getImageFrameConfig(assetKey: string): ImageFrameConfig | undefined {
  return IMAGE_FRAME_ASSETS[assetKey];
}
