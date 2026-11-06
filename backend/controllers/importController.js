const { PrismaClient } = require('@prisma/client');
const { sendInspectionAlert } = require('../services/email.service');
const prisma = new PrismaClient();

// ────────────────────────────────────────────────────────────
// Utility: generate receipt code like TTCS: PN + YYMMDD + 4-digit sequence
// ────────────────────────────────────────────────────────────
async function generateReceiptCode() {
  const today = new Date();
  const y = String(today.getFullYear()).slice(-2);
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const prefix = `PN${y}${m}${d}`;

  const last = await prisma.importReceipt.findFirst({
    where: { receipt_code: { startsWith: prefix } },
    orderBy: { receipt_code: 'desc' },
  });

  let seq = 1;
  if (last) {
    seq = parseInt(last.receipt_code.slice(-4), 10) + 1;
  }
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

// ────────────────────────────────────────────────────────────
// GET /api/imports  — danh sách phiếu nhập (có filter/search)
// ────────────────────────────────────────────────────────────
exports.getAll = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      status = '',
      supplier_id = '',
      from_date = '',
      to_date = '',
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where = {};

    if (search) {
      where.OR = [
        { receipt_code: { contains: search, mode: 'insensitive' } },
        { supplier: { name: { contains: search, mode: 'insensitive' } } },
        { details: { some: { product: { name: { contains: search, mode: 'insensitive' } } } } },
      ];
    }
    if (status) where.status = status;
    if (supplier_id) where.supplier_id = parseInt(supplier_id);
    if (from_date) where.import_date = { ...(where.import_date || {}), gte: new Date(from_date) };
    if (to_date) where.import_date = { ...(where.import_date || {}), lte: new Date(to_date) };

    const [total, items] = await Promise.all([
      prisma.importReceipt.count({ where }),
      prisma.importReceipt.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true } },
          creator: { select: { id: true, full_name: true } },
          details: { 
            select: { 
              id: true, 
              quantity: true,
              product: { select: { name: true } }
            } 
          },
        },
        orderBy: { import_date: 'desc' },
        skip,
        take,
      }),
    ]);

    const data = items.map((r) => ({
      id: r.id,
      receipt_code: r.receipt_code,
      import_date: r.import_date ? r.import_date.toISOString().split('T')[0] : null,
      supplier_id: r.supplier_id,
      supplier_name: r.supplier?.name || '—',
      status: r.status,
      total_amount: Number(r.total_amount),
      items_count: r.details.length,
      total_qty: r.details.reduce((s, d) => s + d.quantity, 0),
      product_names: r.details.map((d) => d.product?.name).filter(Boolean),
      created_by: r.creator?.full_name || '—',
      created_at: r.created_at,
      note: r.note,
    }));

    return res.json({
      data,
      pagination: {
        total,
        page: parseInt(page),
        limit: take,
        total_pages: Math.ceil(total / take),
      },
    });
  } catch (err) {
    console.error('getAll imports error:', err);
    return res.status(500).json({ error: 'Lỗi hệ thống khi tải danh sách phiếu nhập.' });
  }
};

// ────────────────────────────────────────────────────────────
// GET /api/imports/:id  — chi tiết 1 phiếu nhập
// ────────────────────────────────────────────────────────────
exports.getById = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const receipt = await prisma.importReceipt.findUnique({
      where: { id },
      include: {
        supplier: true,
        creator: { select: { id: true, full_name: true, username: true } },
        inspector: { select: { id: true, full_name: true, username: true } },
        completer: { select: { id: true, full_name: true, username: true } },
        details: {
          include: {
            product: {
              select: {
                id: true,
                product_code: true,
                name: true,
                unit: true,
                category: true,
                unit_price: true,
                location_id: true,
              },
            },
            lot_location: { select: { id: true, location_code: true, name: true } },
          },
          orderBy: { id: 'asc' },
        },
      },
    });

    if (!receipt) return res.status(404).json({ error: 'Không tìm thấy phiếu nhập.' });

    return res.json(receipt);
  } catch (err) {
    console.error('getById import error:', err);
    return res.status(500).json({ error: 'Lỗi hệ thống khi tải chi tiết phiếu nhập.' });
  }
};

