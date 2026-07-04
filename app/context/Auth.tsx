// 인증 컨텍스트 (Phase 3 Stage 2) — 첫 실행 익명 sign-in + 세션 관리 + 온라인 게이트.
// 설계: docs/phase3-account-design.md §1·§7. 착수: ADR-023.
// 첫 실행 1회는 온라인 필요(익명 UID 생성). 이후 세션은 AsyncStorage에 유지돼 오프라인 생존.
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import PixelText from '../components/PixelText';
import PixelButton from '../components/PixelButton';
import { colors, spacing } from '../theme';

type AuthStatus = 'loading' | 'ready' | 'needs_online';

interface AuthCtx {
  session: Session | null;
  userId: string | null;
  isAnonymous: boolean;   // 익명 유저(소셜 미연결)
  isProtected: boolean;   // 소셜 연결됨 → 재설치 복구 가능
}

const Ctx = createContext<AuthCtx>({ session: null, userId: null, isAnonymous: true, isProtected: false });

export function useAuth() {
  return useContext(Ctx);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  // 세션 확보: 있으면 사용, 없으면(첫 실행) 익명 sign-in(온라인 필요).
  const bootstrap = useCallback(async () => {
    setStatus('loading');
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setSession(data.session);
        setStatus('ready');
        return;
      }
      const { data: anon, error } = await supabase.auth.signInAnonymously();
      if (error || !anon.session) {
        setStatus('needs_online');
        return;
      }
      setSession(anon.session);
      setStatus('ready');
    } catch {
      setStatus('needs_online');
    }
  }, []);

  useEffect(() => {
    void bootstrap();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) setStatus('ready');
    });
    return () => sub.subscription.unsubscribe();
  }, [bootstrap]);

  // 첫 실행 온라인 게이트
  if (status === 'needs_online') {
    return (
      <View style={styles.center}>
        <PixelText variant="title">인터넷 연결이 필요해요</PixelText>
        <PixelText variant="body" color={colors.textDim} style={styles.msg}>
          첫 실행에는 계정 생성을 위해 인터넷이 필요해요.{'\n'}연결 후 다시 시도해 주세요.
        </PixelText>
        <PixelButton label="다시 시도" onPress={() => { void bootstrap(); }} style={styles.retry} />
      </View>
    );
  }

  // 세션 확보 중(짧은 순간) — 크림 배경 유지
  if (status === 'loading') {
    return <View style={styles.center} />;
  }

  const user = session?.user ?? null;
  return (
    <Ctx.Provider
      value={{
        session,
        userId: user?.id ?? null,
        isAnonymous: user?.is_anonymous ?? true,
        isProtected: !!user && !user.is_anonymous,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: spacing.xl },
  msg: { marginTop: spacing.md, textAlign: 'center', lineHeight: 20 },
  retry: { marginTop: spacing.lg, minWidth: 160 },
});
