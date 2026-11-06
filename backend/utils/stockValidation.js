/**
 * Hàm thuần dùng cho unit test (Jest) — logic nghiệp vụ tách khỏi Express.
 */

function validateImportItem({ quantity }) {
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error('Số lượng phải là số nguyên dương');
  }
}

function calculateImportTotal(items) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unit_price) || 0;
    return sum + qty * price;
  }, 0);
}

function isLowStock({ current_stock, min_stock }) {
  return Number(current_stock) < Number(min_stock);
}

function isExpiringWithinDays(expiryDate, warningDays, now = new Date()) {
  if (!expiryDate) return false;
  const expiry = new Date(expiryDate);
  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= Number(warningDays);
}

module.exports = {
  validateImportItem,
  calculateImportTotal,
  isLowStock,
  isExpiringWithinDays,
};
