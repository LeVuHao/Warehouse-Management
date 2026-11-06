# Hướng dẫn test các nhánh tính năng — INT1334

Repo: https://github.com/n23dccn155-gif/Quan_ly_kho_hang.git

## Quy trình làm việc

1. `git fetch origin`
2. Checkout từng nhánh feature bên dưới
3. Chạy test theo checklist
4. Báo lại nếu OK → merge vào `main` theo thứ tự gợi ý

**Thứ tự merge gợi ý:**

1. `feature/deployment-config`
2. `feature/auth-refresh-token-db`
3. `feature/nextjs-middleware-rendering`
4. `feature/server-actions-import`
5. `feature/email-alerts-and-tests`

---

## Chuẩn bị chung (mỗi lần test)

```powershell
cd backend
npm install
npx prisma generate
# Nếu nhánh auth: tạo bảng refresh_tokens
npx prisma db push

cd ..\frontend
npm install
```

Tạo `backend/.env` và `frontend/.env.local` từ file `.env.example`.

Chạy 2 terminal:

```powershell
cd backend; npm run dev
cd frontend; npm run dev
```

Mở http://localhost:3000 — đăng nhập `admin` / `admin123`.

---

## 1. `feature/deployment-config`

**Mục đích:** CORS production, Render/Vercel config, tài liệu deploy.

| Bước | Việc làm | Kỳ vọng |
|------|----------|---------|
| 1 | Đọc `docs/DEPLOYMENT.md` | Có hướng dẫn Render + Vercel |
| 2 | `GET http://localhost:5001/api/health` | JSON `status: OK` |
| 3 | Đăng nhập + duyệt dashboard | Không lỗi CORS |

---

## 2. `feature/auth-refresh-token-db`

**Mục đích:** Refresh token lưu PostgreSQL, logout thu hồi token.

```powershell
cd backend
npx prisma db push
```

| Bước | Việc làm | Kỳ vọng |
|------|----------|---------|
| 1 | Đăng nhập | Thành công |
| 2 | Neon/Prisma Studio: bảng `refresh_tokens` | Có 1 dòng mới |
| 3 | Đăng xuất | Gọi API logout, dòng token bị xóa |
| 4 | Đổi mật khẩu ở Profile | Refresh tokens của user bị xóa |

---

## 3. `feature/nextjs-middleware-rendering`

**Mục đích:** Middleware, SSG, ISR, SSR.

| Bước | Việc làm | Kỳ vọng |
|------|----------|---------|
| 1 | Mở `/dashboard` khi chưa login | Redirect `/login` |
| 2 | Đăng nhập → vào dashboard | OK (cookie `accessToken` được set) |
| 3 | Mở `/about` không cần login | Trang giới thiệu (SSG) |
| 4 | View source `/dashboard/imports` | HTML có dữ liệu phiếu (SSR) hoặc load nhanh từ `initialData` |
| 5 | Xem `dashboard/page.js` | Có `export const revalidate = 60` |

---

## 4. `feature/server-actions-import`

**Mục đích:** Server Action tạo phiếu nhập.

| Bước | Việc làm | Kỳ vọng |
|------|----------|---------|
| 1 | Tạo phiếu nhập mới | Thành công, chuyển trang chi tiết |
| 2 | Network tab | Request qua Server Action (không chỉ POST client trực tiếp) |
| 3 | Submit form trống sản phẩm | Báo lỗi validation |

---

## 5. `feature/email-alerts-and-tests`

**Mục đích:** Email Nodemailer + Jest.

### Unit test

```powershell
cd backend
npm install
npm test
```

Kỳ vọng: **5 test passed**.

### Email (cần cấu hình `.env`)

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_USER=...
EMAIL_PASS=app-password
ADMIN_ALERT_EMAIL=email-nhan-canh-bao@gmail.com
```

| Bước | Việc làm | Kỳ vọng |
|------|----------|---------|
| 1 | Postman: `POST /api/inventory/alerts/send-email` + header `Authorization: Bearer <admin_token>` | `{ success: true, sent: N }` |
| 2 | Kiểm tra hòm thư | Email HTML danh sách tồn thấp |

---

## Sau khi bạn báo OK

Nhắn: *"Merge nhánh X vào main"* — sẽ thực hiện merge + push theo thứ tự trên.

**Lưu ý:** Không push thẳng lên `main` khi chưa test; mỗi nhánh nên `git push -u origin feature/ten-nhanh` để đồng đội review trên GitHub.
