# Copies the plugin into TitanClient's JavaScript plugin folder.
$ErrorActionPreference = "Stop"
$plugins = Join-Path $env:USERPROFILE ".titanclient\plugins"
New-Item -ItemType Directory -Force $plugins | Out-Null
Copy-Item (Join-Path $PSScriptRoot "profAmethyst.js") $plugins -Force
Write-Host "Deployed profAmethyst.js to $plugins"
