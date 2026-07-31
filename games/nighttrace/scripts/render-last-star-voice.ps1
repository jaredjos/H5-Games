[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$rendererPath = Join-Path $PSScriptRoot 'render-last-star-voice.mjs'
$staleOpenAiCredential = 'C:\tmp\nighttrace-openai-key.dpapi'
$secureValue = Read-Host -Prompt 'Paste temporary Google AI Studio API key now' -AsSecureString
$secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
$generationSucceeded = $false

try {
  $plainValue = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
  $env:GEMINI_API_KEY = $plainValue
  & node $rendererPath
  if ($LASTEXITCODE -ne 0) {
    throw "Voice generation exited with code $LASTEXITCODE."
  }
  $generationSucceeded = $true
}
finally {
  Remove-Item Env:GEMINI_API_KEY -ErrorAction SilentlyContinue
  $plainValue = $null
  $secureValue = $null
  if ($secretPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer)
  }
  if ($generationSucceeded -and (Test-Path -LiteralPath $staleOpenAiCredential)) {
    Remove-Item -LiteralPath $staleOpenAiCredential -Force
  }
}

Write-Host 'Last Star voice assets generated. The Google key was never stored, and the obsolete encrypted OpenAI handoff was removed.'
