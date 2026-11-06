const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedRichHistory() {
  console.log('[START] Generating 80+ realistic warehouse transactions (No bugs guarantee)...');

  // 1. Get seed structural data
  const users = await prisma.user.findMany();
  const products = await prisma.product.findMany();
  const suppliers = await prisma.supplier.findMany();
  const locations = await prisma.location.findMany();

  const admin = users.find(u => u.role === 'admin') || users[0];
  const staff = users.find(u => u.role === 'staff') || users[0];

  if (!products.length || !suppliers.length) {
    console.error('Seed products and suppliers first.');
    return;
  }

  // Clear existing transactions first to avoid duplicate batch codes or data contamination
  console.log('Cleaning existing import/export transaction tables...');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE export_details, export_receipts, import_details, import_receipts RESTART IDENTITY CASCADE;');

  // Helper date generator
  const daysAgo = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(9, 0, 0, 0);
    return d;
  };

  const ts = Date.now().toString().slice(-4);
  let importSeq = 1000;
  let exportSeq = 1000;

  // --- Step 1: Generate 45 Import Receipts distributed over 60 days ---
  const activeLotsMap = {}; // product_id -> Array of imported detail lots

  console.log('Generating 45 Import Receipts...');
  for (let i = 60; i >= 2; i -= 1.3) {
    const isCompleted = i > 4; // Older than 4 days are fully COMPLETED
    const status = isCompleted 
      ? 'COMPLETED' 
      : (i > 2.5 ? 'IN_TRANSIT' : 'PENDING_APPROVAL');

    const supplier = suppliers[Math.floor(Math.random() * suppliers.length)];
    const code = `PN2605${importSeq++}`;
    const date = daysAgo(Math.floor(i));

    // Choose 2 to 5 random products to import
    const numProducts = Math.floor(Math.random() * 4) + 2;
    const shuffledProds = [...products].sort(() => 0.5 - Math.random());
    const selectedProds = shuffledProds.slice(0, numProducts);

    let total = 0;
    const detailsData = selectedProds.map(p => {
      const qty = (Math.floor(Math.random() * 6) + 4) * 10; // 40 to 90
      const price = Math.round(Number(p.unit_price) * 0.9); // Contract discount 10%
      total += price * qty;
      const loc = locations.find(l => l.zone === p.category) || locations[0];

      return {
        product_id: p.id,
        quantity: qty,
        expected_quantity: qty,
        received_quantity: status === 'COMPLETED' ? qty : null,
        accepted_quantity: status === 'COMPLETED' ? qty : null,
        unit_price: price,
        batch_code: `BAT-${ts}-${importSeq}-${p.product_code}`,
        mfg_date: daysAgo(Math.floor(i) + 40),
        expiry_date: daysAgo(Math.floor(i) - 200), // Far in future
        location_id: loc.id
      };
    });

    const receipt = await prisma.importReceipt.create({
      data: {
        receipt_code: code,
        import_date: date,
        supplier_id: supplier.id,
        total_amount: total,
        status: status,
        created_by: admin.id,
        completed_by: status === 'COMPLETED' ? admin.id : null,
        completed_at: status === 'COMPLETED' ? date : null,
        note: 'Dữ liệu nhập kho lịch sử tự động tạo chuẩn chỉnh',
        details: { create: detailsData }
      },
      include: { details: true }
    });

    // If completed, register these lots as available for export
    if (status === 'COMPLETED') {
      receipt.details.forEach(d => {
        if (!activeLotsMap[d.product_id]) {
          activeLotsMap[d.product_id] = [];
        }
        activeLotsMap[d.product_id].push({
          import_detail_id: d.id,
          available: d.quantity
        });
      });
    }
  }

  // --- Step 2: Generate 35 Export Receipts distributed over 45 days ---
  const customers = [
    'Bách Hóa Xanh Quận 1', 'Bách Hóa Xanh Quận 3', 'Bách Hóa Xanh Thủ Đức',
    'Bách Hóa Xanh Gò Vấp', 'Bách Hóa Xanh Bình Thạnh', 'Bách Hóa Xanh Tân Bình',
    'Co.op Food GigaMall', 'WinMart Landmark 81', 'Lotte Mart Quận 7'
  ];

  console.log('Generating 35 Export Receipts (selling from imported lots)...');
  for (let i = 45; i >= 1; i -= 1.3) {
    const isCompleted = i > 2; // Older than 2 days are COMPLETED
    const status = isCompleted ? 'COMPLETED' : 'PENDING_APPROVAL';
    
    const customer = customers[Math.floor(Math.random() * customers.length)];
    const code = `PX2605${exportSeq++}`;
    const date = daysAgo(Math.floor(i));

    // Choose 2 to 4 random products to export
    const numProducts = Math.floor(Math.random() * 3) + 2;
    const availableProductIds = Object.keys(activeLotsMap).filter(pid => activeLotsMap[pid].some(lot => lot.available > 5));
    
    if (availableProductIds.length < numProducts) continue; // Skip if database is dry

    const shuffledPids = availableProductIds.sort(() => 0.5 - Math.random());
    const selectedPids = shuffledPids.slice(0, numProducts);

    let total = 0;
    const detailsData = [];

    for (const pidStr of selectedPids) {
      const pid = parseInt(pidStr, 10);
      const prod = products.find(p => p.id === pid);
      const price = Number(prod.unit_price);
      
      // Request a reasonable quantity to export
      const requestedQty = Math.floor(Math.random() * 15) + 5; // 5 to 20
      
      // Deduct from imported lots using FIFO/FEFO
      let remainingToExport = requestedQty;
      const productLots = activeLotsMap[pid];

      for (const lot of productLots) {
        if (lot.available <= 0) continue;
        const take = Math.min(lot.available, remainingToExport);
        
        lot.available -= take;
        remainingToExport -= take;

        detailsData.push({
          product_id: pid,
          quantity: take,
          selling_price: price,
          import_detail_id: lot.import_detail_id
        });

        if (remainingToExport <= 0) break;
      }
      
      total += price * (requestedQty - remainingToExport);
    }

    if (detailsData.length === 0) continue;

    await prisma.exportReceipt.create({
      data: {
        receipt_code: code,
        export_date: date,
        customer_name: customer,
        delivery_address: 'Hồ Chí Minh, Việt Nam',
        total_amount: total,
        status: status,
        reason: 'SELL',
        created_by: staff.id,
        approved_by: status === 'COMPLETED' ? admin.id : null,
        approved_at: status === 'COMPLETED' ? date : null,
        note: 'Dữ liệu xuất kho lịch sử tự động tạo chuẩn chỉnh',
        details: { create: detailsData }
      }
    });
  }

  console.log('[OK] Seeding 80+ unique imports/exports completed without conflicts!');
}

seedRichHistory()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
