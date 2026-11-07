const { GoogleGenerativeAI } = require('@google/generative-ai');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * ── Các hàm truy vấn dữ liệu thời gian thực (Database Tool Handlers) ──
 */

// 1. Tổng quan tình trạng kho
async function getWarehouseOverview() {
  try {
    const totalProducts = await prisma.product.count({ where: { is_active: true } });
    const totalSuppliers = await prisma.supplier.count({ where: { is_active: true } });

    const lowStock = await prisma.$queryRaw`
      SELECT COUNT(*)::int as count FROM "v_stock_balance" WHERE "current_stock" < "min_stock"
    `.catch(() => [{ count: 0 }]);

    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

    const expiringLots = await prisma.importDetail.count({
      where: {
        expiry_date: { lte: thirtyDaysLater, gte: new Date() },
        import_receipt: { status: 'COMPLETED' },
      },
    }).catch(() => 0);

    return {
      total_products: totalProducts,
      total_suppliers: totalSuppliers,
      low_stock_count: lowStock[0]?.count || 0,
      expiring_lots_count: expiringLots,
      system_time: new Date().toLocaleString('vi-VN'),
    };
  } catch (error) {
    console.error('getWarehouseOverview error:', error.message);
    return { error: 'Không thể tải tổng quan kho.' };
  }
}

// 2. Tra cứu sản phẩm & tồn kho
async function searchInventory(keyword) {
  try {
    const cleanKw = keyword ? keyword.trim() : '';
    const products = await prisma.product.findMany({
      where: {
        is_active: true,
        OR: [
          { name: { contains: cleanKw, mode: 'insensitive' } },
          { product_code: { contains: cleanKw, mode: 'insensitive' } },
          { category: { contains: cleanKw, mode: 'insensitive' } },
        ],
      },
      include: {
        default_location: true,
        supplier_prices: {
          include: { supplier: true },
          take: 1,
        },
      },
      take: 8,
    });

    // Lấy tồn kho thực tế từ view hoặc tính toán
    const productIds = products.map((p) => p.id);
    let stockMap = new Map();
    try {
      const stockRows = await prisma.$queryRaw`
        SELECT product_id, current_stock::int FROM "v_stock_balance" WHERE product_id IN (${productIds.length ? productIds.join(',') : 0})
      `;
      stockMap = new Map(stockRows.map((r) => [r.product_id, r.current_stock]));
    } catch {
      // Fallback
    }

    return products.map((p) => ({
      product_id: p.id,
      product_code: p.product_code,
      name: p.name,
      unit: p.unit,
      category: p.category,
      current_stock: stockMap.get(p.id) ?? 0,
      min_stock: p.min_stock,
      unit_price: Number(p.unit_price || 0),
      shelf_location: p.default_location ? `Zone ${p.default_location.zone} - Kệ ${p.default_location.shelf}` : 'Chưa định vị',
      preferred_supplier: p.supplier_prices[0]?.supplier?.name || 'Chưa liên kết',
    }));
  } catch (error) {
    console.error('searchInventory error:', error.message);
    return [];
  }
}

// 3. Tra cứu lô hàng cận hạn sử dụng (FEFO)
async function getExpiringLots(days = 30) {
  try {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + Number(days));

    const lots = await prisma.importDetail.findMany({
      where: {
        expiry_date: { lte: targetDate },
        import_receipt: { status: 'COMPLETED' },
      },
      include: {
        product: {
          include: { default_location: true },
        },
        import_receipt: {
          include: { supplier: true },
        },
      },
      orderBy: { expiry_date: 'asc' },
      take: 10,
    });

    const now = new Date();
    return lots.map((l) => {
      const exp = new Date(l.expiry_date);
      const isExpired = exp < now;
      const daysLeft = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));

      return {
        lot_id: l.id,
        lot_number: l.lot_number || 'N/A',
        product_name: l.product?.name || 'Sản phẩm',
        product_code: l.product?.product_code,
        quantity: l.quantity,
        expiry_date: exp.toLocaleDateString('vi-VN'),
        days_left: daysLeft,
        status: isExpired ? 'Đã hết hạn' : `Còn ${daysLeft} ngày`,
        shelf: l.product?.default_location ? `Zone ${l.product.default_location.zone} - Kệ ${l.product.default_location.shelf}` : 'Kho chính',
        supplier: l.import_receipt?.supplier?.name || 'N/A',
      };
    });
  } catch (error) {
    console.error('getExpiringLots error:', error.message);
    return [];
  }
}

