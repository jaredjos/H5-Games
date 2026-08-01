$ErrorActionPreference = 'Stop'

$secureApiKey = Read-Host 'Paste the temporary Google AI Studio API key' -AsSecureString
$apiKeyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureApiKey)

try {
  $env:GEMINI_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($apiKeyPointer)
  $maximumAttempts = 3
  $completed = $false

  for ($attempt = 1; $attempt -le $maximumAttempts; $attempt += 1) {
    node "$PSScriptRoot/render-memory-voices.mjs"
    if ($LASTEXITCODE -eq 0) {
      $completed = $true
      break
    }

    if ($attempt -lt $maximumAttempts) {
      Write-Warning "Generation pass $attempt failed. Completed WAVs are safe; resuming automatically in 5 seconds."
      Start-Sleep -Seconds 5
    }
  }

  if (-not $completed) {
    throw "Memory voice generation did not complete after $maximumAttempts resumable passes."
  }
}
finally {
  Remove-Item Env:GEMINI_API_KEY -ErrorAction SilentlyContinue
  if ($apiKeyPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($apiKeyPointer)
  }
  $secureApiKey = $null
}
