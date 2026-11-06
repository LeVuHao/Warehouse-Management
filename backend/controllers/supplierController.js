const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper to check if user is Admin
const checkAdmin = (req) => {
  return req.user && req.user.role === 'admin';
};

// Helper to serialize supplier data (handling decimals)
const serializeSupplier = (s) => {
  return {
    id: s.id,
    name: s.name,
    contact_person: s.contact_person,
    phone: s.phone,
    email: s.email,
    address: s.address,
    distance_km: s.distance_km ? Number(s.distance_km) : null,
    latitude: s.latitude ? Number(s.latitude) : null,
    longitude: s.longitude ? Number(s.longitude) : null,
    is_active: s.is_active,
    created_at: s.created_at,
  };
};

// 1. Get all active suppliers with search and pagination
exports.getAllSuppliers = async (req, res) => {
  const { search, limit, offset, product_ids } = req.query;

  const limitVal = limit ? parseInt(limit) : 200;
  const offsetVal = offset ? parseInt(offset) : 0;

  try {
    const where = { is_active: true };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { contact_person: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (product_ids) {
      const ids = product_ids.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
      if (ids.length > 0) {
        where.product_prices = {
          some: { product_id: { in: ids } }
        };
      }
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      orderBy: { name: 'asc' },
      take: limitVal,
      skip: offsetVal
    });

    const result = suppliers.map(serializeSupplier);
    return res.json(result);
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    return res.status(500).json({ error: 'Lỗi hệ thống khi tải danh sách nhà cung cấp.' });
  }
};

// 2. Get supplier by ID
exports.getSupplierById = async (req, res) => {
  const { id } = req.params;
  const supplierId = parseInt(id);

  if (isNaN(supplierId)) {
    return res.status(400).json({ error: 'ID nhà cung cấp không hợp lệ.' });
  }

  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId }
    });

    if (!supplier || !supplier.is_active) {
      return res.status(404).json({ error: 'Không tìm thấy nhà cung cấp hoặc nhà cung cấp đã bị ẩn.' });
    }

    return res.json(serializeSupplier(supplier));
  } catch (error) {
    console.error('Error fetching supplier by id:', error);
    return res.status(500).json({ error: 'Lỗi hệ thống khi tải chi tiết nhà cung cấp.' });
  }
};

// 3. Create supplier (Admin Only)
exports.createSupplier = async (req, res) => {
  if (!checkAdmin(req)) {
    return res.status(403).json({ error: 'Chỉ Quản trị viên (Admin) mới có quyền thực hiện thao tác này.' });
  }

  const { name, contact_person, phone, email, address, distance_km, latitude, longitude } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Tên nhà cung cấp không được để trống.' });
  }

  try {
    const dist = distance_km !== undefined && distance_km !== '' && distance_km !== null ? Number(distance_km) : null;
    const lat = latitude !== undefined && latitude !== '' && latitude !== null ? Number(latitude) : null;
    const lon = longitude !== undefined && longitude !== '' && longitude !== null ? Number(longitude) : null;

    const supplier = await prisma.supplier.create({
      data: {
        name: name.trim(),
        contact_person: contact_person || null,
        phone: phone || null,
        email: email || null,
        address: address || null,
        distance_km: dist,
        latitude: lat,
        longitude: lon,
        is_active: true
      }
    });

    return res.status(201).json(serializeSupplier(supplier));
  } catch (error) {
    console.error('Error creating supplier:', error);
    return res.status(500).json({ error: 'Lỗi hệ thống khi tạo nhà cung cấp mới.' });
  }
};

// 4. Update supplier (Admin Only)
exports.updateSupplier = async (req, res) => {
  if (!checkAdmin(req)) {
    return res.status(403).json({ error: 'Chỉ Quản trị viên (Admin) mới có quyền thực hiện thao tác này.' });
  }

  const { id } = req.params;
  const supplierId = parseInt(id);

  if (isNaN(supplierId)) {
    return res.status(400).json({ error: 'ID nhà cung cấp không hợp lệ.' });
  }

  const { name, contact_person, phone, email, address, distance_km, latitude, longitude } = req.body;

  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId }
    });

    if (!supplier || !supplier.is_active) {
      return res.status(404).json({ error: 'Không tìm thấy nhà cung cấp để cập nhật.' });
    }

    const dist = distance_km === '' ? null : (distance_km !== undefined ? Number(distance_km) : supplier.distance_km);
    const lat = latitude === '' ? null : (latitude !== undefined ? Number(latitude) : supplier.latitude);
    const lon = longitude === '' ? null : (longitude !== undefined ? Number(longitude) : supplier.longitude);

    const updated = await prisma.supplier.update({
      where: { id: supplierId },
      data: {
        name: name !== undefined ? name.trim() : supplier.name,
        contact_person: contact_person !== undefined ? contact_person : supplier.contact_person,
        phone: phone !== undefined ? phone : supplier.phone,
        email: email !== undefined ? email : supplier.email,
        address: address !== undefined ? address : supplier.address,
        distance_km: dist,
        latitude: lat,
        longitude: lon
      }
    });

    return res.json(serializeSupplier(updated));
  } catch (error) {
    console.error('Error updating supplier:', error);
    return res.status(500).json({ error: 'Lỗi hệ thống khi cập nhật nhà cung cấp.' });
  }
};

// 5. Delete supplier (Admin Only - Soft Delete)
exports.deleteSupplier = async (req, res) => {
  if (!checkAdmin(req)) {
    return res.status(403).json({ error: 'Chỉ Quản trị viên (Admin) mới có quyền thực hiện thao tác này.' });
  }

  const { id } = req.params;
  const supplierId = parseInt(id);

  if (isNaN(supplierId)) {
    return res.status(400).json({ error: 'ID nhà cung cấp không hợp lệ.' });
  }

  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId }
    });

    if (!supplier || !supplier.is_active) {
      return res.status(404).json({ error: 'Không tìm thấy nhà cung cấp hoặc đã bị xóa trước đó.' });
    }

    // Soft delete
    await prisma.supplier.update({
      where: { id: supplierId },
      data: { is_active: false }
    });

    return res.json({ message: 'Đã ẩn nhà cung cấp thành công.' });
  } catch (error) {
    console.error('Error deleting supplier:', error);
    return res.status(500).json({ error: 'Lỗi hệ thống khi xóa nhà cung cấp.' });
  }
};
