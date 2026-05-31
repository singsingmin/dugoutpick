// 스플래시/랜딩: 항상 멈춰서 '시작하기'를 눌러야 진입. 화면을 꽉 채우는 구성(상/중/하).
import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import PixelText from '../components/PixelText';
import Panel from '../components/Panel';
import PixelButton from '../components/PixelButton';
import { getCheerTeam } from '../data/team';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

// 스플래시 전용 야구장 장식 색(데코)
const STANDS = '#21402A';   // 관중석 배경(어두운 그린)
const WALL = '#E8DCC0';     // 외야 펜스(탄)
const GRASS1 = '#34663F';   // 잔디 줄무늬 A
const GRASS2 = '#3F7A4C';   // 잔디 줄무늬 B
const DIRT = '#C99A5B';     // 내야 흙
const DIRT_LINE = '#A8763D'; // 흙 테두리

// 관중 도트 팔레트 + 안정적(모듈 레벨) 배열 — 알록달록 관중
const CROWD = ['#F4ECD8', '#5BC8FF', '#FF6B6B', '#FFD23F', '#FFFFFF', '#9B8CFF', '#FF9F45'];
const DOTS = Array.from({ length: 160 }, (_, i) => CROWD[(i * 13 + (i % 7) * 5) % CROWD.length]);

const Spark = ({ style }: { style?: object }) => (
  <PixelText style={[styles.spark, style]} color={colors.accent}>✦</PixelText>
);

