# KẾ HOẠCH NÂNG CẤP HỆ THỐNG AI & PHÂN CÔNG NHIỆM VỤ DỰ ÁN
## ĐỒ ÁN: HỆ THỐNG QUẢN LÝ KHO THÔNG MINH (SMART WMS & LOGISTICS)

---

## I. MỤC TIÊU & ĐỊNH HƯỚNG CỐT LÕI

Mục tiêu chính của đợt nâng cấp này là đưa hệ thống WMS từ mức "quản lý dữ liệu tĩnh" trở thành **Hệ thống Quản lý Kho có khả năng tự nhận thức ngữ cảnh (Context-Aware Smart WMS)**, tập trung giải quyết 3 bài toán sống còn trong chuỗi cung ứng:
1. **Kiểm soát rủi ro hạn sử dụng & Chiến lược xả hàng (FEFO & Waste Reduction):** Không để hàng hóa bị quá hạn dẫn đến tiêu hủy; tự động đề xuất chiến lược xả hàng/thu hồi vốn.
2. **Dự báo nguy cơ cạn kho & Tác động ngoại cảnh (Context-Aware Stockout Risk):** Nhạy cảm với các biến động thời tiết (mưa bão, sạt lở đèo), chu kỳ bán hàng (cuối tuần, lễ hội) và khoảng cách nhà cung cấp để không bị đứt hàng.
3. **Động cơ ra quyết định tập trung & Giả lập ngữ cảnh (Central Decision Engine & Scenario Trigger):** Cung cấp các đề xuất hành động cụ thể 1-click (1-Click Actionable Recommendations) thay vì chỉ đưa ra báo cáo dạng văn bản tĩnh.

---

## II. PHƯƠNG PHÁP LUẬN CÔNG NGHỆ (HYBRID AI ARCHITECTURE)

> **Lưu ý kỹ thuật:** Nhóm **không** tiến hành train/fine-tune lại mô hình ngôn ngữ lớn (LLM) vì chi phí GPU tốn kém và mô hình ngôn ngữ lớn dễ gặp hiện tượng ảo giác (hallucination) trong tính toán số học.

Thay vào đó, hệ thống áp dụng kiến trúc **Hybrid AI chuẩn công nghiệp (2025–2026)** gồm 3 tầng:
* **Tầng 1 - Logic toán học xác định (Deterministic Supply Chain Engine):** Code backend tự động tính toán chính xác 100% các chỉ số: Tốc độ bán hàng ngày ($D$), Điểm đặt hàng lại ($ROP$), Thời gian chạy hết hàng ($DOI$), Chỉ số rủi ro hết hạn ($ExpiryRiskIndex$).
* **Tầng 2 - Tiêm ngữ cảnh động (Dynamic Context Injection):** Tích hợp các hệ số ngoại cảnh (Hệ số thời tiết $\alpha$, Hệ số cuối tuần $\beta$, Khoảng cách nhà cung cấp $L$).
* **Tầng 3 - Trí tuệ nhân tạo suy luận (LLM Reasoning Layer - Gemini 2.0):** Tiếp nhận hồ sơ số liệu chuẩn hóa từ Tầng 1 & 2 để đóng vai trò Giám đốc Chuỗi cung ứng AI: đưa ra phân tích chuyên sâu, giải thích nguyên nhân và đề xuất phương án hành động tức thời.

---

## III. BẢNG PHÂN CÔNG NHIỆM VỤ CHI TIẾT (WORK BREAKDOWN)

---

### 1. BẠN HÀO (LEAD DEVELOPER) — TRỌNG TÂM CỐT LÕI & ĐIỀU PHỐI DEMO
* **Mô-đun phụ trách:** **AI Central Decision Hub & Realtime Context Simulation** *(Bộ điều khiển trung tâm & Giả lập ngữ cảnh)*.
* **Mục tiêu:** Là cầu nối trung tâm nhận dữ liệu phân tích từ phân hệ của Huy và Hùng, tạo giao diện điều khiển ngữ cảnh trực tiếp phục vụ buổi bảo vệ đồ án.

#### Công việc cụ thể:
1. **Thanh điều khiển Giả lập Ngữ cảnh (Context Simulator Bar):**
   * Xây dựng widget điều khiển trên thanh Header của Dashboard, cho phép chuyển đổi 3 trạng thái môi trường tức thì:
     * ☀️ **Chế độ 1: Bình thường (Normal Operations)** — Giữ nguyên định mức an toàn tiêu chuẩn.
     * 🌧️ **Chế độ 2: Cảnh báo Mưa bão / Sạt lở đèo (Severe Weather / Landslide Alert)** — Tự động kích hoạt hệ số rủi ro thời tiết, tăng Safety Stock lên 1.5x, cảnh báo nguy cơ trễ tuyến Đà Lạt - TP.HCM.
     * 🏖️ **Chế độ 3: Cao điểm Cuối tuần / Mùa vụ (Weekend & Seasonal Peak)** — Tự động nhân hệ số tiêu thụ thực phẩm/nước ngọt lên 1.35x.
