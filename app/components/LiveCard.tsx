// '지금 볼 각' 라이브 카드: 🔴 LIVE + 라이브 스코어 + 상황 라벨 + 흥미도(heat).
import { Pressable, View, StyleSheet } from 'react-native';
import type { Game } from '../types';
import PixelText from './PixelText';
import Panel from './Panel';
import TeamName from './TeamName';
import { colors, spacing } from '../theme';

const LIVE_RED = '#E03131';

export default function LiveCard({ game, onPress }: { game: Game; onPress: () => void }) {
  const lv = game.live;
  return (
    <Pressable onPress={onPress}>
      <Panel accentColor={LIVE_RED} style={styles.card}>
        <View style={styles.top}>
          <PixelText variant="caption" color={LIVE_RED}>🔴 LIVE</PixelText>
          {lv && <PixelText variant="caption" color={colors.textDim}>{lv.label}</PixelText>}
          {lv && (
            <View style={styles.heat}>
              <PixelText variant="caption" color={colors.onGold}>지금 {lv.heat}</PixelText>
            </View>
          )}
        </View>
        <View style={styles.row}>
          <TeamName code={game.away.code} variant="title" />
          <PixelText variant="title" color={colors.text}>
            {game.away.score ?? 0} : {game.home.score ?? 0}
          </PixelText>
          <TeamName code={game.home.code} variant="title" />
        </View>
      </Panel>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, marginBottom: spacing.sm },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  heat: { marginLeft: 'auto', backgroundColor: colors.gold, paddingHorizontal: spacing.sm, paddingVertical: 1, borderRadius: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
});
