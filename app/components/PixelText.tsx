// 모든 텍스트의 기본 단위. Galmuri11 픽셀 폰트 적용. (ADR-009)
import { Text, StyleSheet, type TextProps } from 'react-native';
import { colors, fonts, fontSize } from '../theme';

type Variant = 'hero' | 'title' | 'body' | 'caption' | 'score';

interface Props extends TextProps {
  variant?: Variant;
  color?: string;
}

export default function PixelText({ variant = 'body', color, style, ...rest }: Props) {
  return <Text {...rest} style={[styles.base, styles[variant], color ? { color } : null, style]} />;
}

const styles = StyleSheet.create({
  base: { fontFamily: fonts.pixel, color: colors.text },
  hero: { fontSize: fontSize.hero },
  title: { fontSize: fontSize.title },
  body: { fontSize: fontSize.body },
  caption: { fontSize: fontSize.caption, color: colors.textDim },
  score: { fontSize: fontSize.score },
});
