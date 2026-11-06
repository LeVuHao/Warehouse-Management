'use client';

export default function DashboardError({ error, reset }) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-900 dark:bg-red-950/40">
      <h2 className="text-lg font-bold text-red-700 dark:text-red-400">Đã xảy ra lỗi</h2>
      <p className="mt-2 text-sm text-red-600 dark:text-red-300">{error?.message || 'Không thể tải trang.'}</p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
      >
        Thử lại
      </button>
    </div>
  );
}
