# Hướng dẫn Deploy & Vận hành Hệ thống — WMS INT1334

## Kiến trúc Hệ thống

```
Trình duyệt (Vercel) ──(HTTPS)──> Backend Express (Render) ──(ORM Prisma)──> PostgreSQL Database (Neon)
```

---

## 1. Triển khai Backend trên Render

1. Đăng nhập [render.com](https://render.com) qua tài khoản GitHub.
2. Click **New +** -> **Web Service** -> Kết nối repository `Quan_ly_kho_hang`.
3. Cấu hình các thông số cơ bản:
   - **Name:** `wms-backend`
   - **Region:** `Singapore (Southeast Asia)` (Khuyên dùng để tối ưu tốc độ từ Việt Nam)
   - **Branch:** `main`
   - **Root Directory:** `backend` (Bắt buộc)
   - **Language/Runtime:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free`
4. Cấu hình biến môi trường (Mục **Environment Variables**):

| Tên biến (Key) | Giá trị (Value) | Giải thích |
|------|---------|------|
| `DATABASE_URL` | Chuỗi connection string từ Neon | Kết nối PostgreSQL Cloud |
| `JWT_SECRET` | Chuỗi ký tự bảo mật bất kỳ (≥32 ký tự) | Dùng để ký Access Token |
| `JWT_REFRESH_SECRET` | Chuỗi ký tự bảo mật khác | Dùng để ký Refresh Token |
| `GEMINI_API_KEY` | Gemini API Key từ Google AI Studio | Dùng cho phân hệ gợi ý bổ sung bằng AI |
| `CORS_ORIGIN` | URL Vercel của bạn (ví dụ `https://quan-ly-kho-hang-chi.vercel.app`) | Chặn request từ các domain lạ |
| `PORT` | `5001` | Cổng dịch vụ |
| `NODE_ENV` | `production` | Chạy môi trường sản phẩm |

5. Tiến hành Deploy. Sau khi dịch vụ báo trạng thái **`Live`**, có thể mở Shell của Render để chạy các lệnh khởi tạo CSDL:
   ```bash
   npx prisma db push
   npx prisma db seed
   ```

---

## 2. Triển khai Frontend trên Vercel

1. Đăng nhập [vercel.com](https://vercel.com) qua tài khoản GitHub.
2. Chọn **Add New...** -> **Project** -> Chọn repository bản Fork của bạn (`Quan_ly_kho_hang`).
3. Cấu hình các thông số:
   - **Framework Preset:** `Next.js`
   - **Root Directory:** Chọn thư mục `frontend`
4. Cấu hình biến môi trường (Mục **Environment Variables**):

| Tên biến (Key) | Giá trị (Value) | Giải thích |
|------|---------|------|
| `NEXT_PUBLIC_API_URL` | `https://wms-backend-fsyd.onrender.com/api` | API Endpoint Backend (Render) |
| `BACKEND_URL` | `https://wms-backend-fsyd.onrender.com` | Base URL Backend (Không có /api ở cuối) |

5. Nhấn **Deploy** và chờ khoảng 1 phút để Vercel build dự án.

---

## 3. Nhật ký Sửa lỗi Thực tế & Kinh nghiệm Vận hành (Quan trọng khi bảo vệ đồ án)

Trong quá trình triển khai thực tế, hệ thống đã ghi nhận và khắc phục các lỗi đặc trưng sau, thành viên trong nhóm cần nắm vững để giải trình trong báo cáo hoặc trả lời câu hỏi của thầy:

### Lỗi 1: Prepared Statements trên Neon PostgreSQL
- **Triệu chứng:** Backend crash lúc khởi động kèm lỗi: `cannot insert multiple commands into a prepared statement`.
- **Nguyên nhân:** Neon Database không cho phép thực thi một chuỗi SQL thô gộp nhiều câu lệnh ngăn cách bằng dấu `;` thông qua `Prisma.$executeRawUnsafe()`.
- **Giải pháp:** Tách các câu lệnh tạo Views (`v_stock_balance`, `v_lot_stock`) thành các truy vấn đơn riêng biệt trong tệp tin `backend/db/ensureStockViews.js`.

### Lỗi 2: Export Metadata trên Client Component (Next.js)
- **Triệu chứng:** Vercel báo lỗi build: `You are attempting to export "metadata" from a component marked with "use client"`.
- **Nguyên nhân:** Next.js cấm khai báo metadata chuẩn SEO trong các tệp tin chứa chỉ thị `'use client'`.
- **Giải pháp:** Xóa metadata khỏi file Client Component (Ví dụ: `imports/page.js`), giữ cho metadata chỉ nằm ở các Server Component tĩnh hoặc các file `layout.js` tương ứng.

### Lỗi 3: Địa chỉ API bị ghép lặp lại liên tiếp
- **Triệu chứng:** Đăng nhập báo lỗi đỏ `api is not defined` hoặc lỗi gọi link dạng `https://backend.com/apihttps://backend.com/api/auth/login`.
- **Nguyên nhân:** Thiết lập sai hoặc ghi đè lặp biến `NEXT_PUBLIC_API_URL` trên Vercel.
- **Giải pháp:** Xóa sạch biến cũ trên Settings của Vercel và điền chính xác duy nhất một lần đường link API dạng `https://wms-backend-fsyd.onrender.com/api` (không có dấu gạch chéo `/` ở cuối). Tiến hành **Redeploy** để áp dụng thay đổi.

---

## 4. Kịch bản Kiểm thử Tích hợp (E2E Test) trên Môi trường Live

Khi cần test nhanh hệ thống chạy trên link Vercel, thực hiện 4 bước sau:

1. **Đăng nhập phân quyền**: Đăng nhập tài khoản `staff` / `staff123` để xác nhận phân quyền bị chặn truy cập mục *Người dùng*, sau đó đăng nhập tài khoản `admin` / `admin123` để thao tác toàn quyền.
2. **AI gợi ý bổ sung hàng**: Vào mục *Đề xuất bổ sung*, bấm nút *Phân tích & Đề xuất bằng AI*, chờ 3 giây xem bảng kết quả phân tích mức độ ưu tiên từ Gemini.
3. **Luồng Nhập kho & Bản đồ**: Tạo phiếu nhập với số lượng thực tế, chọn nhà cung cấp để xem bản đồ hiển thị quãng đường tối ưu. Chuyển trạng thái phiếu từ *Đang vận chuyển* sang *Hoàn thành* để xác nhận hàng vào kho.
4. **Luồng Xuất kho (FEFO)**: Tạo phiếu xuất cho sản phẩm vừa nhập, thử xuất vượt tồn kho để kiểm tra cảnh báo lỗi. Sau đó xuất đúng số lượng để xác minh lô hàng cũ nhất/sắp hết hạn sẽ tự động xuất trước.