// 4. Bối cảnh rủi ro chuỗi cung ứng & Ngoại cảnh (External World Intelligence)
function getSupplyChainExternalContext() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const isWeekendSurge = dayOfWeek >= 4; // Thứ 5 đến CN
  const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

  return {
    current_time: now.toLocaleString('vi-VN'),
    day_name: dayNames[dayOfWeek],
    is_weekend_surge: isWeekendSurge,
    corridors: [
      {
        route: 'Lâm Đồng (Đà Lạt) ➔ TP.HCM',
        products: 'Rau cải, xà lách, cà chua beef organic',
        risk_level: 'Cảnh báo chậm 1-2 ngày',
        reason: 'Tuyến đèo Bảo Lộc / QL20 thường ùn ứ hoặc sạt lở vào mùa mưa. Cần duy trì tồn kho an toàn ít nhất 2 ngày.',
      },
      {
        route: 'Đồng Nai (Biên Hòa) ➔ TP.HCM',
        products: 'Thịt heo CP, gà CP, bánh kẹo Nestlé',
        risk_level: 'Ổn định',
        reason: 'Khoảng cách gần (~31km qua Xa lộ Hà Nội), thời gian giao chuẩn 1-2 ngày.',
      },
      {
        route: 'Nội thành TP.HCM (Tân Bình, Q7, Q1)',
        products: 'Mì Hảo Hảo (Acecook), Sữa Vinamilk, Masan',
        risk_level: 'Rất nhanh (0.5 - 1 ngày)',
        reason: 'Các nhà máy trong bán kính 10km, có thể đặt hàng gấp trong ngày.',
      },
    ],
    seasonal_factors: isWeekendSurge
      ? 'Đang trong chu kỳ cao điểm mua sắm cuối tuần. Sức mua thực phẩm tươi sống và đồ uống dự kiến tăng +35% đến +50%.'
      : 'Chu kỳ bán hàng ngày thường ổn định. Duy trì mức tồn kho định mức tiêu chuẩn.',
  };
}

/**
 * ── Hàm xử lý Chat chính: Kết hợp Gemini 2.0 + Database Grounding + Fallback Rule Engine ──
 */
