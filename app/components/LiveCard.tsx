// '지금 볼 각' 라이브 카드: 🔴 LIVE + 라이브 스코어 + 출루 다이아몬드 + 아웃 카운트 + 현재 투수/타자.
import { Pressable, View, StyleSheet } from 'react-native';
import type { Game, LiveState } from '../types';
import PixelText from './PixelText';
import Panel from './Panel';
import TeamName from './TeamName';
import { colors, spacing } from '../theme';

const LIVE_RED = '#E03131';
const BASE_ON = LIVE_RED;
const BASE_OFF = colors.track;
const BASE_SIZE = 14;
const OUT_SIZE = 7;

function Base({ on }: { on: boolean }) {
  return <View style={[s.base, on && { backgroundColor: BASE_ON }]} />;
}

function OutDot({ filled }: { filled: boolean }) {
  return <View style={[s.outDot, filled && s.outFilled]} />;
}

function DiamondAndOuts({ lv }: { lv: LiveState }) {
  const outs = lv.out ?? 0;
  return (
    <View style={s.diamondWrap}>
      {/* 1~3루 다이아몬드: spacer로 원래 홈베이스 자리 보존해 삼각형 모양 유지 */}
      <View style={s.diamond}>
        <View style={s.diamondTop}>
          <Base on={lv.b2} />
        </View>
        <View style={s.diamondMid}>
          <Base on={lv.b3} />
          <View style={s.baseSpacer} />
          <Base on={lv.b1} />
        </View>
      </View>
      {/* 아웃 카운트 */}
      <View style={s.outs}>
        <OutDot filled={outs >= 1} />
        <OutDot filled={outs >= 2} />
      </View>
    </View>
  );
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
            <DiamondAndOuts lv={lv} />
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

const s = StyleSheet.create({
  card: { gap: spacing.sm, marginBottom: spacing.sm },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  heat: { marginLeft: 'auto', backgroundColor: colors.gold, paddingHorizontal: spacing.sm, paddingVertical: 1, borderRadius: 4 },
  main: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  teamCol: { flex: 1, alignItems: 'center', gap: 2 },
  diamondWrap: { alignItems: 'center', gap: 6 },
  diamond: { alignItems: 'center', gap: 2 },
  diamondTop: { alignItems: 'center' },
  // spacer가 원래 홈베이스 자리를 차지해 3루·1루 꼭짓점이 떨어지고 2루와 삼각형 정렬됨
  diamondMid: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  baseSpacer: { width: BASE_SIZE },
  base: { width: BASE_SIZE, height: BASE_SIZE, backgroundColor: BASE_OFF, transform: [{ rotate: '45deg' }] },
  outs: { flexDirection: 'row', gap: 5 },
  outDot: { width: OUT_SIZE, height: OUT_SIZE, borderRadius: OUT_SIZE / 2, borderWidth: 1.5, borderColor: colors.textDim },
  outFilled: { backgroundColor: LIVE_RED, borderColor: LIVE_RED },
  players: { textAlign: 'center' },
});
