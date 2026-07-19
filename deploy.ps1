# Deploy mot lenh: tu dong commit + push thay doi local, sau do deploy len VPS.
#
#   .\deploy.ps1                  # backend + frontend, VPS mặc định bên dưới
#   .\deploy.ps1 -BackendOnly     # chi backend
#   .\deploy.ps1 -Vps "deploy@your-vps" -RemotePath "/opt/veo3-web"
#   .\deploy.ps1 -IdentityFile "$env:USERPROFILE\.ssh\id_ed25519"

[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [switch]$BackendOnly,
  [string]$Vps = "root@180.93.43.43",
  [string]$RemotePath = "/opt/veo3-web",
  [string]$IdentityFile = $env:VEO3_DEPLOY_IDENTITY
)

$ErrorActionPreference = "Stop"
$RepoRoot = $PSScriptRoot

function Stop-Deploy {
  param([string]$Message)

  Write-Host "[X] $Message" -ForegroundColor Red
  exit 1
}

if ([string]::IsNullOrWhiteSpace($Vps)) {
  Stop-Deploy "Thieu VPS. Dat VEO3_DEPLOY_TARGET hoac truyen -Vps 'user@host'."
}
if ($Vps.StartsWith("-") -or $Vps -match "\s") {
  Stop-Deploy "Gia tri -Vps khong hop le."
}
if ($RemotePath -notmatch "^/[A-Za-z0-9._/-]+$") {
  Stop-Deploy "-RemotePath chi duoc chua chu, so, dau cham, gach ngang, gach duoi va '/'."
}
if (-not [string]::IsNullOrWhiteSpace($IdentityFile) -and
    -not (Test-Path -LiteralPath $IdentityFile -PathType Leaf)) {
  Stop-Deploy "Khong tim thay SSH identity file: $IdentityFile"
}

Write-Host ""
Write-Host "==> [1/3] Commit + push code local..." -ForegroundColor Cyan

$status = @(git -C $RepoRoot status --porcelain=v1)
if ($LASTEXITCODE -ne 0) {
  Stop-Deploy "Khong doc duoc git status."
}
$branch = (git -C $RepoRoot branch --show-current).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($branch)) {
  Stop-Deploy "Dang o detached HEAD hoac khong doc duoc ten branch."
}

$upstream = (git -C $RepoRoot rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>$null)
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($upstream)) {
  Stop-Deploy "Branch '$branch' chua co upstream. Push branch va dat upstream truoc."
}
$upstream = $upstream.Trim()

if ($status.Count -gt 0) {
  $status | ForEach-Object { Write-Host "   $_" }
  if (-not $PSCmdlet.ShouldProcess($RepoRoot, "git add -A va tao commit deploy")) {
    Write-Host "   Da bo qua commit (-WhatIf)." -ForegroundColor Yellow
    exit 0
  }
  git -C $RepoRoot add -A
  if ($LASTEXITCODE -ne 0) {
    Stop-Deploy "git add that bai."
  }
  $autoMessage = "deploy: auto update " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
  git -C $RepoRoot commit -m $autoMessage
  if ($LASTEXITCODE -ne 0) {
    Stop-Deploy "git commit that bai."
  }
}

git -C $RepoRoot fetch --quiet
if ($LASTEXITCODE -ne 0) {
  Stop-Deploy "Git fetch that bai; khong the xac minh commit da duoc push."
}

$localCommit = (git -C $RepoRoot rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0) {
  Stop-Deploy "Khong doc duoc commit local."
}
$upstreamCommit = (git -C $RepoRoot rev-parse '@{upstream}').Trim()
if ($LASTEXITCODE -ne 0) {
  Stop-Deploy "Khong doc duoc commit upstream."
}
if ($localCommit -ne $upstreamCommit) {
  Write-Host "   Dang push $branch..." -ForegroundColor Cyan
  git -C $RepoRoot push
  if ($LASTEXITCODE -ne 0) {
    Stop-Deploy "git push that bai. Neu remote co commit moi, pull/rebase roi chay lai."
  }
  git -C $RepoRoot fetch --quiet
  $localCommit = (git -C $RepoRoot rev-parse HEAD).Trim()
  $upstreamCommit = (git -C $RepoRoot rev-parse '@{upstream}').Trim()
  if ($localCommit -ne $upstreamCommit) {
    Stop-Deploy "Push xong nhung HEAD van khong trung $upstream."
  }
}

