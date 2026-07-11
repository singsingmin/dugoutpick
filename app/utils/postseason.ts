// 포스트시즌 내 팀 상태 도출(클라). 파이프라인 data-pipeline/postseason.mjs 의 myTeamStatus 와 동일 로직.
// (앱은 파이프라인 모듈을 import 못 해 소규모 재구현 — 변경 시 양쪽 동기화. 설계 docs/postseason-plan.md §4)
import type { BracketRound } from '../types';

export type MyTeamPostseasonState = '진출실패' | '대기' | '진행중' | '탈락' | '우승';
export interface MyTeamPostseasonStatus {
  state: MyTeamPostseasonState;
  roundName?: string; // 관련 라운드명
}

export function myTeamPostseasonStatus(bracket: BracketRound[], myCode: string | null): MyTeamPostseasonStatus {
  if (!myCode) return { state: '진출실패' };
  const participates = bracket.some((r) => r.high === myCode || r.low === myCode);
  if (!participates) return { state: '진출실패' };
  for (const r of bracket) {
    if (r.high !== myCode && r.low !== myCode) continue;
    if (r.status === 'active') return { state: '진행중', roundName: r.roundName };
    if (r.status === 'upcoming') return { state: '대기', roundName: r.roundName };
    if (r.status === 'done') {
      if (r.winner === myCode) {
        if (r.round === 'KS') return { state: '우승', roundName: r.roundName };
        continue; // 다음 라운드 슬롯에서 다시 잡힘
      }
      return { state: '탈락', roundName: r.roundName };
    }
  }
  return { state: '대기' };
}

// 상태별 표시 문구. teamName: 내 팀 표시명.
export function myTeamStatusCopy(status: MyTeamPostseasonStatus, teamName: string): { title: string; sub: string; icon: 'autumn' | 'fire' | 'star' } {
  const rn = status.roundName ?? '가을야구';
  switch (status.state) {
    case '우승':
      return { title: `🏆 ${teamName} 우승!`, sub: '한국시리즈 정상에 올랐어요', icon: 'star' };
    case '진행중':
      return { title: `${teamName} ${rn} 진행 중`, sub: '지금이 가을야구의 한복판', icon: 'fire' };
    case '대기':
      return { title: `${teamName} ${rn} 대기 중`, sub: '상대 확정을 기다리는 중', icon: 'autumn' };
    case '탈락':
      return { title: `${teamName} 가을야구 종료`, sub: `${rn}에서 아쉽게 탈락했어요`, icon: 'autumn' };
    case '진출실패':
    default:
      return { title: `${teamName} 올해 가을야구는 다음 기회에`, sub: '내년 시즌을 기약해요', icon: 'autumn' };
  }
}
