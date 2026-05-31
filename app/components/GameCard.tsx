// 경기 카드 (리스트/히어로 공용). 꿀잼지수·이유는 game.honjam 그대로 표시(ADR-004/005).
import { Pressable, View, StyleSheet } from 'react-native';
import type { Game } from '../types';
import PixelText from './PixelText';
import Panel from './Panel';
import TeamBadge from './TeamBadge';
import HonjamBadge from './HonjamBadge';
import { colors, honjamColor, spacing } from '../theme';

interface Props {
  game: Game;
  variant: 'hero' | 'list';
  onPress: () => void;
}

export default function GameCard({ game, variant, onPress }: Props) {
  const hero = variant === 'hero';
  const accent = game.honjam ? honjamColor(game.honjam.score) : colors.border;
  const final = game.status === 'FINAL';
  const canceled = game.status === 'CANCELED';

  // 양팀 표시: 점수(FINAL) 또는 'vs'
  const middle = canceled ? '취소' : final ? `${game.away.score ?? '-'} : ${game.home.score ?? '-'}` : 'vs';

  const matchup = (
    <View style={styles.matchup}>
      <TeamBadge code={game.away.code} size={hero ? 'md' : 'sm'} />
      <PixelText variant={hero ? 'title' : 'body'} color={canceled ? colors.bad : colors.textDim} style={styles.mid}>
        {middle}
      </PixelText>
      <TeamBadge code={game.home.code} size={hero ? 'md' : 'sm'} />
    </View>
  );

  const meta = (
    <PixelText variant="caption" color={colors.textDim}>
      {game.time} · {game.stadium}
    </PixelText>
  );

  if (hero) {
    return (
      <Pressable onPress={onPress}>
        <Panel accentColor={accent} style={styles.hero}>
          <PixelText variant="caption" color={accent}>★ 오늘의 추천</PixelText>
          {game.honjam && (
            <View style={styles.heroBadge}>
              <HonjamBadge score={game.honjam.score} size="lg" />
            </View>
          )}
          {matchup}
          {meta}
          {game.honjam && (
            <PixelText variant="body" color={colors.text} style={styles.reasonHero}>
              {game.honjam.reason}
            </PixelText>
          )}
        </Panel>
      </Pressable>
    );
  }

  // list variant
  return (
    <Pressable onPress={onPress}>
      <Panel accentColor={accent} style={styles.list}>
        <View style={styles.listLeft}>
          {matchup}
          {meta}
          {game.honjam && (
            <PixelText variant="caption" color={colors.textDim} numberOfLines={1} style={styles.reasonList}>
              {game.honjam.reason}
            </PixelText>
          )}
        </View>
        {game.honjam && <HonjamBadge score={game.honjam.score} size="sm" />}
      </Panel>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing.sm, alignItems: 'center' },
  heroBadge: { marginVertical: spacing.xs },
  reasonHero: { textAlign: 'center', marginTop: spacing.xs },
  list: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, marginBottom: spacing.sm },
  listLeft: { flex: 1, gap: spacing.xs },
  matchup: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  mid: { marginHorizontal: spacing.xs },
  reasonList: { marginTop: 2 },
});
