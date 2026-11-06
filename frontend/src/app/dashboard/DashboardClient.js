'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import {
  LogOut, User, Shield, Mail, AlertTriangle, ShieldAlert,
  Calendar, Clock, Eye, ArrowRight, TrendingDown,
  Layers, ArrowDownLeft, ArrowUpRight, AlertCircle, Loader2, Sparkles, Plus, Trash2
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

const COLORS = ['#06b6d4', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];

export default function DashboardClient() {
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedAlertCategory, setSelectedAlertCategory] = useState(null);
  const [disposeConfirmItem, setDisposeConfirmItem] = useState(null);
  const [isDisposing, setIsDisposing] = useState(false);

  // States for metrics
  const [overview, setOverview] = useState({
    total_product_types: 0,
    total_current_stock: 0,
    total_stock_value: 0,
  });
  const [thisMonth, setThisMonth] = useState({
    import_receipts_count: 0,
    export_receipts_count: 0,
  });
  const [alerts, setAlerts] = useState({
    low_stock_count: 0,
    expiring_soon_count: 0,
    expired_count: 0,
    slow_moving_count: 0,
    low_stock: [],
    expiring_soon: [],
    expired: [],
    slow_moving: [],
  });
  const [recentImports, setRecentImports] = useState([]);
  const [recentExports, setRecentExports] = useState([]);
  const [chartData, setChartData] = useState({
    stats_7days: [],
    category_stock: []
  });

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [dashRes, alertRes, impRes, expRes, statsRes] = await Promise.all([
        api.get('/inventory/dashboard'),
        api.get('/inventory/alerts'),
        api.get('/imports'),
        api.get('/exports'),
        api.get('/inventory/stats'),
      ]);

      setOverview(dashRes.data.overview || {});
      setThisMonth(dashRes.data.this_month || {});
      
      const alertData = alertRes.data || {};
      setAlerts({
        low_stock_count: alertData.summary?.low_stock_count || 0,
        expiring_soon_count: alertData.summary?.expiring_soon_count || 0,
        expired_count: alertData.summary?.expired_count || 0,
        slow_moving_count: alertData.summary?.slow_moving_count || 0,
        low_stock: alertData.low_stock || [],
        expiring_soon: alertData.expiring_soon || [],
        expired: alertData.expired || [],
        slow_moving: alertData.slow_moving || [],
      });

      setRecentImports((impRes.data?.data || []).slice(0, 5));
      setRecentExports((expRes.data?.data || []).slice(0, 5));
      setChartData(statsRes.data || { stats_7days: [], category_stock: [] });
    } catch (err) {
      console.error('Failed to fetch dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    loadDashboardData();
  }, []);

  const formatCurrency = (val) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val || 0);

  const handleDisposeClick = (item) => {
    if (user?.role !== 'admin') {
      alert('Chỉ Admin mới có quyền tiêu hủy lô hàng.');
      return;
    }
    setDisposeConfirmItem(item);
  };

  const confirmDispose = async () => {
    if (!disposeConfirmItem) return;
    setIsDisposing(true);
    try {
      await api.post('/inventory/alerts/dispose', {
        import_detail_id: disposeConfirmItem.lot_id,
        product_id: disposeConfirmItem.product_id,
        quantity: disposeConfirmItem.available_lot_stock || disposeConfirmItem.current_lot_stock
      });
      // Refresh list
      await loadDashboardData();
      setDisposeConfirmItem(null);
      alert('Đã tiêu hủy lô hàng thành công.');
    } catch (error) {
      alert(error.response?.data?.error || 'Lỗi khi tiêu hủy lô hàng.');
    } finally {
      setIsDisposing(false);
    }
  };

  if (!user) return null;

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600 dark:text-indigo-400" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Đang phân tích số liệu kho hàng...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total Types */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900/20 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-550">Tổng dòng sản phẩm</p>
              <h3 className="mt-2 text-3xl font-bold text-slate-850 dark:text-white">{overview.total_product_types}</h3>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400">
              <Layers className="h-5.5 w-5.5" />
            </div>
          </div>
        </div>

        {/* Card 2: Monthly Imports */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900/20 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-550">Phiếu nhập tháng này</p>
              <h3 className="mt-2 text-3xl font-bold text-slate-850 dark:text-white">{thisMonth.import_receipts_count}</h3>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-650 dark:text-emerald-400">
              <ArrowDownLeft className="h-5.5 w-5.5" />
            </div>
          </div>
        </div>

        {/* Card 3: Monthly Exports */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900/20 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-550">Phiếu xuất kho tháng này</p>
              <h3 className="mt-2 text-3xl font-bold text-slate-850 dark:text-white">{thisMonth.export_receipts_count}</h3>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-650 dark:text-amber-400">
              <ArrowUpRight className="h-5.5 w-5.5" />
            </div>
          </div>
        </div>

        {/* Card 4: Low Stock Alert */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900/20 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-550">Cảnh báo tồn thấp</p>
              <h3 className="mt-2 text-3xl font-bold text-slate-850 dark:text-white">{alerts.low_stock_count}</h3>
            </div>
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all ${
              alerts.low_stock_count > 0 
                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 animate-pulse' 
                : 'bg-slate-50 dark:bg-slate-950/40 text-slate-400'
            }`}>
              <AlertCircle className="h-5.5 w-5.5" />
            </div>
          </div>
        </div>
      </div>

      {/* Inventory Valuation card */}
      <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-gradient-to-r from-indigo-50/50 via-white to-indigo-50/20 dark:from-slate-900/40 dark:via-slate-900/20 dark:to-slate-900/10 p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Tổng giá trị lưu trữ kho hiện tại</p>
        <p className="mt-2 text-3xl font-extrabold text-indigo-755 dark:text-indigo-400 tracking-tight">
          {formatCurrency(overview.total_stock_value)}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Tổng số lượng thực tế: <strong className="text-slate-800 dark:text-slate-200">{overview.total_current_stock?.toLocaleString()}</strong> đơn vị sản phẩm.
        </p>
      </div>

      {/* Charts Section */}
      {mounted && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Bar Chart: Import/Export last 7 days */}
          <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900/20 p-6 shadow-sm">
            <h3 className="mb-4 text-base font-bold text-slate-850 dark:text-white">Xu hướng xuất nhập kho (7 ngày qua)</h3>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.stats_7days}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-800" />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    dy={8}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderRadius: '12px',
                      border: 'none',
                      color: '#fff',
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3)'
                    }}
                    cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '15px', fontSize: 12 }} />
                  <Bar name="Nhập kho" dataKey="import" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  <Bar name="Xuất kho" dataKey="export" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pie Chart: Inventory by Category */}
          <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900/20 p-6 shadow-sm flex flex-col">
            <h3 className="mb-4 text-base font-bold text-slate-850 dark:text-white">Cơ cấu lưu lượng theo danh mục</h3>
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 items-center gap-4">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData.category_stock.filter(item => item.value > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                      nameKey="name"
                      stroke="none"
                    >
                      {chartData.category_stock.filter(item => item.value > 0).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        borderRadius: '12px',
                        border: 'none',
                        color: '#fff',
                      }}
                      formatter={(value) => [`${value.toLocaleString()} đơn vị`, 'Lưu lượng']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-3.5 max-h-60 overflow-y-auto pr-1">
                {(() => {
                  const total = chartData.category_stock.reduce((sum, item) => sum + item.value, 0);
                  return chartData.category_stock
                    .filter(item => item.value > 0)
                    .sort((a, b) => b.value - a.value)
                    .map((item, index) => {
                      const percent = total > 0 ? (item.value / total) * 100 : 0;
                      return (
                        <div key={index} className="flex flex-col gap-1">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                              />
                              <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[130px]" title={item.name}>
                                {item.name}
                              </span>
                            </div>
                            <span className="font-bold text-slate-800 dark:text-slate-200">{percent.toFixed(1)}%</span>
                          </div>
                          <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${percent}%`,
                                backgroundColor: COLORS[index % COLORS.length]
                              }}
                            />
                          </div>
                        </div>
                      );
                    });
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tables and Alerts widgets */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Recent Imports */}
        <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900/20 p-5 shadow-sm flex flex-col h-[400px]">
          <h3 className="mb-4 text-base font-bold text-slate-850 dark:text-white flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
            Nhập kho gần đây
          </h3>
          
          <div className="flex-1 overflow-y-auto pr-1 space-y-3 scrollbar-thin">
            {recentImports.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">Chưa có giao dịch nhập kho.</p>
            ) : (
              recentImports.map(imp => (
                <div key={imp.id} className="p-3 border border-slate-100 dark:border-slate-800/80 rounded-xl bg-slate-50/40 dark:bg-slate-950/20 flex flex-col gap-1 hover:border-indigo-500/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-indigo-650 dark:text-indigo-400">{imp.receipt_code}</span>
                    <span className="text-[10px] text-slate-400">{imp.import_date}</span>
                  </div>
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">{imp.supplier_name}</div>
                  <div className="flex justify-between items-center mt-1">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      imp.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30' : 'bg-amber-50 text-amber-600'
                    }`}>{imp.status}</span>
                    <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">{formatCurrency(imp.total_amount)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Exports */}
        <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900/20 p-5 shadow-sm flex flex-col h-[400px]">
          <h3 className="mb-4 text-base font-bold text-slate-850 dark:text-white flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-500"></span>
            Xuất kho gần đây
          </h3>
          
          <div className="flex-1 overflow-y-auto pr-1 space-y-3 scrollbar-thin">
            {recentExports.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">Chưa có giao dịch xuất kho.</p>
            ) : (
              recentExports.map(exp => (
                <div key={exp.id} className="p-3 border border-slate-100 dark:border-slate-800/80 rounded-xl bg-slate-50/40 dark:bg-slate-950/20 flex flex-col gap-1 hover:border-indigo-500/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-indigo-650 dark:text-indigo-400">{exp.receipt_code}</span>
                    <span className="text-[10px] text-slate-400">{exp.export_date}</span>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-1">
                    <span>Lý do:</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">{exp.reason}</span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      exp.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30' : 'bg-amber-50 text-amber-600'
                    }`}>{exp.status}</span>
                    <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">{formatCurrency(exp.total_amount)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Alerts Widget */}
        <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900/20 p-5 shadow-sm flex flex-col h-[400px]">
          <h3 className="mb-4 text-base font-bold text-slate-850 dark:text-white flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-red-500 animate-pulse" />
            Cảnh báo kho hàng
          </h3>
          
          <div className="flex-1 flex flex-col gap-3">
            {/* Tồn thấp */}
            <div
              onClick={() => setSelectedAlertCategory('low_stock')}
              className="group cursor-pointer rounded-xl bg-red-50/50 dark:bg-red-950/10 p-3 border border-red-100/50 dark:border-red-950/20 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all duration-200 flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-red-100 dark:bg-red-900/40 rounded-lg text-red-650 dark:text-red-400">
                  <AlertTriangle className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-red-800 dark:text-red-400">Tồn dưới mức tối thiểu</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{alerts.low_stock_count} sản phẩm bị hụt</p>
                </div>
              </div>
              <button className="flex items-center gap-0.5 text-[10px] font-bold text-red-700 bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/50 px-2 py-1 rounded-lg opacity-80 group-hover:opacity-100 transition shadow-sm cursor-pointer">
                <Eye className="w-3 h-3" /> Xem
              </button>
            </div>

            {/* Sắp hết hạn (FEFO) */}
            <div
              onClick={() => setSelectedAlertCategory('expiring_soon')}
              className="group cursor-pointer rounded-xl bg-amber-50/50 dark:bg-amber-955/10 p-3 border border-amber-100/50 dark:border-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-955/20 transition-all duration-200 flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-amber-100 dark:bg-amber-900/40 rounded-lg text-amber-650 dark:text-amber-400">
                  <Calendar className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-amber-800 dark:text-amber-400">Sắp hết hạn sử dụng</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{alerts.expiring_soon_count} lô hàng cận date</p>
                </div>
              </div>
              <button className="flex items-center gap-0.5 text-[10px] font-bold text-amber-700 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 px-2 py-1 rounded-lg opacity-80 group-hover:opacity-100 transition shadow-sm cursor-pointer">
                <Eye className="w-3 h-3" /> Xem
              </button>
            </div>

            {/* Tồn kho lâu ngày */}
            <div
              onClick={() => setSelectedAlertCategory('slow_moving')}
              className="group cursor-pointer rounded-xl bg-indigo-50/50 dark:bg-indigo-950/10 p-3 border border-indigo-100/50 dark:border-indigo-950/20 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition-all duration-200 flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg text-indigo-650 dark:text-indigo-400">
                  <Clock className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-indigo-800 dark:text-indigo-400">Tồn kho lâu ngày (&gt;30d)</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{alerts.slow_moving_count} sản phẩm luân chuyển chậm</p>
                </div>
              </div>
              <button className="flex items-center gap-0.5 text-[10px] font-bold text-indigo-700 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/50 px-2 py-1 rounded-lg opacity-80 group-hover:opacity-100 transition shadow-sm cursor-pointer">
                <Eye className="w-3 h-3" /> Xem
              </button>
            </div>

            {/* Lô hàng đã hết hạn */}
            {alerts.expired_count > 0 && (
              <div
                onClick={() => setSelectedAlertCategory('expired')}
                className="group cursor-pointer rounded-xl bg-rose-50/80 dark:bg-rose-950/20 p-3 border border-rose-200 dark:border-rose-900/80 hover:bg-rose-100 dark:hover:bg-rose-955/35 transition-all duration-200 flex items-center justify-between animate-pulse"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-rose-200 dark:bg-rose-900/60 rounded-lg text-rose-700 dark:text-rose-350">
                    <TrendingDown className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-rose-800 dark:text-rose-300">Đã hết hạn sử dụng ⚠️</p>
                    <p className="text-[10px] text-rose-600 dark:text-rose-400 font-medium">{alerts.expired_count} lô hàng cần xử lý gấp</p>
                  </div>
                </div>
                <button className="flex items-center gap-0.5 text-[10px] font-bold text-rose-750 bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-900/50 px-2 py-1 rounded-lg opacity-90 group-hover:opacity-100 transition shadow-sm cursor-pointer">
                  Xử lý
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {false && user?.role === 'admin' && (
        <div className="rounded-2xl border border-indigo-200/60 dark:border-indigo-900/50 bg-indigo-50/30 dark:bg-indigo-950/10 p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-850 dark:text-white flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-500" />
              Đề xuất bổ sung kho (Replenishment Suggestions)
            </h3>
            {alerts.low_stock_count > 0 && (
              <button
                onClick={() => router.push('/dashboard/imports/new')}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-indigo-700 transition cursor-pointer"
              >
                <Plus className="h-4 w-4" /> Tạo phiếu nhập ngay
              </button>
            )}
          </div>
          
          <div className="flex-1">
            {alerts.low_stock.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center bg-white dark:bg-slate-900/40 rounded-xl border border-slate-200/50 dark:border-slate-800">
                Tất cả sản phẩm đều ở mức an toàn. Chưa cần bổ sung lúc này.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900/40">
                <table className="w-full text-left text-xs md:text-sm text-slate-600 dark:text-slate-350">
                  <thead className="text-[11px] uppercase tracking-wider text-slate-500 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200/60 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Mã SP</th>
                      <th className="px-4 py-3">Sản phẩm cần nhập</th>
                      <th className="px-4 py-3 text-right">Tồn hiện tại</th>
                      <th className="px-4 py-3 text-right">Định mức</th>
                      <th className="px-4 py-3 text-right text-indigo-600 dark:text-indigo-400 font-bold">Số lượng đề xuất nhập</th>
                      <th className="px-4 py-3 text-right">Dự toán</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                    {alerts.low_stock.map((item) => {
                      const suggestAmount = item.shortage + Math.ceil(item.min_stock * 0.5); // Example rule: replenish shortage + 50% buffer
                      const estCost = suggestAmount * (item.unit_price || 0);
                      return (
                        <tr key={item.product_id} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/20">
                          <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200 font-mono">{item.product_code}</td>
                          <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">{item.product_name}</td>
                          <td className="px-4 py-3 text-right font-semibold text-red-600 dark:text-red-450">{item.current_stock}</td>
                          <td className="px-4 py-3 text-right text-slate-500">{item.min_stock}</td>
                          <td className="px-4 py-3 text-right font-bold text-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/10">
                            +{suggestAmount} {item.unit}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-500 font-medium">
                            {formatCurrency(estCost)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal chi tiết cảnh báo sức khỏe kho hàng */}
      {selectedAlertCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-4xl max-h-[85vh] overflow-hidden transform rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col text-slate-800 dark:text-slate-200">
            <div className="bg-slate-50 dark:bg-slate-950/60 px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-905 dark:text-white flex items-center gap-2">
                {selectedAlertCategory === 'low_stock' && <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" />}
                {selectedAlertCategory === 'expiring_soon' && <Calendar className="w-5 h-5 text-amber-500" />}
                {selectedAlertCategory === 'slow_moving' && <Clock className="w-5 h-5 text-indigo-500" />}
                {selectedAlertCategory === 'expired' && <TrendingDown className="w-5 h-5 text-rose-500" />}
                
                {selectedAlertCategory === 'low_stock' && 'Cảnh báo tồn kho dưới mức tối thiểu'}
                {selectedAlertCategory === 'expiring_soon' && 'Cảnh báo hạn sử dụng (FEFO Optimizer)'}
                {selectedAlertCategory === 'slow_moving' && 'Cảnh báo sản phẩm tồn kho lâu ngày (> 30 ngày)'}
                {selectedAlertCategory === 'expired' && 'Cảnh báo lô hàng đã hết hạn sử dụng'}
              </h3>
              <button
                onClick={() => setSelectedAlertCategory(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs md:text-sm">
              {/* LOW STOCK TABLE */}
              {selectedAlertCategory === 'low_stock' && (
                alerts.low_stock.length === 0 ? (
                  <p className="text-slate-500 py-8 text-center">Tuyệt vời! Hiện không có sản phẩm nào dưới mức tối thiểu.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-950/40">
                    <table className="w-full text-left text-xs md:text-sm text-slate-600 dark:text-slate-350">
                      <thead className="text-[11px] uppercase tracking-wider text-slate-500 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200/60 dark:border-slate-800">
                        <tr>
                          <th className="px-4 py-3">Mã sản phẩm</th>
                          <th className="px-4 py-3">Tên sản phẩm</th>
                          <th className="px-4 py-3 text-center">ĐVT</th>
                          <th className="px-4 py-3 text-right">Tồn hiện tại</th>
                          <th className="px-4 py-3 text-right">Tồn tối thiểu</th>
                          <th className="px-4 py-3 text-right text-red-600 dark:text-red-400 font-bold">Thiếu hụt</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                        {alerts.low_stock.map((item) => (
                          <tr key={item.product_id} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/20">
                            <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200 font-mono">{item.product_code}</td>
                            <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">{item.product_name}</td>
                            <td className="px-4 py-3 text-center text-slate-500">{item.unit}</td>
                            <td className="px-4 py-3 text-right font-semibold text-red-650 dark:text-red-450">{item.current_stock}</td>
                            <td className="px-4 py-3 text-right text-slate-500">{item.min_stock}</td>
                            <td className="px-4 py-3 text-right font-bold text-red-600 bg-red-500/5 dark:bg-red-500/10">-{item.shortage}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {/* EXPIRING SOON TABLE */}
              {selectedAlertCategory === 'expiring_soon' && (
                alerts.expiring_soon.length === 0 ? (
                  <p className="text-slate-500 py-8 text-center">An toàn! Không có lô hàng nào sắp hết hạn trong ngưỡng cảnh báo.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-950/40">
                    <table className="w-full text-left text-xs md:text-sm text-slate-600 dark:text-slate-355">
                      <thead className="text-[11px] uppercase tracking-wider text-slate-500 bg-slate-50 dark:bg-slate-955/60 border-b border-slate-200/60 dark:border-slate-800">
                        <tr>
                          <th className="px-4 py-3">Mã lô</th>
                          <th className="px-4 py-3">Tên sản phẩm</th>
                          <th className="px-4 py-3">Hạn sử dụng</th>
                          <th className="px-4 py-3 text-right">Tồn lô</th>
                          <th className="px-4 py-3 text-center">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                        {alerts.expiring_soon.map((item) => {
                          const days = item.days_until_expiry;
                          let badgeColor = "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-450 border-red-200/50";
                          if (days > 7) badgeColor = "bg-amber-50 text-amber-700 dark:bg-amber-955/40 dark:text-amber-450 border-amber-200/50";

                          return (
                            <tr key={item.lot_id} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/20">
                              <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200 font-mono">{item.batch_code || 'Chưa phân lô'}</td>
                              <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">{item.product_name}</td>
                              <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-semibold">{new Date(item.expiry_date).toLocaleDateString('vi-VN')}</td>
                              <td className="px-4 py-3 text-right font-bold text-slate-800 dark:text-slate-250">{item.current_lot_stock} {item.unit}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border ${badgeColor}`}>
                                  {days === 0 ? 'Hết hạn hôm nay!' : `Còn ${days} ngày`}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {/* SLOW MOVING TABLE */}
              {selectedAlertCategory === 'slow_moving' && (
                alerts.slow_moving.length === 0 ? (
                  <p className="text-slate-500 py-8 text-center">Tuyệt vời! Toàn bộ sản phẩm đều được luân chuyển đều đặn.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-950/40">
                    <table className="w-full text-left text-xs md:text-sm text-slate-600 dark:text-slate-350">
                      <thead className="text-[11px] uppercase tracking-wider text-slate-500 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200/60 dark:border-slate-800">
                        <tr>
                          <th className="px-4 py-3">Mã sản phẩm</th>
                          <th className="px-4 py-3">Tên sản phẩm</th>
                          <th className="px-4 py-3 text-right">Tồn hiện tại</th>
                          <th className="px-4 py-3">Ngày xuất cuối</th>
                          <th className="px-4 py-3 text-right">Số ngày chưa xuất</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                        {alerts.slow_moving.map((item) => (
                          <tr key={item.product_id} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/20">
                            <td className="px-4 py-3 font-semibold text-slate-850 dark:text-slate-200 font-mono">{item.product_code}</td>
                            <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">{item.product_name}</td>
                            <td className="px-4 py-3 text-right font-bold text-slate-700 dark:text-slate-250">{item.current_stock} {item.unit}</td>
                            <td className="px-4 py-3 text-slate-500">
                              {item.last_export_date ? new Date(item.last_export_date).toLocaleDateString('vi-VN') : 'Chưa từng xuất'}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-indigo-600 bg-indigo-500/5 dark:bg-indigo-500/10">
                              {item.days_since_last_export !== null ? `${item.days_since_last_export} ngày` : 'Chưa rõ'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {/* EXPIRED TABLE */}
              {selectedAlertCategory === 'expired' && (
                alerts.expired.length === 0 ? (
                  <p className="text-slate-500 py-8 text-center">Không có lô hàng nào hết hạn sử dụng.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-950/40">
                    <table className="w-full text-left text-xs md:text-sm text-slate-600 dark:text-slate-350">
                      <thead className="text-[11px] uppercase tracking-wider text-slate-500 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200/60 dark:border-slate-800">
                        <tr>
                          <th className="px-4 py-3">Mã lô</th>
                          <th className="px-4 py-3">Tên sản phẩm</th>
                          <th className="px-4 py-3">Hạn sử dụng</th>
                          <th className="px-4 py-3 text-right">Tồn lô</th>
                          <th className="px-4 py-3 text-center">Tình trạng</th>
                          <th className="px-4 py-3 text-center">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                        {alerts.expired.map((item) => (
                          <tr key={item.lot_id} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/20 bg-red-50/20 dark:bg-red-950/5">
                            <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200 font-mono">{item.batch_code || 'Không mã'}</td>
                            <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">{item.product_name}</td>
                            <td className="px-4 py-3 text-red-600 dark:text-red-400 font-bold">{new Date(item.expiry_date).toLocaleDateString('vi-VN')}</td>
                            <td className="px-4 py-3 text-right font-bold text-slate-800 dark:text-slate-250">{item.current_lot_stock} {item.unit}</td>
                            <td className="px-4 py-3 text-center">
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400 border-red-200/50">
                                Đã quá hạn!
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => handleDisposeClick(item)}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Tiêu hủy
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
              <p className="text-slate-400">Tự động cảnh báo dựa trên quy trình xếp hàng FEFO tối ưu</p>
              <button
                onClick={() => setSelectedAlertCategory(null)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition shadow-sm cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispose Confirmation Modal */}
      {disposeConfirmItem && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md transform rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col">
            <div className="p-6">
              <div className="flex items-center gap-3 text-red-600 mb-4">
                <AlertTriangle className="h-6 w-6" />
                <h3 className="text-lg font-bold">Xác nhận tiêu hủy</h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Lô hàng này đã hết hạn. Bạn có chắc chắn muốn lập phiếu xuất tiêu hủy toàn bộ số tồn còn lại (<strong>{disposeConfirmItem.available_lot_stock || disposeConfirmItem.current_lot_stock} {disposeConfirmItem.unit}</strong>) không?
              </p>
              <p className="text-xs text-red-500 mt-2">Hành động này không thể hoàn tác.</p>
            </div>
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 rounded-b-2xl">
              <button
                onClick={() => setDisposeConfirmItem(null)}
                disabled={isDisposing}
                className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                onClick={confirmDispose}
                disabled={isDisposing}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 flex items-center gap-2 disabled:opacity-50 transition-colors"
              >
                {isDisposing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {isDisposing ? 'Đang xử lý...' : 'Xác nhận tiêu hủy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
