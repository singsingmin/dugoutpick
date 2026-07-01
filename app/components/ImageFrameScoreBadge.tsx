// 범용 imageFrame 에셋 배지 — 고정 PNG 프레임 + 점수 숫자만 동적 오버레이.
// 레이아웃은 assetFrameConfig(assetKey)에서 조회. 전광판과 달리 숫자 위치가 임의(좌측 패널 등)라
// 가로 중심을 numberCenterX로 지정 가능(width 트릭으로 임의 x 센터링).
import { View, Image, StyleSheet } from 'react-native';
import PixelText from './PixelText';
import { getImageFrameConfig } from '../utils/assetFrameConfig';

export type ImageFrameVariant = 'hero' | 'compact' | 'detail' | 'preview';

interface Props {
  score: number;
  variant?: ImageFrameVariant;
  assetKey: string;
}

export default function ImageFrameScoreBadge({ score, variant = 'hero', assetKey }: Props) {
  const cfg = getImageFrameConfig(assetKey);
  if (!cfg) return null;

  const w = cfg.widths[variant];
  const h = Math.round(w / cfg.aspect);
  const n = Math.round(score);
  const digits = String(Math.abs(n)).length;

  const baseFont = h * cfg.fontRatio;
  const fontSize = digits >= 3 ? baseFont * cfg.threeDigitScale : baseFont;

  // 세로: 창 중심(numberCenterY)에 숫자 세로중심 맞춤.
  const top = h * cfg.numberCenterY - fontSize * cfg.centerOffset;
  // 가로: 폭 = 2·cx·w 인 컨테이너를 left:0에 두면 자식 중심이 cx·w 에 위치.
  const centerW = Math.max(fontSize, cfg.numberCenterX * 2 * w);

  return (
    <View style={{ width: w, height: h }}>
      <Image source={cfg.source} style={{ width: w, height: h }} resizeMode="contain" />
      <View style={[styles.overlay, { top, width: centerW }]} pointerEvents="none">
        <PixelText
          style={{
            fontSize,
            color: cfg.numberColor,
            fontFamily: cfg.fontFamily,
            lineHeight: fontSize * 1.05,
            textShadowColor: cfg.shadowColor,
            textShadowOffset: { width: 0, height: cfg.shadowDy },
            textShadowRadius: cfg.shadowRadius,
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
    alignItems: 'center',
  },
});
