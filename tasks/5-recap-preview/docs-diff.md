# docs-diff: recap-preview

Baseline: `fe9c6a0`

## `docs/data-schema.md`

```diff
diff --git a/docs/data-schema.md b/docs/data-schema.md
index b28d3e7..930aa4d 100644
--- a/docs/data-schema.md
+++ b/docs/data-schema.md
@@ -14,7 +14,10 @@
     "sampleSize": 23,              // 윈도우 내 실제 집계된 레코드 수
     "hitRate": 71,                 // 0~100 정수. verdict==='예측 적중' 비율(%)
     "bonusRate": 17,               // 0~100 정수. verdict==='기대 이상' 비율(%). hitRate와 별개(합산 금지)
-    "ready": true                  // sampleSize >= 10(MIN_SAMPLE)일 때만 true
+    "ready": true,                 // sampleSize >= 10(MIN_SAMPLE)일 때만 true
+    "recentRecapPreview": [        // 옵셔널. ready=false일 때만 존재 — 최근 최대 5경기의 frozen 예측·판정 배열(newest first). 선별 없음('기대 이하'도 포함). ready=true면 파이프라인이 이 필드를 생략함
+      { "pred": 78, "verdict": "기대 이상" }
+    ]
   },
   "recommendedGameId": "20260531LTNC0",     // 최고 꿀잼지수 경기, null 가능
   "games": [{
```
