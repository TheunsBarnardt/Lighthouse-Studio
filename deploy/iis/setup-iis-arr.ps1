<#
.SYNOPSIS
    Installs and configures IIS Application Request Routing (ARR) and URL Rewrite
    for reverse-proxying to the Node.js platform web app.

.DESCRIPTION
    Run this script on the Windows Server that will host IIS.
    Requires Administrator privileges and internet access to download ARR/URL Rewrite.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File setup-iis-arr.ps1
#>

#Requires -RunAsAdministrator

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step { param([string]$Message) Write-Host "`n==> $Message" -ForegroundColor Cyan }
function Write-OK   { param([string]$Message) Write-Host "    OK: $Message" -ForegroundColor Green }
function Write-Warn { param([string]$Message) Write-Host "    WARN: $Message" -ForegroundColor Yellow }

Write-Step "Checking IIS installation"
$iisFeature = Get-WindowsOptionalFeature -Online -FeatureName "IIS-WebServerRole" -ErrorAction SilentlyContinue
if ($null -eq $iisFeature -or $iisFeature.State -ne "Enabled") {
    Write-Step "Installing IIS"
    Install-WindowsFeature -Name Web-Server, Web-Mgmt-Console, Web-Scripting-Tools -IncludeAllSubFeature
    Write-OK "IIS installed"
} else {
    Write-OK "IIS already installed"
}

Write-Step "Installing Web Platform Installer (WebPI)"
$webpiPath = "$env:ProgramFiles\Microsoft\Web Platform Installer\WebpiCmd-x64.exe"
if (-not (Test-Path $webpiPath)) {
    $webpiUrl = "https://download.microsoft.com/download/C/F/F/CFF3A0B8-99D4-41A2-AE1A-496C08BEB904/WebPlatformInstaller_amd64_en-US.msi"
    $webpiMsi = "$env:TEMP\WebPlatformInstaller.msi"
    Write-Host "    Downloading WebPI..."
    (New-Object Net.WebClient).DownloadFile($webpiUrl, $webpiMsi)
    Start-Process msiexec.exe -ArgumentList "/i", $webpiMsi, "/quiet", "/norestart" -Wait
    Remove-Item $webpiMsi -Force
    Write-OK "WebPI installed"
} else {
    Write-OK "WebPI already present"
}

Write-Step "Installing ARR 3.0 via WebPI"
$arrCheck = Get-Item "HKLM:\SOFTWARE\Microsoft\IIS Extensions\Application Request Routing" -ErrorAction SilentlyContinue
if ($null -eq $arrCheck) {
    & $webpiPath /Install /Products:"ARRv3_0" /AcceptEula /SuppressReboot
    Write-OK "ARR 3.0 installed"
} else {
    Write-OK "ARR already installed"
}

Write-Step "Installing URL Rewrite 2.1 via WebPI"
$rwCheck = Get-Item "HKLM:\SOFTWARE\Microsoft\IIS Extensions\URL Rewrite" -ErrorAction SilentlyContinue
if ($null -eq $rwCheck) {
    & $webpiPath /Install /Products:"UrlRewrite2" /AcceptEula /SuppressReboot
    Write-OK "URL Rewrite 2.1 installed"
} else {
    Write-OK "URL Rewrite already installed"
}

Write-Step "Enabling proxy mode in ARR"
$arrServerPath = "IIS:\ServerFarm"
Import-Module WebAdministration -ErrorAction SilentlyContinue
Set-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST' `
    -filter "system.webServer/proxy" `
    -name "enabled" -value "True" `
    -ErrorAction SilentlyContinue
Write-OK "ARR proxy mode enabled"

Write-Step "Disabling ARR disk cache (not needed for API reverse proxy)"
Set-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST' `
    -filter "system.webServer/diskCache" `
    -name "enabled" -value "False" `
    -ErrorAction SilentlyContinue
Write-OK "ARR disk cache disabled"

Write-Host "`n==> IIS ARR setup complete." -ForegroundColor Green
Write-Host "    Next: run web.config.generate.mts and copy web.config to the IIS site root." -ForegroundColor Yellow
