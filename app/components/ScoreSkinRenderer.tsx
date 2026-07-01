import { useScoreSkin } from '../context/ScoreSkin';
import { getScoreSkinById, resolveJerseyColor, resolveJerseyNumberMode } from '../utils/scoreSkinConfig';
import JerseyScoreBadge from './JerseyScoreBadge';
import ScoreboardScoreBadge from './ScoreboardScoreBadge';

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

  if (skin.kind === 'asset') {
    // 현재 renderType은 scoreboard만. 라벨은 에셋 내부 포함 — 외부 showLabel 무관.
    return <ScoreboardScoreBadge score={score} variant={variant} teamColor={teamColor} />;
  }

  return (
    <JerseyScoreBadge
      score={score}
      variant={variant}
      teamColor={resolveJerseyColor(skin, teamColor)}
      uniformPreset={skin.styleId}
      showLabel={showLabel}
      numberMode={resolveJerseyNumberMode(skin)}
    />
  );
}
