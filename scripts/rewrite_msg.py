import sys
import re

def rewrite_message(msg):
    msg_strip = msg.strip()
    
    # 1. Nếu đã có tag semantic chuẩn, giữ nguyên
    # feat, fix, docs, chore, refactor, style, test, merge, revert, ci, build
    semantic_pattern = r'^(feat|fix|docs|chore|refactor|style|test|merge|revert|ci|build|Merge|Revert)(\(.*\))?\s*:\s*.*'
    if re.match(semantic_pattern, msg_strip):
        return msg_strip
        
    # Bỏ qua các commit Merge branch hoặc Merge pull request
    if msg_strip.startswith("Merge branch") or msg_strip.startswith("Merge pull request") or msg_strip.startswith("merge"):
        return msg_strip

    # 2. Map cụ thể các commit message không chuẩn phổ biến của Dang Van Hiep
    mapping = {
        "chinh sua tinh nang email": "feat(email): chinh sua tinh nang email",
        "chinh sua giao dien phu hop cho mobie": "style(ui): chinh sua giao dien cho thiet bi di dong",
        "update": "chore: cap nhat ma nguon",
        "sua loi them nha cung cap": "fix(supplier): sua loi khi them nha cung cap",
        "update readme": "docs: cap nhat tai lieu README.md",
        "Bo sung README.md": "docs: khoi tao tai lieu README.md",
        "Bo sun canh bao cac thao tac": "feat(alerts): bo sung canh bao cac thao tac",
        "Chinh sua map duong di": "feat(map): chinh sua ban do va duong di",
        "Hoan thien chuc nang kiem hang nhap kho": "feat(import): hoan thien chuc nang kiem hang nhap kho",
        "Cập nhật: Tích hợp thông báo realtime Socket.io, áp dụng Next.js Server Actions cho trang Nhà cung cấp, và sửa lỗi trống tên Nhà cung cấp khi xuất Excel": "feat: tich hop socket.io realtime, server actions va sua loi excel",
        "Chinh sua tao nhap xuat phieu": "feat(receipt): chinh sua form tao phieu nhap xuat",
        "Chinh sua bo sung thong tin ca nhan tai khoan": "feat(user): chinh sua bo sung thong tin ca nhan tai khoan",
        "Chinh sua giao dien va logic xu ly": "refactor(ui): chinh sua giao dien va logic xu ly",
        "Chinh sua giao dien": "style(ui): chinh sua giao dien",
        "Chinh sua giao dien dang nhap": "style(auth): chinh sua giao dien dang nhap",
        "Chinh sua giao dien dashboard": "style(dashboard): chinh sua giao dien dashboard"
    }
    
    # So khớp không phân biệt chữ hoa thường và khoảng trắng thừa
    normalized_msg = re.sub(r'\s+', ' ', msg_strip).strip().lower()
    for key, value in mapping.items():
        if normalized_msg == re.sub(r'\s+', ' ', key).strip().lower():
            return value
            
    # 3. Phân loại theo từ khóa nếu không khớp chính xác
    msg_lower = msg_strip.lower()
    
    if any(kw in msg_lower for kw in ["giao dien", "css", "color", "mau", "indigo", "theme", "mobile", "style"]):
        return f"style(ui): {msg_strip}"
    elif any(kw in msg_lower for kw in ["email", "gmail", "nodemailer", "resend", "alert"]):
        return f"feat(email): {msg_strip}"
    elif any(kw in msg_lower for kw in ["loi", "fix", "bug", "err", "error", "sửa lỗi", "sua loi"]):
        return f"fix: {msg_strip}"
    elif any(kw in msg_lower for kw in ["nha cung cap", "supplier"]):
        return f"feat(supplier): {msg_strip}"
    elif any(kw in msg_lower for kw in ["phieu", "receipt", "nhap", "xuat", "import", "export"]):
        return f"feat(receipt): {msg_strip}"
    elif any(kw in msg_lower for kw in ["kiem hang", "ton kho", "fefo", "stock"]):
        return f"feat(inventory): {msg_strip}"
    elif any(kw in msg_lower for kw in ["readme", "huong dan", "hướng dẫn", "deploy", "docs", "doc"]):
        return f"docs: {msg_strip}"
    elif any(kw in msg_lower for kw in ["map", "duong di", "tuyen duong", "routing"]):
        return f"feat(map): {msg_strip}"
    elif any(kw in msg_lower for kw in ["auth", "dang nhap", "dang xuat", "login", "logout", "profile", "tai khoan"]):
        return f"feat(auth): {msg_strip}"
    elif any(kw in msg_lower for kw in ["update", "up", "chore"]):
        return f"chore: {msg_strip}"
    
    # Fallback mặc định
    return f"feat: {msg_strip}"

if __name__ == "__main__":
    # Đọc tin nhắn commit từ stdin
    original_msg = sys.stdin.read()
    new_msg = rewrite_message(original_msg)
    # Ghi tin nhắn mới ra stdout
    sys.stdout.write(new_msg)
