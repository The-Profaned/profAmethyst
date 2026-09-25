# Downloads the Titan SDK typings used for IntelliSense into js/types/.
$ErrorActionPreference = "Stop"
$base = "https://raw.githubusercontent.com/Soxs/titan-public-sdk/main"
$dest = Join-Path $PSScriptRoot "types"
New-Item -ItemType Directory -Force $dest | Out-Null
foreach ($file in "titan-plugin-sdk.d.ts", "titan-gamevals.d.ts") {
    Invoke-WebRequest "$base/$file" -OutFile (Join-Path $dest $file)
    Write-Host "Fetched $file"
}
