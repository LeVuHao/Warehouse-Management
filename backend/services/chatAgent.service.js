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
function getSupplyChainExternalContext(scenario = 'NORMAL') {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek >= 5;
  const isStormScenario = scenario === 'STORM_CENTRAL';
  const isWeekendScenario = scenario === 'WEEKEND_PEAK' || (!isStormScenario && isWeekend);

  const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const dayName = dayNames[dayOfWeek];

  let scenarioDescription = 'Vận hành tiêu chuẩn. Thời tiết ổn định, các tuyến vận tải và nhà cung cấp hoạt động bình thường.';
  let weatherBriefing = 'Thời tiết khu vực Nam Bộ và các hành lang vận chuyển chính hiện tại tương đối thuận lợi, không có cảnh báo triều cường hay mưa dông lớn. Các tuyến vận chuyển đang lưu thông đúng tiến độ.';

  let corridors = [
    {
      route: 'Lâm Đồng (Đà Lạt) ➔ TP.HCM',
      products: 'Rau cải, xà lách, cà chua beef organic',
      risk_level: isStormScenario ? '🔴 KHẨN CẤP: Chậm 2-3 ngày do sạt lở đèo Bảo Lộc / QL20' : 'Cảnh báo chậm 1-2 ngày',
      reason: isStormScenario
        ? 'Mưa dông lớn gây sạt lở nghiêm trọng đèo Bảo Lộc / QL20. Tuyến đường bị cô lập tạm thời, xe tải buộc phải đi đường vòng ĐT725 làm kéo dài Lead Time +3 ngày.'
        : 'Tuyến đèo Bảo Lộc / QL20 thường ùn ứ vào mùa mưa. Duy trì tồn an toàn 2 ngày.',
    },
    {
      route: 'Đồng bằng Sông Cửu Long (Long An, Tiền Giang) ➔ TP.HCM',
      products: 'Gạo ST25, trái cây, nông sản miền Tây',
      risk_level: isStormScenario ? '🟡 Chậm 1-2 ngày (Triều cường / Mưa ngập QL1A)' : 'Ổn định',
      reason: isStormScenario
        ? 'Triều cường dâng cao kết hợp mưa lớn làm ngập nhiều điểm trên QL1A và cửa ngõ phía Tây TP.HCM, xe tải giao chậm 1-2 ngày.'
        : 'Hành lang vận tải miền Tây thông suốt, thời gian giao hàng chuẩn 1-2 ngày.',
    },
    {
      route: 'Đồng Nai (Biên Hòa) ➔ TP.HCM',
      products: 'Thịt heo CP, gà CP, xúc xích',
      risk_level: isStormScenario ? '🟡 Cần chú ý (Mưa ngập cục bộ)' : 'Ổn định',
      reason: isStormScenario
        ? 'Mưa ngập một số đoạn QL1A và Xa lộ Hà Nội, thời gian giao hàng tăng thêm 0.5 - 1 ngày. Khuyến nghị nhập bù trữ kho ngay.'
        : 'Khoảng cách gần (~31km qua Xa lộ Hà Nội), thời gian giao chuẩn 1-2 ngày.',
    },
    {
      route: 'Nội thành TP.HCM (Tân Bình, Q7, Q1)',
      products: 'Mì Hảo Hảo (Acecook), Sữa Vinamilk, Masan',
      risk_level: 'Rất nhanh (0.5 - 1 ngày)',
      reason: 'Các nhà máy trong bán kính 10km, ưu tiên điều chuyển nội thành để thay thế nguồn cung xa.',
    },
  ];

  if (isStormScenario) {
    scenarioDescription = '⚠️ KỊCH BẢN THỜI TIẾT XẤU & NGẬP LỤT: Mưa lớn diện rộng, triều cường ngập úng tại TP.HCM/Miền Tây và nguy cơ sạt lở đèo Bảo Lộc. Nguồn cung liên tỉnh trễ 2-3 ngày. Tồn kho an toàn thực phẩm thiết yếu tự động nâng x1.5.';
    weatherBriefing = 'Cảnh báo thời tiết xấu: Khu vực Nam Bộ và Miền Tây đang chịu ảnh hưởng mưa dông diện rộng kết hợp triều cường ngập úng nhiều tuyến đường huyết mạch; tuyến đèo Đà Lạt - Lâm Đồng tiềm ẩn nguy cơ sạt lở. Lead time giao hàng dự kiến trễ 2-3 ngày, khuyến nghị ưu tiên nhập dự phòng thực phẩm thiết yếu.';
  } else if (isWeekendScenario) {
    scenarioDescription = '🎉 KỊCH BẢN CAO ĐIỂM CUỐI TUẦN & LỄ HỘI: Nhu cầu tiêu thụ bia, nước giải khát, thịt BBQ tăng mạnh (+35% đến +50%). Tự động kích hoạt điểm đặt hàng lại ROP tăng cường.';
    weatherBriefing = 'Dự báo cuối tuần thời tiết đẹp, thuận lợi cho hoạt động dã ngoại và mua sắm gia đình. Sức mua nhóm đồ uống, bia và thực phẩm tươi sống dự kiến tăng vọt +35% đến +50%.';
  }

  return {
    scenario,
    scenario_title: isStormScenario ? 'Thời tiết xấu, Mưa bão & Ngập lụt' : isWeekendScenario ? 'Cao điểm Cuối tuần' : 'Ngày thường',
    current_time: now.toLocaleString('vi-VN'),
    day_name: dayName,
    is_storm_scenario: isStormScenario,
    is_weekend_surge: isWeekendScenario,
    seasonal_factors: scenarioDescription,
    weather_briefing: weatherBriefing,
    corridors,
  };
}

