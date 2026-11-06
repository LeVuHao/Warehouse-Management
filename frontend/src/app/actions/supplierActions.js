'use server';

import { cookies } from 'next/headers';

function getBackendBaseUrl() {
  if (process.env.BACKEND_URL) return process.env.BACKEND_URL.replace(/\/$/, '');
  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';
  return api.replace(/\/api\/?$/, '');
}

export async function createSupplierAction(formData) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('accessToken')?.value;

    const payload = {
      name: formData.get('name'),
      contact_person: formData.get('contact_person'),
      phone: formData.get('phone'),
      email: formData.get('email'),
      address: formData.get('address'),
      distance_km: formData.get('distance_km') ? Number(formData.get('distance_km')) : null,
      latitude: formData.get('latitude') ? Number(formData.get('latitude')) : null,
      longitude: formData.get('longitude') ? Number(formData.get('longitude')) : null,
    };

    const res = await fetch(`${getBackendBaseUrl()}/api/suppliers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {})
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorData = await res.json();
      return { success: false, error: errorData.error || 'Lỗi tạo nhà cung cấp' };
    }

    const data = await res.json();
    return { success: true, data };
  } catch (error) {
    console.error('Server Action Error:', error);
    return { success: false, error: 'Lỗi máy chủ khi gọi API' };
  }
}

