import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type ScoreSkinId, normalizeScoreSkinId, SCORE_SKINS } from '../utils/scoreSkinConfig';
import type { UniformPresetId } from '../utils/uniformResolver';

const SKIN_KEY = 'user.scoreSkinId';
const LEGACY_KEY = 'user.uniformPreset';

interface ScoreSkinCtx {
  skinId: ScoreSkinId;
  setSkin: (id: ScoreSkinId) => Promise<void>;
}

const ScoreSkinContext = createContext<ScoreSkinCtx>({
  skinId: 'jersey.classic',
  setSkin: async () => {},
});

export function useScoreSkin() {
  return useContext(ScoreSkinContext);
}

export function useUniformPreset() {
  const { skinId, setSkin } = useContext(ScoreSkinContext);
  const config = SCORE_SKINS[skinId];
  const preset: UniformPresetId = config.uniformPreset ?? 'classic';
  const setPreset = useCallback(async (id: UniformPresetId) => {
    const mapped: Record<UniformPresetId, ScoreSkinId> = {
      classic: 'jersey.classic',
      pinstripe: 'jersey.pinstripe',
      cream: 'jersey.cream',
    };
    await setSkin(mapped[id] ?? 'jersey.classic');
  }, [setSkin]);
  return { preset, setPreset };
}

export function ScoreSkinProvider({ children }: { children: ReactNode }) {
  const [skinId, setSkinState] = useState<ScoreSkinId>('jersey.classic');

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
