// 야구장 레트로 전광판 스킨 V6 — 첨부 레퍼런스 기준 "설치형 전광판 오브젝트" 재설계.
// V5 대비: 상단 중앙 헤더 캡(View 기반, 살짝 올라온 실루엣) + 레이어드 프레임(아이보리/딥그린)
//          + 은은한 LED 도트 매트릭스 + 더 가로형 비율. 깃발·삼각형 없음.
// 숫자 가독성 최우선. 유니폼 SVG는 무관(별도 kind).
import { Fragment } from 'react';
import { View, StyleSheet } from 'react-native';
import PixelText from './PixelText';

// ── 색상 토큰(스펙)
const IVORY = '#D8C7A4';        // outerFrame
const FRAME_DARK = '#1A2B1D';   // innerFrame / 구획선
const BOARD_BG = '#0E2518';     // 전광판 본체
const HEADER_BG = '#0A1E12';    // 헤더 캡(본체보다 어둡게)
const NUMBER_COLOR = '#EFD479'; // 숫자(크림-옐로우 LED)
const LABEL_COLOR = '#E7C766';  // 헤더 라벨(숫자보다 덜 강조)
const DOT_COLOR = '#2A553A';    // 도트 매트릭스(은은)

// B/S/O 램프
const LAMP_B = '#6FA36A';
const LAMP_S = '#C88A3D';
const LAMP_O = '#B85A4E';
const LAMP_OFF = '#2D3A2F';
const BSO_LETTER = '#C7B789';
const DIVIDER = 'rgba(216,199,164,0.16)';
const BAR_LINE = 'rgba(0,0,0,0.28)';

// 야구식 B=3/S=2/O=2, 부분 점등(켜짐/꺼짐 구분 — 실데이터 무관 장식).
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

interface VConf {
  w: number;            // 본체(=배지) 가로폭
  cap: boolean;         // 헤더 캡 사용(hero/detail/preview) vs 플랫 헤더(compact)
  capW: number; capH: number; overlap: number; // 캡 폭/높이/본체와 겹침
  bodyH: number;        // 본체(프레임) 세로
  headerH: number;      // 플랫 헤더 높이(compact)
  num: number;          // 숫자 폰트
  pad: number;          // 프레임 패딩(아이보리 외곽 두께)
  radius: number;
  lamp: number;         // 램프 크기
  bsoFont: number;      // B/S/O 글자(0=숨김)
  dots: [number, number] | null; // 도트 매트릭스 [cols, rows] / null
  numGap: number;       // 숫자~BSO 여백(숫자영역 하단 패딩 → 숫자 살짝 위)
}

// 비율: preview/detail ~1.43~1.45, hero ~1.33, compact ~1.27 (가로형, 카드 침범 안 함).
const CONF: Record<ScoreboardVariant, VConf> = {
  compact: { w: 66,  cap: false, capW: 0,   capH: 0,  overlap: 0, bodyH: 52,  headerH: 13, num: 20, pad: 2, radius: 4, lamp: 3, bsoFont: 0,  dots: null,    numGap: 3 },
  hero:    { w: 128, cap: true,  capW: 84,  capH: 20, overlap: 6, bodyH: 82,  headerH: 0,  num: 40, pad: 3, radius: 6, lamp: 4, bsoFont: 8,  dots: [7, 4],  numGap: 6 },
  detail:  { w: 168, cap: true,  capW: 108, capH: 24, overlap: 7, bodyH: 100, headerH: 0,  num: 50, pad: 3, radius: 7, lamp: 5, bsoFont: 9,  dots: [8, 5],  numGap: 8 },
  preview: { w: 180, cap: true,  capW: 116, capH: 26, overlap: 8, bodyH: 108, headerH: 0,  num: 54, pad: 3, radius: 8, lamp: 5, bsoFont: 10, dots: [9, 5],  numGap: 8 },
};

// 은은한 LED 도트 매트릭스(절대배치, 숫자 뒤). 터치 비간섭.
function DotMatrix({ cols, rows }: { cols: number; rows: number }) {
  const dots = Array.from({ length: cols * rows });
  return (
    <View style={styles.dotLayer} pointerEvents="none">
      {dots.map((_, i) => (
        <View
          key={i}
          style={[styles.dot, { flexBasis: `${100 / cols}%`, height: `${100 / rows}%` }]}
        >
          <View style={styles.dotPip} />
        </View>
      ))}
    </View>
  );
}

function Lamp({ on, color, size }: { on: boolean; color: string; size: number }) {
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: on ? color : LAMP_OFF,
        opacity: on ? 0.92 : 1,
      }}
    />
  );
}

