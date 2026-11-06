const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('[START] Starting database reset and seed...');

  // 1. Clean up old tables
  console.log('Truncating existing tables...');
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE 
      export_details, 
      export_receipts, 
      import_details, 
      import_receipts, 
      supplier_product_prices, 
      products, 
      locations, 
      suppliers, 
      users 
    RESTART IDENTITY CASCADE;
  `);
  console.log('[OK] Database cleared successfully.');

  // 2. Seed Users
  console.log('Seeding users...');
  const salt = await bcrypt.genSalt(10);
  const adminHash = await bcrypt.hash('admin123', salt);
  const staffHash = await bcrypt.hash('nhanvien123', salt);

  const usersData = [
    { username: 'admin', full_name: 'Quản trị viên', role: 'admin', password_hash: adminHash },
    { username: 'nhanvien1', full_name: 'Đặng Văn Hiệp', role: 'staff', password_hash: staffHash },
    { username: 'nhanvien2', full_name: 'Sang Xuân Hùng', role: 'staff', password_hash: staffHash },
    { username: 'huy123', full_name: 'Võ Gia Huy', role: 'staff', password_hash: staffHash }
  ];

  const users = [];
  for (const u of usersData) {
    const createdUser = await prisma.user.create({ data: u });
    users.push(createdUser);
  }
  console.log(`[OK] Seeded ${users.length} users successfully.`);

  // 3. Seed Suppliers
  console.log('Seeding 10 Bach Hoa Xanh-like suppliers...');
  const suppliersData = [
    { name: 'Công ty Cổ phần Sữa Việt Nam (Vinamilk)', contact_person: 'Nguyễn Hữu Phát', phone: '02854155555', email: 'vinamilk@vinamilk.com.vn', address: '10 Tân Trào, Tân Phú, Quận 7, TP. Hồ Chí Minh', distance_km: 9.5, latitude: 10.728956, longitude: 106.726359 },
    { name: 'Công ty TNHH Nước Giải Khát Coca-Cola Việt Nam', contact_person: 'Lê Đình Luân', phone: '02838961000', email: 'cocacola@coca-cola.com.vn', address: 'Xa Lộ Hà Nội, Linh Trung, Thủ Đức, TP. Hồ Chí Minh', distance_km: 21.5, latitude: 10.865916, longitude: 106.784405 },
    { name: 'Công ty Cổ phần Hàng Tiêu dùng Masan', contact_person: 'Phạm Hoàng Nam', phone: '02862565660', email: 'masan@masan.com.vn', address: '12 Tôn Đức Thắng, Bến Nghé, Quận 1, TP. Hồ Chí Minh', distance_km: 5.8, latitude: 10.776662, longitude: 106.706821 },
    { name: 'Công ty TNHH Unilever Việt Nam', contact_person: 'Trần Thị Lan', phone: '02854135686', email: 'unilever@unilever.com.vn', address: '156 Nguyễn Lương Bằng, Tân Phú, Quận 7, TP. Hồ Chí Minh', distance_km: 10.2, latitude: 10.723126, longitude: 106.727509 },
    { name: 'Công ty TNHH Nestlé Việt Nam', contact_person: 'Nguyễn Văn Thành', phone: '02839106600', email: 'nestle@nestle.com.vn', address: 'KCN Biên Hòa 2, Long Bình, Biên Hòa, Đồng Nai', distance_km: 31.2, latitude: 10.929845, longitude: 106.868744 },
    { name: 'Công ty Cổ phần Acecook Việt Nam', contact_person: 'Trương Công Vinh', phone: '02838154060', email: 'acecook@acecook.com.vn', address: 'Lô II-3 KCN Tân Bình, Tân Phú, TP. Hồ Chí Minh', distance_km: 10.3, latitude: 10.816774, longitude: 106.617821 },
    { name: 'Công ty Cổ phần Tập đoàn KIDO', contact_person: 'Mai Văn Tuyến', phone: '02838270468', email: 'kido@kido.com.vn', address: '138 - 142 Hai Bà Trưng, Quận 1, TP. Hồ Chí Minh', distance_km: 4.5, latitude: 10.782633, longitude: 106.697472 },
    { name: 'Công ty TNHH Suntory PepsiCo Việt Nam', contact_person: 'Hoàng Thị Mai', phone: '02838219437', email: 'pepsico@suntorypepsico.vn', address: '88 Đồng Khởi, Bến Nghé, Quận 1, TP. Hồ Chí Minh', distance_km: 5.2, latitude: 10.775318, longitude: 106.703273 },
    { name: 'Công ty TNHH L\'Oreal Việt Nam', contact_person: 'Bùi Minh Trí', phone: '02839369168', email: 'loreal@loreal.com.vn', address: '72 Lê Thánh Tôn, Bến Nghé, Quận 1, TP. Hồ Chí Minh', distance_km: 5.3, latitude: 10.778007, longitude: 106.702008 },
    { name: 'Công ty Cổ phần Chăn nuôi C.P. Việt Nam', contact_person: 'Phạm Tiến Dũng', phone: '02513836251', email: 'cpvietnam@cp.com.vn', address: 'KCN Biên Hòa 2, Biên Hòa, Đồng Nai', distance_km: 31.8, latitude: 10.928810, longitude: 106.871230 }
  ];

  const suppliers = [];
  for (const s of suppliersData) {
    const createdSup = await prisma.supplier.create({ data: s });
    suppliers.push(createdSup);
  }
  console.log(`[OK] Seeded ${suppliers.length} suppliers.`);

  // 4. Seed Locations
  console.log('Seeding 10 shelves across 5 Category-matching zones...');
  const locationsData = [
    { location_code: 'TPTS-A', name: 'Kệ A - Tươi sống', zone: 'Thực phẩm tươi sống', max_capacity: 500 },
    { location_code: 'TPTS-B', name: 'Kệ B - Tươi sống', zone: 'Thực phẩm tươi sống', max_capacity: 500 },
    { location_code: 'TPK-NYP-A', name: 'Kệ A - Thực phẩm khô', zone: 'Thực phẩm khô và Nhu yếu phẩm', max_capacity: 1000 },
    { location_code: 'TPK-NYP-B', name: 'Kệ B - Nhu yếu phẩm', zone: 'Thực phẩm khô và Nhu yếu phẩm', max_capacity: 1000 },
    { location_code: 'DUBK-A', name: 'Kệ A - Đồ uống & Bánh kẹo', zone: 'Đồ uống và bánh kẹo', max_capacity: 800 },
    { location_code: 'DUBK-B', name: 'Kệ B - Đồ uống & Bánh kẹo', zone: 'Đồ uống và bánh kẹo', max_capacity: 800 },
    { location_code: 'HMP-A', name: 'Kệ A - Hóa mỹ phẩm', zone: 'Hóa mỹ phẩm', max_capacity: 600 },
    { location_code: 'HMP-B', name: 'Kệ B - Hóa mỹ phẩm', zone: 'Hóa mỹ phẩm', max_capacity: 600 },
    { location_code: 'DDGD-A', name: 'Kệ A - Đồ dùng gia đình', zone: 'Đồ dùng gia đình', max_capacity: 700 },
    { location_code: 'DDGD-B', name: 'Kệ B - Đồ dùng gia đình', zone: 'Đồ dùng gia đình', max_capacity: 700 }
  ];

  const locations = [];
  const shelfByCategory = {};

  for (const l of locationsData) {
    const createdLoc = await prisma.location.create({ data: l });
    locations.push(createdLoc);
    
    // Quick helper to map primary shelf per zone
    if (!shelfByCategory[l.zone]) {
      shelfByCategory[l.zone] = createdLoc.id;
    }
  }
  console.log(`[OK] Seeded ${locations.length} shelf locations.`);

  // 5. Seed Products & SupplierProductPrices
  console.log('Seeding 50 products linked with supplier contract prices...');
  const rawProductsData = [
    // --- Group 1: Thực phẩm tươi sống ---
    { code: "TS001", name: "Thịt ba rọi heo CP tươi sạch", unit: "Kg", price: 140000, cat: "Thực phẩm tươi sống", sup_idx: [9, 2] },
    { code: "TS002", name: "Đùi tỏi gà CP tươi đóng khay", unit: "Kg", price: 85000, cat: "Thực phẩm tươi sống", sup_idx: [9, 2] },
    { code: "TS003", name: "Cánh gà tươi CP", unit: "Kg", price: 95000, cat: "Thực phẩm tươi sống", sup_idx: [9] },
    { code: "TS004", name: "Trứng gà Ba Huân sạch tiệt trùng", unit: "Hộp 10 quả", price: 32000, cat: "Thực phẩm tươi sống", sup_idx: [2, 9] },
    { code: "TS005", name: "Trứng vịt Ba Huân sạch tiệt trùng", unit: "Hộp 10 quả", price: 38000, cat: "Thực phẩm tươi sống", sup_idx: [9] },
    { code: "TS006", name: "Cá hồi phi lê tươi Nauy nhập khẩu", unit: "Kg", price: 360000, cat: "Thực phẩm tươi sống", sup_idx: [9, 2] },
    { code: "TS007", name: "Tôm thẻ chân trắng tươi sống cỡ lớn", unit: "Kg", price: 220000, cat: "Thực phẩm tươi sống", sup_idx: [9] },
    { code: "TS008", name: "Rau cải ngọt Bách Hóa Xanh organic", unit: "Gói 500g", price: 12000, cat: "Thực phẩm tươi sống", sup_idx: [9, 2] },
    { code: "TS009", name: "Xà lách búp mỡ Đà Lạt giòn ngọt", unit: "Gói 300g", price: 16000, cat: "Thực phẩm tươi sống", sup_idx: [9] },
    { code: "TS010", name: "Cà chua beef Đà Lạt mọng nước", unit: "Kg", price: 25000, cat: "Thực phẩm tươi sống", sup_idx: [9, 2] },

    // --- Group 2: Thực phẩm khô và Nhu yếu phẩm ---
    { code: "TK001", name: "Gạo thơm ST25 Neptune hạt ngọc", unit: "Túi 5kg", price: 185000, cat: "Thực phẩm khô và Nhu yếu phẩm", sup_idx: [2, 4] },
    { code: "TK002", name: "Mì Hảo Hảo tôm chua cay chuẩn vị", unit: "Thùng 30 gói", price: 125000, cat: "Thực phẩm khô và Nhu yếu phẩm", sup_idx: [5, 2] },
    { code: "TK003", name: "Nước mắm Nam Ngư Đệ Nhị thượng hạng", unit: "Chai 900ml", price: 34000, cat: "Thực phẩm khô và Nhu yếu phẩm", sup_idx: [2, 0] },
    { code: "TK004", name: "Dầu ăn Simply 100% đậu nành", unit: "Chai 1 lít", price: 58000, cat: "Thực phẩm khô và Nhu yếu phẩm", sup_idx: [2, 6] },
    { code: "TK005", name: "Đường tinh luyện trắng Biên Hòa", unit: "Gói 1kg", price: 26000, cat: "Thực phẩm khô và Nhu yếu phẩm", sup_idx: [2] },
    { code: "TK006", name: "Hạt nêm Knorr hương vị thịt thăn", unit: "Gói 900g", price: 78000, cat: "Thực phẩm khô và Nhu yếu phẩm", sup_idx: [4, 2] },
    { code: "TK007", name: "Tương ớt Chinsu cay nồng", unit: "Chai 250g", price: 15000, cat: "Thực phẩm khô và Nhu yếu phẩm", sup_idx: [2] },
    { code: "TK008", name: "Muối i-ốt Visalco cao cấp", unit: "Gói 500g", price: 7000, cat: "Thực phẩm khô và Nhu yếu phẩm", sup_idx: [2, 3] },
    { code: "TK009", name: "Bột ngọt Ajinomoto tinh khiết", unit: "Gói 454g", price: 36000, cat: "Thực phẩm khô và Nhu yếu phẩm", sup_idx: [2] },
    { code: "TK010", name: "Cháo sen bát bảo Minh Trung bổ dưỡng", unit: "Lon 365g", price: 18000, cat: "Thực phẩm khô và Nhu yếu phẩm", sup_idx: [2, 5] },

    // --- Group 3: Đồ uống và bánh kẹo ---
    { code: "BK001", name: "Thùng Bia Tiger lon bạc cao cấp", unit: "Thùng 24 lon", price: 385000, cat: "Đồ uống và bánh kẹo", sup_idx: [7, 1] },
    { code: "BK002", name: "Thùng Nước ngọt Coca Cola vị nguyên bản", unit: "Thùng 24 lon", price: 210000, cat: "Đồ uống và bánh kẹo", sup_idx: [1, 7] },
    { code: "BK003", name: "Thùng Nước ngọt Pepsi lon xanh", unit: "Thùng 24 lon", price: 205000, cat: "Đồ uống và bánh kẹo", sup_idx: [7, 1] },
    { code: "BK004", name: "Sữa tươi Vinamilk 100% ít đường", unit: "Thùng 48 hộp x 180ml", price: 350000, cat: "Đồ uống và bánh kẹo", sup_idx: [0, 4] },
    { code: "BK005", name: "Sữa lúa mạch uống Nestlé Milo", unit: "Thùng 48 hộp x 180ml", price: 375000, cat: "Đồ uống và bánh kẹo", sup_idx: [4, 0] },
    { code: "BK006", name: "Nước khoáng Aquafina tinh khiết", unit: "Lốc 6 chai 500ml", price: 28000, cat: "Đồ uống và bánh kẹo", sup_idx: [7, 1] },
    { code: "BK007", name: "Bánh quy Cosy Kinh Đô vị bơ truyền thống", unit: "Hộp 336g", price: 42000, cat: "Đồ uống và bánh kẹo", sup_idx: [2] },
    { code: "BK008", name: "Bánh xốp Choco-Pie Orion kem sô cô la", unit: "Hộp 12 cái", price: 54000, cat: "Đồ uống và bánh kẹo", sup_idx: [2, 6] },
    { code: "BK009", name: "Kẹo dẻo Haribo Goldbears nhập khẩu", unit: "Gói 80g", price: 22000, cat: "Đồ uống và bánh kẹo", sup_idx: [2] },
    { code: "BK010", name: "Snack khoai tây Lays vị tự nhiên thơm giòn", unit: "Gói 95g", price: 19000, cat: "Đồ uống và bánh kẹo", sup_idx: [7, 2] },

    // --- Group 4: Hóa mỹ phẩm ---
    { code: "MP001", name: "Dầu gội Clear mát lạnh bạc hà trị gàu", unit: "Chai 650g", price: 165000, cat: "Hóa mỹ phẩm", sup_idx: [3, 8] },
    { code: "MP002", name: "Dầu gội Pantene ngăn rụng tóc nuôi dưỡng", unit: "Chai 650g", price: 158000, cat: "Hóa mỹ phẩm", sup_idx: [3, 8] },
    { code: "MP003", name: "Sữa tắm Lifebuoy bảo vệ khỏi vi khuẩn", unit: "Chai 850g", price: 178000, cat: "Hóa mỹ phẩm", sup_idx: [3, 8] },
    { code: "MP004", name: "Nước giặt Omo Matic xoáy bay vết bẩn", unit: "Túi 3.6kg", price: 215000, cat: "Hóa mỹ phẩm", sup_idx: [3] },
    { code: "MP005", name: "Nước xả vải Downy huyền bí thơm lâu", unit: "Túi 3.5 lít", price: 228000, cat: "Hóa mỹ phẩm", sup_idx: [3] },
    { code: "MP006", name: "Nước rửa chén Sunlight hương chanh đậm đặc", unit: "Chai 750g", price: 32000, cat: "Hóa mỹ phẩm", sup_idx: [3, 8] },
    { code: "MP007", name: "Kem đánh răng P/S bảo vệ 123", unit: "Tuýp 240g", price: 38000, cat: "Hóa mỹ phẩm", sup_idx: [3] },
    { code: "MP008", name: "Bàn chải đánh răng Colgate Slimsoft tơ mảnh", unit: "Cây", price: 35000, cat: "Hóa mỹ phẩm", sup_idx: [3, 8] },
    { code: "MP009", name: "Xà bông cục diệt khuẩn Safeguard trắng", unit: "Cục 130g", price: 16000, cat: "Hóa mỹ phẩm", sup_idx: [3] },
    { code: "MP010", name: "Nước lau sàn nhà Gift hương bạc hà mát lạnh", unit: "Chai 1 lít", price: 29000, cat: "Hóa mỹ phẩm", sup_idx: [3, 8] },

    // --- Group 5: Đồ dùng gia đình ---
    { code: "GD001", name: "Chảo siêu chống dính Sunhouse bền bỉ", unit: "Đường kính 26cm", price: 145000, cat: "Đồ dùng gia đình", sup_idx: [2, 4] },
    { code: "GD002", name: "Nồi inox 3 đáy Happycook đun nấu nhanh", unit: "Đường kính 20cm", price: 235000, cat: "Đồ dùng gia đình", sup_idx: [2, 4] },
    { code: "GD003", name: "Bộ lau nhà xoay tay 360 độ cao cấp Lock&Lock", unit: "Bộ", price: 490000, cat: "Đồ dùng gia đình", sup_idx: [4, 2] },
    { code: "GD004", name: "Hộp nhựa bảo quản thực phẩm Duy Tân", unit: "Bộ 3 hộp", price: 68000, cat: "Đồ dùng gia đình", sup_idx: [2] },
    { code: "GD005", name: "Bình giữ nhiệt kim loại Lock&Lock cao cấp", unit: "Cái", price: 295000, cat: "Đồ dùng gia đình", sup_idx: [4, 2] },
    { code: "GD006", name: "Chổi quét nhà nhựa dẻo cán inox Duy Tân", unit: "Cây", price: 45000, cat: "Đồ dùng gia đình", sup_idx: [2] },
    { code: "GD007", name: "Thùng rác đạp chân Duy Tân siêu bền", unit: "Cái", price: 85000, cat: "Đồ dùng gia đình", sup_idx: [2, 4] },
    { code: "GD008", name: "Dao chặt xương chất liệu thép Sunhouse", unit: "Cây", price: 125000, cat: "Đồ dùng gia đình", sup_idx: [2] },
    { code: "GD009", name: "Bộ chén bát ăn cơm sứ trắng Minh Long", unit: "Bộ 6 cái", price: 180000, cat: "Đồ dùng gia đình", sup_idx: [2] },
    { code: "GD010", name: "Khăn lau đa năng Microfiber siêu thấm hút", unit: "Gói 5 cái", price: 35000, cat: "Đồ dùng gia đình", sup_idx: [3, 4] }
  ];

  const discounts = [0.80, 0.85, 0.90];
  const leadTimes = [1, 2, 3];
  let productCount = 0;

  for (const raw of rawProductsData) {
    const defaultLocationId = shelfByCategory[raw.cat];

    const prod = await prisma.product.create({
      data: {
        product_code: raw.code,
        name: raw.name,
        unit: raw.unit,
        category: raw.cat,
        description: `Sản phẩm bách hóa chất lượng cao: ${raw.name}. Đảm bảo chất lượng kiểm định.`,
        min_stock: 10,
        unit_price: raw.price,
        location_id: defaultLocationId,
        is_active: true
      }
    });

    productCount++;

    // Link suppliers
    for (const idx of raw.sup_idx) {
      const dbSupplier = suppliers[idx];
      const discount = discounts[Math.floor(Math.random() * discounts.length)];
      const contractPrice = Math.round(raw.price * discount * 100) / 100;
      const leadTime = leadTimes[Math.floor(Math.random() * leadTimes.length)];

      await prisma.supplierProductPrice.create({
        data: {
          supplier_id: dbSupplier.id,
          product_id: prod.id,
          contract_price: contractPrice,
          lead_time_days: leadTime
        }
      });
    }
  }

  console.log(`[OK] Seeded ${productCount} products with supplier contract prices successfully.`);
  console.log('[DONE] Database seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('[ERROR] Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
