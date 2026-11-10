# 일부러 틀린 구현마다 공통 테스트 전체를 돌려, 어떤 테스트가 결함을 잡는지 보여 준다 (run.sh 의 PowerShell 판 · 정혁 구현용)
# 결함은 inspection-mutant-adapter.js 의 MUTANT_KIND 를 그대로 쓴다. 판정은 하지 않고 보여 주기만 한다 (자동 판정은 IA)
#   .\selfcheck\run-mutants.ps1                    → Adapter = adapters\jeonghyeok.js
#   .\selfcheck\run-mutants.ps1 -Adapter <경로>     → 다른 Adapter
[CmdletBinding()]
param([string]$Adapter)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if (-not $Adapter) { $Adapter = Join-Path $root 'adapters\jeonghyeok.js' }
$Adapter = (Resolve-Path -LiteralPath $Adapter).Path

$kinds = @(
  @{ kind = 'baseline';           note = '결함 없음 (기준선, 0 이어야 함)' },
  @{ kind = 'noop-update';        note = 'update 가 아무것도 안 함' },
  @{ kind = 'full-rerender';      note = '결과는 같고 노드를 전부 새로 만듦' },
  @{ kind = 'mutate-on-read';     note = '읽는 중 원본 DOM 에 속성을 붙임' },
  @{ kind = 'noop-patch-button';  note = 'Patch 버튼 클릭을 막음' },
  @{ kind = 'noop-back-button';   note = '뒤로가기 클릭을 막음' },
  @{ kind = 'property-only-form'; note = '정상 변형 : 폼 값을 프로퍼티로만 (필수는 0 이어야 함)' }
)

$saved = @{ ADAPTER = $env:ADAPTER; BASE_ADAPTER = $env:BASE_ADAPTER; MUTANT_KIND = $env:MUTANT_KIND }
Push-Location -LiteralPath $root
try {
  Write-Host "Adapter : $Adapter"
  Write-Host ''
  foreach ($k in $kinds) {
    $env:ADAPTER = Join-Path $root 'selfcheck\inspection-mutant-adapter.js'
    $env:BASE_ADAPTER = $Adapter
    $env:MUTANT_KIND = $k.kind
    $out = & node --test --test-reporter=tap tests/module.test.js tests/page.test.js 2>&1 | Out-String
    $failed = [regex]::Matches($out, '(?m)^\s*not ok \d+ - \[([A-Z]+-\d+)\]') | ForEach-Object { $_.Groups[1].Value }
    $failed = @($failed | Select-Object -Unique)
    $count = if ($failed.Count) { $failed.Count } else { 0 }
    $list = if ($count) { $failed -join ' ' } else { '-' }
    Write-Host ('{0,-20} 실패 {1,2}개 : {2}' -f $k.kind, $count, $list)
    Write-Host ('{0,-20} └ {1}' -f '', $k.note) -ForegroundColor DarkGray
  }
} finally {
  Pop-Location
  foreach ($name in $saved.Keys) { Set-Item -Path "Env:$name" -Value $saved[$name] -ErrorAction SilentlyContinue; if ($null -eq $saved[$name]) { Remove-Item "Env:$name" -ErrorAction SilentlyContinue } }
}
