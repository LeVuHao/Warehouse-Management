export default function DashboardLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
      <span className="ml-3 text-slate-500">Đang tải...</span>
    </div>
  );
}
