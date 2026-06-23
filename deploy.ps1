# Deploy 1 lenh: commit + push (local) -> SSH vao VPS pull + cai + restart + build.
#
#   .\deploy.ps1                       # deploy day du (backend + frontend)
#   .\deploy.ps1 "sua abc"             # kem commit message
#   .\deploy.ps1 "fix api" -BackendOnly    # chi backend (bo build frontend cho nhanh)
#
# Can: ssh (Windows co san) + da push duoc len GitHub.
# Muon khoi nhap mat khau SSH moi lan -> tao SSH key 1 lan (xem cuoi file).

param(
  [string]$m = "deploy",
  [switch]$BackendOnly
)

$VPS = "root@74.81.54.150"

Write-Host ""
Write-Host "==> [1/2] Commit + push (local)..." -ForegroundColor Cyan
git add -A
git commit -m $m
if ($LASTEXITCODE -ne 0) { Write-Host "   (khong co thay doi moi - van deploy code hien tai)" -ForegroundColor Yellow }
git push
if ($LASTEXITCODE -ne 0) { Write-Host "[X] PUSH THAT BAI - dung lai." -ForegroundColor Red; exit 1 }

# Lenh chay tren VPS
$frontend = if ($BackendOnly) { "echo '(bo qua frontend)'" } else {
  "cd ../frontend && npm ci --silent && npm run build && sudo chown -R www-data:www-data dist"
}
$remote = @"
set -e
cd /opt/veo3-web
git config --global --add safe.directory /opt/veo3-web >/dev/null 2>&1 || true
git pull --ff-only
cd backend && ./venv/bin/pip install -q -r requirements.txt && sudo systemctl restart veo3-api
$frontend
echo '=== DEPLOY OK ==='
"@

Write-Host ""
Write-Host "==> [2/2] Deploy tren VPS ($VPS)..." -ForegroundColor Cyan
ssh $VPS $remote
if ($LASTEXITCODE -ne 0) { Write-Host "[X] DEPLOY VPS THAT BAI." -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "[OK] XONG -> https://app.aiautocut.com" -ForegroundColor Green

# --- Tao SSH key de khoi nhap mat khau moi lan (chay 1 lan) ---
#   ssh-keygen -t ed25519
#   type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh root@74.81.54.150 "mkdir -p ~/.ssh; cat >> ~/.ssh/authorized_keys"
