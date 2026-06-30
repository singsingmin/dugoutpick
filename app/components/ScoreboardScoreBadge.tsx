// 레트로 전광판 스킨 — scoreboard.vintage
import { View, StyleSheet } from 'react-native';
import PixelText from './PixelText';
import GguljamScoreLabel from './GguljamScoreLabel';

interface Props {
  score: number;
  variant?: 'hero' | 'compact' | 'detail';
  teamColor?: string;
  showLabel?: boolean;
}

const BG = '#1B2C1A';
const AMBER = '#E8C97A';
const DIM_DOT = '#3D5C3A';

const SIZES = {
  compact: { w: 48, h: 43, numSize: 20, dotSize: 2, dotGap: 3, barH: 3 },
  hero:    { w: 88, h: 85, numSize: 40, dotSize: 4, dotGap: 5, barH: 5 },
  detail:  { w: 110, h: 106, numSize: 50, dotSize: 5, dotGap: 6, barH: 6 },
};

export default function ScoreboardScoreBadge({
  score,
  variant = 'hero',
  teamColor = '#2D7D3A',
  showLabel = true,
}: Props) {
  const sz = SIZES[variant];
  const showGguljam = showLabel && variant !== 'compact';

  const dots = (
    <View style={styles.dotRow}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            width: sz.dotSize, height: sz.dotSize,
            borderRadius: sz.dotSize / 2,
            backgroundColor: i === 1 ? AMBER : DIM_DOT,
            marginHorizontal: sz.dotGap / 2,
          }}
        />
      ))}
    </View>
  );

  return (
    <View style={styles.wrap}>
      {showGguljam && <GguljamScoreLabel variant={variant === 'detail' ? 'detail' : 'hero'} />}
      <View
        style={[
          styles.board,
          {
            width: sz.w,
            height: sz.h,
            borderRadius: variant === 'compact' ? 5 : 8,
          },
        ]}
      >
        {dots}
        <PixelText
          style={{
            fontSize: sz.numSize,
            color: AMBER,
            fontFamily: 'Galmuri11Bold',
            lineHeight: sz.numSize * 1.15,
            letterSpacing: 1,
          }}
        >
          {Math.round(score)}
        </PixelText>
        <View
          style={{
            width: '75%',
            height: sz.barH,
            backgroundColor: teamColor,
            borderRadius: 2,
            opacity: 0.85,
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 4 },
  board: {
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#2A4228',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  dotRow: { flexDirection: 'row', alignItems: 'center' },
});
