// 공용 토스트 — 하단 중앙 알약형 메시지. 화면마다 재구현되던 것을 통일(UX 폴리시 2026-07).
// 사용: const { message, showToast } = useToast();  … <Toast message={message} />
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import PixelText from './PixelText';
import { spacing } from '../theme';

export function useToast(duration = 1800) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const showToast = useCallback((msg: string) => {
    setMessage(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), duration);
  }, [duration]);
  return { message, showToast };
}

export default function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={styles.bubble}>
        <PixelText variant="caption" color="#fff">{message}</PixelText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 40, alignItems: 'center' },
  bubble: { backgroundColor: 'rgba(30,24,12,0.92)', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 999 },
});
