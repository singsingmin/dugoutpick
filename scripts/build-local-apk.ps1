# 로컬 안드로이드 release APK 빌드 (EAS 쿼터 절약용).
# 툴체인: Android Studio JBR + C:\tmp\androidsdk. 한글 경로 CMake 이슈는 GRADLE_USER_HOME을
# 영문 경로로 돌려 우회. Supabase는 app/.env.local, 디버그툴은 EXPO_PUBLIC_DEBUG_TOOLS=1.
# 결과 APK: app/android/app/build/outputs/apk/release/app-release.apk (debug 키 서명 → 설치 가능).
$ErrorActionPreference = "Stop"
$root = "C:\dev\DugoutPick\app"

$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "C:\tmp\androidsdk"
$env:GRADLE_USER_HOME = "C:\tmp\gradle-home"
# ⚠️ TEMP를 영문 경로로 — prefab/CMake가 한글 사용자홈 TEMP(C:\Users\한글\...\Temp)에
#    스테이징하다 [CXX1429]로 깨짐. 영문 TEMP로 우회.
New-Item -ItemType Directory -Force -Path "C:\tmp\build-temp" | Out-Null
$env:TMP = "C:\tmp\build-temp"
$env:TEMP = "C:\tmp\build-temp"
$env:EXPO_PUBLIC_DEBUG_TOOLS = "1"
$env:EXPO_PUBLIC_BUILD_ID = (git -C $root rev-parse HEAD)

# app/.env.local 로드 (SUPABASE_URL·ANON_KEY)
Get-Content "$root\.env.local" | ForEach-Object {
  if ($_ -match '^\s*([^#=]+)=(.+)$') {
    Set-Item -Path ("env:" + $matches[1].Trim()) -Value $matches[2].Trim()
  }
}

Write-Host "buildId=$($env:EXPO_PUBLIC_BUILD_ID)  supabase=$([bool]$env:SUPABASE_URL)"
Set-Location "$root\android"
# 기존 데몬 정지(옛 한글 tmpdir 유지한 데몬 재사용 방지) + --no-daemon(새 JVM이 위 영문 TEMP 상속).
& .\gradlew.bat --stop
& .\gradlew.bat assembleRelease --no-daemon --console=plain
Write-Host "DONE exit=$LASTEXITCODE"
