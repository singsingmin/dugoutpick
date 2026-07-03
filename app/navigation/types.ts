// 네비게이션 파라미터 타입 (flow.md와 1:1).
export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Tabs: undefined;
  GameDetail: { gameId: string };
  SkinSelect: undefined;
  BaseballCenter: undefined;
  Settings: undefined;
  SpikeAuth: undefined;   // Phase 3 Auth 스파이크(디버그 전용, 검증 후 삭제)
};

export type TabParamList = {
  Today: undefined;
  Standings: undefined;
  MyTeam: undefined;
  LockerRoom: undefined;
};

// 전역 navigation 타입 보강 (useNavigation 등에서 타입 추론).
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
