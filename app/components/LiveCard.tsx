// '지금 볼 각' 라이브 카드: 🔴 LIVE + 라이브 스코어 + 출루 다이아몬드 + 현재 투수/타자.
import { Pressable, View, StyleSheet } from 'react-native';
import type { Game, LiveState } from '../types';
import PixelText from './PixelText';
import Panel from './Panel';
import TeamName from './TeamName';
import { colors, spacing } from '../theme';

const LIVE_RED = '#E03131';
const BASE_ON = LIVE_RED;
const BASE_OFF = colors.track;

function BaseDiamond({ lv }: { lv: LiveState }) {
  return (
    <View style={s.diamond}>
      <View style={s.diamondRow}>
        <Base on={lv.b2} />
      </View>
      <View style={s.diamondMid}>
        <Base on={lv.b3} />
        <Base on={lv.b1} />
      </View>
    </View>
  );
}

function Base({ on }: { on: boolean }) {
  return <View style={[s.base, on && { backgroundColor: BASE_ON }]} />;
}

export default function LiveCard({ game, onPress }: { game: Game; onPress: () => void }) {
  const lv = game.live;
  return (
    <Pressable onPress={onPress}>
      <Panel accentColor={LIVE_RED} style={s.card}>
        <View style={s.top}>
          <PixelText variant="caption" color={LIVE_RED}>● LIVE</PixelText>
          {lv && <PixelText variant="caption" color={colors.textDim}>{lv.label}</PixelText>}
          {lv && (
            <View style={s.heat}>
              <PixelText variant="caption" color={colors.onGold}>지금 {lv.heat}</PixelText>
            </View>
          )}
        </View>

        <View style={s.main}>
          <View style={s.teamCol}>
            <TeamName code={game.away.code} variant="title" />
            <PixelText variant="title" color={colors.text}>{game.away.score ?? 0}</PixelText>
          </View>

          {lv ? (
            <BaseDiamond lv={lv} />
          ) : (
            <PixelText variant="title" color={colors.textDim}>VS</PixelText>
          )}

          <View style={s.teamCol}>
            <TeamName code={game.home.code} variant="title" />
            <PixelText variant="title" color={colors.text}>{game.home.score ?? 0}</PixelText>
          </View>
        </View>

        {lv && (lv.pitcher || lv.batter) && (
          <PixelText variant="caption" color={colors.textDim} style={s.players}>
            {[lv.pitcher && `투수 ${lv.pitcher}`, lv.batter && `타자 ${lv.batter}`].filter(Boolean).join(' · ')}
          </PixelText>
        )}
      </Panel>
    </Pressable>
  );
}

const BASE_SIZE = 14;

const s = StyleSheet.create({
  card: { gap: spacing.sm, marginBottom: spacing.sm },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  heat: { marginLeft: 'auto', backgroundColor: colors.gold, paddingHorizontal: spacing.sm, paddingVertical: 1, borderRadius: 4 },
  main: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  teamCol: { flex: 1, alignItems: 'center', gap: 2 },
  diamond: { alignItems: 'center', gap: 2 },
  diamondRow: { alignItems: 'center' },
  diamondMid: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  base: { width: BASE_SIZE, height: BASE_SIZE, backgroundColor: BASE_OFF, transform: [{ rotate: '45deg' }] },
  players: { textAlign: 'center' },
});
