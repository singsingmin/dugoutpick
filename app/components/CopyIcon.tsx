// 복사(두 장 겹친 시트) 아이콘 — 추천코드 복사 버튼용. 앞 시트를 배경색으로 채워 겹침을 가림.
import Svg, { Rect } from 'react-native-svg';

export default function CopyIcon({ size = 24, color, bg }: { size?: number; color: string; bg: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={8} y={3} width={13} height={13} rx={2.5} stroke={color} strokeWidth={2} fill={bg} />
      <Rect x={3} y={8} width={13} height={13} rx={2.5} stroke={color} strokeWidth={2} fill={bg} />
    </Svg>
  );
}
