'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { importReceiptSchema } from '@/lib/validations/importSchema';

function getBackendBaseUrl() {
  if (process.env.BACKEND_URL) return process.env.BACKEND_URL.replace(/\/$/, '');
  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';
  return api.replace(/\/api\/?$/, '');
}

/**
 * Server Action — tạo phiếu nhập (INT1334 bắt buộc ≥1 Server Action).
 * Validate Zod trên server, gọi Express API, revalidate cache trang danh sách.
 */
export async function createImportAction(payload) {
  const parsed = importReceiptSchema.safeParse(payload);

  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.flatten().fieldErrors,
      message: 'Dữ liệu phiếu nhập không hợp lệ.',
    };
  }

  const cookieStore = await cookies();
  const accessToken = cookieStore.get('accessToken')?.value;

  if (!accessToken) {
    return { success: false, message: 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.' };
  }

  try {
    const res = await fetch(`${getBackendBaseUrl()}/api/imports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(parsed.data),
      cache: 'no-store',
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        success: false,
        message: data.error || data.message || `Lỗi máy chủ (${res.status})`,
      };
    }

    revalidatePath('/dashboard/imports');
    revalidatePath('/dashboard');

    return {
      success: true,
      id: data.id,
      receipt_code: data.receipt_code,
    };
  } catch (error) {
    console.error('createImportAction:', error);
    return { success: false, message: 'Không thể kết nối máy chủ backend.' };
  }
}
