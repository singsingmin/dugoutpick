// 포스트시즌 컨텍스트 로직 테스트 — 2025 시즌 실데이터(API 스파이크) 골든.
// 실행: node data-pipeline/test/postseason.test.mjs
// 픽스처는 GetKboGameList 원본 game 객체에서 로직이 읽는 필드만 발췌(2026-07-11 스파이크).
import assert from 'node:assert';
import {
  parseRound, winsNeeded, normalizeGame, gameWinnerCode,
  accumulateSeriesScore, buildPostseasonContext, seriesContextLine,
  computePostseasonHonjam, buildBracket, myTeamStatus, ROUND_SRID,
} from '../postseason.mjs';

let pass = 0;
function check(name, actual, expected) {
  assert.strictEqual(actual, expected, `${name}: expected ${expected}, got ${actual}`);
  pass++;
}
function checkDeep(name, actual, expected) {
  assert.deepStrictEqual(actual, expected, `${name}: mismatch\n  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(actual)}`);
  pass++;
}

// ── 2025 한국시리즈 원본(발췌): LG(1위) vs 한화(2위), 최종 LG 4-1 ──
const KS = [
  { G_ID: '20251026HHLG0', GAME_SC_NM: 'KS1', VS_GAME_CN: 1, AWAY_NM: '한화', HOME_NM: 'LG', T_SCORE_CN: '2', B_SCORE_CN: '8', GAME_STATE_SC: '3', GAME_RESULT_CK: 1, CANCEL_SC_NM: '정상경기' },
  { G_ID: '20251027HHLG0', GAME_SC_NM: 'KS2', VS_GAME_CN: 2, AWAY_NM: '한화', HOME_NM: 'LG', T_SCORE_CN: '5', B_SCORE_CN: '13', GAME_STATE_SC: '3', GAME_RESULT_CK: 1, CANCEL_SC_NM: '정상경기' },
  { G_ID: '20251029LGHH0', GAME_SC_NM: 'KS3', VS_GAME_CN: 3, AWAY_NM: 'LG', HOME_NM: '한화', T_SCORE_CN: '3', B_SCORE_CN: '7', GAME_STATE_SC: '3', GAME_RESULT_CK: 1, CANCEL_SC_NM: '정상경기' },
  { G_ID: '20251030LGHH0', GAME_SC_NM: 'KS4', VS_GAME_CN: 4, AWAY_NM: 'LG', HOME_NM: '한화', T_SCORE_CN: '7', B_SCORE_CN: '4', GAME_STATE_SC: '3', GAME_RESULT_CK: 1, CANCEL_SC_NM: '정상경기' },
  { G_ID: '20251031LGHH0', GAME_SC_NM: 'KS5', VS_GAME_CN: 5, AWAY_NM: 'LG', HOME_NM: '한화', T_SCORE_CN: '4', B_SCORE_CN: '1', GAME_STATE_SC: '3', GAME_RESULT_CK: 1, CANCEL_SC_NM: '정상경기' },
];
// 2025 와일드카드: 삼성(4위) vs NC(5위), 최종 삼성 진출
const WC = [
  { G_ID: '20251006NCSS0', GAME_SC_NM: 'WC1', VS_GAME_CN: 1, AWAY_NM: 'NC', HOME_NM: '삼성', T_SCORE_CN: '4', B_SCORE_CN: '1', GAME_STATE_SC: '3', GAME_RESULT_CK: 1, CANCEL_SC_NM: '정상경기' },
  { G_ID: '20251007NCSS0', GAME_SC_NM: 'WC2', VS_GAME_CN: 2, AWAY_NM: 'NC', HOME_NM: '삼성', T_SCORE_CN: '0', B_SCORE_CN: '3', GAME_STATE_SC: '3', GAME_RESULT_CK: 1, CANCEL_SC_NM: '정상경기' },
];
const rankKS = (c) => ({ LG: 1, HH: 2 }[c]);
const rankWC = (c) => ({ SS: 4, NC: 5 }[c]);

// ── 1. parseRound: 준PO를 PO보다 먼저 매칭 ──
checkDeep('parseRound WC2', parseRound('WC2'), { round: 'WC', gameNo: 2 });
checkDeep('parseRound 준PO3(=준PO)', parseRound('준PO3'), { round: '준PO', gameNo: 3 });
checkDeep('parseRound PO1', parseRound('PO1'), { round: 'PO', gameNo: 1 });
checkDeep('parseRound KS5', parseRound('KS5'), { round: 'KS', gameNo: 5 });
check('parseRound 정규경기=null', parseRound('정규경기'), null);
check('parseRound null', parseRound(null), null);

