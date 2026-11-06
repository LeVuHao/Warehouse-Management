const {
  validateImportItem,
  calculateImportTotal,
  isLowStock,
  isExpiringWithinDays,
} = require('../utils/stockValidation');

describe('validateImportItem', () => {
  test('rejects zero quantity', () => {
    expect(() => validateImportItem({ quantity: 0 })).toThrow();
  });

  test('rejects negative quantity', () => {
    expect(() => validateImportItem({ quantity: -1 })).toThrow();
  });

  test('accepts positive quantity', () => {
    expect(() => validateImportItem({ quantity: 10 })).not.toThrow();
  });
});

describe('calculateImportTotal', () => {
  test('sums line items correctly', () => {
    const items = [
      { quantity: 5, unit_price: 10000 },
      { quantity: 3, unit_price: 20000 },
    ];
    expect(calculateImportTotal(items)).toBe(110000);
  });
});

describe('isLowStock', () => {
  test('returns true when below minimum', () => {
    expect(isLowStock({ current_stock: 5, min_stock: 10 })).toBe(true);
  });

  test('returns false when sufficient', () => {
    expect(isLowStock({ current_stock: 15, min_stock: 10 })).toBe(false);
  });
});

describe('isExpiringWithinDays', () => {
  test('detects expiry within warning window', () => {
    const now = new Date('2026-05-29');
    const expiry = '2026-06-10';
    expect(isExpiringWithinDays(expiry, 30, now)).toBe(true);
  });
});
