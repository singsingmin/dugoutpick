// 오늘경기 탭: 그린 헤더 + 추천 히어로 + 나머지 경기(꿀잼 높은 순). (flow.md, ADR-004)
import { useEffect, useState } from 'react';
import { View, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { GamesData, Game } from '../types';
import { loadGames } from '../data/load';
import GameCard from '../components/GameCard';
import LiveCard from '../components/LiveCard';
import ScreenHeader from '../components/ScreenHeader';
import SectionLabel from '../components/SectionLabel';
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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="오늘 경기" leftIcon="⚾" rightIcon="📅" />
      {failed ? (
        <Centered text="데이터를 불러오지 못했다" />
      ) : !data ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
      ) : data.games.length === 0 ? (
        <Centered text="오늘은 경기가 없다" />
      ) : (
        <Body data={data} open={open} />
      )}
    </SafeAreaView>
  );
}

function Body({ data, open }: { data: GamesData; open: (id: string) => void }) {
  const liveGames = data.games
    .filter((g) => g.status === 'LIVE')
    .sort((a, b) => (b.live?.heat ?? 0) - (a.live?.heat ?? 0));
  const recommended: Game | undefined = data.games.find((g) => g.gameId === data.recommendedGameId);
  const rest = data.games
    .filter((g) => g.gameId !== recommended?.gameId)
    .sort((a, b) => (b.honjam?.score ?? -1) - (a.honjam?.score ?? -1));

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <PixelText variant="caption" color={colors.textDim} style={styles.date}>{data.dateText}</PixelText>

      {liveGames.length > 0 && (
        <View style={styles.section}>
          <SectionLabel icon="🔴" label="지금 볼 각" />
          {liveGames.map((g) => (
            <LiveCard key={g.gameId} game={g} onPress={() => open(g.gameId)} />
          ))}
        </View>
      )}

      {recommended && (
        <View style={styles.section}>
          <SectionLabel icon="★" label="오늘의 추천 경기" />
          <GameCard game={recommended} variant="hero" onPress={() => open(recommended.gameId)} />
        </View>
      )}

      {rest.length > 0 && (
        <View style={styles.section}>
          <SectionLabel label="다른 경기" />
          {rest.map((g) => (
            <GameCard key={g.gameId} game={g} variant="list" onPress={() => open(g.gameId)} />
          ))}
        </View>
      )}
    </ScrollView>
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
  content: { padding: spacing.md },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  date: { marginBottom: spacing.md },
  section: { marginBottom: spacing.lg },
});
