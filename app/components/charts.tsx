// 8비트 스타일 차트(라이브러리 없이 View 기반). 내 팀 탭 시각화용.
import { View, StyleSheet } from 'react-native';
import PixelText from './PixelText';
import { loadTeams } from '../data/load';
import type { RecentGame } from '../types';
import { colors } from '../theme';

const TEAMS = loadTeams().teams;
const teamMeta = (code: string) => TEAMS.find((t) => t.code === code);

// 순위 사다리 — 10팀 중 내 위치
export function RankLadder({ rank, color }: { rank: number; color: string }) {
  return (
    <View style={s.ladder}>
      {Array.from({ length: 10 }).map((_, i) => {
        const here = i + 1 === rank;
        return (
          <View key={i} style={[s.rung, here && { backgroundColor: color, borderColor: colors.border }]}>
            {here && <PixelText variant="caption" color="#ffffff">{rank}</PixelText>}
          </View>
        );
      })}
    </View>
  );
}

// 승-무-패 스택 막대
export function WLDBar({ win, draw, loss }: { win: number; draw: number; loss: number }) {
  return (
    <View>
      <View style={s.track}>
        {win > 0 && <View style={{ flex: win, backgroundColor: colors.good }} />}
        {draw > 0 && <View style={{ flex: draw, backgroundColor: colors.textDim }} />}
        {loss > 0 && <View style={{ flex: loss, backgroundColor: colors.bad }} />}
      </View>
      <PixelText variant="caption" color={colors.textDim}>{win}승 {draw}무 {loss}패</PixelText>
    </View>
  );
}

// 홈/원정 비교 — "승-무-패" 문자열 파싱해 막대 2개
function parseWDL(s: string) {
  const [w, d, l] = (s || '0-0-0').split('-').map((n) => parseInt(n, 10) || 0);
  return { w, d, l };
}
export function HomeAwayBars({ home, away }: { home: string; away: string }) {
  const h = parseWDL(home);
  const a = parseWDL(away);
  return (
    <View style={{ gap: 8 }}>
      <View>
        <PixelText variant="caption" color={colors.textDim}>홈</PixelText>
        <WLDBar win={h.w} draw={h.d} loss={h.l} />
      </View>
      <View>
        <PixelText variant="caption" color={colors.textDim}>원정</PixelText>
        <WLDBar win={a.w} draw={a.d} loss={a.l} />
      </View>
    </View>
  );
}

// 상대팀별 상대전적 — 승률 높은 순
export function H2HList({ vs }: { vs: Record<string, string> }) {
  const rows = Object.entries(vs)
    .map(([code, rec]) => {
      const [w, l, d] = rec.split('-').map((n) => parseInt(n, 10) || 0);
      const g = w + l + d;
      const m = teamMeta(code);
      return { code, name: m?.name ?? code, color: m?.color ?? colors.text, w, l, d, wr: g ? w / g : 0 };
    })
    .sort((x, y) => y.wr - x.wr);
  return (
    <View style={{ gap: 4 }}>
      {rows.map((r) => (
        <View key={r.code} style={s.h2hRow}>
          <PixelText variant="caption" color={r.color} style={s.h2hName}>{r.name}</PixelText>
          <View style={s.h2hTrack}>
            {r.w > 0 && <View style={{ flex: r.w, backgroundColor: colors.good }} />}
            {r.d > 0 && <View style={{ flex: r.d, backgroundColor: colors.textDim }} />}
            {r.l > 0 && <View style={{ flex: r.l, backgroundColor: colors.bad }} />}
          </View>
          <PixelText variant="caption" color={colors.textDim} style={s.h2hRec}>{r.w}-{r.l}{r.d ? `-${r.d}` : ''}</PixelText>
        </View>
      ))}
    </View>
  );
}

// 최근 N경기 폼 — 결과 도트(오래된→최신). compact: 작은 도트만(순위 탭 서브라인용).
const dotColor = (r: string) => (r === 'W' ? colors.good : r === 'L' ? colors.bad : colors.textDim);
export function FormDots({ games, compact = false }: { games: RecentGame[]; compact?: boolean }) {
  if (compact) {
    return (
      <View style={s.miniRow}>
        {games.map((g, i) => (
          <View key={i} style={[s.formDotMini, { backgroundColor: dotColor(g.result) }]} />
        ))}
      </View>
    );
  }
  const w = games.filter((g) => g.result === 'W').length;
  const l = games.filter((g) => g.result === 'L').length;
  const d = games.length - w - l;
  return (
    <View>
      <View style={s.dotsRow}>
        {games.map((g, i) => (
          <View key={i} style={[s.formDot, { backgroundColor: dotColor(g.result) }]}>
            <PixelText variant="caption" color="#ffffff" style={s.formDotTxt}>{g.result}</PixelText>
          </View>
        ))}
      </View>
      <PixelText variant="caption" color={colors.textDim}>최근 {games.length}경기 {w}승 {d}무 {l}패 (← 오래된 · 최신 →)</PixelText>
    </View>
  );
}

const s = StyleSheet.create({
  ladder: { flexDirection: 'row', gap: 2 },
  rung: { flex: 1, height: 20, backgroundColor: colors.surfaceAlt, borderRadius: 2, alignItems: 'center', justifyContent: 'center' },
  track: { flexDirection: 'row', height: 14, borderRadius: 3, overflow: 'hidden', marginBottom: 4 },
  h2hRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  h2hName: { width: 36 },
  h2hTrack: { flex: 1, flexDirection: 'row', height: 10, borderRadius: 2, overflow: 'hidden', backgroundColor: colors.surfaceAlt },
  h2hRec: { width: 46, textAlign: 'right' },
  dotsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginBottom: 4 },
  formDot: { width: 18, height: 18, borderRadius: 2, alignItems: 'center', justifyContent: 'center' },
  formDotTxt: { fontSize: 9 },
  miniRow: { flexDirection: 'row', gap: 2 },
  formDotMini: { width: 9, height: 9, borderRadius: 1 },
});
