const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const QRCode = require('qrcode');

// Helper to check if user is an Admin
const checkAdmin = (req) => {
  return req.user && req.user.role === 'admin';
};

// Helper to serialize product object (handling Prisma Decimals)
const serializeProduct = (p, currentStock = 0) => {
  return {
    id: p.id,
    product_code: p.product_code,
    name: p.name,
    unit: p.unit,
    category: p.category,
    description: p.description,
    min_stock: p.min_stock,
    unit_price: p.unit_price ? Number(p.unit_price) : null,
    location_id: p.location_id,
    location_code: p.default_location?.location_code || null,
    location_name: p.default_location?.name || null,
    is_active: p.is_active,
    min_days_to_sell: p.min_days_to_sell,
    expiry_warning_days: p.expiry_warning_days,
    created_at: p.created_at,
    current_stock: currentStock,
    is_low_stock: currentStock < p.min_stock,
    supplier_ids: p.supplier_prices ? p.supplier_prices.map(sp => sp.supplier_id) : [],
    supplier_prices: p.supplier_prices
      ? p.supplier_prices.map(sp => ({
          supplier_id: sp.supplier_id,
          contract_price: sp.contract_price !== undefined && sp.contract_price !== null ? Number(sp.contract_price) : null,
          lead_time_days: sp.lead_time_days,
        }))
      : [],
  };
};

// Sync suppliers contract prices
const syncSuppliers = async (productId, suppliersData, defaultUnitPrice) => {
  // Delete old entries
  await prisma.supplierProductPrice.deleteMany({
    where: { product_id: productId }
  });

  if (!suppliersData || !Array.isArray(suppliersData) || suppliersData.length === 0) {
    return;
  }

  const prices = [];
  
  for (const item of suppliersData) {
    let supplierId, contractPrice, leadTime;

    if (typeof item === 'object' && item !== null) {
      supplierId = item.supplier_id || item.supplierId;
      contractPrice = item.contract_price !== undefined ? item.contract_price : item.contractPrice;
      leadTime = item.lead_time_days || item.leadTimeDays || 2;
    } else {
      // Just raw ID passed
      supplierId = item;
      contractPrice = defaultUnitPrice;
      leadTime = 2;
    }

    try {
      const sid = parseInt(supplierId);
      if (isNaN(sid)) continue;

      const supplier = await prisma.supplier.findUnique({
        where: { id: sid }
      });

      if (supplier && supplier.is_active) {
        const cPrice = contractPrice !== undefined && contractPrice !== '' ? Number(contractPrice) : Number(defaultUnitPrice || 0);
        const lTime = parseInt(leadTime) || 2;

        await prisma.supplierProductPrice.create({
          data: {
            supplier_id: sid,
            product_id: productId,
            contract_price: cPrice,
            lead_time_days: lTime
          }
        });
        
        prices.push(cPrice);
      }
    } catch (err) {
      console.error(`Failed to link supplier ${supplierId} to product ${productId}:`, err);
    }
  }

  // Update product's unit price if it is not set
  if (defaultUnitPrice === null || defaultUnitPrice === undefined || defaultUnitPrice === '') {
    if (prices.length > 0) {
      const minPrice = Math.min(...prices);
      await prisma.product.update({
        where: { id: productId },
        data: { unit_price: minPrice }
      });
    } else {
      await prisma.product.update({
        where: { id: productId },
        data: { unit_price: 0.0 }
      });
    }
  }
};

// 1. Check duplicates
exports.checkDuplicate = async (req, res) => {
  const { product_code, name, exclude_id } = req.query;
  const excludeIdInt = exclude_id ? parseInt(exclude_id) : undefined;

  try {
    if (!product_code && !name) {
      return res.json({ success: true, exists: false });
    }

    // Base filter
    const baseFilter = { is_active: true };
    if (excludeIdInt) {
      baseFilter.id = { not: excludeIdInt };
    }

    if (product_code) {
      const pCodeClean = product_code.trim();
      const duplicateCode = await prisma.product.findFirst({
        where: {
          ...baseFilter,
          product_code: pCodeClean
        }
      });

      if (duplicateCode) {
        return res.json({
          success: true,
          exists: true,
          field: 'product_code',
          message: `Mã sản phẩm "${pCodeClean}" đã tồn tại trên hệ thống.`
        });
      }
    }

    if (name) {
      const pNameClean = name.trim();
      const duplicateName = await prisma.product.findFirst({
        where: {
          ...baseFilter,
          name: pNameClean
        }
      });

      if (duplicateName) {
        return res.json({
          success: true,
          exists: true,
          field: 'name',
          message: `Tên sản phẩm "${pNameClean}" đã tồn tại trên hệ thống.`
        });
      }
    }

    return res.json({ success: true, exists: false });
  } catch (error) {
    console.error('Error checking duplicate product:', error);
    return res.status(500).json({ error: 'Lỗi hệ thống khi kiểm tra trùng lặp.' });
  }
};

