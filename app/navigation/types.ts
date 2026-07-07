// 네비게이션 파라미터 타입 (flow.md와 1:1).
export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Tabs: undefined;
  GameDetail: { gameId: string };
  SkinSelect: undefined;
  BaseballCenter: undefined;
  PredictionLeague: undefined;
  TitleList: undefined;
  BackgroundShop: undefined;
  HallOfFame: undefined;
  Settings: undefined;
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
