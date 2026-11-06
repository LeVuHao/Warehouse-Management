const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Gợi ý đặt hàng bổ sung thông minh kết hợp Thuật toán Chuỗi cung ứng (ROP, Velocity) & Gemini AI.
 * @param {Array} enrichedProducts - Danh sách SP kèm chỉ số chuỗi cung ứng (tốc độ bán, NCC chuẩn, giá hợp đồng...)
 * @param {Array} importHistory    - Lịch sử nhập hàng gần nhất
 * @returns {Array} Danh sách đề xuất chi tiết
 */
async function getReplenishmentSuggestions(enrichedProducts, importHistory = []) {
  // Chuẩn bị dữ liệu fallback chuẩn chỉnh (không bao giờ gán cứng Masan hay giá giả)
  const computeFallback = () => {
    return enrichedProducts.map((p) => {
      let dynamicReason = '';
      if (p.priority === 'urgent') {
        dynamicReason = `Tồn kho cạn kiệt (${p.current_stock} ${p.unit}). Với tốc độ xuất ${p.daily_velocity} ${p.unit}/ngày, dự kiến cạn kho trong ${p.runout_days} ngày. Trong khi NCC ${p.supplier_name} mất ${p.lead_time_days} ngày giao. Cần nhập gấp ${p.suggested_qty} ${p.unit} để tránh đứt gãy chuỗi cung ứng.`;
      } else if (p.priority === 'high') {
        dynamicReason = `Tồn kho thấp hơn mức an toàn (${p.current_stock}/${p.min_stock} ${p.unit}). Tốc độ tiêu thụ ổn định ${p.daily_velocity} ${p.unit}/ngày. Đề xuất nhập ${p.suggested_qty} ${p.unit} từ ${p.supplier_name} để duy trì chu kỳ bán 14 ngày tới.`;
      } else {
        dynamicReason = `Tồn kho tiệm cận điểm đặt hàng lại (ROP = ${p.reorder_point} ${p.unit}). Đề xuất bổ sung dự phòng ${p.suggested_qty} ${p.unit} theo kế hoạch định kỳ.`;
      }

      return {
        product_id: p.product_id,
        product_code: p.product_code,
        product_name: p.product_name,
        unit: p.unit,
        category: p.category,
        current_stock: p.current_stock,
        min_stock: p.min_stock,
        suggested_qty: p.suggested_qty,
        supplier_id: p.supplier_id,
        supplier_name: p.supplier_name,
        estimated_price: p.estimated_price,
        priority: p.priority,
        daily_velocity: p.daily_velocity,
        runout_days: p.runout_days,
        lead_time_days: p.lead_time_days,
        reorder_point: p.reorder_point,
        reason: dynamicReason,
      };
    });
  };

  // Nếu không có API Key, sử dụng ngay kết quả tính toán thuật toán chuỗi cung ứng
  if (!process.env.GEMINI_API_KEY) {
    console.log('[AI Replenishment] Chưa cấu hình GEMINI_API_KEY, kích hoạt thuật toán Supply Chain nội bộ.');
    return computeFallback();
  }

  const prompt = `
Bạn là Giám đốc Chuỗi cung ứng (Supply Chain Director) hàng đầu tại chuỗi bán lẻ Việt Nam.
Dưới đây là bảng phân tích tồn kho và các chỉ số chuỗi cung ứng thực tế từ cơ sở dữ liệu:

--- DỮ LIỆU SẢN PHẨM & TỒN KHO THỰC TẾ ---
${JSON.stringify(
  enrichedProducts.map((p) => ({
    product_id: p.product_id,
    product_code: p.product_code,
    product_name: p.product_name,
    unit: p.unit,
    current_stock: p.current_stock,
    min_stock: p.min_stock,
    daily_velocity: `${p.daily_velocity} ${p.unit}/ngày`,
    estimated_runout_days: `${p.runout_days} ngày`,
    preferred_supplier: p.supplier_name,
    contract_price: p.estimated_price,
    lead_time_days: `${p.lead_time_days} ngày`,
    suggested_qty_by_algo: p.suggested_qty,
    priority: p.priority,
  })),
  null,
  2
)}

Yêu cầu chuyên môn:
1. Đánh giá số lượng đặt hàng đề xuất (suggested_qty). Giữ nguyên hoặc điều chỉnh hợp lý dựa trên tốc độ tiêu thụ và thời gian giao hàng.
2. Tuyệt đối giữ đúng nhà cung cấp tương ứng (supplier_name) và đơn giá (estimated_price), không tự bịa nhà cung cấp khác.
3. Viết phân tích lý do (reason) sắc sảo, thuyết phục bằng tiếng Việt chuyên ngành Logistics (nêu rõ số ngày cạn kho, tốc độ bán, rủi ro thiếu hụt).
4. Phân loại mức độ ưu tiên chuẩn xác: urgent (khẩn cấp), high (cao), medium (trung bình).

Trả về ĐÚNG định dạng JSON array sau (không thêm markdown ngoài JSON):
[
  {
    "product_id": <số>,
    "suggested_qty": <số nguyên lượng đặt>,
    "priority": "urgent|high|medium",
    "reason": "<phân tích chuyên sâu 1-2 câu>"
  }
]`;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('Gemini không trả về JSON hợp lệ');

    const aiOutputs = JSON.parse(jsonMatch[0]);

    // Hợp nhất kết quả AI với dữ liệu gốc chuẩn xác từ database
    return enrichedProducts.map((p) => {
      const aiItem = aiOutputs.find((item) => Number(item.product_id) === Number(p.product_id));
      return {
        product_id: p.product_id,
        product_code: p.product_code,
        product_name: p.product_name,
        unit: p.unit,
        category: p.category,
        current_stock: p.current_stock,
        min_stock: p.min_stock,
        suggested_qty: aiItem?.suggested_qty && aiItem.suggested_qty > 0 ? Number(aiItem.suggested_qty) : p.suggested_qty,
        supplier_id: p.supplier_id,
        supplier_name: p.supplier_name,
        estimated_price: p.estimated_price,
        priority: aiItem?.priority || p.priority,
        daily_velocity: p.daily_velocity,
        runout_days: p.runout_days,
        lead_time_days: p.lead_time_days,
        reorder_point: p.reorder_point,
        reason: aiItem?.reason || p.baseline_reason,
      };
    });
  } catch (err) {
    console.warn('[AI Replenishment] Gemini API error (fallback to internal algorithm):', err.message);
    return computeFallback();
  }
}

module.exports = { getReplenishmentSuggestions };
