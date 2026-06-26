// 경기 카드 (리스트/히어로 공용). 꿀잼지수·이유는 game.honjam 그대로 표시(ADR-004/005).
// 목업 스타일: 팀명=팀색 텍스트, 추천=골드 배지, 리스트=그린 점수 박스.
import { Pressable, View, StyleSheet } from 'react-native';
import type { Game } from '../types';
import PixelText from './PixelText';
import Panel from './Panel';
import TeamName from './TeamName';
import HonjamBadge from './HonjamBadge';
import StatusChip from './StatusChip';
import StarterLine from './StarterLine';
import { colors, spacing } from '../theme';

interface Props {
  game: Game;
  variant: 'hero' | 'list';
  onPress: () => void;
  showRecap?: boolean; // 경기 후 결산 줄 노출(오늘경기 탭 전용). 기본 true
}

export default function GameCard({ game, variant, onPress, showRecap = true }: Props) {
  const hero = variant === 'hero';
  const final = game.status === 'FINAL';
  const live = game.status === 'LIVE';
  const canceled = game.status === 'CANCELED';
  const tv = hero ? 'hero' : 'body';

  const middle = canceled ? (
    <PixelText variant="body" color={colors.bad}>취소</PixelText>
  ) : final || live ? (
    <PixelText variant={hero ? 'hero' : 'body'} color={live ? colors.bad : colors.text}>
      {game.away.score ?? '-'} : {game.home.score ?? '-'}
    </PixelText>
  ) : (
    <PixelText variant={hero ? 'title' : 'body'} color={colors.textDim} style={styles.vs}>vs</PixelText>
  );

  const matchup = (
    <View style={styles.matchup}>
      <View style={styles.teamWrap}><TeamName code={game.away.code} variant={tv} /></View>
      {middle}
      <View style={styles.teamWrap}><TeamName code={game.home.code} variant={tv} /></View>
    </View>
  );

  // 경기 후 꿀잼결산: 예측 → 실제 + 판정 칩(기대 이상 ▲ / 예측 적중 / 기대 이하 ▼)
  const recap = game.recap;
  const pred = game.honjam?.score ?? null;
  const tier =
    !recap || pred == null ? null
    : recap.actual >= pred + 10 ? 'up'
    : recap.actual <= pred - 10 ? 'down'
    : 'even';
  const tierColor = tier === 'up' ? colors.good : tier === 'down' ? colors.bad : colors.info;
  const tierText = tier === 'up' ? '기대 이상 ▲' : tier === 'down' ? '기대 이하 ▼' : '예측 적중';
  const recapLine = recap && showRecap ? (
    <View style={styles.recapRow}>
      <PixelText variant="caption" color={colors.textDim}>예측 {pred ?? '-'} → </PixelText>
      <PixelText variant="caption" color={tierColor}>실제 {recap.actual}</PixelText>
      {tier && (
        <View style={[styles.recapChip, { borderColor: tierColor }]}>
          <PixelText variant="caption" color={tierColor}>{tierText}</PixelText>
        </View>
      )}
    </View>
  ) : null;

  if (hero) {
    return (
      <Pressable onPress={onPress}>
        <Panel accentColor={colors.bad} style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroLeft}>
              <StatusChip game={game} />
              {matchup}
              <StarterLine game={game} style={styles.starterHero} />
              <PixelText variant="caption" color={colors.textDim} style={styles.meta}>
                {game.time} · {game.stadium}
              </PixelText>
            </View>
            {game.honjam && <HonjamBadge score={game.honjam.score} size="lg" />}
          </View>
          {game.honjam && (
            <PixelText variant="body" color={colors.text} style={styles.reasonHero}>
              {game.honjam.reason}
            </PixelText>
          )}
          {recapLine}
        </Panel>
      </Pressable>
    );
  }

  // list variant — 한 줄: 팀명 vs 팀명 | 시간 | 점수박스
  return (
    <Pressable onPress={onPress}>
      <Panel style={styles.list}>
        <View style={styles.listMatch}>
          {matchup}
          <StarterLine game={game} style={styles.starterList} />
          {recapLine}
        </View>
        <View style={styles.listMeta}>
          <StatusChip game={game} />
          <PixelText variant="caption" color={colors.textDim}>{game.time}</PixelText>
        </View>
        {game.honjam && <HonjamBadge score={game.honjam.score} size="sm" />}
      </Panel>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing.sm },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  heroLeft: { flex: 1, gap: spacing.xs },
  meta: { marginTop: spacing.xs },
  starterHero: { marginTop: spacing.xs },
  starterList: { marginTop: 3 },
  reasonHero: { marginTop: spacing.xs },
  list: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.sm },
  listMatch: { flex: 1 },
  listMeta: { alignItems: 'flex-end', gap: 2 },
  matchup: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  teamWrap: { flex: 1, alignItems: 'center' },
  vs: { marginHorizontal: spacing.xs },
  recapRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3, flexWrap: 'wrap' },
  recapChip: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
});
