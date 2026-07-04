// 스킨·야구공 재화·출석 전역 상태 (Phase 3 Stage 3: 서버+캐시).
// 인터페이스는 로컬 MVP(ADR-022)와 동일 — 구현만 AsyncStorage → Supabase(RPC)+캐시로 스왑.
// 화면(SkinSelect·BaseballCenter·라커룸)은 무변경. 데이터 레이어 = services/account.ts.
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { type ScoreSkinId, normalizeScoreSkinId, getScoreSkinById, isSkinOwned } from '../utils/scoreSkinConfig';
import type { UniformPresetId } from '../utils/uniformResolver';
import { type BaseballTx, kstDateStr, cyclePosition } from '../utils/attendance';
import { useAuth } from './Auth';
import * as account from '../services/account';
import type { AccountState, ClaimResult } from '../services/account';

export type { ClaimResult };

const DEFAULT_SKIN_ID = 'jersey.classic.team';

interface ScoreSkinCtx {
  skinId: ScoreSkinId;
  setSkin: (id: ScoreSkinId) => Promise<void>;
  baseballBalance: number;
  ownedSkinIds: string[];
  isOwned: (id: ScoreSkinId) => boolean;
  buySkin: (id: ScoreSkinId) => Promise<boolean>;
  addBaseballs: (n: number) => Promise<void>;
  resetProgress: () => Promise<void>;
  transactions: BaseballTx[];
  attendanceStreak: number;
  totalAttendanceCount: number;
  lastAttendanceClaimDate: string | null;
  canClaimAttendance: boolean;
  cyclePosition: number;            // 현재 7일 주기 내 위치(0~7)
  claimAttendance: () => Promise<ClaimResult>;
}

const noopCtx: ScoreSkinCtx = {
  skinId: DEFAULT_SKIN_ID,
  setSkin: async () => {},
  baseballBalance: 0,
  ownedSkinIds: [],
  isOwned: () => false,
  buySkin: async () => false,
  addBaseballs: async () => {},
  resetProgress: async () => {},
  transactions: [],
  attendanceStreak: 0,
  totalAttendanceCount: 0,
  lastAttendanceClaimDate: null,
  canClaimAttendance: false,
  cyclePosition: 0,
  claimAttendance: async () => ({ claimed: false, earned: 0, base: 0, bonus: 0, streak: 0 }),
};

const ScoreSkinContext = createContext<ScoreSkinCtx>(noopCtx);

export function useScoreSkin() {
  return useContext(ScoreSkinContext);
}

export function useUniformPreset() {
  const { skinId, setSkin } = useContext(ScoreSkinContext);
  const skin = getScoreSkinById(skinId);
  const preset: UniformPresetId = skin.kind === 'jersey' ? skin.styleId : 'classic';
  const setPreset = useCallback(async (id: UniformPresetId) => {
    await setSkin(normalizeScoreSkinId(`jersey.${id}.team`));
  }, [setSkin]);
  return { preset, setPreset };
}

export function ScoreSkinProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  const [state, setState] = useState<AccountState>(account.EMPTY_ACCOUNT);

  // 초기 로드: 캐시 즉시(오프라인/속도) → 서버 fetch로 갱신
  useEffect(() => {
    if (!userId) return;
    let active = true;
    (async () => {
      const cached = await account.loadCache();
      if (cached && active) setState(cached);
      try {
        const fresh = await account.fetchAccount();
        if (fresh && active) { setState(fresh); await account.saveCache(fresh); }
      } catch {}
    })();
    return () => { active = false; };
  }, [userId]);

  const refresh = useCallback(async () => {
    const fresh = await account.fetchAccount();
    if (fresh) { setState(fresh); await account.saveCache(fresh); }
  }, []);

  const setSkin = useCallback(async (id: ScoreSkinId) => {
    setState((s) => { const next = { ...s, appliedSkinId: id }; void account.saveCache(next); return next; });  // 낙관적
    try {
      if (userId) await account.updateAppliedSkin(userId, id);
    } catch {
      await refresh();  // 서버 거부(미보유 등) → 롤백
    }
  }, [userId, refresh]);

  const isOwned = useCallback(
    (id: ScoreSkinId) => isSkinOwned(getScoreSkinById(id), state.ownedSkinIds, state.appliedSkinId),
    [state.ownedSkinIds, state.appliedSkinId],
  );

  const buySkin = useCallback(async (id: ScoreSkinId): Promise<boolean> => {
    try {
      const res = await account.rpcPurchaseSkin(id);
      if (res.success) {
        // 낙관적 즉시 반영(잔액·보유) — RPC가 새 잔액 반환 → 화면 지연 없이 갱신.
        setState((s) => {
          const ownedSkinIds = s.ownedSkinIds.includes(id) ? s.ownedSkinIds : [...s.ownedSkinIds, id];
          const next = { ...s, ownedSkinIds, balance: res.balance ?? s.balance };
          void account.saveCache(next);
          return next;
        });
        void refresh();   // 배경 정합(원장·거래내역)
        return true;
      }
      return false;   // 잔액 부족 등
    } catch {
      return false;   // 오프라인/서버 오류
    }
  }, [refresh]);

  const claimAttendance = useCallback(async (): Promise<ClaimResult> => {
    try {
      const res = await account.rpcClaimAttendance();
      if (res.claimed) {
        // 낙관적 즉시 반영(잔액·streak·오늘 출석 완료) → 화면 지연 없이 갱신.
        setState((s) => {
          const next = {
            ...s,
            balance: s.balance + res.earned,
            attStreak: res.streak,
            attCount: s.attCount + 1,
            attLastDate: kstDateStr(),
          };
          void account.saveCache(next);
          return next;
        });
      }
      void refresh();   // 배경 정합(거래내역)
      return res;
    } catch {
      return { claimed: false, earned: 0, base: 0, bonus: 0, streak: state.attStreak };
    }
  }, [refresh, state.attStreak]);

  // 디버그 전용(서버 RPC, app_config.debug_enabled 게이팅). 재화는 클라 직접 불가 → definer RPC 경유.
  const addBaseballs = useCallback(async (n: number) => {
    try { await account.rpcDebugGrant(n); await refresh(); }
    catch (e) { console.warn('[debug] grant 실패:', e); }
  }, [refresh]);
  const resetProgress = useCallback(async () => {
    try { await account.rpcDebugReset(); await refresh(); }
    catch (e) { console.warn('[debug] reset 실패:', e); }
  }, [refresh]);

  const canClaimAttendance = state.attLastDate !== kstDateStr();

  return (
    <ScoreSkinContext.Provider
      value={{
        skinId: normalizeScoreSkinId(state.appliedSkinId),
        setSkin,
        baseballBalance: state.balance,
        ownedSkinIds: state.ownedSkinIds,
        isOwned,
        buySkin,
        addBaseballs,
        resetProgress,
        transactions: state.transactions,
        attendanceStreak: state.attStreak,
        totalAttendanceCount: state.attCount,
        lastAttendanceClaimDate: state.attLastDate,
        canClaimAttendance,
        cyclePosition: cyclePosition(state.attStreak),
        claimAttendance,
      }}
    >
      {children}
    </ScoreSkinContext.Provider>
  );
}

export function UniformPresetProvider({ children }: { children: ReactNode }) {
  return <ScoreSkinProvider>{children}</ScoreSkinProvider>;
}
