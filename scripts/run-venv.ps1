$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$Venv = Join-Path $Root ".venv"

Set-Location $Root

if (-not (Test-Path -LiteralPath $Venv)) {
  $python = Get-Command py -ErrorAction SilentlyContinue
  if ($python) {
    & py -m venv $Venv
  } else {
    & python -m venv $Venv
  }
}

$env:VIRTUAL_ENV = $Venv
$env:Path = (Join-Path $Venv "Scripts") + ";" + $env:Path

if (-not (Test-Path -LiteralPath (Join-Path $Root "node_modules"))) {
  & npm.cmd install
} else {
  & node scripts/copy-web-ifc.mjs
}

& npm.cmd run dev
