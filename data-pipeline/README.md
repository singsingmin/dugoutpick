# DugoutPick 데이터 파이프라인

서버 없이 KBO 실데이터를 정적 JSON으로 가공한다. GitHub Actions가 하루 5회 실행 → `output/*.json` 갱신 → 앱이 그 JSON만 fetch.

## 실행
```bash
node data-pipeline/build.mjs            # KST 오늘
node data-pipeline/build.mjs 20260531   # 특정 날짜
```
의존성 없음 (Node 20+ 내장 fetch만 사용).

## 데이터 소스 (전부 단순 HTTP, 브라우저 불필요)
| 데이터 | 소스 |
|---|---|
| 경기·선발투수·순위·점수·상태 | `POST ws/Main.asmx/GetKboGameList` (JSON) |
| 승률·게임차·최근10·연승연패 | `GET Record/TeamRank/TeamRankDaily.aspx` (HTML) |
| 투수 ERA | `GET Record/Player/PitcherBasic/Basic1.aspx` (HTML) |

## 산출물 (`output/`)
- `games.json` — 경기 목록 + 꿀잼지수/이유/관전포인트, `recommendedGameId`
- `standings.json` — 10팀 순위표
- `teams.json` — 구단 코드·팀명·대표색상 (온보딩용)

## 배포 (저장소 셋업 시 1회)
1. `git init` + GitHub 저장소 생성/푸시
2. Actions 자동 활성화 (워크플로 `.github/workflows/update-data.yml`)
3. 앱은 `output/*.json`을 raw URL 또는 GitHub Pages로 fetch
4. ⚠️ 비공식 엔드포인트 → 파서가 깨지면 앱은 마지막 커밋된 JSON 표시(안정성). 스크립트만 고치면 됨.