// 2. Get all products with search, pagination, category and current stock view
exports.getAllProducts = async (req, res) => {
  const { supplier_id, category, search, limit, offset } = req.query;
  
  const limitVal = limit ? parseInt(limit) : 200;
  const offsetVal = offset ? parseInt(offset) : 0;
  const supplierIdInt = supplier_id ? parseInt(supplier_id) : undefined;

  try {
    let products = [];

    // Filter build
    const where = { is_active: true };

    if (category) {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { product_code: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (supplierIdInt) {
      // Get products associated with supplier
      const supplierProductPrices = await prisma.supplierProductPrice.findMany({
        where: { supplier_id: supplierIdInt },
        include: {
          product: {
            include: { 
              default_location: true,
              supplier_prices: { select: { supplier_id: true, contract_price: true, lead_time_days: true } }
            }
          }
        }
      });
      
      products = supplierProductPrices
        .map(spp => spp.product)
        .filter(p => {
          if (!p.is_active) return false;
          if (category && p.category !== category) return false;
          if (search) {
            const s = search.toLowerCase();
            const nameMatch = p.name && p.name.toLowerCase().includes(s);
            const codeMatch = p.product_code && p.product_code.toLowerCase().includes(s);
            if (!nameMatch && !codeMatch) return false;
          }
          return true;
        })
        .slice(offsetVal, offsetVal + limitVal);
    } else {
      products = await prisma.product.findMany({
        where,
        include: { 
          default_location: true,
          supplier_prices: { select: { supplier_id: true, contract_price: true, lead_time_days: true } }
        },
        orderBy: { product_code: 'asc' },
        take: limitVal,
        skip: offsetVal
      });
    }

    // Fetch current stocks from view
    let stockMap = {};
    try {
      const balances = await prisma.$queryRaw`
        SELECT "product_id", "current_stock" FROM "v_stock_balance"
      `;
      balances.forEach(b => {
        stockMap[b.product_id] = Number(b.current_stock) || 0;
      });
    } catch (e) {
      console.warn('Could not read stock balance view:', e.message);
    }

    // Serialize output
    const result = products.map(p => {
      const stock = stockMap[p.id] || 0;
      return serializeProduct(p, stock);
    });

    return res.json(result);
  } catch (error) {
    console.error('Error fetching products:', error);
    return res.status(500).json({ error: 'Lỗi hệ thống khi tải danh sách sản phẩm.' });
  }
};

// 3. Get product by ID
exports.getProductById = async (req, res) => {
  const { id } = req.params;
  const productId = parseInt(id);

  if (isNaN(productId)) {
    return res.status(400).json({ error: 'ID sản phẩm không hợp lệ.' });
  }

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        default_location: true,
        supplier_prices: { select: { supplier_id: true, contract_price: true, lead_time_days: true } }
      }
    });

    if (!product || !product.is_active) {
      return res.status(404).json({ error: 'Không tìm thấy sản phẩm hoặc sản phẩm đã bị ẩn.' });
    }

    // Fetch current stock from view
    let currentStock = 0;
    try {
      const row = await prisma.$queryRaw`
        SELECT "current_stock" FROM "v_stock_balance" WHERE "product_id" = ${productId}
      `;
      if (row && row.length > 0) {
        currentStock = Number(row[0].current_stock) || 0;
      }
    } catch (e) {
      console.warn('Could not read stock balance for ID from view:', e.message);
    }

    return res.json(serializeProduct(product, currentStock));
  } catch (error) {
    console.error('Error fetching product by id:', error);
    return res.status(500).json({ error: 'Lỗi hệ thống khi tải chi tiết sản phẩm.' });
  }
};

