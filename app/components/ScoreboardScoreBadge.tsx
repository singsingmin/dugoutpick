// 야구장 레트로 전광판 스킨 V4 — B/S/O 램프 문법 + 상단 깃발 + 가로형 패널.
// 의미 없는 장식 점을 제거하고, 하단을 야구 전광판 B/S/O 램프(장식형, 실데이터 아님)로 재구성.
// 숫자 가독성 최우선. 유니폼 SVG는 무관(별도 kind).
import { Fragment } from 'react';
import { View, StyleSheet } from 'react-native';
import PixelText from './PixelText';

const OUTER_BG = '#243026';      // 외곽 프레임
const BOARD_BG = '#142719';      // 본판(딥그린 LED 패널)
const HEADER_BG = '#101E14';     // 헤더(본판보다 약간 어둡게)
const NUMBER_COLOR = '#F4D37A';  // 숫자(크림/옅은 노랑)
const LABEL_COLOR = '#F6D784';   // 헤더 라벨
const BORDER_COLOR = '#D8C7A4';  // 얇은 외곽선(웜그레이/크림)

// V4 B/S/O 램프 — 레트로 채도 낮춤
const LAMP_B = '#6FA86B';        // B: 레트로 그린
const LAMP_S = '#D99A4E';        // S: 레트로 주황/앰버
const LAMP_O = '#C45B4D';        // O: 레트로 레드
const LAMP_OFF = '#2E3B30';      // 비점등: 어두운 올리브/차콜
const BSO_LETTER = '#C7B789';    // B/S/O 글자(숫자보다 덜 강조)
const DIVIDER = 'rgba(216,199,164,0.16)';
const FLAG_COLOR = '#3E6B46';    // 상단 깃발(본판보다 살짝 밝은 그린)

// 장식형 B/S/O 램프(3/2/2, 부분 점등 — 실제 카운트와 무관).
const BSO: { letter: string; color: string; pattern: boolean[] }[] = [
  { letter: 'B', color: LAMP_B, pattern: [true, true, false] },
  { letter: 'S', color: LAMP_S, pattern: [true, false] },
  { letter: 'O', color: LAMP_O, pattern: [true, false] },
];

export type ScoreboardVariant = 'hero' | 'compact' | 'detail' | 'preview';

interface Props {
  score: number;
  variant?: ScoreboardVariant;
  teamColor?: string;
  showLabel?: boolean; // 내부 헤더에 포함 — 이 prop은 무시됨
}

const DIMS: Record<ScoreboardVariant, { w: number; h: number }> = {
  compact: { w: 52,  h: 52  },
  hero:    { w: 112, h: 96  },
  detail:  { w: 148, h: 120 },
  preview: { w: 162, h: 132 },
};

const NUM_FONT:    Record<ScoreboardVariant, number> = { compact: 22, hero: 40, detail: 50, preview: 54 };
const RADIUS:      Record<ScoreboardVariant, number> = { compact: 4,  hero: 6,  detail: 7,  preview: 8  };
const FRAME_PAD:   Record<ScoreboardVariant, number> = { compact: 2,  hero: 3,  detail: 3,  preview: 3  };
const HEADER_H:    Record<ScoreboardVariant, number> = { compact: 0,  hero: 22, detail: 26, preview: 28 };
const HEADER_FONT: Record<ScoreboardVariant, number> = { compact: 0,  hero: 9,  detail: 10, preview: 11 };
const LAMP_DOT:    Record<ScoreboardVariant, number> = { compact: 3,  hero: 4,  detail: 5,  preview: 5  };
const BSO_FONT:    Record<ScoreboardVariant, number> = { compact: 0,  hero: 8,  detail: 9,  preview: 10 };
const FLAG_SIZE:   Record<ScoreboardVariant, number> = { compact: 0,  hero: 7,  detail: 8,  preview: 9  };

// 작은 펜넌트 깃발 — 삼각형 1개(border 트릭). dir로 좌/우 방향.
function Flag({ size, dir }: { size: number; dir: 'left' | 'right' }) {
  const tri =
    dir === 'left'
      ? { borderLeftWidth: size * 1.5, borderLeftColor: FLAG_COLOR }
      : { borderRightWidth: size * 1.5, borderRightColor: FLAG_COLOR };
  return (
    <View
      style={{
        width: 0,
        height: 0,
        borderTopWidth: size,
        borderTopColor: 'transparent',
        borderBottomWidth: size,
        borderBottomColor: 'transparent',
        ...tri,
      }}
    />
  );
}

