# Crea commit con prefijo [rama@hash] visible en EasyPanel Deploy History.
# Uso (después de git add):
#   powershell -File scripts/versioned-commit.ps1 "fix(front): descripción"

param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$Message
)

$ErrorActionPreference = 'Stop'

$staged = git diff --cached --name-only
if (-not $staged) {
  Write-Error 'No hay cambios en staging. Ejecuta git add antes.'
}

git commit -m $Message
$branch = git rev-parse --abbrev-ref HEAD
$sha = git rev-parse --short HEAD
$versioned = "[$branch@$sha] $Message"
git commit --amend -m $versioned
$deploySha = git rev-parse --short HEAD

Write-Host ""
Write-Host "Commit: $versioned"
Write-Host "Hash a pushear: $deploySha"
Write-Host "EasyPanel mostrará esa línea en Deployment History."
