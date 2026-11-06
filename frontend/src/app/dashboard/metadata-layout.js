/**
 * Dashboard metadata layout (Server Component wrapper)
 * Cung cấp metadata SEO cho tất cả trang /dashboard/*
 * Layout thực tế (Sidebar + Header) nằm trong DashboardLayout.js (client)
 */

export const metadata = {
  title: {
    default: 'Dashboard | WMS Logistics',
    template: '%s | WMS Logistics',
  },
  description:
    'Hệ thống quản lý kho WMS — Nhập xuất hàng, tồn kho, nhà cung cấp, cảnh báo và đề xuất thông minh.',
  keywords: ['quản lý kho', 'WMS', 'logistics', 'nhập xuất hàng', 'tồn kho'],
  openGraph: {
    siteName: 'WMS Logistics INT1334',
    locale: 'vi_VN',
    type: 'website',
  },
};

export default function DashboardMetadataLayout({ children }) {
  return children;
}