// ────────────────────────────────────────────────────────────
// POST /api/imports  — tạo phiếu nhập mới
// Body: { supplier_id, import_date, note, transport_note,
//         estimated_delivery_days,
//         details: [{ product_id, quantity, unit_price,
//                     batch_code, expiry_date, mfg_date, location_id }] }
// ────────────────────────────────────────────────────────────
exports.create = async (req, res) => {
  try {
    const {
      supplier_id,
      import_date,
      note,
      transport_note,
      estimated_delivery_days,
      details = [],
    } = req.body;

    const created_by = req.user.id;

    if (!supplier_id) return res.status(400).json({ error: 'Vui lòng chọn nhà cung cấp.' });
    if (!import_date) return res.status(400).json({ error: 'Vui lòng nhập ngày nhập.' });
    if (!details || details.length === 0) {
      return res.status(400).json({ error: 'Phiếu nhập phải có ít nhất 1 sản phẩm.' });
    }

    // Verify that all product_ids are valid integers and exist in database
    const uniqueProductIds = [...new Set(details.map((d) => parseInt(d.product_id)))];
    if (uniqueProductIds.some(Number.isNaN)) {
      return res.status(400).json({ error: 'Mã ID sản phẩm không hợp lệ.' });
    }

    const productsExist = await prisma.product.findMany({
      where: {
        id: { in: uniqueProductIds },
      },
    });

    if (productsExist.length !== uniqueProductIds.length) {
      return res.status(400).json({
        error: 'Có sản phẩm không tồn tại trong hệ thống.',
      });
    }

    // Verify that all products are supplied by the selected supplier
    const supplierPrices = await prisma.supplierProductPrice.findMany({
      where: {
        supplier_id: parseInt(supplier_id),
        product_id: { in: uniqueProductIds },
      },
    });

    if (supplierPrices.length !== uniqueProductIds.length) {
      return res.status(400).json({
        error: 'Một hoặc nhiều sản phẩm không được cung cấp bởi nhà cung cấp đã chọn.',
      });
    }

    const receipt_code = await generateReceiptCode();

    // Calculate total
    const total_amount = details.reduce(
      (sum, d) => sum + (parseFloat(d.unit_price) || 0) * (parseInt(d.quantity) || 0),
      0
    );

    const receipt = await prisma.importReceipt.create({
      data: {
        receipt_code,
        import_date: new Date(import_date),
        supplier_id: parseInt(supplier_id),
        total_amount,
        status: 'IN_TRANSIT',
        note: note || null,
        transport_note: transport_note || null,
        estimated_delivery_days: estimated_delivery_days ? parseInt(estimated_delivery_days) : null,
        estimated_arrival_date: estimated_delivery_days
          ? new Date(new Date(import_date).getTime() + parseInt(estimated_delivery_days) * 86400000)
          : null,
        created_by,
        shipping_started_at: new Date(),
        details: {
          create: details.map((d) => ({
            product_id: parseInt(d.product_id),
            quantity: parseInt(d.quantity),
            expected_quantity: parseInt(d.quantity),
            unit_price: parseFloat(d.unit_price) || 0,
            batch_code: d.batch_code || null,
            expiry_date: d.expiry_date ? new Date(d.expiry_date) : null,
            mfg_date: d.mfg_date ? new Date(d.mfg_date) : null,
            location_id: d.location_id ? parseInt(d.location_id) : null,
          })),
        },
      },
      include: {
        supplier: { select: { id: true, name: true } },
        details: { include: { product: true } },
      },
    });

    // ── Gửi thông báo realtime qua Socket.io ──
    const io = req.app.get('io');
    if (io) {
      io.emit('new_notification', {
        type: 'import',
        message: `Người dùng vừa tạo phiếu nhập ${receipt_code}`,
        timestamp: new Date()
      });
    }

    return res.status(201).json(receipt);
  } catch (err) {
    console.error('create import error:', err);
    return res.status(500).json({ error: 'Lỗi hệ thống khi tạo phiếu nhập.' });
  }
};

