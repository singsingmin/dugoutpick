import { View } from 'react-native';
import { useScoreSkin } from '../context/ScoreSkin';
import { getScoreSkinById, resolveJerseyColor, resolveJerseyNumberMode, resolveUniformOverride } from '../utils/scoreSkinConfig';
import JerseyScoreBadge from './JerseyScoreBadge';
import ScoreboardScoreBadge from './ScoreboardScoreBadge';
import ImageFrameScoreBadge from './ImageFrameScoreBadge';

interface Props {
  score: number;
  variant?: 'hero' | 'compact' | 'detail';
  teamColor?: string;
  showLabel?: boolean;
}

// 외부 소비처(GameCard/LiveCard/GameDetail 등)는 selectedSkinId만 신경씀 —
// 여기서 kind(jersey/asset)에 따라 분기. jersey는 팔레트 실효색을 계산해 넘긴다.
export default function ScoreSkinRenderer({ score, variant = 'hero', teamColor, showLabel = true }: Props) {
  const { skinId } = useScoreSkin();
  const skin = getScoreSkinById(skinId);

  // 점수 배지는 스킨에 따라 이미지/도트로 렌더 → 스크린리더가 숫자를 못 읽음.
  // 래퍼에 a11y 라벨을 달아 "꿀잼지수 N점"으로 읽히게 함(모양·레이아웃 변화 없음).
  let badge;
  if (skin.kind === 'asset') {
    // 라벨은 에셋 내부에 포함 — 외부 showLabel 무관. renderType별 렌더러 분기.
    badge = skin.renderType === 'imageFrame'
      ? <ImageFrameScoreBadge score={score} variant={variant} assetKey={skin.assetKey} />
      : <ScoreboardScoreBadge score={score} variant={variant} teamColor={teamColor} />;
  } else {
    badge = (
      <JerseyScoreBadge
        score={score}
        variant={variant}
        teamColor={resolveJerseyColor(skin, teamColor)}
        uniformPreset={skin.styleId}
        showLabel={showLabel}
        numberMode={resolveJerseyNumberMode(skin)}
        colorOverride={resolveUniformOverride(skin)}
      />
    );
  }

  return (
    <View accessible accessibilityLabel={`꿀잼지수 ${score}점`}>
      {badge}
    </View>
  );
}
