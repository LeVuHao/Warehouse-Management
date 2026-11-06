import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import AuthProvider from '@/components/AuthProvider';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata = {
  title: 'Hệ thống Quản lý Kho WMS',
  description: 'Hệ thống quản lý kho hàng, xuất nhập, nhà cung cấp, QR code và bản đồ logistics',
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