// 4. Get product suppliers
exports.getProductSuppliers = async (req, res) => {
  const { id } = req.params;
  const productId = parseInt(id);

  if (isNaN(productId)) {
    return res.status(400).json({ error: 'ID sản phẩm không hợp lệ.' });
  }

  try {
    const spps = await prisma.supplierProductPrice.findMany({
      where: { product_id: productId },
      include: { supplier: true }
    });

    const result = spps
      .filter(spp => spp.supplier && spp.supplier.is_active)
      .map(spp => ({
        supplier_id: spp.supplier.id,
        supplier_name: spp.supplier.name,
        distance_km: spp.supplier.distance_km ? Number(spp.supplier.distance_km) : null,
        contract_price: Number(spp.contract_price),
        lead_time_days: spp.lead_time_days
      }));

    // Sort by contract price ascending
    result.sort((a, b) => a.contract_price - b.contract_price);

    return res.json(result);
  } catch (error) {
    console.error('Error fetching product suppliers:', error);
    return res.status(500).json({ error: 'Lỗi hệ thống khi tải danh sách nhà cung cấp của sản phẩm.' });
  }
};

// 5. Generate QR Code dynamic endpoint
exports.getProductQRCode = async (req, res) => {
  const { id } = req.params;
  const productId = parseInt(id);

  if (isNaN(productId)) {
    return res.status(400).json({ error: 'ID sản phẩm không hợp lệ.' });
  }

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { default_location: true }
    });

    if (!product || !product.is_active) {
      return res.status(404).json({ error: 'Không tìm thấy sản phẩm để sinh mã QR.' });
    }

    // Build data payload for QR code
    const payload = {
      product_code: product.product_code,
      name: product.name,
      unit: product.unit,
      category: product.category,
      location_code: product.default_location?.location_code || 'CHƯA CÓ KỆ'
    };

    // Generate base64 DataURL image
    const qrCodeDataUrl = await QRCode.toDataURL(JSON.stringify(payload), {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 300,
      color: {
        dark: '#0f172a',  // slate-900 color for QR dots
        light: '#ffffff'
      }
    });

    return res.json({
      product_id: product.id,
      product_code: product.product_code,
      qr_code_image: qrCodeDataUrl
    });
  } catch (error) {
    console.error('Error generating product QR code:', error);
    return res.status(500).json({ error: 'Lỗi hệ thống khi sinh mã QR Code cho sản phẩm.' });
  }
};

// 6. Create Product (Admin Only)
exports.createProduct = async (req, res) => {
  if (!checkAdmin(req)) {
    return res.status(403).json({ error: 'Chỉ Quản trị viên (Admin) mới có quyền thực hiện thao tác này.' });
  }

  const {
    product_code,
    name,
    category,
    unit,
    description,
    min_stock,
    unit_price,
    location_id,
    min_days_to_sell,
    expiry_warning_days,
    supplier_ids
  } = req.body;

  if (!name || !product_code) {
    return res.status(400).json({ error: 'Thiếu thông tin bắt buộc: name, product_code' });
  }

  try {
    const codeClean = product_code.trim();

    // Check code duplication
    const duplicate = await prisma.product.findUnique({
      where: { product_code: codeClean }
    });

    if (duplicate) {
      return res.status(409).json({ error: `Mã sản phẩm '${codeClean}' đã tồn tại.` });
    }

    const locId = location_id !== '' && location_id !== undefined && location_id !== null ? parseInt(location_id) : null;
    const uPrice = unit_price !== '' && unit_price !== undefined && unit_price !== null ? Number(unit_price) : null;

    const product = await prisma.product.create({
      data: {
        product_code: codeClean,
        name: name.trim(),
        category: category || null,
        unit: unit || null,
        description: description || null,
        min_stock: parseInt(min_stock) || 0,
        unit_price: uPrice,
        location_id: locId,
        min_days_to_sell: parseInt(min_days_to_sell) || 7,
        expiry_warning_days: parseInt(expiry_warning_days) || 30,
        is_active: true
      },
      include: { default_location: true }
    });

    // Sync supplier prices
    await syncSuppliers(product.id, supplier_ids || [], uPrice);

    // Re-fetch to get updated unit_price if synced suppliers changed it
    const finalProduct = await prisma.product.findUnique({
      where: { id: product.id },
      include: { default_location: true }
    });

    return res.status(201).json(serializeProduct(finalProduct, 0));
  } catch (error) {
    console.error('Error creating product:', error);
    return res.status(500).json({ error: 'Lỗi hệ thống khi tạo sản phẩm.' });
  }
};