/**
 * ── Hàm xử lý Chat chính: Kết hợp Gemini 2.0 + Database Grounding + Fallback Rule Engine ──
 */
async function processChatMessage({ message, history = [], user = {}, scenario = 'NORMAL' }) {
  const cleanMsg = (message || '').trim();
  if (!cleanMsg) {
    return {
      reply: 'Xin chào! Tôi là Trợ lý AI Thủ kho. Bạn có thể hỏi tôi về số lượng tồn kho, kiểm tra hạn sử dụng các lô hàng, hoặc tư vấn rủi ro chuỗi cung ứng theo ngữ cảnh hiện tại.',
      suggestions: ['Báo cáo nhanh tồn kho hôm nay', 'Lô hàng nào sắp hết hạn trong 30 ngày?', 'Tồn kho bia Tiger và thịt CP thế nào?', 'Tư vấn rủi ro chuỗi cung ứng'],
    };
  }

  // Thu thập dữ liệu thực tế từ Database để làm ngữ cảnh chuẩn xác
  const [overview, expiringLots, externalContext] = await Promise.all([
    getWarehouseOverview(),
    getExpiringLots(30),
    getSupplyChainExternalContext(scenario),
  ]);

  // Tìm kiếm sản phẩm liên quan nếu câu hỏi có nhắc đến tên hàng
  const searchResults = await searchInventory(cleanMsg);

  // Sinh các nút hành động 1-Click (Actionable execution) dựa trên dữ liệu thật
  const actions = [];

  // Hành động 1: Nếu có kịch bản bão/thời tiết xấu hoặc tồn kho thấp, đề xuất nhập dự phòng ngay
  if (scenario === 'STORM_CENTRAL' || overview.low_stock_count > 0 || scenario === 'WEEKEND_PEAK') {
    actions.push({
      id: 'act-import-replenish',
      type: 'create_import',
      title: scenario === 'STORM_CENTRAL' 
        ? '⚡ Tạo phiếu nhập hàng dự phòng thời tiết xấu' 
        : scenario === 'WEEKEND_PEAK'
        ? '⚡ Tạo phiếu nhập tăng cường cuối tuần'
        : '⚡ Tạo phiếu nhập hàng bổ sung tồn kho',
      description: scenario === 'STORM_CENTRAL'
        ? 'Tự động tạo phiếu nhập từ NCC gần (CP Food Đồng Nai) để bù nguồn cung đèo Bảo Lộc và phòng ngừa ngập úng'
        : 'Tự động tạo phiếu nhập theo định mức ROP đã được tối ưu hóa',
      draftData: {
        supplierId: '1',
        supplierName: 'Công ty Cổ phần Chăn nuôi C.P. Việt Nam',
        note: scenario === 'STORM_CENTRAL' 
          ? 'Phiếu nhập dự phòng thời tiết xấu & ngập lụt (Hệ số an toàn x1.5) - Tự động bởi AI Copilot'
          : 'Phiếu nhập bổ sung cao điểm cuối tuần - Tự động bởi AI Copilot',
        items: [
          { productId: 1, productName: 'Thịt heo tươi CP (Thịt ba rọi)', quantity: '150', price: '135000' },
          { productId: 2, productName: 'Thịt đùi gà CP', quantity: '100', price: '68000' },
        ],
      },
    });
  }

  // Hành động 2: Nếu có lô cận date, đề xuất xuất xả hàng / thanh lý FEFO ngay
  if (expiringLots.length > 0) {
    const topLot = expiringLots[0];
    actions.push({
      id: 'act-export-liquidation',
      type: 'create_export',
      title: `⚡ Tạo phiếu xuất xả hàng cận date (${topLot.product_name})`,
      description: `Lô #${topLot.lot_number} còn ${topLot.days_left} ngày - Ưu tiên xuất theo thuật toán FEFO`,
      draftData: {
        reason: 'SELL',
        customerName: 'Đại lý phân phối xả hàng nhanh / Bách Hóa Xanh Outlet',
        note: `Xuất xả hàng ưu tiên FEFO - Lô cận date ${topLot.days_left} ngày (Đề xuất bởi AI Copilot)`,
        items: [
          {
            productId: topLot.product_code || 1,
            productName: topLot.product_name,
            importDetailId: topLot.lot_id,
            quantity: String(topLot.quantity || 50),
            sellingPrice: '0',
          },
        ],
      },
    });
  }

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
- Điểm tin thời tiết & vận tải hiện tại: ${externalContext.weather_briefing}
- Tuyến đường vận chuyển: ${JSON.stringify(externalContext.corridors)}

Yêu cầu trả lời:
1. Trả lời trực tiếp, rõ ràng, thân thiện bằng tiếng Việt.
2. Dẫn chứng số liệu thật từ context ở trên (tên SP, số lượng tồn, mã lô, hạn dùng, tên nhà cung cấp, vị trí kệ). Tuyệt đối không bịa số liệu.
3. Luôn lồng ghép 1-2 câu nhận định ngắn gọn, tinh tế về bối cảnh thời tiết và tác động vận chuyển hiện tại (${externalContext.weather_briefing}) vào câu trả lời để thủ kho chủ động phương án.
4. Nếu người dùng hỏi về thời tiết, rủi ro, bão lũ, ngập lụt hoặc mùa vụ, hãy phân tích chi tiết các tuyến vận tải (Đà Lạt/Lâm Đồng, Miền Tây, Đồng Nai, Nội thành TP.HCM) và tư vấn phương án dự phòng.
5. Trình bày bằng Markdown đẹp mắt (sử dụng in đậm, danh sách gạch đầu dòng, icon trực quan).
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
        scenario: externalContext.scenario,
        scenario_title: externalContext.scenario_title,
        weather_briefing: externalContext.weather_briefing,
        data_context: {
          matched_products: searchResults.length,
          expiring_lots: expiringLots.length,
          is_weekend_surge: externalContext.is_weekend_surge,
          is_storm_scenario: externalContext.is_storm_scenario,
        },
        actions,
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
        reply: `✅ **Kho hàng đang rất an toàn!** Hiện tại không có lô hàng nào cận hạn sử dụng trong vòng 30 ngày tới theo chiến lược xuất hàng **FEFO**.\n\n🌦️ *Ghi chú thời tiết:* ${externalContext.weather_briefing}`,
        actions,
        scenario: externalContext.scenario,
        weather_briefing: externalContext.weather_briefing,
        suggestions: ['Báo cáo tồn kho hiện tại', 'Đề xuất bổ sung hàng', 'Xem sơ đồ kệ kho'],
      };
    }

    const lotList = expiringLots.slice(0, 5).map((l, idx) => 
      `${idx + 1}. **${l.product_name}** (Mã: \`${l.product_code}\`)\n   - Số lô: **${l.lot_number}** | Số lượng: **${l.quantity}**\n   - Hạn dùng: **${l.expiry_date}** (${l.status})\n   - Vị trí: 📍 **${l.shelf}** | NCC: *${l.supplier}*`
    ).join('\n\n');

    return {
      reply: `⚠️ **Phát hiện ${expiringLots.length} lô hàng cận hạn sử dụng trong 30 ngày tới:**\n\n${lotList}\n\n💡 *Khuyến nghị:* Theo quy trình **FEFO**, hệ thống đã tự động ưu tiên xuất các lô này trước trên màn hình Lập phiếu xuất để hạn chế tối đa hư hao. Bạn có thể bấm nút hành động 1-Click bên dưới để lập phiếu xả hàng ngay.\n\n🌦️ *Ghi chú thời tiết:* ${externalContext.weather_briefing}`,
      actions,
      scenario: externalContext.scenario,
      weather_briefing: externalContext.weather_briefing,
      suggestions: ['Tạo phiếu xuất xả hàng', 'Kiểm tra tồn kho tổng thể', 'Đề xuất nhập hàng'],
    };
  }

  // Nhánh 2: Hỏi về rủi ro thời tiết, mùa vụ, bão lũ, ngập úng, hạn hán, cuối tuần
  if (lowerMsg.includes('thời tiết') || lowerMsg.includes('bão') || lowerMsg.includes('mưa') || lowerMsg.includes('ngập') || lowerMsg.includes('hạn hán') || lowerMsg.includes('rủi ro') || lowerMsg.includes('cuối tuần') || lowerMsg.includes('mùa vụ')) {
    const corridorInfo = externalContext.corridors.map((c) => 
      `• **${c.route}** (${c.products}):\n  - Trạng thái: **${c.risk_level}**\n  - Đánh giá: *${c.reason}*`
    ).join('\n\n');

    return {
      reply: `🌦️ **Phân tích Rủi ro Thời tiết & Chuỗi Cung ứng [${externalContext.scenario_title}]:**\n\n` +
        `🌤️ **Điểm tin thời tiết:** ${externalContext.weather_briefing}\n\n` +
        `🚛 **Tình hình các hành lang vận chuyển chính:**\n${corridorInfo}\n\n` +
        `💡 **Chiến lược đề xuất của AI:**\n` +
        `1. Kích hoạt mức tồn an toàn cao hơn cho nhóm Rau củ quả, Thực phẩm tươi sống và nhu yếu phẩm.\n` +
        `2. Tận dụng các nhà cung ứng gần trong nội thành TP.HCM (Vinamilk, Acecook, Masan) để bổ sung nhanh trong 24h nếu tuyến liên tỉnh bị ngập úng hoặc gián đoạn.\n` +
        `3. Bạn có thể bấm nút hành động 1-Click bên dưới để tự động tạo phiếu nhập kho khẩn cấp.`,
      actions,
      scenario: externalContext.scenario,
      weather_briefing: externalContext.weather_briefing,
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
      reply: `🔍 **Kết quả tra cứu sản phẩm trong kho:**\n\n${productCards}\n\n🌦️ *Tình hình vận tải:* ${externalContext.weather_briefing}\n\nBạn có muốn tôi kiểm tra số lô chi tiết hoặc lập kế hoạch đặt thêm hàng không?`,
      actions,
      scenario: externalContext.scenario,
      weather_briefing: externalContext.weather_briefing,
      suggestions: ['Lập phiếu nhập cho sản phẩm này', 'Xem hạn sử dụng các lô', 'Kiểm tra toàn bộ kho'],
    };
  }

  // Nhánh 4: Báo cáo tổng quan kho
  if (lowerMsg.includes('tổng quan') || lowerMsg.includes('báo cáo') || lowerMsg.includes('tình hình') || lowerMsg.includes('kho')) {
    return {
      reply: `📊 **Báo cáo Tình trạng Kho hàng WMS (${overview.system_time}) [${externalContext.scenario_title}]:**\n\n` +
        `• Tổng danh mục hàng hóa: **${overview.total_products} sản phẩm**\n` +
        `• Mạng lưới đối tác: **${overview.total_suppliers} nhà cung cấp**\n` +
        `• Cảnh báo tồn thấp: **${overview.low_stock_count} mặt hàng** cần bổ sung\n` +
        `• Cảnh báo hạn dùng: **${overview.expiring_lots_count} lô hàng** cận date trong 30 ngày\n\n` +
        `🌦️ **Điểm tin thời tiết & vận tải:** ${externalContext.weather_briefing}\n\n` +
        `💡 *Đang ở kịch bản:* ${externalContext.seasonal_factors}`,
      actions,
      scenario: externalContext.scenario,
      weather_briefing: externalContext.weather_briefing,
      suggestions: ['Gợi ý bổ sung hàng tự động', 'Kiểm tra hàng cận hạn', 'Xem bản đồ nhà cung cấp'],
    };
  }

  // Mặc định: Phản hồi hướng dẫn
  return {
    reply: `👋 **Xin chào! Tôi là Trợ lý AI Thủ kho (WMS Copilot) [Kịch bản: ${externalContext.scenario_title}].**\n\n` +
      `🌦️ **Điểm tin thời tiết & vận tải:**\n${externalContext.weather_briefing}\n\n` +
      `Tôi có thể hỗ trợ bạn:\n` +
      `1. 📦 **Tra cứu tức thì:** Hỏi số lượng tồn, vị trí kệ của bất kỳ mặt hàng nào (ví dụ: *"Bia Tiger còn bao nhiêu?", "Thịt heo CP ở kệ nào?"*).\n` +
      `2. ⚠️ **Kiểm tra hạn sử dụng:** Lọc các lô hàng cận hạn theo thuật toán FEFO.\n` +
      `3. 🌦️ **Tư vấn chuỗi cung ứng:** Đánh giá rủi ro thời tiết (mưa dông, ngập úng triều cường Nam Bộ, sạt lở đèo), chu kỳ mua sắm cuối tuần.\n` +
      `4. ⚡ **Hành động 1-Click:** Tự động điền và tạo phiếu nhập/xuất kho ngay trong khung chat.`,
    actions,
    scenario: externalContext.scenario,
    weather_briefing: externalContext.weather_briefing,
    suggestions: ['Báo cáo nhanh tồn kho hôm nay', 'Lô hàng nào sắp hết hạn trong 30 ngày?', 'Tư vấn rủi ro chuỗi cung ứng', 'Tồn kho bia Tiger và mì Hảo Hảo'],
  };
}

module.exports = {
  processChatMessage,
  getWarehouseOverview,
  searchInventory,
  getExpiringLots,
  getSupplyChainExternalContext,
};

