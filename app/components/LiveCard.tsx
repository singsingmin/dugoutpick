// '지금 볼 각' 라이브 카드: 🔴 LIVE + 라이브 스코어 + 출루 다이아몬드 + 아웃 카운트 + 현재 투수/타자.
import { Pressable, View, StyleSheet } from 'react-native';
import type { Game, LiveState } from '../types';
import PixelText from './PixelText';
import Panel from './Panel';
import TeamName from './TeamName';
import { useLiveHeatDisplay } from '../utils/liveHeat';
import { formatInning } from '../utils/inning';
import { colors, spacing } from '../theme';

const LIVE_RED = '#E03131';
const BASE_ON = LIVE_RED;
const BASE_OFF = '#C8C8C8';
const BASE_SIZE = 14;
const OUT_SIZE = 10;

// 절대 좌표로 배치: center 간 거리 = 14px → 45° 회전 사각형이 면을 완전히 공유.
// 2루(21,7) · 3루(11,17) · 1루(31,17). container 42×28.
function BaseDiamond({ lv }: { lv: LiveState }) {
  return (
    <View style={s.diamondContainer}>
      <View style={[s.base, s.pos2, lv.b2 && s.baseOn]} />
      <View style={[s.base, s.pos3, lv.b3 && s.baseOn]} />
      <View style={[s.base, s.pos1, lv.b1 && s.baseOn]} />
    </View>
  );
}

function OutDot({ filled }: { filled: boolean }) {
  return <View style={[s.outDot, filled && s.outFilled]} />;
}

function DiamondAndOuts({ lv }: { lv: LiveState }) {
  const outs = lv.out ?? 0;
  const inning = formatInning(lv.inning, lv.half);
  return (
    <View style={s.diamondWrap}>
      {inning && <PixelText variant="caption" color={colors.text} style={s.inning}>{inning}</PixelText>}
      <BaseDiamond lv={lv} />
      <View style={s.outs}>
        <OutDot filled={outs >= 1} />
        <OutDot filled={outs >= 2} />
      </View>
    </View>
  );
}

export default function LiveCard({ game, onPress }: { game: Game; onPress: () => void }) {
  const lv = game.live;
  // raw(Worker) → display(momentum + smooth) 보정값. ADR-021.
  const { heat, label } = useLiveHeatDisplay(game);
  // live=null이지만 label이 있으면 끝내기 역전 post-game highlight(결정 2).
  const isHighlight = !lv && !!label;
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Panel accentColor={LIVE_RED} style={s.card}>
        <View style={s.top}>
          <PixelText variant="caption" color={LIVE_RED}>{lv ? '● LIVE' : '● 끝내기'}</PixelText>
          {(lv || isHighlight) && <PixelText variant="caption" color={colors.textDim}>{label}</PixelText>}
          {(lv || isHighlight) && (
            <View style={s.heat}>
              <PixelText variant="caption" color={colors.onGold}>{lv ? '지금 ' : ''}{heat}</PixelText>
            </View>
          )}
        </View>

        <View style={s.main}>
          <View style={s.teamCol}>
            <TeamName code={game.away.code} variant="title" />
            <PixelText variant="title" color={colors.text}>{game.away.score ?? 0}</PixelText>
          </View>

          {lv ? (
            <DiamondAndOuts lv={lv} />
          ) : (
            <PixelText variant="title" color={colors.textDim}>{isHighlight ? '끝' : 'VS'}</PixelText>
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

const s = StyleSheet.create({
  card: { gap: spacing.sm, marginBottom: spacing.sm },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  heat: { marginLeft: 'auto', backgroundColor: colors.gold, paddingHorizontal: spacing.sm, paddingVertical: 1, borderRadius: 4, borderWidth: 1, borderColor: colors.border },
  main: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  teamCol: { flex: 1, alignItems: 'center', gap: 2 },
  diamondWrap: { alignItems: 'center', gap: 6 },
  inning: { fontWeight: '700' },
  diamondContainer: { width: 42, height: 30 },
  base: { width: BASE_SIZE, height: BASE_SIZE, backgroundColor: BASE_OFF, borderRadius: 3, transform: [{ rotate: '45deg' }], position: 'absolute' },
  baseOn: { backgroundColor: BASE_ON },
  pos2: { left: 14, top: 0 },
  pos3: { left: 3, top: 13 },
  pos1: { left: 25, top: 13 },
  outs: { flexDirection: 'row', gap: 5 },
  outDot: { width: OUT_SIZE, height: OUT_SIZE, borderRadius: OUT_SIZE / 2, backgroundColor: BASE_OFF },
  outFilled: { backgroundColor: LIVE_RED },
  players: { textAlign: 'center' },
});
