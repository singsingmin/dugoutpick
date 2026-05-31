// 경기 상세: 꿀잼지수(대형) / 한 줄 예측 / 관전포인트 / 선발 매치업. (flow.md, ADR-004/005)
import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { Game, TeamSide } from '../types';
import { loadGames } from '../data/load';
import PixelText from '../components/PixelText';
import Panel from '../components/Panel';
import TeamBadge from '../components/TeamBadge';
import HonjamBadge from '../components/HonjamBadge';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'GameDetail'>;

export default function GameDetail({ route }: Props) {
  const { gameId } = route.params;
  const [game, setGame] = useState<Game | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    loadGames()
      .then((d) => {
        if (!active) return;
        setGame(d.games.find((g) => g.gameId === gameId) ?? null);
      })
      .finally(() => active && setLoaded(true));
    return () => {
      active = false;
    };
  }, [gameId]);

  if (!loaded) return <View style={styles.container} />;
  if (!game) {
    return (
      <View style={styles.center}>
        <PixelText variant="title" color={colors.textDim}>경기를 찾을 수 없다</PixelText>
      </View>
    );
  }

  const final = game.status === 'FINAL';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 매치업 헤더 */}
      <View style={styles.matchup}>
        <TeamSideView side={game.away} />
        <PixelText variant="title" color={colors.textDim}>
          {final ? `${game.away.score ?? '-'} : ${game.home.score ?? '-'}` : 'vs'}
        </PixelText>
        <TeamSideView side={game.home} />
      </View>
      <PixelText variant="caption" color={colors.textDim} style={styles.meta}>
        {game.time} · {game.stadium}
        {game.status === 'CANCELED' ? ' · 취소' : ''}
      </PixelText>

      {/* 꿀잼지수 */}
      {game.honjam && (
        <>
          <View style={styles.honjamWrap}>
            <HonjamBadge score={game.honjam.score} size="lg" />
          </View>

          <PixelText variant="body" color={colors.accent} style={styles.label}>한 줄 예측</PixelText>
          <Panel>
            <PixelText variant="body">{game.honjam.reason}</PixelText>
          </Panel>

          {game.honjam.points.length > 0 && (
            <>
              <PixelText variant="body" color={colors.accent} style={styles.label}>관전 포인트</PixelText>
              <Panel>
                {game.honjam.points.map((p, i) => (
                  <PixelText key={i} variant="body" style={styles.point}>▸ {p}</PixelText>
                ))}
              </Panel>
            </>
          )}
        </>
      )}

      {/* 선발 매치업 */}
      <PixelText variant="body" color={colors.accent} style={styles.label}>선발 매치업</PixelText>
      <Panel>
        <StarterRow side={game.away} />
        <View style={styles.divider} />
        <StarterRow side={game.home} />
      </Panel>
    </ScrollView>
  );
}

function TeamSideView({ side }: { side: TeamSide }) {
  return (
    <View style={styles.side}>
      <TeamBadge code={side.code} size="md" />
      {side.rank != null && (
        <PixelText variant="caption" color={colors.textDim}>{side.rank}위</PixelText>
      )}
    </View>
  );
}

function StarterRow({ side }: { side: TeamSide }) {
  const s = side.starter;
  return (
    <View style={styles.starterRow}>
      <TeamBadge code={side.code} size="sm" />
      <PixelText variant="body">
        {s ? `${s.name}` : '선발 미정'}
      </PixelText>
      <PixelText variant="caption" color={colors.textDim}>
        {s && s.era != null ? `ERA ${s.era.toFixed(2)}` : 'ERA -'}
      </PixelText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.sm },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  matchup: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginTop: spacing.sm },
  side: { alignItems: 'center', gap: spacing.xs },
  meta: { textAlign: 'center', marginBottom: spacing.sm },
  honjamWrap: { alignItems: 'center', marginVertical: spacing.md },
  label: { marginTop: spacing.sm },
  point: { marginVertical: 2 },
  starterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, justifyContent: 'space-between' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
});
