// 공용 에러 상태 — 로딩 실패를 '빈 상태'와 구분해서 보여주고 재시도 제공(UX 폴리시 2026-07).
// 기존엔 fetch 실패가 catch로 삼켜져 "기록이 없어요" 빈 문구로 위장되던 문제를 해소.
import { View, Pressable, StyleSheet } from 'react-native';
import PixelText from './PixelText';
import { border, colors, spacing } from '../theme';

export default function ErrorRetry({ message = '불러오지 못했어요', onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <View style={styles.wrap}>
      <PixelText variant="body" color={colors.textDim}>{message}</PixelText>
      {onRetry && (
        <Pressable onPress={onRetry} style={styles.btn} hitSlop={8}>
          <PixelText variant="caption" color={colors.onGreen}>다시 시도</PixelText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  btn: { backgroundColor: colors.accent, borderRadius: border.radius, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
});