async function processChatMessage({ message, history = [], user = {} }) {
  const cleanMsg = (message || '').trim();
  if (!cleanMsg) {
    return {
      reply: 'Xin chào! Tôi là Trợ lý AI Thủ kho. Bạn có thể hỏi tôi về số lượng tồn kho, kiểm tra hạn sử dụng các lô hàng, hoặc tư vấn rủi ro chuỗi cung ứng.',
      suggestions: ['Báo cáo nhanh tồn kho hôm nay', 'Lô hàng nào sắp hết hạn trong 30 ngày?', 'Tồn kho bia Tiger và thịt CP thế nào?', 'Tư vấn rủi ro chuỗi cung ứng cuối tuần'],
    };
  }

  // Thu thập dữ liệu thực tế từ Database để làm ngữ cảnh chuẩn xác
  const [overview, expiringLots, externalContext] = await Promise.all([
    getWarehouseOverview(),
    getExpiringLots(30),
    getSupplyChainExternalContext(),
  ]);

  // Tìm kiếm sản phẩm liên quan nếu câu hỏi có nhắc đến tên hàng
  const searchResults = await searchInventory(cleanMsg);

  // 1. Thử gọi Gemini AI với Context Grounding đầy đủ
  if (process.env.GEMINI_API_KEY) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const systemPrompt = `
Bạn là Trợ lý AI Thủ kho & Chuyên gia Quản trị Chuỗi cung ứng (WMS Logistics Copilot) tại Việt Nam.
Bạn có quyền truy cập trực tiếp vào hệ thống dữ liệu thời gian thực của kho hàng.

--- THÔNG TIN KHO THỜI GIAN THỰC TỪ DATABASE ---
- Tổng số mặt hàng: ${overview.total_products} SP | Nhà cung cấp: ${overview.total_suppliers} NCC
- Số mặt hàng tồn thấp: ${overview.low_stock_count} SP
- Số lô hàng cận hạn (30 ngày): ${overview.expiring_lots_count} lô
- Danh sách một số lô sắp hết hạn: ${JSON.stringify(expiringLots.slice(0, 5))}
- Kết quả tra cứu sản phẩm liên quan trong câu hỏi: ${JSON.stringify(searchResults.slice(0, 4))}

--- TRI THỨC BỐI CẢNH NGOẠI CẢNH & THỊ TRƯỜNG VIỆT NAM ---
- Hôm nay: ${externalContext.day_name} (${externalContext.current_time})
- Đánh giá chu kỳ: ${externalContext.seasonal_factors}
- Tuyến đường vận chuyển: ${JSON.stringify(externalContext.corridors)}

Yêu cầu trả lời:
1. Trả lời trực tiếp, rõ ràng, thân thiện bằng tiếng Việt.
2. Dẫn chứng số liệu thật từ context ở trên (tên SP, số lượng tồn, mã lô, hạn dùng, tên nhà cung cấp, vị trí kệ). Tuyệt đối không bịa số liệu.
3. Nếu người dùng hỏi về thời tiết, rủi ro, vận chuyển hoặc mùa vụ, hãy kết hợp tri thức chuỗi cung ứng ở trên để tư vấn chiến lược.
4. Trình bày bằng Markdown đẹp mắt (sử dụng in đậm, danh sách gạch đầu dòng, icon trực quan).
`;

      const chat = model.startChat({
        history: (history || []).slice(-6).map((h) => ({
          role: h.sender === 'user' ? 'user' : 'model',
          parts: [{ text: h.text }],
        })),
      });

      const fullPrompt = `${systemPrompt}\n\nNgười dùng (${user.full_name || 'Thủ kho'}): ${cleanMsg}`;
      const result = await chat.sendMessage(fullPrompt);
      const reply = result.response.text();

      return {
        reply,
        data_context: {
          matched_products: searchResults.length,
          expiring_lots: expiringLots.length,
          is_weekend_surge: externalContext.is_weekend_surge,
        },
        suggestions: [
          'Lập đề xuất bổ sung hàng tự động',
          'Kiểm tra các lô cận hạn dưới 15 ngày',
          'Xem bản đồ vị trí các nhà cung cấp',
        ],
      };
    } catch (err) {
      console.warn('[ChatAgent] Gemini API error, chuyển sang chế độ Rule-based Engine:', err.message);
    }
  }

  // 2. Chế độ Dự phòng Thông minh (Intelligent Rule-Based Engine)
  // Xử lý hoàn hảo khi không có API Key hoặc hết quota, đảm bảo demo luôn hoạt động 100%
  const lowerMsg = cleanMsg.toLowerCase();

  // Nhánh 1: Hỏi về hạn sử dụng / cận date / hết hạn
  if (lowerMsg.includes('hạn') || lowerMsg.includes('hết hạn') || lowerMsg.includes('date') || lowerMsg.includes('lô')) {
    if (expiringLots.length === 0) {
      return {
        reply: `✅ **Kho hàng đang rất an toàn!** Hiện tại không có lô hàng nào cận hạn sử dụng trong vòng 30 ngày tới theo chiến lược xuất hàng **FEFO**.`,
        suggestions: ['Báo cáo tồn kho hiện tại', 'Đề xuất bổ sung hàng', 'Xem sơ đồ kệ kho'],
      };
    }

    const lotList = expiringLots.slice(0, 5).map((l, idx) => 
      `${idx + 1}. **${l.product_name}** (Mã: \`${l.product_code}\`)\n   - Số lô: **${l.lot_number}** | Số lượng: **${l.quantity}**\n   - Hạn dùng: **${l.expiry_date}** (${l.status})\n   - Vị trí: 📍 **${l.shelf}** | NCC: *${l.supplier}*`
    ).join('\n\n');

    return {
      reply: `⚠️ **Phát hiện ${expiringLots.length} lô hàng cận hạn sử dụng trong 30 ngày tới:**\n\n${lotList}\n\n💡 *Khuyến nghị:* Theo quy trình **FEFO**, hệ thống đã tự động ưu tiên xuất các lô này trước trên màn hình Lập phiếu xuất để hạn chế tối đa hư hao.`,
      suggestions: ['Tạo phiếu xuất tiêu hủy', 'Kiểm tra tồn kho tổng thể', 'Đề xuất nhập hàng'],
    };
  }

  // Nhánh 2: Hỏi về rủi ro thời tiết, mùa vụ, bão lũ, cuối tuần
  if (lowerMsg.includes('thời tiết') || lowerMsg.includes('bão') || lowerMsg.includes('mưa') || lowerMsg.includes('rủi ro') || lowerMsg.includes('cuối tuần') || lowerMsg.includes('mùa vụ')) {
    const corridorInfo = externalContext.corridors.map((c) => 
      `• **${c.route}** (${c.products}):\n  - Trạng thái: **${c.risk_level}**\n  - Đánh giá: *${c.reason}*`
    ).join('\n\n');

    return {
      reply: `🌦️ **Phân tích Rủi ro Chuỗi cung ứng & Bối cảnh Ngoại cảnh:**\n\n📅 **Hôm nay:** ${externalContext.day_name} — ${externalContext.seasonal_factors}\n\n🚛 **Tình hình các hành lang vận chuyển chính:**\n${corridorInfo}\n\n💡 **Chiến lược đề xuất:**\n1. Kích hoạt mức tồn an toàn cao hơn cho nhóm Rau củ quả Đà Lạt.\n2. Tận dụng các nhà cung ứng gần trong TP.HCM (Vinamilk, Acecook, Masan) để bổ sung nhanh trong 24h nếu có đợt mua sắm đột biến.`,
      suggestions: ['Xem đề xuất bổ sung hàng AI', 'Kiểm tra nhà cung cấp trên bản đồ', 'Báo cáo tồn kho'],
    };
  }

  // Nhánh 3: Tra cứu cụ thể sản phẩm hoặc tìm kiếm tồn kho
  if (searchResults.length > 0) {
    const productCards = searchResults.slice(0, 4).map((p) => {
      const stockStatus = p.current_stock < p.min_stock 
        ? `🔴 **Thiếu hụt (Tồn: ${p.current_stock} / Min: ${p.min_stock} ${p.unit})**`
        : `🟢 **Đủ tồn (Tồn: ${p.current_stock} / Min: ${p.min_stock} ${p.unit})**`;
      
      return `📦 **${p.name}** (\`${p.product_code}\`)\n   - Tình trạng: ${stockStatus}\n   - Vị trí lưu kho: 📍 **${p.shelf_location}**\n   - Đơn giá hợp đồng: ~**${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p.unit_price)}**\n   - Đối tác cung ứng: *${p.preferred_supplier}*`;
    }).join('\n\n');

    return {
      reply: `🔍 **Kết quả tra cứu sản phẩm trong kho:**\n\n${productCards}\n\nBạn có muốn tôi kiểm tra số lô chi tiết hoặc lập kế hoạch đặt thêm hàng không?`,
      suggestions: ['Lập phiếu nhập cho sản phẩm này', 'Xem hạn sử dụng các lô', 'Kiểm tra toàn bộ kho'],
    };
  }

  // Nhánh 4: Báo cáo tổng quan kho
  if (lowerMsg.includes('tổng quan') || lowerMsg.includes('báo cáo') || lowerMsg.includes('tình hình') || lowerMsg.includes('kho')) {
    return {
      reply: `📊 **Báo cáo Tình trạng Kho hàng WMS (${overview.system_time}):**\n\n` +
        `• Tổng danh mục hàng hóa: **${overview.total_products} sản phẩm**\n` +
        `• Mạng lưới đối tác: **${overview.total_suppliers} nhà cung cấp**\n` +
        `• Cảnh báo tồn thấp: **${overview.low_stock_count} mặt hàng** cần bổ sung\n` +
        `• Cảnh báo hạn dùng: **${overview.expiring_lots_count} lô hàng** cận date trong 30 ngày\n\n` +
        `💡 *Hôm nay là ${externalContext.day_name}.* ${externalContext.seasonal_factors}`,
      suggestions: ['Gợi ý bổ sung hàng tự động', 'Kiểm tra hàng cận hạn', 'Xem bản đồ nhà cung cấp'],
    };
  }

  // Mặc định: Phản hồi hướng dẫn
  return {
    reply: `👋 **Xin chào! Tôi là Trợ lý AI Thủ kho (WMS Copilot).**\n\nTôi có thể hỗ trợ bạn:\n` +
      `1. 📦 **Tra cứu tức thì:** Hỏi số lượng tồn, vị trí kệ của bất kỳ mặt hàng nào (ví dụ: *"Bia Tiger còn bao nhiêu?", "Thịt heo CP ở kệ nào?"*).\n` +
      `2. ⚠️ **Kiểm tra hạn sử dụng:** Lọc các lô hàng cận hạn theo thuật toán FEFO.\n` +
      `3. 🌦️ **Tư vấn chuỗi cung ứng:** Đánh giá rủi ro thời tiết, sạt lở đèo, chu kỳ mua sắm cuối tuần.\n` +
      `4. 💡 **Tự động hóa:** Gợi ý kế hoạch đặt hàng hợp lý theo điểm đặt hàng lại ROP.`,
    suggestions: ['Báo cáo nhanh tồn kho hôm nay', 'Lô hàng nào sắp hết hạn trong 30 ngày?', 'Tư vấn rủi ro chuỗi cung ứng cuối tuần', 'Tồn kho bia Tiger và mì Hảo Hảo'],
  };
}

module.exports = {
  processChatMessage,
  getWarehouseOverview,
  searchInventory,
  getExpiringLots,
  getSupplyChainExternalContext,
};

