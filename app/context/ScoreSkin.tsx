import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type ScoreSkinId, normalizeScoreSkinId, getScoreSkinById, isSkinOwned } from '../utils/scoreSkinConfig';
import type { UniformPresetId } from '../utils/uniformResolver';

const SKIN_KEY = 'user.scoreSkinId';
const LEGACY_KEY = 'user.uniformPreset';
const OWNED_KEY = 'user.ownedSkinIds';
const BALANCE_KEY = 'user.baseballBalance';
const GRANT_KEY = 'user.initialBaseballGrant';
const DEFAULT_SKIN_ID = 'jersey.classic.team';
const INITIAL_GRANT = 500;

interface ScoreSkinCtx {
  skinId: ScoreSkinId;
  setSkin: (id: ScoreSkinId) => Promise<void>;
  baseballBalance: number;
  ownedSkinIds: string[];
  isOwned: (id: ScoreSkinId) => boolean;
  buySkin: (id: ScoreSkinId) => Promise<boolean>;   // 성공 시 true(차감+보유추가), 실패(잔액부족) false
  addBaseballs: (n: number) => Promise<void>;        // 디버그
  resetProgress: () => Promise<void>;                // 디버그: 500·기본만 보유·클래식 적용
}

const ScoreSkinContext = createContext<ScoreSkinCtx>({
  skinId: DEFAULT_SKIN_ID,
  setSkin: async () => {},
  baseballBalance: 0,
  ownedSkinIds: [],
  isOwned: () => false,
  buySkin: async () => false,
  addBaseballs: async () => {},
  resetProgress: async () => {},
});

export function useScoreSkin() {
  return useContext(ScoreSkinContext);
}

// 하위호환 브리지 — 현재 스킨의 styleId를 유니폼 프리셋으로 노출.
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
  const [skinId, setSkinState] = useState<ScoreSkinId>(DEFAULT_SKIN_ID);
  const [balance, setBalance] = useState(0);
  const [owned, setOwned] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        // 보유 목록
        let ownedIds: string[] = [];
        try { ownedIds = JSON.parse((await AsyncStorage.getItem(OWNED_KEY)) ?? '[]'); } catch {}
        setOwned(Array.isArray(ownedIds) ? ownedIds : []);

        // 잔액 — 최초 1회 500 지급
        const grant = await AsyncStorage.getItem(GRANT_KEY);
        let bal: number;
        if (!grant) {
          bal = INITIAL_GRANT;
          await AsyncStorage.multiSet([[BALANCE_KEY, String(bal)], [GRANT_KEY, '1']]);
        } else {
          bal = Number((await AsyncStorage.getItem(BALANCE_KEY)) ?? '0') || 0;
        }
        setBalance(bal);

        // 적용 스킨 (+ 레거시 마이그레이션)
        const v = await AsyncStorage.getItem(SKIN_KEY);
        let sid: ScoreSkinId;
        if (v) {
          sid = normalizeScoreSkinId(v);
        } else {
          const legacy = await AsyncStorage.getItem(LEGACY_KEY);
          sid = normalizeScoreSkinId(legacy);
          await AsyncStorage.setItem(SKIN_KEY, sid);
        }
        // 구매제 전환 마이그레이션: 적용 중 스킨이 free 아니고 미보유면 클래식으로 리셋.
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

  const buySkin = useCallback(async (id: ScoreSkinId): Promise<boolean> => {
    const skin = getScoreSkinById(id);
    if (isSkinOwned(skin, owned, skinId)) return true;      // 이미 보유
    const price = skin.price ?? 0;
    if (balance < price) return false;                      // 잔액 부족
    const nextBal = balance - price;
    const nextOwned = owned.includes(id) ? owned : [...owned, id];
    setBalance(nextBal);
    setOwned(nextOwned);
    try {
      await AsyncStorage.multiSet([[BALANCE_KEY, String(nextBal)], [OWNED_KEY, JSON.stringify(nextOwned)]]);
    } catch {}
    return true;
  }, [balance, owned, skinId]);

  const addBaseballs = useCallback(async (n: number) => {
    const next = balance + n;
    setBalance(next);
    try { await AsyncStorage.setItem(BALANCE_KEY, String(next)); } catch {}
  }, [balance]);

  const resetProgress = useCallback(async () => {
    setBalance(INITIAL_GRANT);
    setOwned([]);
    setSkinState(DEFAULT_SKIN_ID);
    try {
      await AsyncStorage.multiSet([
        [BALANCE_KEY, String(INITIAL_GRANT)],
        [OWNED_KEY, '[]'],
        [SKIN_KEY, DEFAULT_SKIN_ID],
        [GRANT_KEY, '1'],
      ]);
    } catch {}
  }, []);

  return (
    <ScoreSkinContext.Provider
      value={{ skinId, setSkin, baseballBalance: balance, ownedSkinIds: owned, isOwned, buySkin, addBaseballs, resetProgress }}
    >
      {children}
    </ScoreSkinContext.Provider>
  );
}

export function UniformPresetProvider({ children }: { children: ReactNode }) {
  return <ScoreSkinProvider>{children}</ScoreSkinProvider>;
}
