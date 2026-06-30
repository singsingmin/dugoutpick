import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type UniformPresetId, normalizePresetId } from '../utils/uniformResolver';

const PRESET_KEY = 'user.uniformPreset';

interface UniformPresetCtx {
  preset: UniformPresetId;
  setPreset: (id: UniformPresetId) => Promise<void>;
}

const UniformPresetContext = createContext<UniformPresetCtx>({
  preset: 'classic',
  setPreset: async () => {},
});

export function useUniformPreset() {
  return useContext(UniformPresetContext);
}

export function UniformPresetProvider({ children }: { children: ReactNode }) {
  const [preset, setPresetState] = useState<UniformPresetId>('classic');

  useEffect(() => {
    AsyncStorage.getItem(PRESET_KEY).then((v) => {
      // default/vintage 등 구 프리셋 → classic으로 정규화
      setPresetState(normalizePresetId(v));
    }).catch(() => {});
  }, []);

  const setPreset = useCallback(async (id: UniformPresetId) => {
    setPresetState(id);
    try { await AsyncStorage.setItem(PRESET_KEY, id); } catch {}
  }, []);

  return (
    <UniformPresetContext.Provider value={{ preset, setPreset }}>
      {children}
    </UniformPresetContext.Provider>
  );
}
