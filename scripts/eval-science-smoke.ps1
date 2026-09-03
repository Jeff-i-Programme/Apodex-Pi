# Smoke: original Pi tests + science adapters. No model required.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..
npm test
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
python adapters/science/cli.py self-check
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
python adapters/science/cli.py dw-self-check
exit $LASTEXITCODE
