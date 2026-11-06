import Link from 'next/link';

/** SSG: trang tĩnh, build-time — không cần auth */
export const metadata = {
  title: 'Giới thiệu hệ thống | WMS Logistics',
  description:
    'Hệ thống quản lý kho WMS (Warehouse Management System) — Xây dựng bằng Next.js 14 App Router, Express, PostgreSQL (Neon), Prisma. Đồ án INT1334 PTIT TP.HCM.',
  keywords: [
    'WMS', 'quản lý kho', 'warehouse management', 'logistics',
    'Next.js', 'PTIT', 'INT1334', 'đồ án lập trình web'
  ],
  openGraph: {
    title: 'WMS Logistics — Hệ thống Quản lý Kho Thông Minh',
    description: 'Ứng dụng quản lý kho với QR Code, bản đồ Leaflet, Gemini AI gợi ý nhập hàng, cảnh báo email.',
    type: 'website',
    locale: 'vi_VN',
    siteName: 'WMS Logistics INT1334',
  },
  twitter: {
    card: 'summary',
    title: 'WMS Logistics — Quản lý Kho',
    description: 'Hệ thống quản lý kho fullstack — Next.js + Express + PostgreSQL',
  },
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm font-semibold uppercase tracking-wider text-cyan-600">INT1334 — Lập trình Web</p>
        <h1 className="mt-2 text-4xl font-bold">Hệ thống Quản lý Kho thông minh (WMS)</h1>
        <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
          Ứng dụng fullstack quản lý nhập xuất, tồn kho, cảnh báo và đề xuất bổ sung hàng cho chuỗi
          cung ứng bán lẻ.
        </p>

        <section className="mt-10 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xl font-semibold">Chiến lược rendering (Next.js App Router)</h2>
          <ul className="list-disc space-y-2 pl-6 text-slate-600 dark:text-slate-400">
            <li>
              <strong>SSG</strong> — Trang About (trang này): nội dung tĩnh khi build.
            </li>
            <li>
              <strong>ISR</strong> — Dashboard: <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">revalidate = 60</code>.
            </li>
            <li>
              <strong>SSR</strong> — Danh sách phiếu nhập: fetch server mỗi request.
            </li>
          </ul>
        </section>

        <section className="mt-6 space-y-2 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xl font-semibold">Tech stack</h2>
          <p className="text-slate-600 dark:text-slate-400">
            Next.js, Express, Prisma, PostgreSQL (Neon), JWT + Refresh Token (DB), Zustand, React Hook Form + Zod.
          </p>
        </section>

        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/login"
            className="rounded-xl bg-cyan-600 px-6 py-3 font-semibold text-white hover:bg-cyan-700"
          >
            Đăng nhập hệ thống
          </Link>
          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-300 px-6 py-3 font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Vào Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
