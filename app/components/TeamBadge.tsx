// 팀 배지. code로 teams.json에서 이름·색상 조회(단일 출처).
import { View, StyleSheet } from 'react-native';
import PixelText from './PixelText';
import { loadTeams } from '../data/load';
import { border, colors, spacing } from '../theme';

const TEAMS = loadTeams().teams;

interface Props {
  code: string;
  size?: 'sm' | 'md';
}

export default function TeamBadge({ code, size = 'md' }: Props) {
  const team = TEAMS.find((t) => t.code === code);
  const color = team?.color ?? colors.border;
  const name = team?.name ?? code;
  const sm = size === 'sm';
  return (
    <View
      style={[
        styles.badge,
        { borderColor: colors.border, backgroundColor: color },
        sm ? styles.sm : styles.md,
      ]}
    >
      <PixelText variant={sm ? 'caption' : 'body'} color="#ffffff">
        {name}
      </PixelText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,     // 다크 테두리(얇게 통일)
    borderRadius: border.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sm: { paddingVertical: 2, paddingHorizontal: spacing.sm, minWidth: 44 },
  md: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, minWidth: 64 },
});
