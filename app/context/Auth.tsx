// 인증 컨텍스트 (Phase 3 Stage 2·4) — 익명 sign-in + 세션 관리 + 소셜 보호/복구.
// 설계: docs/phase3-account-design.md §1·§2(F4~F6)·§7. 착수: ADR-023.
// 첫 실행 1회는 온라인 필요(익명 UID 생성). 이후 세션은 AsyncStorage에 유지돼 오프라인 생존.
// OAuth 메커니즘은 Stage 0 스파이크(SpikeAuth)에서 실기기 증명 → 여기로 정식 이관.
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { View, StyleSheet, Platform, Linking, AppState } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import PixelText from '../components/PixelText';
import PixelButton from '../components/PixelButton';
import { colors, spacing } from '../theme';

WebBrowser.maybeCompleteAuthSession();

// OAuth 리다이렉트 복귀 주소.
// 웹: makeRedirectUri(=Linking.createURL)는 origin만 반환(서브패스 /dugoutpick/ 누락) →
// Supabase 허용목록(.../dugoutpick/**)과 불일치 → Site URL(기본 localhost) 폴백 유발.
// → window.location.origin+pathname으로 배포 서브패스까지 포함해 직접 구성.
// 네이티브: 커스텀 스킴(dugoutpick://) — 스파이크에서 검증됨.
function getRedirectTo(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin + window.location.pathname;
  }
  return makeRedirectUri();
}

type AuthStatus = 'loading' | 'ready' | 'needs_online';

// 이미 다른 계정에 연결된 구글 → 연결(link) 실패. 이땐 "복구(전환)"를 제안.
function isConflictError(raw: string): boolean {
  return /already|exists|linked|in use/i.test(raw || '');
}
// 날것 에러(영문·기술) → 유저 친화 한글. 기술 메시지 노출 금지.
function friendlyAuthError(raw: string): string {
  const s = (raw || '').toLowerCase();
  if (/network|fetch|timeout|offline|connection/.test(s)) return '네트워크 연결을 확인하고 다시 시도해 주세요.';
  if (/cancel|dismiss|closed|abort/.test(s)) return '연결이 취소됐어요.';
  return '계정 연결에 실패했어요. 잠시 후 다시 시도해 주세요.';
}
// 리다이렉트 URL의 에러 파라미터(error_description·error) 추출(웹·네이티브 공통).
function authErrorFromUrl(url: string): string | null {
  const { params } = QueryParams.getQueryParams(url);
  return (params.error_description as string) || (params.error as string) || null;
}

interface AuthCtx {
  session: Session | null;
  userId: string | null;
  isAnonymous: boolean;   // 익명 유저(소셜 미연결)
  isProtected: boolean;   // 소셜 연결됨 → 재설치 복구 가능
  email: string | null;   // 연결된 소셜 이메일(있으면)
  authBusy: boolean;      // OAuth 리다이렉트 진행 중
  authError: string | null;    // 유저 친화 에러 메시지
  linkConflict: boolean;  // 연결하려는 구글이 이미 다른 계정 소유 → 복구(전환) 제안
  connectGoogle: () => Promise<void>;   // 단일 진입: 연결(linkIdentity). 충돌 시 linkConflict=true.
  recoverGoogle: () => Promise<void>;   // 충돌 모달에서 "불러오기": signInWithOAuth(서버 계정으로 전환)
  signOut: () => Promise<void>;
  clearAuthError: () => void;
  clearLinkConflict: () => void;
}

const Ctx = createContext<AuthCtx>({
  session: null, userId: null, isAnonymous: true, isProtected: false, email: null,
  authBusy: false, authError: null, linkConflict: false,
  connectGoogle: async () => {}, recoverGoogle: async () => {}, signOut: async () => {},
  clearAuthError: () => {}, clearLinkConflict: () => {},
});

export function useAuth() {
  return useContext(Ctx);
}