// 7. Update Product (Admin Only)
exports.updateProduct = async (req, res) => {
  if (!checkAdmin(req)) {
    return res.status(403).json({ error: 'Chỉ Quản trị viên (Admin) mới có quyền thực hiện thao tác này.' });
  }

  const { id } = req.params;
  const productId = parseInt(id);

  if (isNaN(productId)) {
    return res.status(400).json({ error: 'ID sản phẩm không hợp lệ.' });
  }

  const {
    product_code,
    name,
    category,
    unit,
    description,
    min_stock,
    unit_price,
    location_id,
    min_days_to_sell,
    expiry_warning_days,
    supplier_ids
  } = req.body;

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product || !product.is_active) {
      return res.status(404).json({ error: 'Không tìm thấy sản phẩm cần cập nhật.' });
    }

    // Check duplicate code if code changed
    let codeClean = product.product_code;
    if (product_code && product_code.trim() !== product.product_code) {
      codeClean = product_code.trim();
      const duplicate = await prisma.product.findFirst({
        where: {
          product_code: codeClean,
          id: { not: productId }
        }
      });
      if (duplicate) {
        return res.status(409).json({ error: `Mã sản phẩm '${codeClean}' đã tồn tại trên hệ thống.` });
      }
    }

    const locId = location_id === '' ? null : (location_id !== undefined ? parseInt(location_id) : product.location_id);
    const uPrice = unit_price === '' ? null : (unit_price !== undefined ? Number(unit_price) : product.unit_price);

    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: {
        product_code: codeClean,
        name: name !== undefined ? name.trim() : product.name,
        category: category !== undefined ? category : product.category,
        unit: unit !== undefined ? unit : product.unit,
        description: description !== undefined ? description : product.description,
        min_stock: min_stock !== undefined ? parseInt(min_stock) : product.min_stock,
        unit_price: uPrice,
        location_id: locId,
        min_days_to_sell: min_days_to_sell !== undefined ? parseInt(min_days_to_sell) : product.min_days_to_sell,
        expiry_warning_days: expiry_warning_days !== undefined ? parseInt(expiry_warning_days) : product.expiry_warning_days
      },
      include: { default_location: true }
    });

    // If suppliers array is provided, sync them
    if (supplier_ids !== undefined) {
      await syncSuppliers(productId, supplier_ids, uPrice);
    }

    // Fetch final stock
    let currentStock = 0;
    try {
      const row = await prisma.$queryRaw`
        SELECT "current_stock" FROM "v_stock_balance" WHERE "product_id" = ${productId}
      `;
      if (row && row.length > 0) {
        currentStock = Number(row[0].current_stock) || 0;
      }
    } catch (e) {
      console.warn(e.message);
    }

    // Re-fetch updated product with potential unit_price modifications
    const finalProduct = await prisma.product.findUnique({
      where: { id: productId },
      include: { default_location: true }
    });

    return res.json(serializeProduct(finalProduct, currentStock));
  } catch (error) {
    console.error('Error updating product:', error);
    return res.status(500).json({ error: 'Lỗi hệ thống khi cập nhật sản phẩm.' });
  }
};

// 8. Delete Product (Admin Only - Soft Delete)
exports.deleteProduct = async (req, res) => {
  if (!checkAdmin(req)) {
    return res.status(403).json({ error: 'Chỉ Quản trị viên (Admin) mới có quyền thực hiện thao tác này.' });
  }

  const { id } = req.params;
  const productId = parseInt(id);

  if (isNaN(productId)) {
    return res.status(400).json({ error: 'ID sản phẩm không hợp lệ.' });
  }

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product || !product.is_active) {
      return res.status(404).json({ error: 'Không tìm thấy sản phẩm hoặc sản phẩm đã bị ẩn từ trước.' });
    }

    // Soft delete
    await prisma.product.update({
      where: { id: productId },
      data: { is_active: false }
    });

    return res.json({ message: 'Ẩn sản phẩm thành công.' });
  } catch (error) {
    console.error('Error deleting product:', error);
    return res.status(500).json({ error: 'Lỗi hệ thống khi xóa sản phẩm.' });
  }
};