// ────────────────────────────────────────────────────────────
// PATCH /api/imports/:id  — sửa thông tin phiếu (khi còn IN_TRANSIT)
// ────────────────────────────────────────────────────────────
exports.update = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.importReceipt.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy phiếu nhập.' });

    if (!['IN_TRANSIT', 'ARRIVED'].includes(existing.status)) {
      return res.status(400).json({ error: 'Chỉ có thể chỉnh sửa phiếu ở trạng thái IN_TRANSIT hoặc ARRIVED.' });
    }

    const { note, transport_note, estimated_delivery_days, import_date } = req.body;

    const updated = await prisma.importReceipt.update({
      where: { id },
      data: {
        note: note !== undefined ? note : existing.note,
        transport_note: transport_note !== undefined ? transport_note : existing.transport_note,
        estimated_delivery_days:
          estimated_delivery_days !== undefined
            ? parseInt(estimated_delivery_days)
            : existing.estimated_delivery_days,
        import_date: import_date ? new Date(import_date) : existing.import_date,
      },
    });

    return res.json(updated);
  } catch (err) {
    console.error('update import error:', err);
    return res.status(500).json({ error: 'Lỗi hệ thống khi cập nhật phiếu nhập.' });
  }
};

// ────────────────────────────────────────────────────────────
// PATCH /api/imports/:id/arrive  — đánh dấu hàng ĐÃ VỀ KHO
// Chuyển trạng thái IN_TRANSIT → ARRIVED
// ────────────────────────────────────────────────────────────
exports.markArrived = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const receipt = await prisma.importReceipt.findUnique({
      where: { id },
      include: {
        details: {
          include: {
            product: { select: { id: true, name: true, category: true } },
          },
        },
      },
    });
    if (!receipt) return res.status(404).json({ error: 'Không tìm thấy phiếu nhập.' });
    if (receipt.status !== 'IN_TRANSIT') {
      return res.status(400).json({ error: 'Phiếu nhập không ở trạng thái IN_TRANSIT.' });
    }

    const updated = await prisma.importReceipt.update({
      where: { id },
      data: {
        status: 'ARRIVED',
        actual_arrival_at: new Date(),
      },
    });

    // Thông báo realtime: chuông tự cập nhật trên mọi trình duyệt
    const io = req.app.get('io');
    if (io) io.emit('new_notification', { type: 'import_arrived', receipt_id: id });

    return res.json({ message: 'Đã xác nhận hàng về kho.', receipt: updated });
  } catch (err) {
    console.error('markArrived error:', err);
    return res.status(500).json({ error: 'Lỗi hệ thống khi cập nhật trạng thái.' });
  }
};