2. **Cơ chế đề xuất hành động 1-Click (1-Click Actionable Execution):**
   * Tích hợp nút hành động trực tiếp ngay dưới các cảnh báo của AI:
     * Nút: *"Tạo phiếu nhập hàng dự phòng bão"* $\rightarrow$ Tự động chuyển hướng sang form nhập hàng với đầy đủ sản phẩm, số lượng và nhà cung cấp tối ưu.
     * Nút: *"Tạo phiếu xuất xả hàng cận date"* $\rightarrow$ Tự động điền danh sách các lô hàng có nguy cơ hết hạn cao nhất.
3. **Trợ lý AI Copilot Chatbot (Thời gian thực):**
   * Nâng cấp khả năng tra cứu của con Chatbot: Khi người dùng đặt câu hỏi trong bất kỳ ngữ cảnh nào, Chatbot tự động truy vấn CSDL PostgreSQL và trả lời chính xác số liệu tồn kho, tình trạng lô hàng và kịch bản ứng phó bão/cuối tuần tương ứng.
4. **Hạ tầng & Điều phối chung:**
   * Quản lý kết nối Database Neon PostgreSQL, quy trình CI/CD trên Render và Vercel.
   * Review code và hợp nhất (merge) các nhánh tính năng của Huy và Hùng vào nhánh chính `main`.

---

### 2. BẠN HUY — BÀI TOÁN HẠN SỬ DỤNG & XẢ HÀNG KHẨN CẤP (EXPIRY & FEFO)
* **Mô-đun phụ trách:** **AI Expiry Risk Guardian & Smart Liquidation** *(Bảo vệ hạn dùng & Xuất xả hàng thông minh)*.
* **Mục tiêu:** Giải quyết bài toán hàng cận date, ngăn chặn hoàn toàn việc hàng bị quá hạn gây thất thoát tài chính.

#### Công việc cụ thể:
1. **Xây dựng Thuật toán Chấm điểm Rủi ro Quá hạn ($ExpiryRiskIndex$):**
   * Tại backend (`backend/controllers/inventoryController.js` hoặc service riêng), viết logic so sánh giữa **thời gian còn lại của lô hàng** và **khả năng tiêu thụ của thị trường**:
     $$\text{Số ngày đến hạn} = \text{expiry\_date} - \text{current\_date}$$
     $$\text{Số ngày cần để bán hết lô} = \frac{\text{Số lượng tồn của lô hàng}}{\text{Tốc độ bán hàng ngày } (D)}$$
   * Nếu: $\text{Số ngày đến hạn} < \text{Số ngày cần để bán hết}$ $\rightarrow$ Đánh dấu cờ đỏ: **Nguy cơ hủy hàng nếu không can thiệp kịp thời**.
2. **Tích hợp AI Gợi ý Kịch bản Xả hàng (Liquidation Strategy via Gemini):**
   * Gửi danh sách các lô hàng có nguy cơ cao qua Gemini API kèm prompt chuyên môn:
     * Yêu cầu AI phân tích và đưa ra giải pháp cụ thể:
       * Lô còn 20–30 ngày: Gợi ý áp dụng chương trình khuyến mãi/giảm giá (chiết khấu bao nhiêu %).
       * Lô còn < 15 ngày: Gợi ý liên hệ nhà cung cấp để thương lượng đổi trả hoặc xuất bán thu hồi vốn lưu động.
3. **Nâng cấp Giao diện Quản lý Hạn dùng (`/dashboard/alerts`):**
   * Hiển thị bảng theo dõi lô hàng trực quan với các mức độ cảnh báo màu sắc (Xanh: An toàn, Vàng: Cần chú ý, Đỏ: Khẩn cấp).
   * Bổ sung thanh đo rủi ro (Risk Gauge) và hiển thị bảng phân tích kịch bản xả hàng do AI gợi ý.

---

### 3. BẠN HÙNG — BÀI TOÁN NGOẠI CẢNH & DỰ BÁO CẠN KHO (CONTEXT & STOCKOUT)
* **Mô-đun phụ trách:** **AI Dynamic Stockout Forecaster & Supply Disruption Engine** *(Dự báo nguy cơ cạn kho động)*.
* **Mục tiêu:** Giải quyết bài toán đứt gãy chuỗi cung ứng do ảnh hưởng của thời tiết, khoảng cách địa lý và nhu cầu đột biến.

#### Công việc cụ thể:
1. **Xây dựng Mô hình Hệ số Ngoại cảnh (Context Multipliers Engine):**
   * Tại backend, thiết lập bảng tham số động:
     * **Hệ số thời tiết ($\alpha_{weather}$):** Khi có bão, thời gian giao hàng ($LeadTime$) của nhà cung cấp tăng từ $1.3$ đến $1.6$ lần tùy theo khoảng cách địa lý (`distance_km`).
     * **Hệ số cuối tuần / mùa vụ ($\beta_{weekend}$):** Tốc độ tiêu thụ mặt hàng thực phẩm, nước giải khát tăng từ $1.2$ đến $1.4$ lần vào các ngày cao điểm.
