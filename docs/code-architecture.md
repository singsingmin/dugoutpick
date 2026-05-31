# Code Architecture

## 큰 그림
```
[GitHub Actions, 하루 5회]
  data-pipeline/build.mjs  ──생성──>  output/*.json  ──commit/push──> 저장소
                                                          │ fetch (raw URL/Pages)
[Expo 앱] <───────────────────────────────────────────────┘
  표시 전용. 꿀잼지수 재계산 X. 마지막 데이터 AsyncStorage 캐시(오프라인 생존).
```
핵심: 깨지기 쉬운 스크래핑을 앱에서 **분리**. 스크래퍼가 깨져도 앱은 캐시/마지막 커밋 JSON 표시 → 안정성. (배경: adr.md ADR-002/003)

## 디렉토리
```
DugoutPick/
├─ data-pipeline/          # 데이터 생성 (Node 20, 의존성 0)
│  ├─ build.mjs            # fetch→파싱→꿀잼지수→write. 진입점
│  ├─ teams.mjs            # 10구단 코드·팀명·색상 (단일 출처)
│  └─ output/*.json        # games/standings/teams (산출물)
├─ .github/workflows/update-data.yml  # 크론 자동 갱신
├─ app/                    # Expo RN 앱 (※ 아직 미생성)
├─ docs/                   # 본 문서들
└─ scripts/                # 설계 PoC(spike, honjam-v1~v3). 참고용, 런타임 무관
```

## 파이프라인 (data-pipeline/build.mjs)
- 입력: KBO 3개 엔드포인트(소스는 data-schema/README). 전부 단순 HTTP, 브라우저 불필요.
- 처리: 순위표→팀별 지표 맵 / 경기+선발 / 투수ERA맵 → `computeHonjam()`으로 점수·이유·관전포인트 생성.
- 꿀잼지수 로직은 **이 파일에 응집** (앱과 공유 안 함 — 앱은 결과만 소비). 공식 튜닝 시 앱 재배포 불필요.
- 실패 시 exit 1 → Actions가 커밋 안 함 → 앱은 직전 JSON 유지.

## 앱 (Expo / React Native + TypeScript) — 계획
| 영역 | 선택 | 비고 |
|---|---|---|
| 언어 | **TypeScript** | phase별 `tsc --noEmit` 검증 가능 (adr.md ADR-012). data-schema를 `types.ts`로 명문화 |
| 네비 | React Navigation: native-stack(Splash/Onboarding/GameDetail) + bottom-tabs(Today/MyTeam/Settings) | flow.md와 1:1 |
| 상태 | 응원팀 = AsyncStorage / 데이터 = 로드+캐시 | 전역 상태관리 라이브러리 불필요(소규모). React Context 정도면 충분 |
| 데이터 로딩 | dev=번들 JSON import, prod=원격 URL fetch + AsyncStorage 캐시 폴백 | 환경 분기 `data/config.ts` 1곳에 격리 |
| 테마 | 8비트 도트: 픽셀폰트 **Galmuri11**(expo-font 로드), 색·보더·간격을 토큰화한 `theme.ts` | 이미지 대신 CSS+아이콘 (adr.md ADR-009/013) |
| 팀 색상 | teams.json `color` | 배지·테두리 액센트 |

### 앱 폴더(예정)
```
app/
├─ App.tsx                 # 네비 루트 + 폰트 로드 + 응원팀 로드 분기
├─ theme.ts                # 8비트 디자인 토큰(색/폰트/보더/간격)
├─ types.ts                # data-schema의 TS 타입(Game/Standing/Team 등)
├─ screens/                # Splash, Onboarding, Today, GameDetail, MyTeam, Settings (.tsx)
├─ components/             # GameCard, HonjamBadge, TeamBadge, PixelText ...
├─ data/                   # config.ts(env분기), load.ts(번들/fetch+캐시), team.ts(AsyncStorage)
└─ assets/                 # Galmuri11.ttf, 번들 JSON(dev: games/standings/teams)
```

### Phase AC 전략 (디바이스 없이 검증)
- `npx tsc --noEmit` — 타입·문법 오류 0
- `npx expo export --platform ios` (또는 web) — JS 번들 성공 = import/해상도/구문 오류 0
- 헤드리스 환경에서 앱 "실행"은 검증하지 않음(디바이스 필요). 위 둘이 phase 합격 기준.

## 원칙
- 꿀잼지수 = 파이프라인 단일 출처. 앱·문서 어디서도 재구현 금지.
- teams는 `teams.mjs`/`teams.json` 단일 출처.
- 외부 의존 최소화(파이프라인 0개). 앱도 무거운 라이브러리 지양 → "에러 적고 빠른 완성" 원칙.
