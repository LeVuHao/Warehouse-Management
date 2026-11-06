const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get all active shelf locations for dropdowns and selection
exports.getAllLocations = async (req, res) => {
  try {
    const locations = await prisma.location.findMany({
      where: { is_active: true },
      orderBy: { location_code: 'asc' }
    });
    return res.json(locations.map((location) => ({
      ...location,
      available_capacity: Math.max(0, Number(location.max_capacity || 0) - Number(location.current_occupied || 0)),
    })));
  } catch (error) {
    console.error('Error fetching locations:', error);
    return res.status(500).json({ error: 'Lỗi hệ thống khi tải danh sách vị trí kệ.' });
  }
};
