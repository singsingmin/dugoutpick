// 온라인/오프라인 감지 (Phase 3 Stage 3-2, phase3-account-design.md §5).
// 민감 쓰기(구매·출석·피드백) 게이팅용. 기본값 낙관적(online) — 판정 전 UI 막지 않음.
// isInternetReachable는 초기 null 가능 → false만 오프라인으로 취급(null=online 낙관).
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

function isOnline(s: { isConnected: boolean | null; isInternetReachable: boolean | null }): boolean {
  // 웹: netinfo 도달성 probe가 `HEAD /`(status 200)로 판정하는데, GitHub Pages 프로젝트 사이트
  // (/dugoutpick/ 서브패스)에선 `/`가 origin 루트로 가 200이 안 나와 isInternetReachable가
  // false로 오판됨 → navigator.onLine(isConnected)만 신뢰. (offline 시 RPC 실패는 각 호출부가 처리)
  if (Platform.OS === 'web') return s.isConnected !== false;
  return s.isConnected !== false && s.isInternetReachable !== false;
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const unsub = NetInfo.addEventListener((s) => setOnline(isOnline(s)));
    void NetInfo.fetch().then((s) => setOnline(isOnline(s)));
    return () => unsub();
  }, []);
  return online;
}
