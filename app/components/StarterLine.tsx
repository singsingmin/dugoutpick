// 선발투수 한 줄: ⚾ 원정선발 vs 홈선발. 오늘경기 탭 카드 공용(리스트/히어로/결산/라이브).
// 양쪽 다 미등록이면 줄 자체를 숨겨(null) 빈 줄이 생기지 않게 한다. 한쪽만 미등록이면 '미정'.
import type { TextStyle, StyleProp } from 'react-native';
import type { Game } from '../types';
import PixelText from './PixelText';
import { colors } from '../theme';

export default function StarterLine({ game, style }: { game: Game; style?: StyleProp<TextStyle> }) {
  const a = game.away.starter?.name;
  const h = game.home.starter?.name;
  if (!a && !h) return null;
  return (
    <PixelText variant="caption" color={colors.textDim} numberOfLines={1} style={style}>
      ⚾ {a ?? '미정'} vs {h ?? '미정'}
    </PixelText>
  );
}
