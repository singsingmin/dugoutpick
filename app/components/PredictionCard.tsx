// '오늘의 예측' 카드 (Phase 4 Stage 3). 설계: docs/prediction-league-design.md §6.
// 상태 4가지: 미제출(마감전 선택 유도/마감후 놓침) → pending(대기중, 마감전 재선택 가능)
//           → hit/miss/void(정산 후 결과). 판정은 서버(settle_prediction)만, 여기선 표시만.
import { useCallback, useEffect, useState } from 'react';
import { View, Pressable, Modal, ScrollView, TextInput, StyleSheet } from 'react-native';
import type { Game, DailyHoneyResult } from '../types';
import { useAuth } from '../context/Auth';
import { useOnline } from '../hooks/useOnline';
import { loadDailyHoney } from '../data/load';
import {
  fetchTodayPrediction, fetchPredictionStats, rpcSubmitPrediction, rpcSetNickname,
  type TodayPrediction, type PredictionStats,
} from '../services/predictions';
import PixelText from './PixelText';
import Panel from './Panel';
import TeamName from './TeamName';
import SectionLabel from './SectionLabel';
import { ymdToIso } from '../utils';
import { colors, spacing, border } from '../theme';

interface Props {
  dateYmd: string;   // "YYYYMMDD" — Today.tsx의 data.date
  games: Game[];     // 오늘 전체 경기(선택지 구성용)
  locked: boolean;   // 오늘 이미 경기 시작함(라이브/전체종료) — 마감 UI 힌트용. 실제 마감은 서버가 판정.
}

