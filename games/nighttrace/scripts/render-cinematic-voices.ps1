[CmdletBinding()]
param(
  [switch]$Force,
  [switch]$DryRun,
  [string[]]$Scene = @()
)

$ErrorActionPreference = 'Stop'
$rendererPath = Join-Path $PSScriptRoot 'render-cinematic-voices.mjs'
$nodeArguments = @($rendererPath)

if ($Force) { $nodeArguments += '--force' }
if ($DryRun) { $nodeArguments += '--dry-run' }
foreach ($sceneId in $Scene) {
  if ([string]::IsNullOrWhiteSpace($sceneId)) {
    throw 'Scene ids cannot be empty.'
  }
  $nodeArguments += @('--scene', $sceneId)
}

$secureApiKey = $null
$plainApiKey = $null
$apiKeyPointer = [IntPtr]::Zero

try {
  if (-not $DryRun) {
    $secureApiKey = Read-Host 'Paste the temporary Google AI Studio API key' -AsSecureString
    if ($null -eq $secureApiKey) {
      throw 'No API key was entered.'
    }
    $apiKeyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureApiKey)
    $plainApiKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($apiKeyPointer)
    if ([string]::IsNullOrWhiteSpace($plainApiKey)) {
      throw 'No API key was entered.'
    }
    $env:GEMINI_API_KEY = $plainApiKey
  }

  & node @nodeArguments
  if ($LASTEXITCODE -ne 0) {
    throw "Cinematic voice generation exited with code $LASTEXITCODE. Completed clips remain reusable on the next run."
  }
}
finally {
  Remove-Item Env:GEMINI_API_KEY -ErrorAction SilentlyContinue
  $plainApiKey = $null
  $secureApiKey = $null
  if ($apiKeyPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($apiKeyPointer)
  }
}

if ($DryRun) {
  Write-Host 'Cinematic voice dry run complete. No key was requested or retained.'
}
else {
  Write-Host 'Cinematic voice pass complete. The Google key was not stored.'
}