// ────────────────────────────────────────────────────────────
// PATCH /api/imports/:id/inspect  — kiểm tra hàng hoá
// Chuyển trạng thái ARRIVED → PENDING_APPROVAL
// Body: { issue_notes, details: [{ detail_id, received_qty, accepted_qty, rejected_qty }] }
// ────────────────────────────────────────────────────────────
exports.inspect = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const inspected_by = req.user.id;
    const { issue_notes, details = [], send_email_notification } = req.body;

    const receipt = await prisma.importReceipt.findUnique({
      where: { id },
      include: {
        details: {
          include: {
            product: { select: { id: true, name: true, category: true } },
          },
        },
      },
    });
    if (!receipt) return res.status(404).json({ error: 'Không tìm thấy phiếu nhập.' });
    if (receipt.status !== 'ARRIVED') {
      return res.status(400).json({ error: 'Phiếu nhập phải ở trạng thái ARRIVED để kiểm tra.' });
    }

    const detailMap = new Map(receipt.details.map((detail) => [detail.id, detail]));
    const locationDemands = new Map();

    for (const d of details) {
      const detailId = parseInt(d.detail_id, 10);
      const detail = detailMap.get(detailId);
      if (!detail) {
        return res.status(400).json({ error: `Dòng kiểm kho ${detailId || ''} không thuộc phiếu nhập này.` });
      }

      const receivedQty = parseInt(d.received_qty ?? d.received_quantity, 10);
      const acceptedQty = parseInt(d.accepted_qty ?? d.accepted_quantity ?? d.quantity, 10);
      const rejectedQty = parseInt(d.rejected_qty ?? d.rejected_quantity, 10);
      if ([receivedQty, acceptedQty, rejectedQty].some((qty) => Number.isNaN(qty) || qty < 0)) {
        return res.status(400).json({ error: `Số lượng kiểm kho của "${detail.product?.name || detailId}" không hợp lệ.` });
      }
      if (acceptedQty + rejectedQty !== receivedQty) {
        return res.status(400).json({ error: `Số lượng đạt và lỗi của "${detail.product?.name || detailId}" phải bằng số lượng nhận.` });
      }

      if (d.location_id) {
        const locationId = parseInt(d.location_id, 10);
        if (Number.isNaN(locationId)) {
          return res.status(400).json({ error: 'Vị trí kệ không hợp lệ.' });
        }

        const location = await prisma.location.findFirst({
          where: { id: locationId, is_active: true },
        });
        if (!location) {
          return res.status(404).json({ error: `Không tìm thấy vị trí kệ id=${locationId}.` });
        }
        if (location.zone !== detail.product?.category) {
          return res.status(400).json({
            error: `Kệ "${location.location_code}" thuộc phân khu "${location.zone}", không khớp sản phẩm "${detail.product?.name}" thuộc "${detail.product?.category}".`,
          });
        }

        const current = locationDemands.get(locationId) || { location, qty: 0 };
        current.qty += acceptedQty;
        locationDemands.set(locationId, current);
      }
    }

    for (const { location, qty } of locationDemands.values()) {
      const available = Number(location.max_capacity || 0) - Number(location.current_occupied || 0);
      if (available < qty) {
        return res.status(400).json({
          error: `Kệ "${location.location_code}" không đủ sức chứa. Còn trống ${available}, cần xếp ${qty}.`,
        });
      }
    }

    for (const d of details) {
      const detailId = parseInt(d.detail_id, 10);
      const receivedQty = parseInt(d.received_qty ?? d.received_quantity, 10);
      const acceptedQty = parseInt(d.accepted_qty ?? d.accepted_quantity ?? d.quantity, 10);
      const rejectedQty = parseInt(d.rejected_qty ?? d.rejected_quantity, 10);

      if (!detailId) continue;

      await prisma.importDetail.update({
        where: { id: detailId },
        data: {
          quantity: Number.isNaN(acceptedQty) ? undefined : Math.max(0, acceptedQty),
          received_quantity: Number.isNaN(receivedQty) ? null : Math.max(0, receivedQty),
          accepted_quantity: Number.isNaN(acceptedQty) ? null : Math.max(0, acceptedQty),
          rejected_quantity: Number.isNaN(rejectedQty) ? 0 : Math.max(0, rejectedQty),
          batch_code: d.batch_code?.trim() || undefined,
          mfg_date: d.mfg_date ? new Date(d.mfg_date) : undefined,
          expiry_date: d.expiry_date ? new Date(d.expiry_date) : undefined,
          location_id: d.location_id ? parseInt(d.location_id, 10) : undefined,
        },
      });
    }

    const updated = await prisma.importReceipt.update({
      where: { id },
      data: {
        status: 'PENDING_APPROVAL',
        inspected_by,
        inspected_at: new Date(),
        issue_notes: issue_notes || null,
      },
    });

    // Thông báo realtime: Admin nhận ngay thông báo có phiếu chờ duyệt
    const io = req.app.get('io');
    if (io) io.emit('new_notification', { type: 'import_inspected', receipt_id: id });

    if (send_email_notification) {
      try {
        const receiptWithDetails = await prisma.importReceipt.findUnique({
          where: { id },
          include: {
            details: {
              include: {
                product: { select: { product_code: true, name: true } },
                lot_location: { select: { location_code: true } },
              },
            },
            supplier: { select: { name: true } },
            inspector: { select: { full_name: true, email: true } },
          },
        });

        const admins = await prisma.user.findMany({
          where: { role: 'admin', is_active: true, email: { not: null, not: '' } },
          select: { email: true },
        });

        const emails = admins.map((a) => a.email).filter(Boolean);
        if (emails.length === 0) {
          const fallback = process.env.ADMIN_ALERT_EMAIL || process.env.EMAIL_USER;
          if (fallback) emails.push(fallback);
        }

        for (const email of emails) {
          await sendInspectionAlert(receiptWithDetails, email);
        }
      } catch (emailErr) {
        console.error('Failed to send inspection alert email:', emailErr);
      }
    }

    return res.json({ message: 'Đã lưu kết quả kiểm tra.', receipt: updated });
  } catch (err) {
    console.error('inspect error:', err);
    return res.status(500).json({ error: 'Lỗi hệ thống khi lưu kết quả kiểm tra.' });
  }
};

