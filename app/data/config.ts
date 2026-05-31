// 데이터 소스 환경 분기 단일 지점 (ADR-002).
// null  = 번들된 정적 JSON 사용 (개발/MVP 기본).
// 문자열 = 원격 베이스 URL. 배포 시 파이프라인 산출 JSON이 호스팅된 곳을 주입
//          (예: GitHub Pages / raw URL). 이 경우 load.ts가 fetch+캐시한다.
export const REMOTE_BASE_URL: string | null = null;
