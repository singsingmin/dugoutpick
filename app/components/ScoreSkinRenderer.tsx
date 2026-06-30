import { useScoreSkin } from '../context/ScoreSkin';
import { SCORE_SKINS } from '../utils/scoreSkinConfig';
import JerseyScoreBadge from './JerseyScoreBadge';
import ScoreboardScoreBadge from './ScoreboardScoreBadge';

interface Props {
  score: number;
  variant?: 'hero' | 'compact' | 'detail';
  teamColor?: string;
  showLabel?: boolean;
}

export default function ScoreSkinRenderer({ score, variant = 'hero', teamColor, showLabel = true }: Props) {
  const { skinId } = useScoreSkin();
  const config = SCORE_SKINS[skinId];

  if (config.kind === 'scoreboard') {
    // 라벨은 전광판 내부 헤더에 포함 — 외부 showLabel 무관
    return (
      <ScoreboardScoreBadge
        score={score}
        variant={variant}
        teamColor={teamColor}
      />
    );
  }

  return (
    <JerseyScoreBadge
      score={score}
      variant={variant}
      teamColor={teamColor}
      uniformPreset={config.uniformPreset}
      showLabel={showLabel}
    />
  );
}