export default function PredictionCard({ dateYmd, games, locked }: Props) {
  const { userId } = useAuth();
  const online = useOnline();
  const [prediction, setPrediction] = useState<TodayPrediction | null>(null);
  const [stats, setStats] = useState<PredictionStats | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [nicknameVisible, setNicknameVisible] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [pendingGameId, setPendingGameId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [todayHoney, setTodayHoney] = useState<DailyHoneyResult | null>(null);

  const dateIso = ymdToIso(dateYmd);

  const load = useCallback(() => {
    if (!userId) { setLoaded(true); return; }
    Promise.all([fetchTodayPrediction(dateIso), fetchPredictionStats()])
      .then(([p, s]) => {
        setPrediction(p); setStats(s); setLoaded(true);
        // 정산 완료 상태일 때만 "오늘의 실제 명경기" 표시용으로 판정 결과를 가져옴.
        if (p && p.status !== 'pending') {
          loadDailyHoney()
            .then((d) => setTodayHoney(d.results.find((r) => r.date === dateYmd && r.away && r.home) ?? null))
            .catch(() => {});
        }
      })
      .catch(() => setLoaded(true));
  }, [userId, dateIso, dateYmd]);

  useEffect(() => { load(); }, [load]);

  const submit = useCallback(async (gameId: string) => {
    setSubmitting(true);
    try {
      // 제출 시점 경기 맥락 스냅샷(P3) — 이후 조건이 바뀌어도 픽 당시 맥락 보존.
      const g = games.find((x) => x.gameId === gameId);
      const snapshot = g
        ? { honey_score_at_pick: g.honjam?.score ?? null, home_team: g.home.code, away_team: g.away.code, game_start_time: g.time }
        : {};
      const res = await rpcSubmitPrediction(gameId, snapshot);
      if (res.success) {
        setPrediction({ selectedGameId: gameId, status: 'pending', rewardBaseballs: 0, rankingPoints: 0 });
        setPickerVisible(false);
      }
      // 실패(locked/window_not_ready)는 조용히 무시 — 다음 진입 때 실제 서버 상태로 갱신됨.
    } catch {
      // 네트워크 실패 등 — 민감 쓰기 실패로 화면을 깨뜨리지 않음
    } finally {
      setSubmitting(false);
    }
  }, [games]);

  const selectGame = useCallback(async (gameId: string) => {
    if (!stats?.nickname) {
      setPendingGameId(gameId);
      setPickerVisible(false);
      setNicknameVisible(true);
      return;
    }
    await submit(gameId);
  }, [stats, submit]);

  const submitNickname = useCallback(async () => {
    setNicknameError(null);
    const trimmed = nicknameInput.trim();
    const res = await rpcSetNickname(trimmed).catch(() => null);
    if (!res) { setNicknameError('오류가 발생했어요'); return; }
    if (!res.success) {
      setNicknameError(
        res.reason === 'rate_limited' ? '이번 달엔 닉네임을 이미 바꿨어요' : '닉네임은 2~10자로 입력해주세요'
      );
      return;
    }
    setStats((s) => (s ? { ...s, nickname: res.nickname ?? trimmed }
      : { nickname: res.nickname ?? trimmed, nicknameChangedMonth: null, totalPredictions: 0, totalHits: 0, currentStreak: 0, bestStreak: 0, equippedTitle: null, equippedOwnedBackgroundId: null }));
    setNicknameVisible(false);
    if (pendingGameId) {
      const gameId = pendingGameId;
      setPendingGameId(null);
      await submit(gameId);
    }
  }, [nicknameInput, pendingGameId, submit]);

  if (!loaded || !userId || games.length === 0) return null;

  const selected = prediction ? games.find((g) => g.gameId === prediction.selectedGameId) : null;
  // 예측 선택지는 아직 시작 안 한 경기만 — 이미 취소(우천 등) 발표된 경기를 골라 무위험 void로
  // 연속 적중을 보존하는 어뷰징 방지(서버는 경기 상태를 몰라 클라에서 거른다).
  const selectableGames = games.filter((g) => g.status === 'SCHEDULED');

  return (
    <View style={styles.section}>
      <SectionLabel icon="sparkles" label="오늘의 예측" />
      <Panel style={styles.card}>
        {!online ? (
          <PixelText variant="caption" color={colors.textDim}>오프라인일 땐 예측을 제출할 수 없어요</PixelText>
        ) : !prediction ? (
          locked ? (
            <PixelText variant="body" color={colors.textDim}>오늘은 예측을 놓쳤어요</PixelText>
          ) : (
            <Pressable onPress={() => setPickerVisible(true)} disabled={submitting}>
              <PixelText variant="body" color={colors.accent}>오늘 제일 재밌을 경기를 골라보세요 →</PixelText>
            </Pressable>
          )
        ) : prediction.status === 'pending' ? (
          <View>
            <View style={styles.row}>
              {selected ? (
                <>
                  <TeamName code={selected.away.code} variant="body" />
                  <PixelText variant="caption" color={colors.textDim}>vs</PixelText>
                  <TeamName code={selected.home.code} variant="body" />
                </>
              ) : (
                <PixelText variant="body" color={colors.text}>내 예측 접수됨</PixelText>
              )}
            </View>
            <PixelText variant="caption" color={colors.textDim}>결과 대기중</PixelText>
            {!locked && (
              <Pressable onPress={() => setPickerVisible(true)} disabled={submitting}>
                <PixelText variant="caption" color={colors.accent} style={styles.changeLink}>다시 고르기</PixelText>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.resultBlock}>
            {todayHoney?.away && todayHoney?.home && (
              <View style={styles.honeyReveal}>
                <PixelText variant="caption" color={colors.textDim}>오늘의 실제 명경기</PixelText>
                <View style={styles.row}>
                  <TeamName code={todayHoney.away.code} variant="body" />
                  <PixelText variant="caption" color={colors.textDim}>vs</PixelText>
                  <TeamName code={todayHoney.home.code} variant="body" />
                </View>
                <PixelText variant="caption" color={colors.accent}>{todayHoney.decidingReasonTags.join(' · ')}</PixelText>
              </View>
            )}
            {prediction.status === 'void' ? (
              <PixelText variant="body" color={colors.textDim}>선택한 경기가 취소돼 무효 처리됐어요</PixelText>
            ) : prediction.status === 'hit' ? (
              <View>
                <PixelText variant="body" color={colors.good}>적중! 야구공 +{prediction.rewardBaseballs}</PixelText>
                {stats && stats.currentStreak > 1 && (
                  <PixelText variant="caption" color={colors.textDim}>{stats.currentStreak}연속 적중중</PixelText>
                )}
              </View>
            ) : (
              <PixelText variant="body" color={colors.textDim}>아쉽네요, 다음 기회에</PixelText>
            )}
          </View>
        )}
      </Panel>

      {/* 경기 선택 바텀시트 */}
      <Modal visible={pickerVisible} transparent animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <View style={styles.sheetContainer}>
          <Pressable style={styles.backdrop} onPress={() => setPickerVisible(false)} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <PixelText variant="title" style={styles.sheetTitle}>오늘 제일 재밌을 경기는?</PixelText>
            <ScrollView>
              {selectableGames.length === 0 ? (
                <PixelText variant="body" color={colors.textDim} style={styles.sheetEmpty}>지금 예측할 수 있는 경기가 없어요</PixelText>
              ) : (
                selectableGames.map((g) => (
                  <Pressable key={g.gameId} style={styles.gameOption} disabled={submitting} onPress={() => selectGame(g.gameId)}>
                    <TeamName code={g.away.code} variant="body" />
                    <PixelText variant="caption" color={colors.textDim}>vs</PixelText>
                    <TeamName code={g.home.code} variant="body" />
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 닉네임 설정(리그 첫 참여 시) */}
      <Modal visible={nicknameVisible} transparent animationType="fade" onRequestClose={() => setNicknameVisible(false)}>
        <View style={styles.sheetContainer}>
          <Pressable style={styles.backdrop} onPress={() => setNicknameVisible(false)} />
          <View style={styles.nicknameBox}>
            <PixelText variant="title" style={styles.sheetTitle}>예측 리그 닉네임</PixelText>
            <PixelText variant="caption" color={colors.textDim} style={styles.nicknameHint}>랭킹에 공개되는 이름이에요 (2~10자, 이후 월 1회 변경 가능)</PixelText>
            <TextInput
              style={styles.input}
              value={nicknameInput}
              onChangeText={setNicknameInput}
              placeholder="닉네임 입력"
              placeholderTextColor={colors.textDim}
              maxLength={10}
            />
            {nicknameError && <PixelText variant="caption" color={colors.bad}>{nicknameError}</PixelText>}
            <Pressable style={styles.confirmButton} onPress={submitNickname}>
              <PixelText variant="body" color={colors.onGreen}>확인</PixelText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, marginBottom: spacing.lg },
  card: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  changeLink: { marginTop: spacing.xs },
  resultBlock: { gap: spacing.sm },
  honeyReveal: { gap: 2, paddingBottom: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.surfaceAlt },

  sheetContainer: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    maxHeight: '75%',
    backgroundColor: '#FBF5E4',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.sm },
  sheetTitle: { textAlign: 'center', marginBottom: spacing.sm },
  sheetEmpty: { textAlign: 'center', paddingVertical: spacing.lg },
  gameOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.surfaceAlt,
  },

  nicknameBox: {
    margin: spacing.lg, backgroundColor: '#FBF5E4', borderRadius: border.radius,
    padding: spacing.lg, gap: spacing.sm,
  },
  nicknameHint: { textAlign: 'center', marginBottom: spacing.xs },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: border.radius,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, color: colors.text,
  },
  confirmButton: {
    backgroundColor: colors.accent, borderRadius: border.radius,
    paddingVertical: spacing.sm, alignItems: 'center', marginTop: spacing.xs,
  },
});