2. **Thuật toán Tính toán Điểm Đặt Hàng Lại Động ($ROP_{dynamic}$):**
   * Áp dụng công thức chuỗi cung ứng:
     $$ROP_{dynamic} = (D \times \beta_{weekend}) \times (LeadTime \times \alpha_{weather}) + SafetyStock_{dynamic}$$
   * Khi mức tồn kho thực tế giảm xuống dưới $ROP_{dynamic}$, hệ thống tự động phát cảnh báo cạn kho kèm thời gian dự kiến đứt hàng (Days to Stockout).
3. **Nâng cấp Giao diện Dashboard (`/dashboard`):**
   * Thêm biểu đồ đường **Dự báo chu kỳ cạn kho (Runout Forecast Timeline)**: Mô phỏng xu hướng giảm của tồn kho theo thời gian thực.
   * Thiết kế danh sách cảnh báo: *"Top 5 mặt hàng có nguy cơ đứt hàng cao nhất trong 48h tới nếu thời tiết tiếp tục diễn biến xấu"*.

---

## IV. QUY TRÌNH PHỐI HỢP KỸ THUẬT & QUẢN LÝ GIT (GIT WORKFLOW)

Để đảm bảo quá trình phát triển không bị xung đột mã nguồn (conflict), 3 thành viên tuân thủ nghiêm ngặt quy trình làm việc sau:

```
[ main ]  (Nhánh chính trên GitHub — Render & Vercel tự động deploy từ đây)
   │
   ├───────► [ feature/ai-expiry-huy ]    (Huy làm việc độc lập trên nhánh này)
   │
   └───────► [ feature/ai-context-hung ]  (Hùng làm việc độc lập trên nhánh này)
```

1. **Phân chia nhánh:**
   * Bạn Hào: Quản lý nhánh `main` và nhánh kiểm thử `test`.
   * Bạn Huy: Tạo và làm việc trên nhánh `feature/ai-expiry-huy`.
   * Bạn Hùng: Tạo và làm việc trên nhánh `feature/ai-context-hung`.
2. **Quy tắc kiểm thử trước khi bàn giao:**
   * Mỗi thành viên kiểm thử đầy đủ API và giao diện trên máy cá nhân (localhost) trước khi thông báo merge.
   * Tuyệt đối không commit trực tiếp vào nhánh `main`.
3. **Quy trình tích hợp:**
   * Sau khi Huy và Hùng hoàn thành tính năng, gửi thông báo kèm hình ảnh/kết quả test cho Hào.
   * Hào tiến hành review code, hợp nhất vào nhánh `main` và đẩy lên GitHub để hệ thống Vercel/Render tự động cập nhật bản live.

---

## V. KỊCH BẢN PHỐI HỢP KHI THUYẾT TRÌNH BẢO VỆ ĐỒ ÁN

Buổi bảo vệ đồ án sẽ diễn ra theo kịch bản tương tác trực tiếp cực kỳ thuyết phục:

1. **Phần 1 - Bạn Hào (Trưởng nhóm):**
   * Giới thiệu tổng quan hệ thống Smart WMS và mô hình kiến trúc Hybrid AI.
   * Bật giao diện Dashboard và trực tiếp thao tác thanh **Context Simulator**: 
     > *"Em xin phép chuyển hệ thống sang kịch bản: **'Cảnh báo Bão số 3'**. Thầy cô có thể quan sát thấy toàn bộ hệ số an toàn của kho tự động điều chỉnh và AI Copilot kích hoạt cảnh báo nguy cơ đứt gãy tức thì."*
2. **Phần 2 - Bạn Huy:**
   * Trình bày phân hệ **AI Kiểm soát Hạn sử dụng**:
     > *"Tại kịch bản bão lũ, việc vận chuyển bị đình trệ có thể khiến các lô hàng thực phẩm cận date bị quá hạn. Phân hệ của em đã tính toán tốc độ bán và tự động đưa ra kịch bản xuất xả hàng/chiết khấu để thu hồi vốn kịp thời."*
3. **Phần 3 - Bạn Hùng:**
   * Trình bày phân hệ **AI Dự báo Cạn kho Động**:
     > *"Đồng thời, đối với các mặt hàng thiết yếu, phân hệ của em đã tính toán thời gian trễ của nhà cung cấp do mưa bão để tự động nâng mức ROP và đưa ra cảnh báo bổ sung hàng trước 48 giờ."*
4. **Phần 4 - Bạn Hào kết thúc:**
   * Bấm nút **Hành động 1-Click** để tự động tạo phiếu nhập kho/phiếu xuất kho từ chính các đề xuất AI vừa phân tích $\rightarrow$ Khẳng định tính tự động hóa khép kín và giá trị thực tiễn cao của đồ án.

---
*Tài liệu được thiết lập ngày 10/11/2026 nhằm định hướng phát triển và phân công công việc nội bộ nhóm dự án WMS Logistics.*
