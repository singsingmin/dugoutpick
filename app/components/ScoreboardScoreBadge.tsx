// 야구장 레트로 전광판 스킨 V5 — 가로형 패널 + 3단 구조(헤더/숫자/BSO) 전 variant 통일.
// V4 대비: 상단 깃발 제거, compact에도 헤더+BSO 유지, 더 가로형 비율, 숫자 살짝 위+여백 확대,
//          외곽선·그림자 최소화(스티커가 아닌 '전광판 숫자'). 유니폼 SVG는 무관(별도 kind).
import { Fragment } from 'react';
import { View, StyleSheet } from 'react-native';
import PixelText from './PixelText';

const OUTER_BG = '#243026';      // 외곽 프레임
const BOARD_BG = '#142719';      // 본판(딥그린 LED 패널)
const HEADER_BG = '#101E14';     // 헤더(본판보다 더 어둡게)
const NUMBER_COLOR = '#F4D37A';  // 숫자(크림-옐로우 LED)
const LABEL_COLOR = '#F6D784';   // 헤더 라벨
const BORDER_COLOR = '#C9BA98';  // 얇은 외곽선

// B/S/O 램프 — 레트로 채도(낮춤)
const LAMP_B = '#6FA86B';        // B: 그린
const LAMP_S = '#D99A4E';        // S: 앰버/주황
const LAMP_O = '#C45B4D';        // O: 레드
const LAMP_OFF = '#2E3B30';      // 꺼진 점: 다크 올리브
const BSO_LETTER = '#C7B789';    // B/S/O 글자(숫자보다 덜 강조)
const DIVIDER = 'rgba(216,199,164,0.16)';

// 실제 야구식 점 개수 B=3/S=2/O=2, 부분 점등(켜짐/꺼짐 구분 — 실데이터 무관 장식).
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

// 가로형 비율(1.23~1.31:1). 정사각 배지가 아닌 가로 패널 인상.
const DIMS: Record<ScoreboardVariant, { w: number; h: number }> = {
  compact: { w: 64,  h: 52  },
  hero:    { w: 124, h: 96  },
  detail:  { w: 156, h: 120 },
  preview: { w: 168, h: 128 },
};

const NUM_FONT:    Record<ScoreboardVariant, number> = { compact: 20, hero: 40, detail: 50, preview: 54 };
const RADIUS:      Record<ScoreboardVariant, number> = { compact: 4,  hero: 6,  detail: 7,  preview: 8  };
const FRAME_PAD:   Record<ScoreboardVariant, number> = { compact: 2,  hero: 3,  detail: 3,  preview: 3  };
const HEADER_H:    Record<ScoreboardVariant, number> = { compact: 13, hero: 22, detail: 26, preview: 28 };
const HEADER_FONT: Record<ScoreboardVariant, number> = { compact: 7,  hero: 9,  detail: 10, preview: 11 };
const LAMP_DOT:    Record<ScoreboardVariant, number> = { compact: 3,  hero: 4,  detail: 5,  preview: 5  };
const BSO_FONT:    Record<ScoreboardVariant, number> = { compact: 0,  hero: 8,  detail: 9,  preview: 10 };
// 숫자를 중앙보다 살짝 위로 + 숫자~BSO 여백 확보(숫자 영역 하단 패딩).
const NUM_GAP:     Record<ScoreboardVariant, number> = { compact: 3,  hero: 7,  detail: 9,  preview: 9  };

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
  const numSize = NUM_FONT[variant];
  const lampSz = LAMP_DOT[variant];
  // teamColor 은은한 헤더 accent(≈12%). hex(#RRGGBB)에만 적용 — 과사용 금지.
  const headerAccent =
    teamColor && /^#[0-9a-fA-F]{6}$/.test(teamColor) ? `${teamColor}1F` : 'transparent';

  return (
    <View
      style={[styles.outer, { width: w, height: h, borderRadius: RADIUS[variant], padding: pad }]}
    >
      <View style={[styles.board, { borderRadius: boardRadius }]}>
        {/* 상단: 꿀잼지수 헤더 (전 variant 유지) */}
        <View
          style={[styles.header, { height: HEADER_H[variant], borderBottomColor: headerAccent }]}
        >
          <PixelText style={{ fontSize: HEADER_FONT[variant], color: LABEL_COLOR, letterSpacing: isCompact ? 0.5 : 1 }}>
            꿀잼지수
          </PixelText>
        </View>

        {/* 중앙: 큰 숫자 (중앙보다 살짝 위) */}
        <View style={[styles.numberArea, { paddingBottom: NUM_GAP[variant] }]}>
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

        {/* 하단: B/S/O 바 (compact는 글자·구분선 생략, 점만 축약) */}
        {isCompact ? (
          <View style={[styles.bsoRow, { paddingBottom: 5, gap: 5 }]}>
            {BSO.map((g) => (
              <View key={g.letter} style={styles.bsoGroup}>
                {g.pattern.map((on, i) => (
                  <Lamp key={i} on={on} color={g.color} size={lampSz} />
                ))}
              </View>
            ))}
          </View>
        ) : (
          <View style={[styles.bsoRow, { paddingBottom: 7, gap: 6 }]}>
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
    // 그림자 최소화 — 스티커가 아닌 전광판 패널 인상
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
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
});
