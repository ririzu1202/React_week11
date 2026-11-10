# 공통 테스트(v3)를 정혁 구현에 연결해 실행한다 (run-tests.bat 이 부른다)
#   .\run-tests.ps1                       → 구현 폴더 자동 선택 (바탕화면 mini-react → mini-react_powershell), 실행 범위 묻기
#   .\run-tests.ps1 "<구현 폴더>" -Mode 1   → 전체 (기능 56 + 판정기 14 + 검사 정확도 8)
#   .\run-tests.ps1 "<구현 폴더>" -Mode 2   → 검사 정확도만 (판정기 14 + 검사 정확도 8)
[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [string]$ProjectFolder,

  [ValidateSet('1', '2')]
  [string]$Mode
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$testRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$desktop = [Environment]::GetFolderPath('Desktop')

# 1. 구현 폴더
if (-not $ProjectFolder) {
  $ProjectFolder = @('mini-react', 'mini-react_powershell') |
    ForEach-Object { Join-Path $desktop $_ } |
    Where-Object { Test-Path -LiteralPath $_ } |
    Select-Object -First 1
  if (-not $ProjectFolder) { throw "구현 폴더를 찾지 못했습니다. 바탕화면에 mini-react 또는 mini-react_powershell 이 없으면 경로를 직접 입력하세요." }
  Write-Host "구현 폴더 (자동 선택) : $ProjectFolder"
}
$projectRoot = (Resolve-Path -LiteralPath $ProjectFolder).Path

foreach ($relativePath in @('src/phase1/dom-to-vdom.ts', 'src/phase1/diff.ts', 'src/phase1/patch.ts', 'src/app/lab-page.ts')) {
  if (-not (Test-Path -LiteralPath (Join-Path $projectRoot $relativePath))) {
    throw "프로젝트 파일을 찾지 못했습니다: $relativePath ($projectRoot)"
  }
}

# 2. 실행 범위
if (-not $Mode) {
  Write-Host '실행할 테스트를 선택하세요:'
  Write-Host '1. 전체 테스트 (기능 56개 + 판정기 14개 + 검사 정확도 8개)'
  Write-Host '2. 검사 정확도 테스트만 (판정기 14개 + 검사 정확도 8개)'
  do { $Mode = Read-Host '번호 입력 (1 또는 2)' } until ($Mode -in @('1', '2'))
}

# 3. Adapter · jsdom
$adapterPath = Join-Path $testRoot 'adapters/jeonghyeok.js'
if (-not (Test-Path -LiteralPath $adapterPath)) {
  throw "정혁 어댑터를 찾지 못했습니다: $adapterPath"
}
if (-not (Test-Path -LiteralPath (Join-Path $testRoot 'node_modules/jsdom/package.json'))) {
  Write-Host 'jsdom 이 없어 npm install 을 먼저 실행합니다...'
  Push-Location -LiteralPath $testRoot
  try { npm install --silent } finally { Pop-Location }
  if ($LASTEXITCODE -ne 0) { throw "npm install 이 실패했습니다 (exit code $LASTEXITCODE)." }
}

# 4. 실행
$previousAdapter = $env:ADAPTER
$previousMiniReactRoot = $env:MINI_REACT_ROOT
$exitCode = 1
$locationPushed = $false

try {
  $env:ADAPTER = $adapterPath
  $env:MINI_REACT_ROOT = $projectRoot
  Push-Location -LiteralPath $testRoot
  $locationPushed = $true
  Write-Host ''
  Write-Host "테스트 폴더 : $testRoot"
  Write-Host "구현 폴더   : $projectRoot"
  Write-Host ''
  if ($Mode -eq '1') {
    npm test
  } else {
    npm run test:inspection
  }
  $exitCode = $LASTEXITCODE
} finally {
  if ($locationPushed) { Pop-Location }
  $env:ADAPTER = $previousAdapter
  $env:MINI_REACT_ROOT = $previousMiniReactRoot
}

Write-Host ''
if ($exitCode -eq 0) {
  Write-Host '결과 : 모두 통과 (fail 0)' -ForegroundColor Green
} else {
  Write-Host "결과 : 실패가 있습니다 (exit code $exitCode). 위의 ✖ 줄을 확인하세요." -ForegroundColor Red
}
exit $exitCode
