# =========================================================================
# SCRIPT DỌN DẸP CÁC NHÁNH GIT TẠM THỜI (LOCAL & REMOTE)
# =========================================================================

# Danh sách các nhánh cốt lõi CẦN GIỮ LẠI
$CORE_BRANCHES = @(
    "main",
    "backup-local-main",
    "feature/auth-implementation",
    "feature/imports",
    "feature/exports",
    "feature/email-alerts-and-tests",
    "feature/gemini-ai-replenishment",
    "feature/qr-scanner",
    "feature/supplier-management",
    "feature/product-management"
)

Write-Host "=== Bắt đầu dọn dẹp các nhánh Git không cần thiết ===" -ForegroundColor Cyan

# 1. Lấy danh sách nhánh local
$local_branches = git branch | ForEach-Object { $_.Trim().Replace("* ", "") }

# Xóa các nhánh local không thuộc danh sách CORE
foreach ($branch in $local_branches) {
    if ($CORE_BRANCHES -notcontains $branch) {
        Write-Host "Đang xóa nhánh local: $branch" -ForegroundColor Yellow
        git branch -D $branch
    }
}

# 2. Lấy danh sách nhánh remote từ origin
Write-Host "Đang quét danh sách các nhánh trên remote (origin)..." -ForegroundColor Cyan
git fetch --prune

$remote_branches = git branch -r | ForEach-Object {
    $clean = $_.Trim()
    if ($clean -match "^origin/(.+)$") {
        $Matches[1]
    }
}

# Xóa các nhánh remote không thuộc danh sách CORE
foreach ($branch in $remote_branches) {
    # Bỏ qua HEAD pointer
    if ($branch -like "HEAD*") { continue }
    
    if ($CORE_BRANCHES -notcontains $branch) {
        Write-Host "Đang xóa nhánh trên GitHub (remote): $branch" -ForegroundColor Red
        # Sử dụng lệnh push origin --delete để xóa nhánh từ xa
        git push origin --delete $branch
    }
}

Write-Host "=== Hoàn thành dọn dẹp Git! Các nhánh hiện tại rất gọn gàng ===" -ForegroundColor Green
git branch -a
