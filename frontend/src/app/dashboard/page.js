import DashboardClient from './DashboardClient';

/** ISR: cache trang tổng quan 60 giây — cân bằng hiệu năng và độ tươi dữ liệu */
export const revalidate = 60;

export const metadata = {
  title: 'Tổng quan | WMS Logistics',
  description: 'Dashboard thống kê kho hàng — chiến lược ISR (Incremental Static Regeneration)',
};

export default function DashboardPage() {
  return <DashboardClient />;
}
