[CmdletBinding()]
param(
  [ValidateSet('Submit', 'Status', 'Resume', 'Watch', 'Review', 'DryRun')]
  [string]$Mode = 'Submit'
)

$ErrorActionPreference = 'Stop'
$rendererPath = Join-Path $PSScriptRoot 'render-cinematic-voices-batch.mjs'
$projectRoot = Split-Path $PSScriptRoot -Parent
$runnerStatusDirectory = Join-Path $projectRoot '.cinematic-voice-batch'
$runnerStatusPath = Join-Path $runnerStatusDirectory 'runner-status.json'
$nodeArguments = @($rendererPath)

function Write-RunnerStatus {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Status,
    [string]$Message = ''
  )

  New-Item -ItemType Directory -Path $runnerStatusDirectory -Force | Out-Null
  $payload = [ordered]@{
    status = $Status
    mode = $Mode
    message = $Message
    processId = $PID
    updatedAt = (Get-Date).ToUniversalTime().ToString('o')
  }
  $payload | ConvertTo-Json | Set-Content -LiteralPath $runnerStatusPath -Encoding UTF8
}

if ($Mode -eq 'DryRun') {
  $nodeArguments += '--dry-run'
}
elseif ($Mode -eq 'Review') {
  $nodeArguments += @('--mode', 'review-auto')
}
else {
  $nodeArguments += @('--mode', $Mode.ToLowerInvariant())
}

$secureApiKey = $null
$plainApiKey = $null
$apiKeyPointer = [IntPtr]::Zero

try {
  if ($Mode -ne 'DryRun') {
    Write-RunnerStatus -Status 'awaiting-key' -Message 'Waiting for masked Google API key input.'
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
    Write-RunnerStatus -Status 'running' -Message 'Key received in memory; running the requested batch workflow.'
  }
  else {
    Write-RunnerStatus -Status 'running' -Message 'Running local dry-run without a key.'
  }

  & node @nodeArguments
  if ($LASTEXITCODE -ne 0) {
    throw "Cinematic Batch API pass exited with code $LASTEXITCODE. Existing live WAVs and completed staged takes remain untouched."
  }

  Write-RunnerStatus -Status 'complete' -Message 'Workflow completed successfully; the key is being cleared.'
}
catch {
  Write-RunnerStatus -Status 'failed' -Message $_.Exception.Message
  throw
}
finally {
  Remove-Item Env:GEMINI_API_KEY -ErrorAction SilentlyContinue
  $plainApiKey = $null
  $secureApiKey = $null
  if ($apiKeyPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($apiKeyPointer)
  }
}

if ($Mode -eq 'DryRun') {
  Write-Host 'Cinematic Batch API dry run complete. No key was requested or retained.'
}
else {
  Write-Host "Cinematic Batch API $Mode pass complete. The Google key was not stored."
}
