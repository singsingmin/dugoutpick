# Phase 0: frag-patterns

## 사전 준비

아래 범위만 읽어라:

- `data-pipeline/build.mjs` L165-255 (`strength`, `playoffRel`, `aceness`, `W` 상수, `computeHonjam` 내 `parts`·`frag` 블록 전체)

이전 phase 없음 (첫 번째이자 마지막 phase).

## 작업 내용

`data-pipeline/build.mjs`의 `computeHonjam()` 함수 내 `frag` 블록 **4곳**만 수정한다. 새 파일 생성 없음, 새 API fetch 없음, 기존 변수(streak, gb, rank, l10, ERA, h2hRec)만 사용.

---

### 1. `frag.form` 확장 (현재 L216)

**현재**: streak ≤ -5 / streak ≥ 3 / 그 외(`양 팀 최근 10경기 합 X승의 화력`) 3분기.

**변경**: 아래 우선순위 순서로 단일 if-else 체인으로 교체.

```
sp[1] <= -5  → 기존 문구 유지: "${sp[0]} ${-sp[1]}연패 탈출 도전"
sp[1] <= -3  → (경량 연패) "${sp[0]} ${-sp[1]}연패 탈출 발판"
sp[1] >= 5   → (장기 연승) "${sp[0]} ${sp[1]}연승 질주, 기세 절정"
sp[1] >= 3   → 기존 문구 유지: "${sp[0]} ${sp[1]}연승 질주"
폴백 분기 (totalL10 = a.l10 + h.l10):
  totalL10 >= 15 → "양 팀 최근 10경기 합 ${totalL10}승, 화력 최고조"
  totalL10 <= 7  → "양 팀 동반 슬럼프, 승기 선점 싸움"
  그 외           → "최근 10경기 ${aw} ${a.l10}승 · ${hm} ${h.l10}승"
```

`sp`는 기존 코드(`Math.abs(a.streak) >= Math.abs(h.streak) ? [aw, a.streak] : [hm, h.streak]`)를 그대로 사용한다.

---

### 2. `frag.playoff` 세분화 (현재 L218)

**현재**: rank ≥ 7 → "N위권 PO 생존 경쟁" / else → "가을야구 직행 순위 다툼".

**변경**: 아래 우선순위 순서로 교체.

```
a.rank >= 7 || h.rank >= 7   → "${Math.max(a.rank, h.rank)}위권 PO 생존 경쟁"
min(rank) >= 5 && abs(rankDiff) <= 1  → "${a.rank}위·${h.rank}위 와일드카드 판가름"
else                                   → "가을야구 직행 순위 다툼"
```

- `rankDiff = a.rank - h.rank` (부호 무관, abs 사용)
- 첫 번째 조건(rank ≥ 7)이 우선이므로 rank 7+ 팀이 있으면 무조건 PO 생존 경쟁.
- 두 번째 조건은 두 팀 모두 5-7위이고 순위 차이 1 이내인 경우만.

---

### 3. `frag.pitcher` 강화 (현재 L220)

**현재**: ERA < 3.6 양 팀 에이스 투수전 / bestERA < 3.6 호투 기대 / else ''.

**변경**: ERA < 2.5 케이스를 **가장 먼저** 처리.

```
bestERA < 2.5  → "${bestNM} ERA ${bestERA} 압도적 에이스 등판"
aERA < 3.6 && hERA < 3.6  → 기존: "양 팀 에이스 투수전(ERA ${aERA}·${hERA})"
bestERA < 3.6  → 기존: "${bestNM}(ERA ${bestERA}) 호투 기대"
else           → ''
```

`bestNM`, `bestERA`는 기존 코드(`aERA <= hERA ? aPit : hPit`, `Math.min(aERA, hERA)`)를 그대로 사용한다.

---

### 4. `frag.quality` — 변경 없음

현재 `max(rank) <= 4 → 상위권 빅매치 / else ''` 유지. 5-7위 중위권은 frag.playoff가 커버한다.

---

## Acceptance Criteria

```bash
# 1. 문법 체크 (네트워크 불필요)
node --check data-pipeline/build.mjs

# 2. 빌드 실행 (KBO API 필요 — 실패 시 exit 1은 정상 방어)
node data-pipeline/build.mjs

# 3. 이유 문구 다양성 spot-check
node -e "
const d = JSON.parse(require('fs').readFileSync('data-pipeline/output/games.json', 'utf8'));
const games = d.games.filter(g => g.honjam && g.honjam.reason);
console.log('이유 문구 목록:');
games.forEach(g => console.log(' -', g.honjam.reason));
if (games.length > 1) {
  const uniq = new Set(games.map(g => g.honjam.reason));
  if (uniq.size < 2) throw new Error('이유 문구 다양성 부족: 모두 동일');
  console.log('✓ 다양성 확인:', uniq.size, '종류 /', games.length, '경기');
} else {
  console.log('경기 1개 이하 — 다양성 검사 스킵');
}
"
```

## AC 검증 방법

위 3단계를 순서대로 실행하라.
- 1번 통과 + 2번 exit 0 + 3번 에러 없음이면 통과.
- 2번이 네트워크 문제로 exit 1이면 "네트워크 실패"로 기록하고 1번만 통과해도 `"completed"`로 마킹해도 된다(파이프라인 정상 방어 동작).

통과 후 `tasks/3-reason-diversity/index.json`의 phase 0 status를 `"completed"`로 변경하라.
3회 시도 후에도 문법/로직 오류로 실패하면 `"error"`로 변경하고 `error_message`를 기록하라.

## 주의사항

- `frag.quality`는 건드리지 마라 — 5-7위 중위권 커버는 frag.playoff 변경으로 충분하다.
- 새 변수(`totalL10` 등)는 frag 블록 직전에 선언하면 되고, 기존 `computeHonjam` 스코프 변수(`a`, `h`, `aw`, `hm`, `aERA`, `hERA`, `aPit`, `hPit`)를 그대로 활용하라.
- 기존 doom/rivalry 로직(L221-231 reason 조립부)은 건드리지 마라 — frag만 수정하면 reason 조립은 자동으로 새 문구를 집어간다.
- `data-pipeline/output/*.json`은 Actions가 관리하므로 직접 커밋하지 마라(push 충돌 유발).
- 기존 테스트(`data-pipeline/test/recap-history.test.mjs`)를 깨뜨리지 마라.
