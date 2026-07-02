# 로컬 안드로이드 APK 빌드 (Windows) — 한글 사용자명/경로 우회.
#
# 왜 필요: 이 PC는 사용자명이 한글(C:\Users\이상민)이라, 기본 Gradle 캐시(~/.gradle)와
# 임시폴더(AppData\Local\Temp)에 한글이 섞여 네이티브(CMake/prefab) 빌드가 깨진다.
# → 모든 경로를 ASCII로 리다이렉트한 뒤 빌드한다. (프로젝트 자체도 영문 경로 C:\dev\DugoutPick 에 있어야 함)
#
# 사용법:  powershell -ExecutionPolicy Bypass -File scripts\local-build.ps1
# 산출물:  바탕화면\dugoutpick-preview.apk  (릴리즈, debug 키 서명 → 사이드로드 가능)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent   # 프로젝트 루트 (scripts/의 부모)

# ── 모든 경로 ASCII 강제 ──
$env:JAVA_HOME       = "C:\Program Files\Android\Android Studio\jbr"   # Android Studio 번들 JDK(JBR)
$env:ANDROID_HOME    = "C:\tmp\androidsdk"
$env:ANDROID_SDK_ROOT = "C:\tmp\androidsdk"
$env:GRADLE_USER_HOME = "C:\gradle"        # 한글 사용자명 우회 (기본 ~/.gradle 대신)
$env:TMP = "C:\temp"; $env:TEMP = "C:\temp"
New-Item -ItemType Directory -Force "C:\gradle","C:\temp" | Out-Null

# ── android/ 없으면 prebuild ──
Set-Location "$root\app"
if (-not (Test-Path "$root\app\android")) {
  Write-Host "→ expo prebuild (android/ 생성)..."
  npx expo prebuild -p android --no-install
}
Set-Content "$root\app\android\local.properties" "sdk.dir=C:/tmp/androidsdk" -Encoding ascii

# ── 빌드 ──
Set-Location "$root\app\android"
Write-Host "→ gradlew assembleRelease (모든 경로 ASCII)..."
& .\gradlew.bat assembleRelease --no-daemon "-Dorg.gradle.jvmargs=-Djava.io.tmpdir=C:\temp -Xmx4g"
if ($LASTEXITCODE -ne 0) { Write-Error "빌드 실패 (exit $LASTEXITCODE)"; exit 1 }

# ── 산출물 바탕화면 복사 ──
$apk  = "$root\app\android\app\build\outputs\apk\release\app-release.apk"
$dest = "$env:USERPROFILE\Desktop\dugoutpick-preview.apk"
Copy-Item $apk $dest -Force
$mb = [math]::Round((Get-Item $dest).Length/1MB,1)
Write-Host "`n✅ 완료: $dest ($mb MB)"
