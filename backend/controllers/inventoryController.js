const { PrismaClient } = require('@prisma/client');
const { sendLowStockAlert } = require('../services/email.service');
const { getReplenishmentSuggestions } = require('../services/gemini.service');

const prisma = new PrismaClient();

const toNumber = (value) => (value === null || value === undefined ? value : Number(value));
const toIsoDate = (value) => {
  if (!value) return value;
  if (value instanceof Date) return value.toISOString().split('T')[0];
  return value;
};

const serializeRow = (row) => {
  const result = {};
  for (const [key, value] of Object.entries(row)) {
    if (value instanceof Date) result[key] = toIsoDate(value);
    else if (typeof value === 'bigint') result[key] = Number(value);
    else if (value && typeof value === 'object' && typeof value.toNumber === 'function') result[key] = value.toNumber();
    else result[key] = value;
  }
  return result;
};

const formatDateCode = () => {
  const today = new Date();
  return [
    String(today.getFullYear()).slice(-2),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('');
};

const getNextReceiptCode = async ({ model, prefix, digits }) => {
  const fullPrefix = `${prefix}${formatDateCode()}`;
  const last = await prisma[model].findFirst({
    where: { receipt_code: { startsWith: fullPrefix } },
    orderBy: { receipt_code: 'desc' },
  });

  const lastSequence = last ? Number.parseInt(last.receipt_code.slice(-digits), 10) : 0;
  return `${fullPrefix}${String((Number.isNaN(lastSequence) ? 0 : lastSequence) + 1).padStart(digits, '0')}`;
};

// GET /api/inventory/next-import-code
exports.getNextImportCode = async (req, res) => {
  try {
    const receiptCode = await getNextReceiptCode({ model: 'importReceipt', prefix: 'PN', digits: 4 });
    return res.json({ success: true, receipt_code: receiptCode });
  } catch (error) {
    console.error('Error generating next import code:', error);
    return res.status(500).json({ success: false, error: 'Không thể tạo mã phiếu nhập kế tiếp.' });
  }
};

// GET /api/inventory/next-export-code
exports.getNextExportCode = async (req, res) => {
  try {
    const receiptCode = await getNextReceiptCode({ model: 'exportReceipt', prefix: 'PX', digits: 3 });
    return res.json({ success: true, receipt_code: receiptCode });
  } catch (error) {
    console.error('Error generating next export code:', error);
    return res.status(500).json({ success: false, error: 'Không thể tạo mã phiếu xuất kế tiếp.' });
  }
};

// GET /api/inventory
exports.getInventory = async (req, res) => {
  try {
    const { category, low_stock_only } = req.query;
    const rows = await prisma.$queryRaw`
      SELECT *
      FROM "v_stock_balance"
      WHERE (${category || null}::text IS NULL OR "category" = ${category || null})
        AND (${low_stock_only === 'true'}::boolean = false OR "current_stock" < "min_stock")
      ORDER BY "product_code" ASC
    `;

    const inventory = rows.map(serializeRow);
    return res.json({ total: inventory.length, inventory });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return res.status(500).json({ error: 'Lỗi hệ thống khi tải tồn kho hiện tại.' });
  }
};

// GET /api/inventory/lots/:productId
exports.getProductLots = async (req, res) => {
  try {
    const productId = parseInt(req.params.productId, 10);
    if (!productId) return res.status(400).json({ error: 'productId không hợp lệ.' });

    const lots = await prisma.$queryRaw`
      SELECT "lot_id"::int,
             COALESCE("batch_code", 'LOT-' || regexp_replace("receipt_code", '^PN', '') || '-' || "lot_id"::text) AS "batch_code",
             "expiry_date", "import_date", "supplier_id"::int,
             "import_qty"::int, "exported_qty"::int, "current_lot_stock"::int,
             "available_lot_stock"::int, "unit_price"::float, "receipt_code"
      FROM "v_lot_stock"
      WHERE "product_id" = ${productId}
      ORDER BY "expiry_date" ASC NULLS LAST, "import_date" ASC
    `;

    return res.json({
      product_id: productId,
      lots: lots.map(serializeRow),
      total: lots.length,
    });
  } catch (error) {
    console.error('Error fetching product lots:', error);
    return res.status(500).json({ error: 'Lỗi hệ thống khi tải danh sách lô hàng.' });
  }
};

// GET /api/inventory/returnable-products?supplier_id=1
exports.getReturnableProducts = async (req, res) => {
  try {
    const supplierId = parseInt(req.query.supplier_id, 10);
    if (!supplierId) return res.status(400).json({ error: 'supplier_id là bắt buộc.' });

    const rows = await prisma.$queryRaw`
      SELECT
          p.id,
          p.product_code,
          p.name,
          p.unit,
          p.category,
          p.description,
          p.min_stock,
          p.min_days_to_sell,
          p.expiry_warning_days,
          p.unit_price::float,
          p.location_id,
          COALESCE(SUM(vls.available_lot_stock), 0)::int AS current_stock
      FROM "v_lot_stock" vls
      JOIN "products" p ON p.id = vls.product_id
      WHERE vls.supplier_id = ${supplierId}
        AND vls.available_lot_stock > 0
        AND p.is_active = TRUE
      GROUP BY p.id, p.product_code, p.name, p.unit, p.category,
               p.description, p.min_stock, p.min_days_to_sell,
               p.expiry_warning_days, p.unit_price, p.location_id
      ORDER BY p.product_code
    `;

    return res.json({
      supplier_id: supplierId,
      products: rows.map(serializeRow),
      total: rows.length,
    });
  } catch (error) {
    console.error('Error fetching returnable products:', error);
    return res.status(500).json({ error: 'Lỗi hệ thống khi tải sản phẩm có thể trả NCC.' });
  }
};

// GET /api/inventory/dashboard
exports.getDashboard = async (req, res) => {
  try {
    // 1. Overview metrics
    const summary = await prisma.$queryRaw`
      SELECT
        COUNT(DISTINCT "product_id")::int          AS "total_product_types",
        COALESCE(SUM("total_imported"), 0)::int    AS "total_imported_qty",
        COALESCE(SUM("total_exported"), 0)::int    AS "total_exported_qty",
        COALESCE(SUM("current_stock"), 0)::int     AS "total_current_stock"
      FROM "v_stock_balance"
    `;

    const stockValue = await prisma.$queryRaw`
      SELECT COALESCE(SUM("current_lot_stock" * "unit_price"), 0)::float AS "total_stock_value"
      FROM "v_lot_stock"
      WHERE "current_lot_stock" > 0
    `;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // monthly imports (COMPLETED)
    const monthlyImports = await prisma.$queryRaw`
      SELECT COUNT(DISTINCT ir.id)::int AS "count", COALESCE(SUM(id.quantity), 0)::int AS "qty"
      FROM import_receipts ir
      JOIN import_details id ON id.receipt_id = ir.id
      WHERE ir.import_date >= ${monthStart}
        AND ir.status = 'COMPLETED'
    `;

    // monthly exports (COMPLETED)
    const monthlyExports = await prisma.$queryRaw`
      SELECT COUNT(DISTINCT receipt_id)::int AS "count", COALESCE(SUM(quantity), 0)::int AS "qty"
      FROM export_details ed
      JOIN export_receipts er ON er.id = ed.receipt_id
      WHERE er.export_date >= ${monthStart}
        AND er.status = 'COMPLETED'
    `;

    const overview = {
      total_product_types: summary[0]?.total_product_types || 0,
      total_imported_qty: summary[0]?.total_imported_qty || 0,
      total_exported_qty: summary[0]?.total_exported_qty || 0,
      total_current_stock: summary[0]?.total_current_stock || 0,
      total_stock_value: stockValue[0]?.total_stock_value || 0,
    };

    const this_month = {
      import_receipts_count: monthlyImports[0]?.count || 0,
      import_qty: monthlyImports[0]?.qty || 0,
      export_receipts_count: monthlyExports[0]?.count || 0,
      export_qty: monthlyExports[0]?.qty || 0,
    };

    return res.json({
      overview,
      this_month,
      generated_at: now.toISOString(),
    });
  } catch (error) {
    console.error('Error fetching inventory dashboard metrics:', error);
    return res.status(500).json({ error: 'Lỗi hệ thống khi tải số liệu tổng quan.' });
  }
};

// GET /api/inventory/alerts
exports.getAlerts = async (req, res) => {
  try {
    const lowStock = await prisma.$queryRaw`
      SELECT "product_id"::int, "product_code", "product_name", "unit",
             "current_stock"::int, "min_stock"::int,
             ("min_stock" - "current_stock")::int AS "shortage"
      FROM "v_stock_balance"
      WHERE "current_stock" < "min_stock"
      ORDER BY "shortage" DESC
    `;

    const expiringSoon = await prisma.$queryRaw`
      SELECT vls.lot_id::int, vls.product_id::int, vls.product_code, vls.product_name,
             COALESCE(vls.batch_code, 'LOT-' || regexp_replace(vls.receipt_code, '^PN', '') || '-' || vls.lot_id::text) AS batch_code,
             vls.expiry_date, vls.current_lot_stock::int,
             vls.available_lot_stock::int, vls.unit, vls.supplier_id::int,
             (vls.expiry_date - CURRENT_DATE)::int AS days_until_expiry,
             p.min_days_to_sell::int, p.expiry_warning_days::int
      FROM v_lot_stock vls
      JOIN products p ON p.id = vls.product_id
      WHERE vls.expiry_date IS NOT NULL
        AND (vls.expiry_date - CURRENT_DATE) <= p.expiry_warning_days
        AND vls.expiry_date >= CURRENT_DATE
        AND vls.available_lot_stock > 0
      ORDER BY vls.expiry_date ASC
    `;

    const expired = await prisma.$queryRaw`
      SELECT vls.lot_id::int, vls.product_id::int, vls.product_code, vls.product_name,
             COALESCE(vls.batch_code, 'LOT-' || regexp_replace(vls.receipt_code, '^PN', '') || '-' || vls.lot_id::text) AS batch_code,
             vls.expiry_date, vls.current_lot_stock::int,
             vls.available_lot_stock::int, vls.unit, vls.supplier_id::int,
             (vls.expiry_date - CURRENT_DATE)::int AS days_until_expiry,
             p.min_days_to_sell::int, p.expiry_warning_days::int
      FROM v_lot_stock vls
      JOIN products p ON p.id = vls.product_id
      WHERE vls.expiry_date IS NOT NULL
        AND vls.expiry_date < CURRENT_DATE
        AND vls.available_lot_stock > 0
      ORDER BY vls.expiry_date ASC
    `;

    const slowMovingThreshold = new Date();
    slowMovingThreshold.setDate(slowMovingThreshold.getDate() - 30);

    const slowMoving = await prisma.$queryRaw`
      SELECT
          vsb.product_id::int,
          vsb.product_code,
          vsb.product_name,
          vsb.unit,
          vsb.current_stock::int,
          MAX(er.export_date) AS last_export_date,
          (CURRENT_DATE - MAX(er.export_date))::int AS days_since_last_export
      FROM v_stock_balance vsb
      LEFT JOIN export_details ed ON ed.product_id = vsb.product_id
      LEFT JOIN export_receipts er
          ON er.id = ed.receipt_id
          AND er.status = 'COMPLETED'
          AND er.reason = 'SELL'
      WHERE vsb.current_stock > 0
      GROUP BY vsb.product_id, vsb.product_code, vsb.product_name,
               vsb.unit, vsb.current_stock
      HAVING MAX(er.export_date) IS NULL
          OR MAX(er.export_date) < ${slowMovingThreshold}
      ORDER BY last_export_date ASC NULLS FIRST
    `;

    const now = new Date();

    return res.json({
      generated_at: now.toISOString(),
      low_stock: lowStock,
      expiring_soon: expiringSoon,
      expired,
      slow_moving: slowMoving,
      summary: {
        low_stock_count: lowStock.length,
        expiring_soon_count: expiringSoon.length,
        expired_count: expired.length,
        slow_moving_count: slowMoving.length,
      }
    });
  } catch (error) {
    console.error('Error fetching inventory alerts:', error);
    return res.status(500).json({ error: 'Lỗi hệ thống khi tải cảnh báo kho.' });
  }
};

// POST /api/inventory/alerts/dispose
exports.disposeLot = async (req, res) => {
  try {
    const { import_detail_id, product_id, quantity } = req.body;
    
    if (!import_detail_id || !product_id || quantity === undefined) {
      return res.status(400).json({ error: 'Thiếu thông tin lô hàng cần tiêu hủy.' });
    }

    if (quantity <= 0) {
      return res.status(400).json({ error: 'Số lượng tiêu hủy phải lớn hơn 0.' });
    }

    // 1. Generate receipt_code for disposal
    const today = new Date();
    const prefix = 'PX' + [
      String(today.getFullYear()).slice(-2),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('');

    const last = await prisma.exportReceipt.findFirst({
      where: { receipt_code: { startsWith: prefix } },
      orderBy: { receipt_code: 'desc' },
    });

    const lastSequence = last ? Number.parseInt(last.receipt_code.slice(-3), 10) : 0;
    const nextSequence = (Number.isNaN(lastSequence) ? 0 : lastSequence) + 1;
    const receipt_code = `${prefix}${String(nextSequence).padStart(3, '0')}`;

    // 2. Create ExportReceipt with reason DISPOSE
    const exportReceipt = await prisma.exportReceipt.create({
      data: {
        receipt_code,
        export_date: today,
        reason: 'DISPOSE',
        status: 'COMPLETED',
        note: `Tiêu hủy tự động từ cảnh báo lô hàng hết hạn (Lot ID: ${import_detail_id})`,
        created_by: req.user.id,
        approved_by: req.user.id,
        approved_at: today,
        details: {
          create: {
            product_id: parseInt(product_id, 10),
            import_detail_id: parseInt(import_detail_id, 10),
            quantity: parseInt(quantity, 10),
            selling_price: 0
          }
        }
      }
    });

    return res.json({ success: true, message: 'Đã tiêu hủy lô hàng thành công.', receipt_code });
  } catch (error) {
    console.error('Error disposing lot:', error);
    return res.status(500).json({ error: 'Lỗi hệ thống khi tiêu hủy lô hàng.' });
  }
};

// GET /api/inventory/stats
exports.getStats = async (req, res) => {
  try {
    // 1. Get import/export statistics for the last 7 days
    const stats_7days = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      d.setHours(0, 0, 0, 0);
      
      const nextDay = new Date(d);
      nextDay.setDate(d.getDate() + 1);

      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const impRes = await prisma.$queryRaw`
        SELECT COALESCE(SUM(id.quantity), 0)::int as qty
        FROM import_details id
        JOIN import_receipts ir ON ir.id = id.receipt_id
        WHERE ir.import_date = ${dateStr}::DATE
          AND ir.status = 'COMPLETED'
      `;

      const expRes = await prisma.$queryRaw`
        SELECT COALESCE(SUM(ed.quantity), 0)::int as qty
        FROM export_details ed
        JOIN export_receipts er ON er.id = ed.receipt_id
        WHERE er.export_date = ${dateStr}::DATE
          AND er.status = 'COMPLETED'
      `;

      // Date format like "DD/MM"
      const dateLabel = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      
      stats_7days.push({
        date: dateLabel,
        import: impRes[0]?.qty || 0,
        export: expRes[0]?.qty || 0
      });
    }

    // 2. Get stock by category
    const categoryStock = await prisma.$queryRaw`
      SELECT 
          COALESCE(category, 'Chưa phân loại') as name,
          COALESCE(SUM(current_stock), 0)::float as value
      FROM v_stock_balance
      GROUP BY category
      ORDER BY value DESC
    `;

    return res.json({
      stats_7days,
      category_stock: categoryStock
    });
  } catch (error) {
    console.error('Error fetching inventory stats:', error);
    return res.status(500).json({ error: 'Lỗi hệ thống khi tải thống kê biểu đồ.' });
  }
};

// GET /api/inventory/bell-notifications
exports.getBellNotifications = async (req, res) => {
  try {
    const [lowStock, expiringSoon, expired, pendingImports, pendingReturns, recentImports, recentExports] = await Promise.all([
      prisma.$queryRaw`SELECT COUNT(*)::int AS c FROM "v_stock_balance" WHERE "current_stock" < "min_stock"`,
      prisma.$queryRaw`
        SELECT COUNT(*)::int AS c
        FROM "v_lot_stock" vls
        JOIN "products" p ON p.id = vls.product_id
        WHERE vls.expiry_date IS NOT NULL
          AND (vls.expiry_date - CURRENT_DATE) <= p.expiry_warning_days
          AND vls.expiry_date >= CURRENT_DATE
          AND vls.available_lot_stock > 0
      `,
      prisma.$queryRaw`
        SELECT COUNT(*)::int AS c
        FROM "v_lot_stock" vls
        WHERE vls.expiry_date IS NOT NULL
          AND vls.expiry_date < CURRENT_DATE
          AND vls.available_lot_stock > 0
      `,
      prisma.importReceipt.count({ where: { status: { in: ['ARRIVED', 'INSPECTING', 'PENDING_APPROVAL'] } } }),
      prisma.exportReceipt.count({ where: { reason: 'RETURN', status: 'PENDING_APPROVAL' } }),
      prisma.importReceipt.findMany({
        orderBy: { created_at: 'desc' },
        take: 5,
        include: { creator: { select: { full_name: true } } },
      }),
      prisma.exportReceipt.findMany({
        orderBy: { created_at: 'desc' },
        take: 5,
        include: { creator: { select: { full_name: true } } },
      }),
    ]);

    const alerts = [];
    if (lowStock[0]?.c > 0) alerts.push({ type: 'low_stock', message: `Có ${lowStock[0].c} sản phẩm dưới mức tồn kho tối thiểu.` });
    if (expiringSoon[0]?.c > 0) alerts.push({ type: 'expiring_soon', message: `Có ${expiringSoon[0].c} lô hàng sắp hết hạn.` });
    if (expired[0]?.c > 0) alerts.push({ type: 'expired', message: `Có ${expired[0].c} lô hàng đã hết hạn.` });
    if (pendingImports > 0) alerts.push({ type: 'arrival_confirmation', message: `Có ${pendingImports} phiếu nhập cần Admin/Nhân viên xử lý.` });
    if (pendingReturns > 0) alerts.push({ type: 'pending_return', message: `Có ${pendingReturns} phiếu trả NCC đang chờ duyệt.` });

    const activities = [...recentImports.map((item) => ({
      type: 'import',
      created_at: item.created_at,
      message: `${item.creator?.full_name || 'Người dùng'} vừa tạo phiếu nhập ${item.receipt_code}`,
    })), ...recentExports.map((item) => ({
      type: 'export',
      created_at: item.created_at,
      message: `${item.creator?.full_name || 'Người dùng'} vừa tạo phiếu xuất ${item.receipt_code}`,
    }))].sort((a, b) => b.created_at - a.created_at).slice(0, 5).map(({ type, message }) => ({ type, message }));

    const alertsCount = Number(lowStock[0]?.c || 0)
      + Number(expiringSoon[0]?.c || 0)
      + Number(expired[0]?.c || 0)
      + Number(pendingImports || 0)
      + Number(pendingReturns || 0);

    return res.json({
      alerts_count: alertsCount,
      alerts,
      activities,
    });
  } catch (error) {
    console.error('Error fetching bell notifications:', error);
    return res.status(500).json({ error: 'Lỗi hệ thống khi tải thông báo.' });
  }
};

// GET /api/inventory/replenishments/suggestions
exports.getReplenishmentSuggestions = async (req, res) => {
  try {
    const lowStockProducts = await prisma.$queryRaw`
      SELECT "product_id"::int, "product_code", "product_name", "unit", "category",
             "current_stock"::int, "min_stock"::int
      FROM "v_stock_balance"
      WHERE "current_stock" < "min_stock"
      ORDER BY "product_code" ASC
    `;

    if (lowStockProducts.length === 0) {
      return res.json({ suggestions: [], total_suppliers: 0, total_items: 0 });
    }

    const fallbackSupplier = await prisma.supplier.findFirst({ where: { is_active: true }, orderBy: { name: 'asc' } });
    const suggestionsBySupplier = new Map();

    for (const product of lowStockProducts) {
      const links = await prisma.supplierProductPrice.findMany({
        where: { product_id: product.product_id },
        include: { supplier: true },
        orderBy: { contract_price: 'asc' },
      });

      const bestLink = links.find((link) => link.supplier?.is_active);
      const supplier = bestLink?.supplier || fallbackSupplier;
      if (!supplier) continue;

      const shortage = Math.max(0, Number(product.min_stock) - Number(product.current_stock));
      const suggestedQty = Math.max(shortage, Number(product.min_stock) * 2 - Number(product.current_stock));
      const unitPrice = bestLink ? Number(bestLink.contract_price) : 0;
      const leadTimeDays = bestLink ? Number(bestLink.lead_time_days || 2) : 2;
      const estimatedAmount = suggestedQty * unitPrice;

      if (!suggestionsBySupplier.has(supplier.id)) {
        suggestionsBySupplier.set(supplier.id, {
          supplier_id: supplier.id,
          supplier_name: supplier.name,
          supplier_phone: supplier.phone,
          items: [],
          total_estimated_amount: 0,
          max_lead_time_days: 0,
        });
      }

      const group = suggestionsBySupplier.get(supplier.id);
      group.items.push({
        product_id: product.product_id,
        product_code: product.product_code,
        product_name: product.product_name,
        unit: product.unit,
        category: product.category,
        current_stock: Number(product.current_stock),
        min_stock: Number(product.min_stock),
        shortage,
        suggested_qty: suggestedQty,
        unit_price: unitPrice,
        estimated_amount: estimatedAmount,
        lead_time_days: leadTimeDays,
      });
      group.total_estimated_amount += estimatedAmount;
      group.max_lead_time_days = Math.max(group.max_lead_time_days, leadTimeDays);
    }

    const suggestions = Array.from(suggestionsBySupplier.values());
    return res.json({
      suggestions,
      total_suppliers: suggestions.length,
      total_items: suggestions.reduce((sum, supplier) => sum + supplier.items.length, 0),
    });
  } catch (error) {
    console.error('Error fetching replenishment suggestions:', error);
    return res.status(500).json({ error: 'Lỗi hệ thống khi lập đề xuất bổ sung hàng.' });
  }
};

// GET /api/imports (recent)
exports.getImports = async (req, res) => {
  try {
    const imports = await prisma.importReceipt.findMany({
      include: {
        supplier: true
      },
      orderBy: {
        import_date: 'desc'
      },
      take: 20
    });
    
    const result = imports.map(imp => ({
      id: imp.id,
      receipt_code: imp.receipt_code,
      supplier_name: imp.supplier?.name || '—',
      import_date: imp.import_date ? imp.import_date.toISOString().split('T')[0] : '—',
      status: imp.status,
      total_amount: Number(imp.total_amount)
    }));
    
    return res.json(result);
  } catch (error) {
    console.error('Error fetching import receipts:', error);
    return res.status(500).json({ error: 'Lỗi hệ thống khi tải danh sách phiếu nhập.' });
  }
};

// GET /api/exports (recent)
exports.getExports = async (req, res) => {
  try {
    const exports = await prisma.exportReceipt.findMany({
      include: {
        supplier: true
      },
      orderBy: {
        export_date: 'desc'
      },
      take: 20
    });
    
    const result = exports.map(exp => ({
      id: exp.id,
      receipt_code: exp.receipt_code,
      reason: exp.reason,
      supplier_name: exp.supplier?.name || '—',
      export_date: exp.export_date ? exp.export_date.toISOString().split('T')[0] : '—',
      status: exp.status,
      total_amount: Number(exp.total_amount)
    }));
    
    return res.json(result);
  } catch (error) {
    console.error('Error fetching export receipts:', error);
    return res.status(500).json({ error: 'Lỗi hệ thống khi tải danh sách phiếu xuất.' });
  }
};

// POST /api/inventory/alerts/send-email — gửi email cảnh báo tồn thấp (admin)
exports.sendLowStockEmail = async (req, res) => {
  try {
    const lowStock = await prisma.$queryRaw`
      SELECT "product_code", "product_name",
             "current_stock"::int, "min_stock"::int,
             ("min_stock" - "current_stock")::int AS "shortage"
      FROM "v_stock_balance"
      WHERE "current_stock" < "min_stock"
      ORDER BY "shortage" DESC
      LIMIT 50
    `;

    if (!lowStock.length) {
      return res.json({ success: true, message: 'Không có sản phẩm tồn thấp để gửi cảnh báo.', sent: 0 });
    }

    const adminEmail =
      process.env.ADMIN_ALERT_EMAIL ||
      req.user?.email ||
      process.env.EMAIL_USER;

    if (!adminEmail) {
      return res.status(400).json({ error: 'Chưa cấu hình ADMIN_ALERT_EMAIL hoặc email admin.' });
    }

    await sendLowStockAlert(lowStock, adminEmail);

    return res.json({
      success: true,
      message: `Đã gửi email cảnh báo tới ${adminEmail}`,
      sent: lowStock.length,
      sentTo: adminEmail,
    });
  } catch (error) {
    console.error('sendLowStockEmail error:', error);
    return res.status(500).json({
      error: error.message || 'Không thể gửi email cảnh báo.',
    });
  }
};

// ── Gemini AI: Gợi ý đặt hàng bổ sung thông minh (Chuỗi cung ứng + AI) ──────
exports.getAiReplenishmentSuggestions = async (req, res) => {
  try {
    // 1. Lấy danh sách sản phẩm tồn kho thấp
    let lowStockRows = [];
    try {
      lowStockRows = await prisma.$queryRaw`
        SELECT "product_id", "product_code", "product_name", "unit", "category",
               "min_stock"::int, "current_stock"::int,
               ("min_stock" - "current_stock")::int AS "shortage"
        FROM "v_stock_balance"
        WHERE "current_stock" < "min_stock"
        ORDER BY "shortage" DESC
        LIMIT 20
      `;
    } catch {
      lowStockRows = await prisma.$queryRaw`
        SELECT
          p.id            AS product_id,
          p.product_code  AS product_code,
          p.name          AS product_name,
          p.unit          AS unit,
          p.category      AS category,
          p.min_stock,
          COALESCE(SUM(id2.quantity - COALESCE(ed.exported, 0)), 0) AS current_stock
        FROM products p
        LEFT JOIN import_details id2 ON id2.product_id = p.id
          AND EXISTS (SELECT 1 FROM import_receipts ir WHERE ir.id = id2.receipt_id AND ir.status = 'COMPLETED')
        LEFT JOIN (
          SELECT product_id, SUM(quantity) AS exported
          FROM export_details ed2
          JOIN export_receipts er ON er.id = ed2.receipt_id AND er.status = 'COMPLETED'
          GROUP BY product_id
        ) ed ON ed.product_id = p.id
        WHERE p.is_active = true
        GROUP BY p.id, p.product_code, p.name, p.unit, p.category, p.min_stock
        HAVING COALESCE(SUM(id2.quantity - COALESCE(ed.exported, 0)), 0) < p.min_stock
        ORDER BY (p.min_stock - COALESCE(SUM(id2.quantity - COALESCE(ed.exported, 0)), 0)) DESC
        LIMIT 20
      `;
    }

    if (!lowStockRows || lowStockRows.length === 0) {
      return res.json({
        message: 'Kho hàng an toàn: Không có sản phẩm nào chạm ngưỡng tồn kho tối thiểu.',
        low_stock_count: 0,
        suggestions: [],
      });
    }

    const productIds = lowStockRows.map((r) => Number(r.product_id));

    // 2. Lấy tốc độ xuất kho 30 ngày gần nhất để tính Sales Velocity
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const exportStats = await prisma.exportDetail.groupBy({
      by: ['product_id'],
      where: {
        product_id: { in: productIds },
        export_receipt: {
          status: 'COMPLETED',
          export_date: { gte: thirtyDaysAgo },
        },
      },
      _sum: {
        quantity: true,
      },
    });
    const exportMap = new Map(exportStats.map((e) => [e.product_id, Number(e._sum.quantity || 0)]));

    // 3. Lấy bảng giá hợp đồng nhà cung cấp (ưu tiên nhà cung cấp rẻ nhất & active)
    const supplierPrices = await prisma.supplierProductPrice.findMany({
      where: {
        product_id: { in: productIds },
        supplier: { is_active: true },
      },
      include: {
        supplier: true,
      },
      orderBy: {
        contract_price: 'asc',
      },
    });

    // 4. Lấy lịch sử nhập gần nhất để dự phòng
    const recentImports = await prisma.importDetail.findMany({
      where: {
        product_id: { in: productIds },
        import_receipt: { status: 'COMPLETED' },
      },
      include: {
        import_receipt: {
          include: {
            supplier: true,
          },
        },
      },
      orderBy: {
        import_receipt: {
          import_date: 'desc',
        },
      },
      take: 50,
    });

    const defaultActiveSupplier = await prisma.supplier.findFirst({
      where: { is_active: true },
      orderBy: { id: 'asc' },
    });

    // 5. Tính toán các chỉ số Chuỗi cung ứng (Supply Chain Engine)
    const enrichedProducts = lowStockRows.map((row) => {
      const pId = Number(row.product_id);
      const currentStock = Math.max(0, Number(row.current_stock || 0));
      const minStock = Math.max(1, Number(row.min_stock || 10));
      const shortage = Math.max(0, minStock - currentStock);

      const exported30d = exportMap.get(pId) || 0;
      const dailyVelocity = exported30d > 0
        ? Number((exported30d / 30).toFixed(1))
        : Number(Math.max(1, minStock / 10).toFixed(1));

      const bestLink = supplierPrices.find((sp) => sp.product_id === pId);
      const recentImport = recentImports.find((imp) => imp.product_id === pId);

      const supplierId = bestLink?.supplier_id || recentImport?.import_receipt?.supplier_id || defaultActiveSupplier?.id || 1;
      const supplierName = bestLink?.supplier?.name || recentImport?.import_receipt?.supplier?.name || defaultActiveSupplier?.name || 'Nhà cung cấp đối tác';
      const contractPrice = bestLink ? Number(bestLink.contract_price) : (recentImport ? Number(recentImport.unit_price) : 50000);
      const leadTimeDays = bestLink?.lead_time_days || 2;

      const safetyStock = Math.ceil(minStock * 0.4);
      const reorderPoint = Math.ceil((dailyVelocity * leadTimeDays) + safetyStock);
      const runoutDays = dailyVelocity > 0 ? Number((currentStock / dailyVelocity).toFixed(1)) : 999;

      const suggestedQty = Math.max(
        shortage,
        reorderPoint - currentStock,
        Math.ceil(dailyVelocity * 14)
      );

      let priority = 'medium';
      if (currentStock === 0 || runoutDays <= leadTimeDays) {
        priority = 'urgent';
      } else if (currentStock < minStock) {
        priority = 'high';
      }

      return {
        product_id: pId,
        product_code: row.product_code || `SP-${pId}`,
        product_name: row.product_name,
        unit: row.unit || 'cái',
        category: row.category || 'Hàng hóa',
        current_stock: currentStock,
        min_stock: minStock,
        shortage,
        daily_velocity: dailyVelocity,
        runout_days: runoutDays,
        lead_time_days: leadTimeDays,
        safety_stock: safetyStock,
        reorder_point: reorderPoint,
        suggested_qty: suggestedQty,
        supplier_id: supplierId,
        supplier_name: supplierName,
        estimated_price: contractPrice,
        priority,
        baseline_reason: `Tồn kho ${currentStock}/${minStock} ${row.unit || 'cái'}. Tốc độ bán ${dailyVelocity} ${row.unit || 'cái'}/ngày, dự kiến cạn trong ${runoutDays} ngày.`,
      };
    });

    // 6. Gửi qua AI Service (kết hợp phân tích chuyên sâu của Gemini + Fallback chuẩn)
    const suggestions = await getReplenishmentSuggestions(enrichedProducts);

    return res.json({
      generated_at: new Date().toISOString(),
      low_stock_count: lowStockRows.length,
      suggestions,
    });
  } catch (error) {
    console.error('AI replenishment error:', error.message);
    return res.status(500).json({
      error: error.message || 'Không thể tạo gợi ý bổ sung hàng AI.',
    });
  }
};