// OAuth 리다이렉트 URL에서 세션 완성(네이티브). PKCE(?code=) 우선, 구형 implicit(#access_token) 폴백.
async function sessionFromUrl(url: string): Promise<Session | null> {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  const errText = (params.error_description as string) || errorCode;
  if (errText) throw new Error(errText);
  const { code, access_token, refresh_token } = params;
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return data.session;
  }
  if (access_token) {
    const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) throw error;
    return data.session;
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [linkConflict, setLinkConflict] = useState(false);

  // OAuth 복귀 에러 라우팅: 이미 쓰는 구글이면 복구 제안(linkConflict), 그 외엔 친화 메시지.
  const routeAuthError = useCallback((raw: string) => {
    setAuthBusy(false);
    if (isConflictError(raw)) setLinkConflict(true);
    else setAuthError(friendlyAuthError(raw));
  }, []);

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
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (s) setStatus('ready');
      // 로그아웃 → 세션 없는 상태 방지: 즉시 새 익명 세션 확립(linkIdentity 등은 세션 필수).
      else if (event === 'SIGNED_OUT') void bootstrap();
    });
    return () => sub.subscription.unsubscribe();
  }, [bootstrap]);

  // OAuth 리다이렉트 복귀 처리(네이티브). 웹은 supabase detectSessionInUrl이 세션 자동 완성.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const handle = (url: string | null) => {
      if (!url) return;
      const err = authErrorFromUrl(url);
      if (err) { routeAuthError(err); return; }
      sessionFromUrl(url).catch((e) => routeAuthError((e as Error).message));
    };
    void Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => sub.remove();
  }, [routeAuthError]);

  // 웹: 리다이렉트 복귀 URL에 에러가 있으면(성공은 detectSessionInUrl 처리) 라우팅 + URL 정리.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const err = authErrorFromUrl(window.location.href);
    if (err) {
      routeAuthError(err);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [routeAuthError]);

  // 앱이 포그라운드로 복귀하면 busy 해제(브라우저 취소로 딥링크 없이 돌아온 경우 방지).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setAuthBusy(false);
    });
    return () => sub.remove();
  }, []);

  // 연결/복구 공통: 리다이렉트 개시. 완료·에러는 딥링크(네이티브)/detectSessionInUrl+URL(웹)로 비동기 반영.
  const runOAuth = useCallback(async (mode: 'link' | 'signin') => {
    setAuthError(null);
    setLinkConflict(false);
    setAuthBusy(true);
    try {
      const options = { redirectTo: getRedirectTo(), skipBrowserRedirect: true } as const;
      const { data, error } =
        mode === 'link'
          ? await supabase.auth.linkIdentity({ provider: 'google', options })
          : await supabase.auth.signInWithOAuth({ provider: 'google', options });
      if (error) throw error;
      if (!data?.url) throw new Error('인증 URL을 받지 못했어요');
      if (Platform.OS === 'web') {
        window.location.assign(data.url);   // 페이지 이동 → 복귀 시 detectSessionInUrl이 세션 완성
      } else {
        await Linking.openURL(data.url);     // 시스템 브라우저(카톡 바운스 견고) → 딥링크가 완성
      }
    } catch (e) {
      routeAuthError((e as Error).message);
    }
  }, [routeAuthError]);

  const connectGoogle = useCallback(() => runOAuth('link'), [runOAuth]);   // 기본: 연결(보호)
  const recoverGoogle = useCallback(() => runOAuth('signin'), [runOAuth]); // 충돌 시 전환(복구)
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setAuthError(null);
    setLinkConflict(false);
  }, []);
  const clearAuthError = useCallback(() => setAuthError(null), []);
  const clearLinkConflict = useCallback(() => setLinkConflict(false), []);

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
        email: user?.email ?? null,
        authBusy,
        authError,
        linkConflict,
        connectGoogle,
        recoverGoogle,
        signOut,
        clearAuthError,
        clearLinkConflict,
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
