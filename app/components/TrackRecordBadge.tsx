// 꿀잼지수 누적 적중률 신뢰 배지. 표본 부족 시 수치 미노출(과장 금지).
import { View, StyleSheet } from 'react-native';
import PixelText from './PixelText';
import { border, colors, spacing } from '../theme';
import type { TrackRecord } from '../types';
import { useTeamTheme } from '../context/TeamTheme';

interface Props {
  track?: TrackRecord | null;
  variant?: 'today' | 'settings';
}

export default function TrackRecordBadge({ track, variant = 'today' }: Props) {
  const { accent } = useTeamTheme();
  if (!track || !track.ready) {
    return (
      <View style={styles.box}>
        <PixelText variant="caption" color={colors.textDim}>적중률 집계 중</PixelText>
      </View>
    );
  }

  return (
    <View style={[styles.box, variant === 'settings' && styles.settingsBox]}>
      <PixelText variant="body" color={accent}>
        최근 {track.sampleSize}경기 예측 적중률 {track.hitRate}%
      </PixelText>
      <PixelText variant="caption" color={colors.textDim}>
        예측 꿀잼지수가 실제 체감과 ±10 안에 든 비율
      </PixelText>
      {variant === 'settings' && (
        <PixelText variant="caption" color={colors.textDim}>
          기대 이상 {track.bonusRate}%
        </PixelText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderColor: 'rgba(45,36,20,0.30)',
    borderRadius: border.radius,
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: 2,
  },
  settingsBox: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
});
