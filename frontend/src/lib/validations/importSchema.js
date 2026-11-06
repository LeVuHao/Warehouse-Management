import { z } from 'zod';

export const importItemSchema = z.object({
  product_id: z.number().int().positive('product_id phải là số dương'),
  quantity: z.number().int().positive('Số lượng phải lớn hơn 0'),
  unit_price: z.number().min(0, 'Đơn giá không được âm'),
});

export const importReceiptSchema = z.object({
  supplier_id: z.number().int().positive('Vui lòng chọn nhà cung cấp'),
  import_date: z.string().min(1, 'Ngày nhập không được trống'),
  note: z.string().optional(),
  estimated_delivery_days: z.number().int().positive().optional(),
  details: z.array(importItemSchema).min(1, 'Phải có ít nhất 1 mặt hàng'),
});
