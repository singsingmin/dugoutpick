import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type ScoreSkinId, normalizeScoreSkinId, getScoreSkinById, isSkinOwned } from '../utils/scoreSkinConfig';
import type { UniformPresetId } from '../utils/uniformResolver';
import {
  type BaseballTx, kstDateStr, prevDateStr, newTxId, cyclePosition,
  ATTENDANCE_REWARD, ATTENDANCE_BONUS, ATTENDANCE_CYCLE, TX_CAP,
} from '../utils/attendance';

const SKIN_KEY = 'user.scoreSkinId';
const LEGACY_KEY = 'user.uniformPreset';
const OWNED_KEY = 'user.ownedSkinIds';
const BALANCE_KEY = 'user.baseballBalance';
const GRANT_KEY = 'user.initialBaseballGrant';
const TX_KEY = 'user.baseballTx';
const ATT_DATE_KEY = 'user.attClaimDate';
const ATT_STREAK_KEY = 'user.attStreak';
const ATT_COUNT_KEY = 'user.attCount';
const DEFAULT_SKIN_ID = 'jersey.classic.team';
const INITIAL_GRANT = 500;

export interface ClaimResult { claimed: boolean; earned: number; base: number; bonus: number; streak: number; }

interface ScoreSkinCtx {
  skinId: ScoreSkinId;
  setSkin: (id: ScoreSkinId) => Promise<void>;
  baseballBalance: number;
  ownedSkinIds: string[];
  isOwned: (id: ScoreSkinId) => boolean;
  buySkin: (id: ScoreSkinId) => Promise<boolean>;
  addBaseballs: (n: number) => Promise<void>;
  resetProgress: () => Promise<void>;
  // 야구공 센터(출석/내역)
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

function initialGrantTx(): BaseballTx {
  return { id: newTxId(), type: 'earn', amount: INITIAL_GRANT, reason: 'initial_grant', label: '첫 지급', createdAt: new Date().toISOString() };
}

export function ScoreSkinProvider({ children }: { children: ReactNode }) {
  const [skinId, setSkinState] = useState<ScoreSkinId>(DEFAULT_SKIN_ID);
  const [balance, setBalance] = useState(0);
  const [owned, setOwned] = useState<string[]>([]);
  const [transactions, setTransactions] = useState<BaseballTx[]>([]);
  const [attDate, setAttDate] = useState<string | null>(null);
  const [attStreak, setAttStreak] = useState(0);
  const [attCount, setAttCount] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        let ownedIds: string[] = [];
        try { ownedIds = JSON.parse((await AsyncStorage.getItem(OWNED_KEY)) ?? '[]'); } catch {}
        setOwned(Array.isArray(ownedIds) ? ownedIds : []);

        // 거래 내역
        let txs: BaseballTx[] = [];
        try { txs = JSON.parse((await AsyncStorage.getItem(TX_KEY)) ?? '[]'); } catch {}
        if (!Array.isArray(txs)) txs = [];

        // 잔액 — 최초 1회 500 지급 + initial_grant 내역
        const grant = await AsyncStorage.getItem(GRANT_KEY);
        let bal: number;
        if (!grant) {
          bal = INITIAL_GRANT;
          txs = [initialGrantTx()];
          await AsyncStorage.multiSet([[BALANCE_KEY, String(bal)], [GRANT_KEY, '1'], [TX_KEY, JSON.stringify(txs)]]);
        } else {
          bal = Number((await AsyncStorage.getItem(BALANCE_KEY)) ?? '0') || 0;
          if (txs.length === 0) {  // 구버전 유저: 내역 비어있으면 초기지급 1건 시드
            txs = [initialGrantTx()];
            await AsyncStorage.setItem(TX_KEY, JSON.stringify(txs));
          }
        }
        setBalance(bal);
        setTransactions(txs);

        // 출석 상태
        setAttDate((await AsyncStorage.getItem(ATT_DATE_KEY)) || null);
        setAttStreak(Number((await AsyncStorage.getItem(ATT_STREAK_KEY)) ?? '0') || 0);
        setAttCount(Number((await AsyncStorage.getItem(ATT_COUNT_KEY)) ?? '0') || 0);

        // 적용 스킨 (+ 레거시 마이그레이션 + 구매제 전환 리셋)
        const v = await AsyncStorage.getItem(SKIN_KEY);
        let sid: ScoreSkinId;
        if (v) {
          sid = normalizeScoreSkinId(v);
        } else {
          sid = normalizeScoreSkinId(await AsyncStorage.getItem(LEGACY_KEY));
          await AsyncStorage.setItem(SKIN_KEY, sid);
        }
        const skin = getScoreSkinById(sid);
        if (skin.unlockType !== 'free' && !(Array.isArray(ownedIds) && ownedIds.includes(sid))) {
          sid = DEFAULT_SKIN_ID;
          await AsyncStorage.setItem(SKIN_KEY, sid);
        }
        setSkinState(sid);
      } catch {}
    })();
  }, []);

  const setSkin = useCallback(async (id: ScoreSkinId) => {
    setSkinState(id);
    try { await AsyncStorage.setItem(SKIN_KEY, id); } catch {}
  }, []);

  const isOwned = useCallback(
    (id: ScoreSkinId) => isSkinOwned(getScoreSkinById(id), owned, skinId),
    [owned, skinId],
  );

  const persistTx = useCallback(async (next: BaseballTx[]) => {
    try { await AsyncStorage.setItem(TX_KEY, JSON.stringify(next)); } catch {}
  }, []);

  const buySkin = useCallback(async (id: ScoreSkinId): Promise<boolean> => {
    const skin = getScoreSkinById(id);
    if (isSkinOwned(skin, owned, skinId)) return true;
    const price = skin.price ?? 0;
    if (balance < price) return false;
    const nextBal = balance - price;
    const nextOwned = owned.includes(id) ? owned : [...owned, id];
    const tx: BaseballTx = {
      id: newTxId(), type: 'spend', amount: price, reason: 'skin_purchase',
      label: `${skin.label} 구매`, createdAt: new Date().toISOString(), relatedSkinId: id,
    };
    const nextTx = [tx, ...transactions].slice(0, TX_CAP);
    setBalance(nextBal); setOwned(nextOwned); setTransactions(nextTx);
    try {
      await AsyncStorage.multiSet([[BALANCE_KEY, String(nextBal)], [OWNED_KEY, JSON.stringify(nextOwned)], [TX_KEY, JSON.stringify(nextTx)]]);
    } catch {}
    return true;
  }, [balance, owned, skinId, transactions]);

  const addBaseballs = useCallback(async (n: number) => {
    const next = balance + n;
    const tx: BaseballTx = { id: newTxId(), type: 'earn', amount: n, reason: 'debug_charge', label: '테스트 충전', createdAt: new Date().toISOString() };
    const nextTx = [tx, ...transactions].slice(0, TX_CAP);
    setBalance(next); setTransactions(nextTx);
    try { await AsyncStorage.multiSet([[BALANCE_KEY, String(next)], [TX_KEY, JSON.stringify(nextTx)]]); } catch {}
  }, [balance, transactions]);

  const resetProgress = useCallback(async () => {
    const txs = [initialGrantTx()];
    setBalance(INITIAL_GRANT); setOwned([]); setSkinState(DEFAULT_SKIN_ID);
    setTransactions(txs); setAttDate(null); setAttStreak(0); setAttCount(0);
    try {
      await AsyncStorage.multiSet([
        [BALANCE_KEY, String(INITIAL_GRANT)], [OWNED_KEY, '[]'], [SKIN_KEY, DEFAULT_SKIN_ID], [GRANT_KEY, '1'],
        [TX_KEY, JSON.stringify(txs)], [ATT_STREAK_KEY, '0'], [ATT_COUNT_KEY, '0'],
      ]);
      await AsyncStorage.removeItem(ATT_DATE_KEY);
    } catch {}
  }, []);

  const claimAttendance = useCallback(async (): Promise<ClaimResult> => {
    const today = kstDateStr();
    if (attDate === today) return { claimed: false, earned: 0, base: 0, bonus: 0, streak: attStreak };
    const nextStreak = attDate === prevDateStr(today) ? attStreak + 1 : 1;   // 연속이면 +1, 놓치면 1부터
    const bonus = nextStreak % ATTENDANCE_CYCLE === 0 ? ATTENDANCE_BONUS : 0;
    const base = ATTENDANCE_REWARD;
    const earned = base + bonus;
    const now = new Date().toISOString();
    const added: BaseballTx[] = [{ id: newTxId(), type: 'earn', amount: base, reason: 'attendance', label: '출석 보상', createdAt: now }];
    if (bonus > 0) added.unshift({ id: newTxId(), type: 'earn', amount: bonus, reason: 'attendance_bonus', label: '7일 연속 보너스', createdAt: now });
    const nextBal = balance + earned;
    const nextTx = [...added, ...transactions].slice(0, TX_CAP);
    const nextCount = attCount + 1;
    setBalance(nextBal); setTransactions(nextTx); setAttDate(today); setAttStreak(nextStreak); setAttCount(nextCount);
    try {
      await AsyncStorage.multiSet([
        [BALANCE_KEY, String(nextBal)], [TX_KEY, JSON.stringify(nextTx)],
        [ATT_DATE_KEY, today], [ATT_STREAK_KEY, String(nextStreak)], [ATT_COUNT_KEY, String(nextCount)],
      ]);
    } catch {}
    return { claimed: true, earned, base, bonus, streak: nextStreak };
  }, [attDate, attStreak, attCount, balance, transactions]);

  const canClaimAttendance = attDate !== kstDateStr();

  return (
    <ScoreSkinContext.Provider
      value={{
        skinId, setSkin, baseballBalance: balance, ownedSkinIds: owned, isOwned, buySkin, addBaseballs, resetProgress,
        transactions, attendanceStreak: attStreak, totalAttendanceCount: attCount, lastAttendanceClaimDate: attDate,
        canClaimAttendance, cyclePosition: cyclePosition(attStreak), claimAttendance,
      }}
    >
      {children}
    </ScoreSkinContext.Provider>
  );
}

export function UniformPresetProvider({ children }: { children: ReactNode }) {
  return <ScoreSkinProvider>{children}</ScoreSkinProvider>;
}
