// 8비트 도트 UI 디자인 토큰 (ADR-009). 모든 화면/컴포넌트는 이 토큰만 사용 — 하드코딩 금지.
// 팔레트: 빈티지 라이트(크림 배경 + 포레스트 그린 크롬 + 골드 꿀잼지수). 각진 두꺼운 다크 테두리 + 픽셀 폰트.

export const colors = {
  bg: '#F3E9CE',        // 크림 배경
  surface: '#FBF5E4',   // 카드(밝은 크림)
  surfaceAlt: '#EADFBF', // 보조/선택 강조
  text: '#2B2620',      // 진한 텍스트(다크 브라운블랙)
  textDim: '#7A7060',   // 보조 텍스트
  accent: '#34663F',    // 주 크롬: 포레스트 그린(헤더·버튼·라벨·활성)
  accent2: '#F2C53D',   // 골드
  gold: '#F2C53D',      // 꿀잼지수 골드
  border: '#2B2620',    // 두꺼운 8비트 다크 테두리
  good: '#2E8B57',      // 승/긍정
  bad: '#D33A2C',       // 패/부정
  onGreen: '#F3E9CE',   // 그린 배경 위 텍스트(크림)
  onGold: '#2B2620',    // 골드 배경 위 텍스트
  shadow: '#000000',
} as const;

export const fonts = {
  pixel: 'Galmuri11', // expo-font 로드 패밀리명과 일치해야 함
} as const;

export const border = {
  width: 3,
  radius: 0, // 각진 픽셀 모서리
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const fontSize = {
  caption: 10,
  body: 13,
  title: 18,
  hero: 26,
  score: 40,
} as const;

// 꿀잼지수 색: 추천/상세 대형 배지는 골드 고정(시그니처). 리스트 소형은 그린 박스.
export function honjamColor(_score: number): string {
  return colors.gold;
}

export const theme = { colors, fonts, border, spacing, fontSize, honjamColor };
export default theme;