export default function Splash({ navigation }: Props) {
  const [team, setTeam] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getCheerTeam().then((c) => active && setTeam(c));
    return () => { active = false; };
  }, []);

  // 항상 버튼으로만 진입: 응원팀 있으면 오늘경기, 없으면 온보딩
  const start = () => navigation.replace(team ? 'Tabs' : 'Onboarding');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        {/* 상단: 로고 */}
        <View style={styles.top}>
          <View style={styles.sparkRow}>
            <Spark /><Spark style={styles.sparkBig} /><Spark />
          </View>
          <View style={styles.logoRow}>
            <PixelText style={styles.logo} color={colors.text}>오늘</PixelText>
            <PixelText style={styles.logo} color={colors.bad}>야구</PixelText>
            <PixelText style={styles.logo} color={colors.text}>각</PixelText>
          </View>
          <PixelText variant="body" color={colors.textDim}>KBO 꿀잼지수 가이드</PixelText>
        </View>

        {/* 중앙: 야구공(하늘) */}
        <View style={styles.mid}>
          <Spark style={styles.sparkL} />
          <Spark style={styles.sparkR} />
          <PixelText style={styles.ball}>⚾</PixelText>
        </View>

        {/* 야구장 단면(관중석/펜스/잔디) + 양옆 조명탑 */}
        <View style={styles.fieldWrap}>
          <View style={styles.field}>
            <View style={styles.stands}>
              {DOTS.map((c, i) => (
                <View key={i} style={[styles.dot, { backgroundColor: c }]} />
              ))}
            </View>
            {/* 그라운드(관중석과 맞닿음): 잔디 + 부채꼴 페어지역 + 외야 펜스 아크 + 내야 */}
            <View style={styles.ground}>
              <View style={styles.grassStripes}>
                {Array.from({ length: 12 }).map((_, i) => (
                  <View key={i} style={[styles.stripe, { backgroundColor: i % 2 === 0 ? GRASS1 : GRASS2 }]} />
                ))}
              </View>
              <View style={styles.fairWedge} />
              <View style={styles.fenceArc} />
              <View style={styles.diamondWrap}>
                <View style={styles.diamondDirt} />
                <View style={styles.infieldGrass} />
                <View style={styles.mound}><View style={styles.rubber} /></View>
                <View style={[styles.base, styles.baseTop]} />
                <View style={[styles.base, styles.baseRight]} />
                <View style={[styles.base, styles.baseLeft]} />
                <View style={[styles.homePlate]} />
              </View>
            </View>
          </View>
          {/* 조명탑 (관중석 위로 솟음) */}
          <View style={[styles.tower, styles.towerL]}><View style={styles.lamp}>{Array.from({ length: 10 }).map((_, i) => (<View key={i} style={styles.lampDot} />))}</View></View>
          <View style={[styles.tower, styles.towerR]}><View style={styles.lamp}>{Array.from({ length: 10 }).map((_, i) => (<View key={i} style={styles.lampDot} />))}</View></View>

          {/* 중앙 전광판 (LED 보드 + 받침 다리) */}
          <View style={styles.boardWrap} pointerEvents="none">
            <View style={styles.board}>
              <PixelText variant="caption" color="#FFB000" style={styles.boardLabel}>오늘 경기</PixelText>
              <View style={styles.ledRow}>
                {Array.from({ length: 11 }).map((_, i) => (
                  <View key={i} style={[styles.led, { backgroundColor: i % 3 === 0 ? '#FF6B6B' : '#FFB000' }]} />
                ))}
              </View>
            </View>
            <View style={styles.legs}>
              <View style={styles.leg} />
              <View style={styles.leg} />
            </View>
          </View>
        </View>

        {/* 하단: 말풍선 + 시작하기 */}
        <View style={styles.bottom}>
          <Panel style={styles.bubble} accentColor={colors.accent}>
            <PixelText variant="title" color={colors.text}>오늘 KBO, 볼 각인가?</PixelText>
          </Panel>
          <PixelButton label="시작하기 ▶" onPress={start} style={styles.cta} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.lg },
  // 상단
  top: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  sparkRow: { flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.xs },
  logoRow: { flexDirection: 'row' },
  logo: { fontSize: 44 },
  // 중앙
  mid: { flex: 1, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch', position: 'relative' },
  ball: { fontSize: 140 },
  spark: { fontSize: 18 },
  // 야구장 래퍼(풀폭·간격) — 조명탑이 위로 솟을 수 있게 overflow 비클립
  fieldWrap: { alignSelf: 'stretch', marginHorizontal: -spacing.lg, marginTop: spacing.xl, marginBottom: spacing.xl, position: 'relative' },
  field: { borderTopWidth: 3, borderBottomWidth: 3, borderColor: colors.border }, // 높이는 내용물(관중석+펜스+그라운드)에 맞춤
  // 조명탑 (stands 상단 기준, 위로 솟음)
  tower: { position: 'absolute', top: -44, width: 5, height: 72, backgroundColor: '#454545', alignItems: 'center' },
  towerL: { left: '15%' },
  towerR: { right: '15%' },
  lamp: { width: 28, height: 16, marginTop: -5, backgroundColor: colors.gold, borderWidth: 2, borderColor: colors.border, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' },
  lampDot: { width: 3, height: 3, margin: 0.5, backgroundColor: '#FFF6C0' },
  // 중앙 전광판 (관중석 위쪽 중앙)
  boardWrap: { position: 'absolute', left: 0, right: 0, top: -46, alignItems: 'center' },
  board: { width: 104, paddingVertical: 4, paddingHorizontal: 6, backgroundColor: '#14140F', borderWidth: 3, borderColor: colors.border, alignItems: 'center' },
  boardLabel: { marginBottom: 3 },
  ledRow: { flexDirection: 'row', gap: 3 },
  led: { width: 5, height: 5, borderRadius: 1 },
  legs: { flexDirection: 'row', gap: 40 },
  leg: { width: 4, height: 14, backgroundColor: '#454545' },
  // 관중석
  stands: { height: 40, backgroundColor: STANDS, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, overflow: 'hidden' },
  dot: { width: 4, height: 4, borderRadius: 2, marginHorizontal: 2, marginVertical: 1 },
  // 그라운드(관중석과 맞닿음): 잔디 + 부채꼴 + 펜스 아크 + 내야
  ground: { height: 150, position: 'relative', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  grassStripes: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row' },
  stripe: { flex: 1, height: '100%' },
  // 부채꼴 페어지역(하단 꼭지=홈, 위로 벌어짐) — CSS 삼각형
  fairWedge: { position: 'absolute', bottom: 0, left: '50%', marginLeft: -150, width: 0, height: 0, borderLeftWidth: 150, borderRightWidth: 150, borderTopWidth: 142, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: GRASS2 },
  // 외야 펜스 아크(부채꼴 위 곡선)
  fenceArc: { position: 'absolute', top: 4, left: '50%', marginLeft: -150, width: 300, height: 130, borderTopWidth: 4, borderColor: WALL, borderTopLeftRadius: 150, borderTopRightRadius: 150, backgroundColor: 'transparent' },
  // 내야 다이아몬드(홈=하단 중앙)
  diamondWrap: { width: 100, height: 100, position: 'absolute', bottom: 2, left: '50%', marginLeft: -50 },
  diamondDirt: { position: 'absolute', top: 15, left: 15, width: 70, height: 70, backgroundColor: DIRT, borderWidth: 2, borderColor: DIRT_LINE, transform: [{ rotate: '45deg' }] },
  infieldGrass: { position: 'absolute', top: 32, left: 32, width: 36, height: 36, backgroundColor: GRASS2, transform: [{ rotate: '45deg' }] },
  mound: { position: 'absolute', top: 44, left: 44, width: 12, height: 12, borderRadius: 6, backgroundColor: DIRT, borderWidth: 1, borderColor: DIRT_LINE, alignItems: 'center', justifyContent: 'center' },
  rubber: { width: 4, height: 2, backgroundColor: '#F4ECD8' },
  base: { position: 'absolute', width: 8, height: 8, backgroundColor: '#F4ECD8', borderWidth: 1, borderColor: colors.border },
  baseTop: { top: -4, left: 46 },
  baseRight: { right: -4, top: 46 },
  baseLeft: { left: -4, top: 46 },
  homePlate: { position: 'absolute', bottom: -5, left: 45, width: 10, height: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border },
  sparkBig: { fontSize: 26 },
  sparkL: { position: 'absolute', left: '12%', top: '18%', fontSize: 22 },
  sparkR: { position: 'absolute', right: '14%', top: '30%', fontSize: 16 },
  // 하단
  bottom: { alignSelf: 'stretch', alignItems: 'center', gap: spacing.lg },
  bubble: { alignItems: 'center', alignSelf: 'stretch' },
  cta: { alignSelf: 'stretch', paddingVertical: spacing.lg },
});
