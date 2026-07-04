// Supabase 클라 싱글턴 (Phase 3 계정/DB, phase3-account-design.md §7).
// 세션 저장 = AsyncStorage(재시작 생존·재설치 소실). detectSessionInUrl=false(네이티브).
// URL/키는 app.config.js extra(← .env.local)에서 주입. anon(publishable) 키는 공개 안전, RLS가 보호.
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';

const url = (Constants.expoConfig?.extra?.supabaseUrl as string | undefined) ?? '';
const anonKey = (Constants.expoConfig?.extra?.supabaseAnonKey as string | undefined) ?? '';

// URL/키 미설정 시 createClient가 'supabaseUrl is required'로 import 시점에 throw →
// 앱 전체 화이트스크린(특히 CI 배포에 env 미주입 시). placeholder로 크래시만 막고,
// 실제 호출은 실패 → Auth가 '온라인 필요' 화면으로 우아하게 처리(진단은 아래 error 로그).
const configured = !!url && !!anonKey;
if (!configured) {
  console.error('[supabase] URL/anon key 미설정 — 로컬은 app/.env.local, 배포는 CI env(SUPABASE_URL·SUPABASE_ANON_KEY) 주입 필요');
}

export const supabase = createClient(
  url || 'https://unconfigured.supabase.co',
  anonKey || 'unconfigured',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
