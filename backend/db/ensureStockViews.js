const { PrismaClient } = require('@prisma/client');

async function ensureStockViews(prisma = new PrismaClient()) {
  await prisma.$executeRawUnsafe(`DROP VIEW IF EXISTS v_lot_stock;`);
  await prisma.$executeRawUnsafe(`DROP VIEW IF EXISTS v_stock_balance;`);

  await prisma.$executeRawUnsafe(`
    CREATE VIEW v_stock_balance AS
    SELECT
      p.id AS product_id,
      p.product_code,
      p.name AS product_name,
      p.unit,
      p.category,
      p.min_stock,
      COALESCE(SUM(lot.total_imported), 0)::int AS total_imported,
      COALESCE(SUM(lot.total_exported), 0)::int AS total_exported,
      (COALESCE(SUM(lot.total_imported), 0) - COALESCE(SUM(lot.total_exported), 0))::int AS current_stock
    FROM products p
    LEFT JOIN (
      SELECT
        id_inner.id AS import_detail_id,
        id_inner.product_id,
        id_inner.quantity AS total_imported,
        COALESCE(SUM(CASE WHEN er.status = 'COMPLETED' THEN ed.quantity ELSE 0 END), 0) AS total_exported
      FROM import_details id_inner
      INNER JOIN import_receipts ir
        ON ir.id = id_inner.receipt_id
        AND ir.status = 'COMPLETED'
      LEFT JOIN export_details ed
        ON ed.import_detail_id = id_inner.id
      LEFT JOIN export_receipts er
        ON er.id = ed.receipt_id
        AND er.status = 'COMPLETED'
      GROUP BY id_inner.id, id_inner.product_id, id_inner.quantity
    ) lot ON lot.product_id = p.id
    WHERE p.is_active = TRUE
    GROUP BY p.id, p.product_code, p.name, p.unit, p.category, p.min_stock
    ORDER BY p.product_code;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE VIEW v_lot_stock AS
    SELECT
      id_lot.id AS lot_id,
      id_lot.product_id,
      p.product_code,
      p.name AS product_name,
      p.unit,
      ir.id AS receipt_id,
      ir.receipt_code,
      ir.import_date,
      ir.supplier_id,
      id_lot.batch_code,
      id_lot.expiry_date,
      id_lot.unit_price,
      id_lot.quantity AS import_qty,
      COALESCE(SUM(CASE WHEN er.status = 'COMPLETED' THEN ed.quantity ELSE 0 END), 0)::int AS exported_qty,
      (id_lot.quantity - COALESCE(SUM(CASE WHEN er.status = 'COMPLETED' THEN ed.quantity ELSE 0 END), 0))::int AS current_lot_stock,
      COALESCE(pending.pending_qty, 0)::int AS pending_return_qty,
      (
        id_lot.quantity
        - COALESCE(SUM(CASE WHEN er.status = 'COMPLETED' THEN ed.quantity ELSE 0 END), 0)
        - COALESCE(pending.pending_qty, 0)
      )::int AS available_lot_stock
    FROM import_details id_lot
    INNER JOIN products p
      ON p.id = id_lot.product_id
    INNER JOIN import_receipts ir
      ON ir.id = id_lot.receipt_id
      AND ir.status = 'COMPLETED'
    LEFT JOIN export_details ed
      ON ed.import_detail_id = id_lot.id
    LEFT JOIN export_receipts er
      ON er.id = ed.receipt_id
      AND er.status = 'COMPLETED'
    LEFT JOIN (
      SELECT
        ed_pend.import_detail_id,
        SUM(ed_pend.quantity) AS pending_qty
      FROM export_details ed_pend
      INNER JOIN export_receipts er_pend
        ON er_pend.id = ed_pend.receipt_id
        AND er_pend.reason = 'RETURN'
        AND er_pend.status = 'PENDING_APPROVAL'
      GROUP BY ed_pend.import_detail_id
    ) pending
      ON pending.import_detail_id = id_lot.id
    WHERE p.is_active = TRUE
    GROUP BY
      id_lot.id,
      id_lot.product_id,
      p.product_code,
      p.name,
      p.unit,
      ir.id,
      ir.receipt_code,
      ir.import_date,
      ir.supplier_id,
      id_lot.batch_code,
      id_lot.expiry_date,
      id_lot.unit_price,
      id_lot.quantity,
      pending.pending_qty
    ORDER BY id_lot.expiry_date ASC NULLS LAST, ir.import_date ASC;
  `);
}

module.exports = ensureStockViews;