function BsoBar({ c }: { c: VConf }) {
  if (c.bsoFont === 0) {
    // compact: 글자·구분선 생략, 점만 축약
    return (
      <View style={[styles.bsoBar, { gap: 5, borderTopWidth: 0, paddingBottom: 5 }]}>
        {BSO.map((g) => (
          <View key={g.letter} style={styles.bsoGroup}>
            {g.pattern.map((on, i) => <Lamp key={i} on={on} color={g.color} size={c.lamp} />)}
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={[styles.bsoBar, { gap: 6, paddingBottom: 6 }]}>
      {BSO.map((g, gi) => (
        <Fragment key={g.letter}>
          {gi > 0 && <View style={styles.divider} />}
          <View style={styles.bsoGroup}>
            <PixelText style={{ fontSize: c.bsoFont, color: BSO_LETTER, marginRight: 2 }}>{g.letter}</PixelText>
            {g.pattern.map((on, i) => <Lamp key={i} on={on} color={g.color} size={c.lamp} />)}
          </View>
        </Fragment>
      ))}
    </View>
  );
}

export default function ScoreboardScoreBadge({ score, variant = 'hero', teamColor }: Props) {
  const c = CONF[variant];
  const capProtrude = c.cap ? c.capH - c.overlap : 0;
  const totalH = c.bodyH + capProtrude;
  const headerAccent =
    teamColor && /^#[0-9a-fA-F]{6}$/.test(teamColor) ? `${teamColor}1F` : 'transparent';

  const numberEl = (
    <PixelText
      style={{
        fontSize: c.num, color: NUMBER_COLOR, fontFamily: 'Galmuri11Bold',
        lineHeight: c.num * 1.1,
        textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 0,
      }}
    >
      {Math.round(score)}
    </PixelText>
  );

  return (
    <View style={{ width: c.w, height: totalH }}>
      {/* 프레임(아이보리) → 본체(딥그린, inner border) */}
      <View
        style={[
          styles.frame,
          { marginTop: capProtrude, height: c.bodyH, borderRadius: c.radius, padding: c.pad },
        ]}
      >
        <View style={[styles.board, { borderRadius: Math.max(1, c.radius - c.pad) }]}>
          {/* compact: 플랫 헤더 스트립 */}
          {!c.cap && (
            <View style={[styles.flatHeader, { height: c.headerH, borderBottomColor: headerAccent }]}>
              <PixelText style={{ fontSize: 7, color: LABEL_COLOR, letterSpacing: 0.5 }}>꿀잼지수</PixelText>
            </View>
          )}
          {/* 중앙 숫자(+ 도트 매트릭스 배경) */}
          <View style={[styles.numberArea, { paddingBottom: c.numGap }]}>
            {c.dots && <DotMatrix cols={c.dots[0]} rows={c.dots[1]} />}
            {numberEl}
          </View>
          {/* 하단 B/S/O 바 */}
          <BsoBar c={c} />
        </View>
      </View>

      {/* 상단 중앙 헤더 캡(hero/detail/preview) */}
      {c.cap && (
        <View style={styles.capWrap} pointerEvents="none">
          <View
            style={[
              styles.cap,
              {
                width: c.capW, height: c.capH,
                borderTopLeftRadius: c.radius, borderTopRightRadius: c.radius,
                borderColor: headerAccent === 'transparent' ? IVORY : headerAccent,
              },
            ]}
          >
            <PixelText style={{ fontSize: c.capH * 0.42, color: LABEL_COLOR, letterSpacing: 1 }}>꿀잼지수</PixelText>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    backgroundColor: IVORY,
    // 그림자 절제 — 설치형 패널 인상(붕 뜬 카드 X)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.28,
    shadowRadius: 2,
    elevation: 2,
  },
  board: {
    flex: 1,
    backgroundColor: BOARD_BG,
    borderWidth: 1.5,
    borderColor: FRAME_DARK,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  flatHeader: {
    width: '100%',
    backgroundColor: HEADER_BG,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
  },
  numberArea: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotLayer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-around',
    alignContent: 'space-around',
    opacity: 0.16,
  },
  dot: { alignItems: 'center', justifyContent: 'center' },
  dotPip: { width: 2, height: 2, borderRadius: 1, backgroundColor: DOT_COLOR },
  bsoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    borderTopWidth: 1,
    borderTopColor: BAR_LINE,
    paddingTop: 3,
  },
  bsoGroup: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  divider: { width: 1, height: 10, backgroundColor: DIVIDER },
  capWrap: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' },
  cap: {
    backgroundColor: HEADER_BG,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
