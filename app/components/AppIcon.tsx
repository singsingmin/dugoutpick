import { MaterialCommunityIcons } from '@expo/vector-icons';
import type React from 'react';

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
  | 'calendar';

type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const ICON_MAP: Record<AppIconName, MCIName> = {
  baseball: 'baseball',
  star: 'star',
  chart: 'poll',
  settings: 'cog',
  clipboard: 'clipboard-text',
  back: 'arrow-left',
  home: 'home',
  fire: 'fire',
  search: 'magnify',
  chat: 'chat',
  flag: 'flag-checkered',
  sparkles: 'telescope',
  live: 'record-circle',
  versus: 'sword-cross',
  calendar: 'calendar',
};

interface Props {
  name: AppIconName;
  size?: number;
  color?: string;
}

export default function AppIcon({ name, size = 18, color = '#000' }: Props) {
  return <MaterialCommunityIcons name={ICON_MAP[name]} size={size} color={color} />;
}