// ── 2. srId 매핑(스파이크 실측) ──
check('srId WC', ROUND_SRID.WC, 4);
check('srId 준PO', ROUND_SRID['준PO'], 3);
check('srId PO', ROUND_SRID.PO, 5);
check('srId KS', ROUND_SRID.KS, 7);

// ── 3. winsNeeded: WC 어드밴티지 ──
check('winsNeeded WC 상위(4위)', winsNeeded('WC', true), 1);
check('winsNeeded WC 하위(5위)', winsNeeded('WC', false), 2);
check('winsNeeded KS', winsNeeded('KS', true), 4);
check('winsNeeded 준PO', winsNeeded('준PO', true), 3);

// ── 4. normalizeGame + gameWinnerCode ──
const ks1 = normalizeGame(KS[0]);
check('normalize round', ks1.round, 'KS');
check('normalize gameNo', ks1.gameNo, 1);
check('normalize awayCode', ks1.awayCode, 'HH');
check('normalize homeCode', ks1.homeCode, 'LG');
check('normalize awayScore', ks1.awayScore, 2);
check('normalize homeScore', ks1.homeScore, 8);
check('normalize finished', ks1.finished, true);
check('winner KS1 = LG(홈)', gameWinnerCode(ks1), 'LG');
check('winner KS3 = HH(홈)', gameWinnerCode(normalizeGame(KS[2])), 'HH');
check('winner KS4 = LG(원정)', gameWinnerCode(normalizeGame(KS[3])), 'LG');
check('normalize 정규경기=null', normalizeGame({ G_ID: '20251001NCLG0', GAME_SC_NM: '정규경기' }), null);

// ── 5. 시리즈 스코어 누적(홈/원정 뒤바뀌어도 코드 기준) — 2025 KS 재현 ──
const ksNorm = KS.map(normalizeGame);
checkDeep('KS 전체 누적 = LG 4 - HH 1', accumulateSeriesScore(ksNorm), { LG: 4, HH: 1 });
checkDeep('KS 1~4차전 누적 = LG 3 - HH 1', accumulateSeriesScore(ksNorm.slice(0, 4)), { LG: 3, HH: 1 });
const wcNorm = WC.map(normalizeGame);
checkDeep('WC 전체 누적 = NC 1 - SS 1', accumulateSeriesScore(wcNorm), { NC: 1, SS: 1 });

// ── 6. 컨텍스트: KS 5차전(직전까지 LG 3-1) → LG 매치포인트, HH 벼랑끝 ──
const ctxKS5 = buildPostseasonContext({
  round: 'KS', gameNo: 5, awayCode: 'LG', homeCode: 'HH',
  seriesScore: accumulateSeriesScore(ksNorm.slice(0, 4)), rankOf: rankKS,
});
check('KS5 상위시드 = LG', ctxKS5.high, 'LG');
check('KS5 하위시드 = HH', ctxKS5.low, 'HH');
check('KS5 LG 매치포인트', ctxKS5.matchpoint.LG, true);
check('KS5 HH 매치포인트 아님', ctxKS5.matchpoint.HH, false);
check('KS5 HH 탈락위기', ctxKS5.elimination.HH, true);
check('KS5 최종전 아님', ctxKS5.isFinalGame, false);
check('KS5 맥락 문구', seriesContextLine(ctxKS5, (c) => ({ LG: 'LG', HH: '한화' }[c])), 'LG 이기면 우승');

// ── 7. 컨텍스트: KS 가상 7차전 3-3 → 최종전 ──
const ctxKS7 = buildPostseasonContext({
  round: 'KS', gameNo: 7, awayCode: 'LG', homeCode: 'HH',
  seriesScore: { LG: 3, HH: 3 }, rankOf: rankKS,
});
check('KS7 3-3 최종전', ctxKS7.isFinalGame, true);
check('KS7 맥락 = 운명의 최종전', seriesContextLine(ctxKS7), '운명의 최종전');

