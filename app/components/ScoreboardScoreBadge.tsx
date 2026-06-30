// 야구장 레트로 전광판 스킨 V2 — 3단 구조 (헤더/숫자/LED라인)
import { View, StyleSheet } from 'react-native';
import PixelText from './PixelText';

const OUTER_BG = '#243026';
const BOARD_BG = '#142719';
const HEADER_BG = '#101E14';
const NUMBER_COLOR = '#F4D37A';
const LABEL_COLOR = '#F6D784';
const LED_DIM = 'rgba(246,215,132,0.18)';
const BORDER_COLOR = '#D8C7A4';

interface Props {
  score: number;
  variant?: 'hero' | 'compact' | 'detail';
  teamColor?: string;
  showLabel?: boolean; // 내부 헤더에 포함 — 이 prop은 무시됨
}

type V = 'hero' | 'compact' | 'detail';

const DIMS: Record<V, { w: number; h: number }> = {
  compact: { w: 52, h: 52 },
  hero:    { w: 88, h: 96 },
  detail:  { w: 110, h: 120 },
};

const NUM_FONT: Record<V, number>    = { compact: 22, hero: 38, detail: 48 };
const RADIUS:   Record<V, number>    = { compact: 4,  hero: 6,  detail: 7  };
const FRAME_PAD: Record<V, number>   = { compact: 2,  hero: 3,  detail: 3  };
const HEADER_H:  Record<V, number>   = { compact: 0,  hero: 22, detail: 26 };
const HEADER_FONT: Record<V, number> = { compact: 0,  hero: 9,  detail: 10 };
const LED_DOT:  Record<V, number>    = { compact: 2,  hero: 3,  detail: 4  };
const BOT_DOT:  Record<V, number>    = { compact: 3,  hero: 4,  detail: 5  };
const BOT_CNT:  Record<V, number>    = { compact: 4,  hero: 6,  detail: 7  };
const LIT_CNT:  Record<V, number>    = { compact: 1,  hero: 2,  detail: 2  };

export default function ScoreboardScoreBadge({
  score,
  variant = 'hero',
  teamColor = '#2D7D3A',
}: Props) {
  const { w, h } = DIMS[variant];
  const pad = FRAME_PAD[variant];
  const boardRadius = Math.max(1, RADIUS[variant] - pad);
  const showHeader = variant !== 'compact';
  const numSize = NUM_FONT[variant];
  const ledSz = LED_DOT[variant];
  const botSz = BOT_DOT[variant];
  const botCnt = BOT_CNT[variant];
  const litCnt = LIT_CNT[variant];

  return (
    <View
      style={[
        styles.outer,
        { width: w, height: h, borderRadius: RADIUS[variant], padding: pad },
      ]}
    >
      <View style={[styles.board, { borderRadius: boardRadius }]}>
        {/* 상단 헤더 — 꿀잼지수 (compact는 생략) */}
        {showHeader && (
          <View style={[styles.header, { height: HEADER_H[variant] }]}>
            <View
              style={{
                width: ledSz, height: ledSz, borderRadius: ledSz / 2,
                backgroundColor: LED_DIM,
              }}
            />
            <PixelText
              style={{ fontSize: HEADER_FONT[variant], color: LABEL_COLOR, letterSpacing: 0.5 }}
            >
              꿀잼지수
            </PixelText>
            <View
              style={{
                width: ledSz, height: ledSz, borderRadius: ledSz / 2,
                backgroundColor: LED_DIM,
              }}
            />
          </View>
        )}

        {/* 중앙 숫자 */}
        <View style={styles.numberArea}>
          <PixelText
            style={{
              fontSize: numSize,
              color: NUMBER_COLOR,
              fontFamily: 'Galmuri11Bold',
              lineHeight: numSize * 1.1,
              textShadowColor: 'rgba(0,0,0,0.30)',
              textShadowOffset: { width: 1, height: 1 },
              textShadowRadius: 0,
            }}
          >
            {Math.round(score)}
          </PixelText>
        </View>

        {/* 하단 LED 점등 라인 */}
        <View style={[styles.bottomRow, { paddingBottom: variant === 'compact' ? 5 : 7 }]}>
          {Array.from({ length: botCnt }).map((_, i) => (
            <View
              key={i}
              style={{
                width: botSz, height: botSz, borderRadius: botSz / 2,
                backgroundColor: i < litCnt ? teamColor : LED_DIM,
                marginHorizontal: variant === 'compact' ? 2 : 3,
                opacity: i < litCnt ? 0.9 : 1,
              }}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    backgroundColor: OUTER_BG,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
    elevation: 4,
  },
  board: {
    flex: 1,
    backgroundColor: BOARD_BG,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  header: {
    width: '100%',
    backgroundColor: HEADER_BG,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  numberArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
