/** @type {import('next').NextConfig} */
const BACKEND_PROD_URL = 'https://wms-backend-fsyd.onrender.com';
const BACKEND_DEV_URL = 'http://localhost:5001';

const nextConfig = {
  env: {
    // Biến này sẽ được bake vào code khi build trên Vercel.
    // Nếu Vercel đã cấu hình NEXT_PUBLIC_API_URL thì giá trị đó sẽ được dùng,
    // ngược lại, ở môi trường production dùng Render, môi trường dev dùng localhost.
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL || 
      (process.env.NODE_ENV === 'production' ? `${BACKEND_PROD_URL}/api` : `${BACKEND_DEV_URL}/api`),
    // Biến này chỉ dùng phía Server (Server Actions), không lộ ra browser.
    BACKEND_URL:
      process.env.BACKEND_URL || 
      (process.env.NODE_ENV === 'production' ? BACKEND_PROD_URL : BACKEND_DEV_URL),
  },
};

export default nextConfig;