// ────────────────────────────────────────────────────────────
// PATCH /api/imports/:id/complete  — hoàn tất nhập kho
// Chuyển trạng thái PENDING_APPROVAL → COMPLETED
// ────────────────────────────────────────────────────────────
exports.complete = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const completed_by = req.user.id;

    const receipt = await prisma.importReceipt.findUnique({
      where: { id },
      include: { details: true },
    });
    if (!receipt) return res.status(404).json({ error: 'Không tìm thấy phiếu nhập.' });
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ Admin mới có quyền hoàn tất phiếu nhập sau khi kiểm kho.' });
    }
    if (!['PENDING_APPROVAL', 'INSPECTING'].includes(receipt.status)) {
      return res.status(400).json({ error: 'Phiếu nhập phải ở trạng thái chờ duyệt để Admin hoàn tất.' });
    }

    // Update total_amount based on accepted_quantity or quantity
    const total_amount = receipt.details.reduce((sum, d) => {
      const qty = d.accepted_quantity ?? d.quantity;
      return sum + qty * Number(d.unit_price);
    }, 0);

    const datePart = receipt.receipt_code?.replace(/^PN/, '') || String(receipt.id).padStart(6, '0');
    for (const detail of receipt.details) {
      const data = {};
      if (!detail.batch_code) data.batch_code = `LOT-${datePart}-${detail.id}`;
      if (detail.accepted_quantity != null && detail.quantity !== detail.accepted_quantity) {
        data.quantity = detail.accepted_quantity;
      }
      if (Object.keys(data).length > 0) {
        await prisma.importDetail.update({ where: { id: detail.id }, data });
      }
    }

    const locationDemands = new Map();
    for (const detail of receipt.details) {
      if (!detail.location_id) continue;
      const qty = detail.accepted_quantity ?? detail.quantity;
      locationDemands.set(detail.location_id, (locationDemands.get(detail.location_id) || 0) + qty);
    }

    for (const [locationId, qty] of locationDemands.entries()) {
      await prisma.location.update({
        where: { id: locationId },
        data: { current_occupied: { increment: qty } },
      });
    }

    const updated = await prisma.importReceipt.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completed_by,
        completed_at: new Date(),
        total_amount,
      },
    });

    // Thông báo realtime: phiếu đã duyệt xong → chuông biến mất trên mọi trình duyệt
    const io = req.app.get('io');
    if (io) io.emit('new_notification', { type: 'import_completed', receipt_id: id });

    return res.json({ message: 'Phiếu nhập đã được hoàn tất và nhập kho thành công.', receipt: updated });
  } catch (err) {
    console.error('complete import error:', err);
    return res.status(500).json({ error: 'Lỗi hệ thống khi hoàn tất phiếu nhập.' });
  }
};

