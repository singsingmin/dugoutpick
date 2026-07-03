// Auth 스파이크 화면 — Phase 3 착수 리스크 게이트(phase3-account-design.md §9 Stage 0).
// 익명 sign-in → linkIdentity(보호) 왕복 + signInWithOAuth(복구) 실측용. 디버그 플래그로만 진입, 프로덕션 미노출.
// 검증 후 삭제 예정(throwaway). 인증 링킹은 linkIdentity 리다이렉트 경로만(ADR-023 결정 ④).
import { useEffect, useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import PixelText from '../components/PixelText';
import Panel from '../components/Panel';
import PixelButton from '../components/PixelButton';
import ScreenHeader from '../components/ScreenHeader';
import SectionLabel from '../components/SectionLabel';
import { colors, spacing } from '../theme';

WebBrowser.maybeCompleteAuthSession();
const redirectTo = makeRedirectUri();

type Provider = 'google' | 'kakao';

// OAuth redirect URL에서 토큰 파싱 → 세션 설정
async function sessionFromUrl(url: string): Promise<Session | null> {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) throw new Error(errorCode);
  const { access_token, refresh_token } = params;
  if (!access_token) return null;
  const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw error;
  return data.session;
}

export default function SpikeAuth() {
  const navigation = useNavigation();
  const [session, setSession] = useState<Session | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const append = useCallback(
    (m: string) => setLog((l) => [`${new Date().toLocaleTimeString()} · ${m}`, ...l].slice(0, 30)),
    [],
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      append(`authState: ${event}`);
    });
    return () => sub.subscription.unsubscribe();
  }, [append]);

  const anon = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      append('익명 sign-in ✅');
    } catch (e) {
      append(`익명 sign-in ❌ ${(e as Error).message}`);
    }
  }, [append]);

  const oauth = useCallback(
    async (mode: 'link' | 'signin', provider: Provider) => {
      try {
        const options = { redirectTo, skipBrowserRedirect: true } as const;
        const { data, error } =
          mode === 'link'
            ? await supabase.auth.linkIdentity({ provider, options })
            : await supabase.auth.signInWithOAuth({ provider, options });
        if (error) throw error;
        if (!data?.url) throw new Error('provider url 없음');
        const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (res.type !== 'success') {
          append(`${mode} ${provider}: ${res.type}`);
          return;
        }
        await sessionFromUrl(res.url);
        append(`${mode} ${provider} ✅`);
      } catch (e) {
        append(`${mode} ${provider} ❌ ${(e as Error).message}`);
      }
    },
    [append],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    append('signOut');
  }, [append]);

  const identities = session?.user?.identities?.map((i) => i.provider).join(', ') || '(없음)';

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Auth 스파이크" leftIcon="back" onLeftPress={() => navigation.goBack()} />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.section}>
            <SectionLabel label="현재 세션" />
            <Panel>
              <PixelText variant="caption" color={colors.textDim}>redirectTo</PixelText>
              <PixelText variant="body" style={styles.mono}>{redirectTo}</PixelText>
              <PixelText variant="caption" color={colors.textDim} style={styles.gap}>uid</PixelText>
              <PixelText variant="body" style={styles.mono}>{session?.user?.id ?? '(없음)'}</PixelText>
              <PixelText variant="caption" color={colors.textDim} style={styles.gap}>익명 여부 / identities</PixelText>
              <PixelText variant="body">
                {session ? String(session.user.is_anonymous) : '-'} / {identities}
              </PixelText>
            </Panel>
          </View>

          <View style={styles.section}>
            <SectionLabel label="① 익명 시작" />
            <PixelButton label="signInAnonymously()" onPress={() => { void anon(); }} />
          </View>

          <View style={styles.section}>
            <SectionLabel label="② 보호하기 (linkIdentity)" />
            <View style={styles.row}>
              <PixelButton label="link Kakao" onPress={() => { void oauth('link', 'kakao'); }} style={styles.btn} />
              <PixelButton label="link Google" onPress={() => { void oauth('link', 'google'); }} style={styles.btn} />
            </View>
          </View>

          <View style={styles.section}>
            <SectionLabel label="③ 복구하기 (signInWithOAuth)" />
            <View style={styles.row}>
              <PixelButton label="signin Kakao" onPress={() => { void oauth('signin', 'kakao'); }} style={styles.btn} />
              <PixelButton label="signin Google" onPress={() => { void oauth('signin', 'google'); }} style={styles.btn} />
            </View>
          </View>

          <View style={styles.section}>
            <PixelButton label="signOut" accentColor={colors.bad} onPress={() => { void signOut(); }} />
          </View>

          <View style={styles.section}>
            <SectionLabel label="로그" />
            <Panel>
              {log.length === 0 ? (
                <PixelText variant="caption" color={colors.textDim}>—</PixelText>
              ) : (
                log.map((l, i) => (
                  <PixelText key={i} variant="caption" color={colors.textDim}>{l}</PixelText>
                ))
              )}
            </Panel>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  content: { padding: spacing.md },
  section: { marginBottom: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.sm },
  btn: { flex: 1 },
  gap: { marginTop: spacing.sm },
  mono: { fontSize: 11 },
});
