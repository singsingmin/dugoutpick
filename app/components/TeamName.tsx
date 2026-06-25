// 팀명을 팀 대표색 텍스트로 표시 (목업 스타일). code로 teams.json 조회.
import PixelText from './PixelText';
import { loadTeams } from '../data/load';
import { colors } from '../theme';

const TEAMS = loadTeams().teams;

interface Props {
  code: string;
  variant?: 'body' | 'title' | 'hero';
}

export default function TeamName({ code, variant = 'body' }: Props) {
  const team = TEAMS.find((t) => t.code === code);
  return (
    <PixelText variant={variant} color={team?.color ?? colors.text} numberOfLines={1}>
      {team?.name ?? code}
    </PixelText>
  );
}