// ────────────────────────────────────────────────────────────
// PATCH /api/imports/:id/cancel  — huỷ phiếu nhập
// ────────────────────────────────────────────────────────────
exports.cancel = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const receipt = await prisma.importReceipt.findUnique({ where: { id } });
    if (!receipt) return res.status(404).json({ error: 'Không tìm thấy phiếu nhập.' });
    if (receipt.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Không thể huỷ phiếu nhập đã hoàn tất.' });
    }
    if (receipt.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Phiếu nhập đã bị huỷ trước đó.' });
    }

    const { cancel_reason } = req.body;

    const updated = await prisma.importReceipt.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        issue_notes: cancel_reason
          ? `[HUỶ] ${cancel_reason}`
          : receipt.issue_notes,
      },
    });

    // Thông báo realtime khi hủy phiếu
    const io = req.app.get('io');
    if (io) io.emit('new_notification', { type: 'import_cancelled', receipt_id: id });

    return res.json({ message: 'Phiếu nhập đã bị huỷ.', receipt: updated });
  } catch (err) {
    console.error('cancel import error:', err);
    return res.status(500).json({ error: 'Lỗi hệ thống khi huỷ phiếu nhập.' });
  }
};

// ────────────────────────────────────────────────────────────
// GET /api/imports/stats  — thống kê tổng quan phiếu nhập
// ────────────────────────────────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [byStatus, thisMonth, topSuppliers] = await Promise.all([
      // Count by status
      prisma.importReceipt.groupBy({
        by: ['status'],
        _count: { id: true },
        _sum: { total_amount: true },
      }),
      // This month summary
      prisma.importReceipt.aggregate({
        where: {
          import_date: { gte: monthStart },
          status: 'COMPLETED',
        },
        _count: { id: true },
        _sum: { total_amount: true },
      }),
      // Top 5 suppliers by import value
      prisma.$queryRaw`
        SELECT s.id, s.name,
               COUNT(ir.id)::int AS receipt_count,
               COALESCE(SUM(ir.total_amount), 0)::float AS total_value
        FROM suppliers s
        JOIN import_receipts ir ON ir.supplier_id = s.id
        WHERE ir.status = 'COMPLETED'
        GROUP BY s.id, s.name
        ORDER BY total_value DESC
        LIMIT 5
      `,
    ]);

    return res.json({
      by_status: byStatus.map((b) => ({
        status: b.status,
        count: b._count.id,
        total_amount: Number(b._sum.total_amount || 0),
      })),
      this_month: {
        count: thisMonth._count.id,
        total_amount: Number(thisMonth._sum.total_amount || 0),
      },
      top_suppliers: topSuppliers,
    });
  } catch (err) {
    console.error('getStats import error:', err);
    return res.status(500).json({ error: 'Lỗi hệ thống khi tải thống kê phiếu nhập.' });
  }
};

// ────────────────────────────────────────────────────────────
// DELETE /api/imports/:id  — xoá phiếu nhập (chỉ IN_TRANSIT/CANCELLED)
// ────────────────────────────────────────────────────────────
exports.remove = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const receipt = await prisma.importReceipt.findUnique({ where: { id } });
    if (!receipt) return res.status(404).json({ error: 'Không tìm thấy phiếu nhập.' });
    if (!['IN_TRANSIT', 'CANCELLED'].includes(receipt.status)) {
      return res.status(400).json({ error: 'Chỉ có thể xoá phiếu nhập ở trạng thái IN_TRANSIT hoặc đã HUỶ.' });
    }

    // Cascade delete details first (handled by Prisma schema onDelete: Cascade)
    await prisma.importReceipt.delete({ where: { id } });

    return res.json({ message: 'Đã xoá phiếu nhập thành công.' });
  } catch (err) {
    console.error('remove import error:', err);
    return res.status(500).json({ error: 'Lỗi hệ thống khi xoá phiếu nhập.' });
  }
};