Write-Host "   Branch: $branch"
Write-Host "   Commit: $localCommit"

$frontendStep = if ($BackendOnly) {
  "echo '(bo qua frontend)'"
} else {
@'
cd "$repo/frontend"
npm ci --include=dev --production=false --no-audit --no-fund --silent
test -f ./node_modules/typescript/bin/tsc
test -f ./node_modules/vite/bin/vite.js
node ./node_modules/typescript/bin/tsc -b
node ./node_modules/vite/bin/vite.js build
'@
}

# Dung single-quoted here-string de PowerShell khong noi suy bien Bash ($repo, $ok, ...).
$remoteTemplate = @'
set -eu
repo="__REMOTE_PATH__"
expected_commit="__EXPECTED_COMMIT__"

cd "$repo"
server_status=$(git -c safe.directory="$repo" status --porcelain=v1)
if [ -n "$server_status" ]; then
  echo '[X] Working tree tren VPS chua sach:'
  printf '%s\n' "$server_status"
  exit 1
fi
git -c safe.directory="$repo" pull --ff-only
actual_commit=$(git -c safe.directory="$repo" rev-parse HEAD)
if [ "$actual_commit" != "$expected_commit" ]; then
  echo "[X] VPS dang o commit $actual_commit, khong phai $expected_commit"
  exit 1
fi

# Build frontend truoc khi restart API. Neu build loi, service cu van tiep tuc chay.
__FRONTEND_STEP__

# Cai dependency truoc. Neu pip loi, khong restart service voi dependency thieu.
cd "$repo/backend"
./venv/bin/pip install -q -r requirements.txt
sudo systemctl restart veo3-api

ok=0
i=1
while [ "$i" -le 15 ]; do
  if curl -fsS -o /dev/null http://127.0.0.1:8000/api/v1/health; then
    ok=1
    break
  fi
  i=$((i + 1))
  sleep 1
done
if [ "$ok" != "1" ]; then
  echo '[X] HEALTH-CHECK THAT BAI. Xem: journalctl -u veo3-api -n 50'
  sudo systemctl is-active veo3-api || true
  exit 1
fi

echo '=== DEPLOY OK ==='
'@

$remote = $remoteTemplate.Replace("__REMOTE_PATH__", $RemotePath)
$remote = $remote.Replace("__EXPECTED_COMMIT__", $localCommit)
$remote = $remote.Replace("__FRONTEND_STEP__", $frontendStep)
# Mã hoá Base64 để giữ nguyên quote/newline qua Windows PowerShell + OpenSSH.
# Truyền raw here-string làm SSH argument sẽ bị ghép/tách quote; pipe thẳng stdin
# từ Windows PowerShell lại có thể không đóng EOF ổn định.
$remote = $remote.Replace(([string][char]13 + [char]10), [string][char]10)
$remoteBase64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($remote))

Write-Host ""
Write-Host "==> [2/3] San sang deploy $localCommit len $Vps..." -ForegroundColor Cyan
if (-not $PSCmdlet.ShouldProcess("$($Vps):$RemotePath", "Deploy commit $localCommit")) {
  Write-Host "   Da bo qua SSH (-WhatIf)." -ForegroundColor Yellow
  exit 0
}

Write-Host ""
Write-Host "==> [3/3] Pull, build, restart va health-check tren VPS..." -ForegroundColor Cyan
$sshArgs = @("-o", "BatchMode=yes", "-o", "ConnectTimeout=15")
if (-not [string]::IsNullOrWhiteSpace($IdentityFile)) {
  $identityPath = (Resolve-Path -LiteralPath $IdentityFile).Path
  $sshArgs += @("-i", $identityPath, "-o", "IdentitiesOnly=yes")
}
$sshArgs += @("--", $Vps, "printf %s $remoteBase64 | base64 -d | bash -se")
& ssh.exe @sshArgs
if ($LASTEXITCODE -ne 0) {
  Stop-Deploy "Deploy VPS that bai. Kiem tra SSH key/quyen truy cap va log tren VPS."
}

Write-Host ""
Write-Host "[OK] XONG -> https://app.aiautocut.com" -ForegroundColor Green
