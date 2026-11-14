$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$secret = Read-Host 'Paste BAPCARRY service_role key (hidden)' -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
try {
  $env:BAPCARRY_SERVICE_ROLE_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  node .\copy-media.cjs
  if ($LASTEXITCODE -ne 0) { throw 'Media copy stopped. See media-report.json.' }
} finally {
  Remove-Item Env:BAPCARRY_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}
