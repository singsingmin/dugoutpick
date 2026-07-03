// Supabase 클라 싱글턴 (Phase 3 계정/DB, phase3-account-design.md §7).
// 세션 저장 = AsyncStorage(재시작 생존·재설치 소실). detectSessionInUrl=false(네이티브).
// URL/키는 app.config.js extra(← .env.local)에서 주입. anon(publishable) 키는 공개 안전, RLS가 보호.
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';

const url = (Constants.expoConfig?.extra?.supabaseUrl as string | undefined) ?? '';
const anonKey = (Constants.expoConfig?.extra?.supabaseAnonKey as string | undefined) ?? '';

if (!url || !anonKey) {
  // 개발 편의용 경고(스파이크 단계). 미설정 시 app/.env.local 확인.
  console.warn('[supabase] URL/anon key 미설정 — app/.env.local 확인');
}

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
