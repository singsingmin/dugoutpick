// 데이터 소스 환경 분기 단일 지점 (ADR-002).
// null  = 번들된 정적 JSON 사용 (개발/MVP 기본).
// 문자열 = 원격 베이스 URL. load.ts가 fetch + AsyncStorage 캐시(오프라인 시 캐시→번들 폴백).
// GitHub Actions가 하루 5회 data-pipeline/output/*.json을 갱신/커밋 → 아래 raw URL이 자동 최신화.
export const REMOTE_BASE_URL: string | null =
  'https://raw.githubusercontent.com/singsingmin/dugoutpick/main/data-pipeline/output';
