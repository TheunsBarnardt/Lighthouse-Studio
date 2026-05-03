<#
.SYNOPSIS
    Binds a TLS certificate to an IIS site from a PFX file.

.PARAMETER CertPath
    Path to the PFX certificate file.

.PARAMETER CertPassword
    Password for the PFX file.

.PARAMETER SiteName
    Name of the IIS site to bind the certificate to. Default: "Platform"

.PARAMETER Hostname
    The hostname for the HTTPS binding (SNI). Required.

.PARAMETER Port
    HTTPS port. Default: 443.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File bind-certificate.ps1 `
        -CertPath "C:\certs\platform.pfx" `
        -CertPassword "pfx-password" `
        -SiteName "Platform" `
        -Hostname "platform.yourdomain.com"
#>

#Requires -RunAsAdministrator

param(
    [Parameter(Mandatory=$true)] [string]$CertPath,
    [Parameter(Mandatory=$true)] [string]$CertPassword,
    [string]$SiteName = "Platform",
    [Parameter(Mandatory=$true)] [string]$Hostname,
    [int]$Port = 443
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Import-Module WebAdministration

Write-Host "==> Importing certificate from $CertPath" -ForegroundColor Cyan

$secPassword = ConvertTo-SecureString -String $CertPassword -AsPlainText -Force
$cert = Import-PfxCertificate -FilePath $CertPath `
    -CertStoreLocation "Cert:\LocalMachine\My" `
    -Password $secPassword
$thumbprint = $cert.Thumbprint
Write-Host "    Thumbprint: $thumbprint" -ForegroundColor Green

Write-Host "==> Removing existing HTTPS binding (if any)" -ForegroundColor Cyan
$existingBinding = Get-WebBinding -Name $SiteName -Protocol "https" -Port $Port -HostHeader $Hostname -ErrorAction SilentlyContinue
if ($existingBinding) {
    Remove-WebBinding -Name $SiteName -Protocol "https" -Port $Port -HostHeader $Hostname
}

Write-Host "==> Adding HTTPS binding for $Hostname:$Port" -ForegroundColor Cyan
New-WebBinding -Name $SiteName -Protocol "https" -Port $Port -HostHeader $Hostname -SslFlags 1

Write-Host "==> Assigning certificate to binding" -ForegroundColor Cyan
$binding = Get-WebBinding -Name $SiteName -Protocol "https" -Port $Port -HostHeader $Hostname
$binding.AddSslCertificate($thumbprint, "My")

Write-Host "==> HTTPS binding configured successfully" -ForegroundColor Green
Write-Host "    Site:        $SiteName" -ForegroundColor Yellow
Write-Host "    Hostname:    $Hostname" -ForegroundColor Yellow
Write-Host "    Port:        $Port" -ForegroundColor Yellow
Write-Host "    Thumbprint:  $thumbprint" -ForegroundColor Yellow
