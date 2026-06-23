# 오늘야구각 (DugoutPick)

KBO 경기를 **꿀잼지수(0~100)** 로 점수화해 "오늘 뭐 볼지" 골라주는 Expo(React Native + TypeScript) 앱.

- 앱: [`app/`](app/) — Expo RN. 실행/검증은 [`app/README.md`](app/README.md).
- 데이터 파이프라인: [`data-pipeline/`](data-pipeline/) — KBO 실데이터 → 정적 JSON(꿀잼지수 계산). GitHub Actions 자동 갱신.
- 설계 문서: [`docs/`](docs/) — [mission](docs/mission.md) · [spec](docs/spec.md) · [flow](docs/flow.md) · [data-schema](docs/data-schema.md) · [code-architecture](docs/code-architecture.md) · [adr](docs/adr.md) · [testing](docs/testing.md).

## 자율 주행 하네스 (cc-system)

이 레포에는 [greatSumini/cc-system](https://github.com/greatSumini/cc-system) 의 **자율 주행 하네스**가 이식되어 있다. "속도 최우선" 원칙([docs/mission.md](docs/mission.md))에 맞춰, 다음 요구사항 선정 → 구현 계획 → phase 단위 구현을 **사람 개입 없이 반복**하기 위한 것이다.

- **구성**: `.claude/skills/{ideation,plan-and-build,persuasion-review,commit}`, `.claude/agents/tech-critic-lead.md`, `scripts/{run-server,run-phases,gen-docs-diff,_utils}.py`, `prompts/task-create.md`. 컨텍스트는 `docs/`, 고객 시뮬은 `persuasion-data/`, 산출물은 `iterations/` · `tasks/` 에 쌓인다.
- **트리거(사람)**: 레포 루트에서 `py scripts/run-server.py` (Windows 기준; macOS/Linux는 `python3`). 이터레이션마다 ideation → commit → plan-and-build → check 를 돌고, 실패 시 직전 빌드로 rollback 한다. Ctrl-C 로 중단하면 다음 실행 때 N+1 이터레이션부터 이어진다.
- **Headless 신호**: `run-server.py` 가 spawn 하는 claude 서브세션에만 환경변수 **`HARNESS_HEADLESS=1`** 을 주입한다. SKILL.md 들은 이를 감지해 모든 사용자 확인/질문 단계를 자동 승인한다. **쉘에서 직접 export 하지 말 것** — 인터랙티브 세션까지 무인 모드로 잠긴다.
- **Windows 메모**: 하네스 스크립트는 cc-system upstream 기준 macOS 경로/인코딩 가정이 있어, 본 레포에서는 (1) `CLAUDE_BIN` 을 `shutil.which("claude")` 로 동적 해석(`claude.CMD`), (2) subprocess/파일 IO 를 UTF-8 로 고정해 한국어 콘솔(cp949)에서 깨지지 않도록 수정했다. 하네스 자체를 더 고치게 되면 upstream cc-system 에 PR 로 환류한다.