// ── 8. 컨텍스트: WC 1차전(0-0) → 어드밴티지 안내 + 5위 벼랑끝 ──
const ctxWC1 = buildPostseasonContext({
  round: 'WC', gameNo: 1, awayCode: 'NC', homeCode: 'SS',
  seriesScore: {}, rankOf: rankWC,
});
check('WC1 상위시드 = SS(4위)', ctxWC1.high, 'SS');
check('WC1 하위시드 = NC(5위)', ctxWC1.low, 'NC');
check('WC1 SS 매치포인트(1승 어드밴티지)', ctxWC1.matchpoint.SS, true);
check('WC1 NC 탈락위기', ctxWC1.elimination.NC, true);
check('WC1 wcAdvantage 플래그', ctxWC1.wcAdvantage, true);
check('WC1 맥락 문구', seriesContextLine(ctxWC1, (c) => ({ SS: '삼성', NC: 'NC' }[c])), '4위 삼성 1승 어드밴티지 · 5위 NC는 2연승 필요');

// ── 9. 컨텍스트: WC 2차전(직전 NC 1승) → 양쪽 매치포인트=최종전 ──
const ctxWC2 = buildPostseasonContext({
  round: 'WC', gameNo: 2, awayCode: 'NC', homeCode: 'SS',
  seriesScore: accumulateSeriesScore([wcNorm[0]]), rankOf: rankWC,
});
check('WC2 SS 매치포인트', ctxWC2.matchpoint.SS, true);
check('WC2 NC 매치포인트(2승째)', ctxWC2.matchpoint.NC, true);
check('WC2 최종전', ctxWC2.isFinalGame, true);

// ── 10. computePostseasonHonjam: 요소별 가산 + clamp ──
const H = (o) => computePostseasonHonjam(o);
// KS 최종전(3-3) + 양 에이스(2.0) + 직전 끝내기 → 상한 근처
const ks7ctx = buildPostseasonContext({ round: 'KS', gameNo: 7, awayCode: 'LG', homeCode: 'HH', seriesScore: { LG: 3, HH: 3 }, rankOf: rankKS });
const ks7hj = H({ ctx: ks7ctx, awayERA: 2.0, homeERA: 2.0, prevGame: { walkoff: true } });
check('KS7 최종전 stakes=18', ks7hj.factors.stakes, 18);
check('KS7 round=KS +7', ks7hj.factors.round, 7);
check('KS7 pitcher(양2.0)=6', ks7hj.factors.pitcher, 6);
check('KS7 momentum(끝내기)=4', ks7hj.factors.momentum, 4);
check('KS7 score clamp 100', ks7hj.score, 100); // 70+7+18+6+4=105 → 100
check('KS7 reason 최종전', ks7hj.reason, '운명의 최종전');

// WC 1차전(0-0), 평범 선발, 직전 없음 → 승부처는 elimination(5위)=12
const wc1ctx = buildPostseasonContext({ round: 'WC', gameNo: 1, awayCode: 'NC', homeCode: 'SS', seriesScore: {}, rankOf: rankWC });
const wc1hj = H({ ctx: wc1ctx, awayERA: 4.5, homeERA: 4.5 });
check('WC1 stakes(엘리미)=12', wc1hj.factors.stakes, 12);
check('WC1 round=WC +0', wc1hj.factors.round, 0);
check('WC1 momentum 없음=0', wc1hj.factors.momentum, 0);
// 70 + 0 + 12 + pitcher(6*(0.166+0.166)/2≈1) → ~83
check('WC1 score 범위', wc1hj.score >= 82 && wc1hj.score <= 84, true);

// 라운드 중반 팽팽(준PO 1-1, 2차전 아닌 3차전 가정) → 승부처 else 분기(gap0=+8)
const jpoCtx = buildPostseasonContext({ round: '준PO', gameNo: 3, awayCode: 'LG', homeCode: 'HH', seriesScore: { LG: 1, HH: 1 }, rankOf: rankKS });
const jpoHj = H({ ctx: jpoCtx, awayERA: 4.2, homeERA: 4.2 });
check('준PO 1-1 승부처 else=+8', jpoHj.factors.stakes, 8);
check('준PO round +2', jpoHj.factors.round, 2);

// 스코어 격차 클 때(2-0) else 분기 감점: gap2 → +2
const jpoGapCtx = buildPostseasonContext({ round: '준PO', gameNo: 3, awayCode: 'LG', homeCode: 'HH', seriesScore: { LG: 2, HH: 0 }, rankOf: rankKS });
// 2-0이면 LG 매치포인트(3승 필요, 2+1=3) → 실제로는 stakes=12. 팽팽 else는 gap 작을 때만.
check('준PO 2-0은 매치포인트 stakes=12', H({ ctx: jpoGapCtx, awayERA: 4.2, homeERA: 4.2 }).factors.stakes, 12);

