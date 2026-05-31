// 오늘경기 탭: 추천 히어로(최상단) + 나머지 경기(꿀잼 높은 순). (flow.md, ADR-004)
import { useEffect, useState } from 'react';
import { View, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { GamesData, Game } from '../types';
import { loadGames } from '../data/load';
import GameCard from '../components/GameCard';
import PixelText from '../components/PixelText';
import { colors, spacing } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function Today() {
  const navigation = useNavigation<Nav>();
  const [data, setData] = useState<GamesData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    loadGames()
      .then((d) => active && setData(d))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, []);

  const open = (gameId: string) => navigation.navigate('GameDetail', { gameId });

  if (failed) return <Centered text="데이터를 불러오지 못했다" />;
  if (!data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const { games, recommendedGameId } = data;
  if (games.length === 0) return <Centered text="오늘은 경기가 없다" />;

  const recommended: Game | undefined = games.find((g) => g.gameId === recommendedGameId);
  const rest = games
    .filter((g) => g.gameId !== recommended?.gameId)
    .sort((a, b) => (b.honjam?.score ?? -1) - (a.honjam?.score ?? -1));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <PixelText variant="title" color={colors.accent}>오늘의 경기</PixelText>
        <PixelText variant="caption" color={colors.textDim} style={styles.date}>
          {data.dateText}
        </PixelText>

        {recommended && (
          <View style={styles.heroWrap}>
            <GameCard game={recommended} variant="hero" onPress={() => open(recommended.gameId)} />
          </View>
        )}

        {rest.length > 0 && (
          <PixelText variant="body" color={colors.textDim} style={styles.sectionTitle}>
            다른 경기
          </PixelText>
        )}
        {rest.map((g) => (
          <GameCard key={g.gameId} game={g} variant="list" onPress={() => open(g.gameId)} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function Centered({ text }: { text: string }) {
  return (
    <View style={styles.center}>
      <PixelText variant="title" color={colors.textDim}>{text}</PixelText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.xs },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  date: { marginBottom: spacing.md },
  heroWrap: { marginBottom: spacing.lg },
  sectionTitle: { marginBottom: spacing.sm },
});
