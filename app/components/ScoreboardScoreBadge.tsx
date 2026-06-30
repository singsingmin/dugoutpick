// 야구장 레트로 전광판 스킨 V7 — 고정 프레임 PNG 에셋 + 숫자만 동적 오버레이.
// 프레임/헤더캡/B/S/O 바(3/2/2 부분점등)/도트매트릭스는 에셋(scoreboard-frame.png, 1448x1086, 4:3)에 구워짐.
// 앱은 디스플레이 창 중심에 score 숫자만 올린다. 유니폼 SVG는 무관(별도 kind).
import { View, Image, StyleSheet } from 'react-native';
import PixelText from './PixelText';

const FRAME = require('../assets/scoreboard-frame.png');
const ASPECT = 1448 / 1086; // ≈1.333 (4:3)

// 디스플레이 창(헤더캡 아래 ~ B/S/O 바 위)의 세로 중심 — 이미지 대비 비율.
// 실기기 스샷 보정(v7.1): 0.45 → 0.475 (숫자가 창에서 살짝 위로 떠서 내림).
const WINDOW_CENTER_Y = 0.475;
// 숫자 텍스트 세로 센터링 오프셋 = lineHeight 절반(≈0.52). 과보정(0.62) → 0.52로 교정.
const CENTER_OFFSET = 0.52;
// 숫자 폰트 = 배지 높이 × 비율 (창 높이 ~0.46h 안에서 시원하게). v7.1: 0.34 → 0.36.
const NUM_RATIO = 0.36;
const NUMBER_COLOR = '#F0D77A';

export type ScoreboardVariant = 'hero' | 'compact' | 'detail' | 'preview';

interface Props {
  score: number;
  variant?: ScoreboardVariant;
  teamColor?: string;  // 에셋에 구워져 미사용(시그니처 호환용)
  showLabel?: boolean; // 헤더 에셋에 포함 — 미사용
}

// 4:3 고정. compact 포함 전 variant가 같은 에셋을 스케일.
const WIDTHS: Record<ScoreboardVariant, number> = {
  compact: 64,
  hero: 128,
  detail: 156,
  preview: 168,
};

export default function ScoreboardScoreBadge({ score, variant = 'hero' }: Props) {
  const w = WIDTHS[variant];
  const h = Math.round(w / ASPECT);
  const n = Math.round(score);
  const digits = String(Math.abs(n)).length;

  // 2자리 기준 폰트, "100"(3자리)만 0.72배 축소(창 폭 넘침 방지), 1자리는 2자리와 동일 크기.
  const baseFont = h * NUM_RATIO;
  const fontSize = digits >= 3 ? baseFont * 0.72 : baseFont;

  // 숫자 세로 중심을 창 중심(WINDOW_CENTER_Y)에 맞춤.
  const top = h * WINDOW_CENTER_Y - fontSize * CENTER_OFFSET;

  return (
    <View style={{ width: w, height: h }}>
      <Image source={FRAME} style={{ width: w, height: h }} resizeMode="contain" />
      <View style={[styles.overlay, { top }]} pointerEvents="none">
        <PixelText
          style={{
            fontSize,
            color: NUMBER_COLOR,
            fontFamily: 'Galmuri11Bold',
            lineHeight: fontSize * 1.05,
            textShadowColor: 'rgba(0,0,0,0.4)',
            textShadowOffset: { width: 1, height: 1 },
            textShadowRadius: 1,
          }}
        >
          {n}
        </PixelText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
