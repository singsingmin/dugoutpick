import { Image } from 'react-native';

export type AppIconName =
  | 'baseball'
  | 'star'
  | 'chart'
  | 'settings'
  | 'clipboard'
  | 'back'
  | 'home'
  | 'fire'
  | 'search'
  | 'chat'
  | 'flag'
  | 'sparkles'
  | 'live'
  | 'versus'
  | 'calendar'
  | 'autumn'
  | 'lockerroom';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ICONS: Record<AppIconName, ReturnType<typeof require>> = {
  baseball:  require('../assets/icons/baseball.png'),
  star:      require('../assets/icons/star.png'),
  chart:     require('../assets/icons/chart.png'),
  settings:  require('../assets/icons/settings.png'),
  clipboard: require('../assets/icons/clipboard.png'),
  back:      require('../assets/icons/back.png'),
  home:      require('../assets/icons/home.png'),
  fire:      require('../assets/icons/fire.png'),
  search:    require('../assets/icons/search.png'),
  chat:      require('../assets/icons/chat.png'),
  flag:      require('../assets/icons/flag.png'),
  sparkles:  require('../assets/icons/sparkles.png'),
  live:      require('../assets/icons/live.png'),
  versus:    require('../assets/icons/versus.png'),
  calendar:  require('../assets/icons/calendar.png'),
  autumn:    require('../assets/icons/autumn.png'),
  lockerroom: require('../assets/icons/lockerroom.png'),
};

interface Props {
  name: AppIconName;
  size?: number;
  color?: string; // pixel art 아이콘은 자체 색상 유지 — color prop은 API 호환성용
}

export default function AppIcon({ name, size = 22 }: Props) {
  return <Image source={ICONS[name]} style={{ width: size, height: size }} />;
}
