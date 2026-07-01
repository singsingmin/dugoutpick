import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type ScoreSkinId, normalizeScoreSkinId, getScoreSkinById } from '../utils/scoreSkinConfig';
import type { UniformPresetId } from '../utils/uniformResolver';

const SKIN_KEY = 'user.scoreSkinId';
const LEGACY_KEY = 'user.uniformPreset';
const DEFAULT_SKIN_ID = 'jersey.classic.team';

interface ScoreSkinCtx {
  skinId: ScoreSkinId;
  setSkin: (id: ScoreSkinId) => Promise<void>;
}

const ScoreSkinContext = createContext<ScoreSkinCtx>({
  skinId: DEFAULT_SKIN_ID,
  setSkin: async () => {},
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
    // styleId → team 팔레트 스킨 id로 매핑(없으면 정규화가 기본으로 처리).
    await setSkin(normalizeScoreSkinId(`jersey.${id}.team`));
  }, [setSkin]);
  return { preset, setPreset };
}

export function ScoreSkinProvider({ children }: { children: ReactNode }) {
  const [skinId, setSkinState] = useState<ScoreSkinId>(DEFAULT_SKIN_ID);

  useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem(SKIN_KEY);
        if (v) {
          setSkinState(normalizeScoreSkinId(v));
        } else {
          const legacy = await AsyncStorage.getItem(LEGACY_KEY);
          const resolved = normalizeScoreSkinId(legacy);
          setSkinState(resolved);
          await AsyncStorage.setItem(SKIN_KEY, resolved);
        }
      } catch {}
    })();
  }, []);

  const setSkin = useCallback(async (id: ScoreSkinId) => {
    setSkinState(id);
    try { await AsyncStorage.setItem(SKIN_KEY, id); } catch {}
  }, []);

  return (
    <ScoreSkinContext.Provider value={{ skinId, setSkin }}>
      {children}
    </ScoreSkinContext.Provider>
  );
}

export function UniformPresetProvider({ children }: { children: ReactNode }) {
  return <ScoreSkinProvider>{children}</ScoreSkinProvider>;
}
