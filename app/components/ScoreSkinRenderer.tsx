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
    return (
      <ScoreboardScoreBadge
        score={score}
        variant={variant}
        teamColor={teamColor}
        showLabel={showLabel}
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
