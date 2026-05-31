// 8비트 도트 UI 디자인 토큰 (ADR-009). 모든 화면/컴포넌트는 이 토큰만 사용 — 하드코딩 금지.
// 어두운 배경 + 고대비 비비드 팔레트 + 각진 두꺼운 테두리 + 픽셀 폰트(Galmuri11).

export const colors = {
  bg: '#0d0b1a',          // 화면 배경(딥 네이비/퍼플)
  surface: '#1a1730',     // 패널 배경
  surfaceAlt: '#262146',  // 보조 패널/선택 강조
  text: '#f4f4f8',        // 기본 텍스트
  textDim: '#9a93c4',     // 보조 텍스트
  accent: '#ffd23f',      // 주 강조(비비드 옐로)
  accent2: '#00e5a8',     // 보조 강조(민트)
  border: '#5b5488',      // 기본 테두리
  good: '#3ad97a',        // 승/긍정
  bad: '#ff4d6d',         // 패/부정
  shadow: '#000000',
} as const;

export const fonts = {
  pixel: 'Galmuri11', // expo-font로 로드된 패밀리명과 정확히 일치해야 함
} as const;

export const border = {
  width: 3,    // 8비트 두꺼운 테두리
  radius: 0,   // 각진 모서리(픽셀 감성)
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

// 꿀잼지수 점수대별 색(높을수록 뜨거운 색). 히어로/배지에 사용.
export function honjamColor(score: number): string {
  if (score >= 80) return '#ff3b3b'; // 핫 레드
  if (score >= 60) return '#ff8c1a'; // 오렌지
  if (score >= 40) return '#ffd23f'; // 옐로
  if (score >= 20) return '#5bc8ff'; // 블루
  return '#7a86a8';                  // 그레이블루(시시)
}

export const theme = { colors, fonts, border, spacing, fontSize, honjamColor };
export default theme;
