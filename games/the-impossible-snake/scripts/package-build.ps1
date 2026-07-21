param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("standalone", "poki", "crazygames")]
  [string]$Platform
)

$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$SourceDirectory = Join-Path $ProjectRoot "dist\$Platform"
$IndexFile = Join-Path $SourceDirectory "index.html"
$ReleaseDirectory = Join-Path $ProjectRoot "releases"
$ArchivePath = Join-Path $ReleaseDirectory "the-impossible-snake-$Platform.zip"

if (-not (Test-Path -LiteralPath $IndexFile -PathType Leaf)) {
  throw "Build dist/$Platform before packaging it."
}

New-Item -ItemType Directory -Path $ReleaseDirectory -Force | Out-Null
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

if (Test-Path -LiteralPath $ArchivePath) {
  [System.IO.File]::Delete($ArchivePath)
}

$archive = [System.IO.Compression.ZipFile]::Open(
  $ArchivePath,
  [System.IO.Compression.ZipArchiveMode]::Create
)

try {
  Get-ChildItem -LiteralPath $SourceDirectory -File -Recurse | ForEach-Object {
    $entryName = $_.FullName.Substring($SourceDirectory.Length).TrimStart([char[]]@(92, 47)).Replace([char]92, [char]47)
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
      $archive,
      $_.FullName,
      $entryName,
      [System.IO.Compression.CompressionLevel]::Optimal
    ) | Out-Null
  }
}
finally {
  $archive.Dispose()
}

Write-Output $ArchivePath