function Lamp({ on, color, size }: { on: boolean; color: string; size: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: on ? color : LAMP_OFF,
        opacity: on ? 0.92 : 1,
      }}
    />
  );
}

export default function ScoreboardScoreBadge({
  score,
  variant = 'hero',
  teamColor,
}: Props) {
  const { w, h } = DIMS[variant];
  const pad = FRAME_PAD[variant];
  const boardRadius = Math.max(1, RADIUS[variant] - pad);
  const isCompact = variant === 'compact';
  const showHeader = !isCompact;
  const showFlags = !isCompact;
  const numSize = NUM_FONT[variant];
  const lampSz = LAMP_DOT[variant];
  const flagSz = FLAG_SIZE[variant];
  // teamColor 은은한 헤더 accent(≈12%). hex(#RRGGBB)에만 적용.
  const headerAccent =
    teamColor && /^#[0-9a-fA-F]{6}$/.test(teamColor) ? `${teamColor}1F` : 'transparent';

  return (
    <View
      style={[styles.outer, { width: w, height: h, borderRadius: RADIUS[variant], padding: pad }]}
    >
      {/* 상단 깃발(hero/detail/preview) */}
      {showFlags && (
        <>
          <View style={[styles.flagLeft, { top: -flagSz }]}>
            <Flag size={flagSz} dir="left" />
          </View>
          <View style={[styles.flagRight, { top: -flagSz }]}>
            <Flag size={flagSz} dir="right" />
          </View>
        </>
      )}

      <View style={[styles.board, { borderRadius: boardRadius }]}>
        {/* 상단 헤더 — 꿀잼지수 (compact 생략) */}
        {showHeader && (
          <View
            style={[
              styles.header,
              { height: HEADER_H[variant], borderBottomColor: headerAccent },
            ]}
          >
            <PixelText style={{ fontSize: HEADER_FONT[variant], color: LABEL_COLOR, letterSpacing: 1 }}>
              꿀잼지수
            </PixelText>
          </View>
        )}

        {/* 중앙 숫자 — 가장 먼저 보여야 함 */}
        <View style={styles.numberArea}>
          <PixelText
            style={{
              fontSize: numSize,
              color: NUMBER_COLOR,
              fontFamily: 'Galmuri11Bold',
              lineHeight: numSize * 1.1,
              textShadowColor: 'rgba(0,0,0,0.35)',
              textShadowOffset: { width: 1, height: 1 },
              textShadowRadius: 0,
            }}
          >
            {Math.round(score)}
          </PixelText>
        </View>

        {/* 하단 B/S/O 램프 */}
        {isCompact ? (
          <View style={[styles.compactLamps, { paddingBottom: 5 }]}>
            {BSO.map((g) => (
              <View key={g.letter} style={styles.compactGroup}>
                {g.pattern.map((on, i) => (
                  <Lamp key={i} on={on} color={g.color} size={lampSz} />
                ))}
              </View>
            ))}
          </View>
        ) : (
          <View style={[styles.bsoRow, { paddingBottom: 7 }]}>
            {BSO.map((g, gi) => (
              <Fragment key={g.letter}>
                {gi > 0 && <View style={styles.divider} />}
                <View style={styles.bsoGroup}>
                  <PixelText style={{ fontSize: BSO_FONT[variant], color: BSO_LETTER, marginRight: 2 }}>
                    {g.letter}
                  </PixelText>
                  {g.pattern.map((on, i) => (
                    <Lamp key={i} on={on} color={g.color} size={lampSz} />
                  ))}
                </View>
              </Fragment>
            ))}
          </View>
        )}
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
  flagLeft: { position: 'absolute', left: 6, zIndex: 2 },
  flagRight: { position: 'absolute', right: 6, zIndex: 2 },
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
    borderBottomWidth: 1,
  },
  numberArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bsoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  bsoGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  divider: {
    width: 1,
    height: 10,
    backgroundColor: DIVIDER,
  },
  compactLamps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  compactGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
});
