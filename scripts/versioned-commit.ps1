# Commit con prefijo EasyPanel:
#   [UI <ver>@<hash> · API <ver>@<hash>] <descripción>
# VERSION = producto (no nombre de rama).
# Uso (después de git add):
#   powershell -File scripts/versioned-commit.ps1 "feat: descripción"

param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$Message
)

$ErrorActionPreference = 'Stop'

function Get-AppRelease {
  $root = Split-Path -Parent $PSScriptRoot
  $versionFile = Join-Path $root 'VERSION'
  if (Test-Path $versionFile) {
    $v = (Get-Content $versionFile -Raw).Trim()
    if ($v) { return $v }
  }
  $appReleaseJs = Join-Path $root 'front\scripts\app-release.js'
  if (Test-Path $appReleaseJs) {
    $m = Select-String -Path $appReleaseJs -Pattern "APP_RELEASE\s*=\s*'([^']+)'" | Select-Object -First 1
    if ($m -and $m.Matches[0].Groups[1].Value) {
      return $m.Matches[0].Groups[1].Value
    }
  }
  throw 'No se pudo resolver la version de producto (VERSION o front/scripts/app-release.js).'
}

$staged = git diff --cached --name-only
if (-not $staged) {
  Write-Error 'No hay cambios en staging. Ejecuta git add antes.'
}

git commit -m $Message
$release = Get-AppRelease
$sha = git rev-parse --short HEAD
$versioned = "[UI $release@$sha · API $release@$sha] $Message"
git commit --amend -m $versioned
$deploySha = git rev-parse --short HEAD

Write-Host ""
Write-Host "Commit: $versioned"
Write-Host "Hash a pushear: $deploySha"
Write-Host "EasyPanel mostrará esa línea en Deployment History."
Write-Host "Badge de app (sin hash): UI $release · API $release"