// 최저 바닥: 모든 가산 최소여도 clamp 하한 이상
const minCtx = buildPostseasonContext({ round: 'WC', gameNo: 1, awayCode: 'NC', homeCode: 'SS', seriesScore: {}, rankOf: rankWC });
check('score 하한 >= 68', H({ ctx: minCtx, awayERA: null, homeERA: null }).score >= 68, true);

// ── 11. buildBracket + myTeamStatus: 2025 대진 재현 ──
// 2025 최종: LG(1) 우승 · 한화 HH(2) 준우승 · SSG SK(3) 준PO탈락 · 삼성 SS(4) PO탈락 · NC(5) WC탈락
const seeds2025 = ['LG', 'HH', 'SK', 'SS', 'NC'];
const win = (round, gameNo, w, l) => ({ round, gameNo, awayCode: w, homeCode: l, awayScore: 5, homeScore: 3, finished: true });
const games2025 = {
  WC: [win('WC', 1, 'NC', 'SS'), win('WC', 2, 'SS', 'NC')],            // 1-1, 4위 SS 어드밴티지로 진출
  '준PO': [win('준PO', 1, 'SS', 'SK'), win('준PO', 2, 'SS', 'SK'), win('준PO', 3, 'SS', 'SK')], // SS 3-0
  PO: [win('PO', 1, 'HH', 'SS'), win('PO', 2, 'HH', 'SS'), win('PO', 3, 'HH', 'SS')],           // HH 3-0
  KS: [win('KS', 1, 'LG', 'HH'), win('KS', 2, 'LG', 'HH'), win('KS', 3, 'HH', 'LG'), win('KS', 4, 'LG', 'HH'), win('KS', 5, 'LG', 'HH')], // LG 4-1
};
const bracket = buildBracket(seeds2025, games2025);
check('브래킷 WC 승자 SS', bracket[0].winner, 'SS');
check('브래킷 준PO 참가 low=WC승자 SS', bracket[1].low, 'SS');
check('브래킷 준PO 승자 SS', bracket[1].winner, 'SS');
check('브래킷 PO 참가 high=2위 HH', bracket[2].high, 'HH');
check('브래킷 PO 승자 HH', bracket[2].winner, 'HH');
check('브래킷 KS 참가 = LG vs HH', `${bracket[3].high}-${bracket[3].low}`, 'LG-HH');
check('브래킷 KS 승자 LG', bracket[3].winner, 'LG');
check('브래킷 KS status done', bracket[3].status, 'done');

check('내 팀 LG = 우승', myTeamStatus(bracket, 'LG', seeds2025).state, '우승');
check('내 팀 HH = 탈락(KS패)', myTeamStatus(bracket, 'HH', seeds2025).state, '탈락');
check('내 팀 SS = 탈락(PO패)', myTeamStatus(bracket, 'SS', seeds2025).state, '탈락');
check('내 팀 SK = 탈락(준PO패)', myTeamStatus(bracket, 'SK', seeds2025).state, '탈락');
check('내 팀 NC = 탈락(WC패)', myTeamStatus(bracket, 'NC', seeds2025).state, '탈락');
check('내 팀 KT(6위) = 진출실패', myTeamStatus(bracket, 'KT', seeds2025).state, '진출실패');
check('응원팀 없음 = 진출실패', myTeamStatus(bracket, null, seeds2025).state, '진출실패');

// ── 12. myTeamStatus 중간 상태(WC만 끝, 준PO 미시작) ──
const midBracket = buildBracket(seeds2025, { WC: games2025.WC });
check('중간: 준PO high SK upcoming → SK 대기', myTeamStatus(midBracket, 'SK', seeds2025).state, '대기');
check('중간: WC 승자 SS 다음라운드 대기', myTeamStatus(midBracket, 'SS', seeds2025).state, '대기');
check('중간: 1위 LG는 KS 대기', myTeamStatus(midBracket, 'LG', seeds2025).state, '대기');
check('중간: NC는 이미 탈락', myTeamStatus(midBracket, 'NC', seeds2025).state, '탈락');

// ── 13. myTeamStatus 진행중(준PO 경기 있으나 승자 미확정) ──
const activeBracket = buildBracket(seeds2025, { WC: games2025.WC, '준PO': [win('준PO', 1, 'SS', 'SK')] });
check('진행중: 준PO 1-0 → SS 진행중', myTeamStatus(activeBracket, 'SS', seeds2025).state, '진행중');
check('진행중: SK도 진행중', myTeamStatus(activeBracket, 'SK', seeds2025).state, '진행중');

console.log(`\n✅ postseason.test.mjs — ${pass} checks passed`);
