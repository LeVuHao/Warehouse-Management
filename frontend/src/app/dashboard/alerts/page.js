'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, Clock, Loader2, ShieldAlert, TrendingDown, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';

const tabs = [
  { key: 'low_stock', label: 'Tồn thấp', icon: AlertTriangle, active: 'bg-red-500 text-white shadow-lg shadow-red-200', idle: 'bg-white text-red-600 border-red-200 hover:bg-red-50' },
  { key: 'expiring_soon', label: 'Sắp hết hạn', icon: CalendarClock, active: 'bg-yellow-500 text-white shadow-lg shadow-yellow-200', idle: 'bg-white text-yellow-600 border-yellow-200 hover:bg-yellow-50' },
  { key: 'expired', label: 'Đã hết hạn', icon: TrendingDown, active: 'bg-red-600 text-white shadow-lg shadow-red-200', idle: 'bg-white text-red-700 border-red-200 hover:bg-red-50' },
  { key: 'slow_moving', label: 'Tồn lâu', icon: Clock, active: 'bg-orange-500 text-white shadow-lg shadow-orange-200', idle: 'bg-white text-orange-600 border-orange-200 hover:bg-orange-50' },
];

const config = {
  low_stock: {
    title: 'Cảnh báo tồn thấp',
    description: 'Danh sách sản phẩm có tồn kho dưới ngưỡng tối thiểu.',
    empty: 'Tất cả sản phẩm đều ổn định.',
    columns: ['Mã SP', 'Tên sản phẩm', 'ĐVT', 'Tồn hiện tại', 'Ngưỡng tối thiểu', 'Cần nhập thêm'],
    row: (item) => [
      item.product_code,
      item.product_name,
      item.unit,
      item.current_stock,
      item.min_stock,
      <span key="shortage" className="font-bold text-red-600">{item.shortage}</span>,
    ],
  },
  expiring_soon: {
    title: 'Cảnh báo sắp hết hạn',
    description: 'Lô hàng sắp hết hạn sử dụng dựa theo cấu hình cảnh báo của từng sản phẩm.',
    empty: 'Không có lô hàng nào sắp hết hạn.',
    columns: ['Mã SP', 'Tên sản phẩm', 'Mã lô', 'Ngày hết hạn', 'Còn lại', 'Số ngày còn lại'],
    row: (item) => [
      item.product_code,
      item.product_name,
      item.batch_code || 'Chưa phân lô',
      item.expiry_date ? new Date(item.expiry_date).toLocaleDateString('vi-VN') : '-',
      item.current_lot_stock,
      <span key="days" className="font-bold text-yellow-600">{item.days_until_expiry} ngày</span>,
    ],
  },
  expired: {
    title: 'Cảnh báo hàng đã hết hạn',
    description: 'Danh sách các lô hàng đã quá hạn sử dụng, cần xử lý trả NCC hoặc hủy theo quy trình.',
    empty: 'Không có lô hàng hết hạn.',
    columns: ['Mã SP', 'Tên sản phẩm', 'Mã lô', 'Ngày hết hạn', 'Còn lại', 'Tình trạng', 'Thao tác'],
    row: (item, actions) => [
      item.product_code,
      item.product_name,
      item.batch_code || 'Chưa phân lô',
      item.expiry_date ? new Date(item.expiry_date).toLocaleDateString('vi-VN') : '-',
      item.current_lot_stock,
      <span key="expired" className="font-bold text-red-600">Quá hạn {Math.abs(item.days_until_expiry || 0)} ngày</span>,
      <button 
        key="dispose"
        onClick={() => actions?.handleDispose && actions.handleDispose(item)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors"
      >
        <Trash2 className="h-3.5 w-3.5" /> Tiêu hủy
      </button>
    ],
  },
  slow_moving: {
    title: 'Cảnh báo tồn lâu',
    description: 'Sản phẩm còn tồn nhưng chưa có phiếu xuất bán trong 30 ngày qua.',
    empty: 'Không có sản phẩm tồn lâu.',
    columns: ['Mã SP', 'Tên sản phẩm', 'ĐVT', 'Tồn hiện tại', 'Xuất lần cuối', 'Số ngày chưa xuất'],
    row: (item) => [
      item.product_code,
      item.product_name,
      item.unit,
      item.current_stock,
      item.last_export_date ? new Date(item.last_export_date).toLocaleDateString('vi-VN') : 'Chưa từng xuất',
      item.days_since_last_export !== null && item.days_since_last_export !== undefined ? `${item.days_since_last_export} ngày` : 'Chưa rõ',
    ],
  },
};

export default function AlertsPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('low_stock');
  const [alerts, setAlerts] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAlerts = async () => {
      setLoading(true);
      try {
        const res = await api.get('/inventory/alerts');
        setAlerts(res.data || {});
      } catch (error) {
        console.error('Failed to load alerts:', error);
        setAlerts({});
      } finally {
        setLoading(false);
      }
    };

    loadAlerts();
  }, []);

  const [isDisposing, setIsDisposing] = useState(false);
  const [disposeConfirmItem, setDisposeConfirmItem] = useState(null);

  const handleDisposeClick = (item) => {
    if (user?.role !== 'admin') {
      alert('Chỉ Admin mới có quyền tiêu hủy lô hàng.');
      return;
    }
    setDisposeConfirmItem(item);
  };

  const confirmDisposeLot = async () => {
    if (!disposeConfirmItem) return;
    setIsDisposing(true);
    try {
      await api.post('/inventory/alerts/dispose', {
        import_detail_id: disposeConfirmItem.lot_id,
        product_id: disposeConfirmItem.product_id,
        quantity: disposeConfirmItem.available_lot_stock
      });
      // Refresh list
      const res = await api.get('/inventory/alerts');
      setAlerts(res.data || {});
      setDisposeConfirmItem(null);
    } catch (error) {
      alert(error.response?.data?.error || 'Lỗi khi tiêu hủy lô hàng.');
    } finally {
      setIsDisposing(false);
    }
  };

  const activeConfig = config[activeTab];
  const data = useMemo(() => alerts[activeTab] || [], [alerts, activeTab]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500 text-white shadow-lg shadow-cyan-200">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">{activeConfig.title}</h1>
              <p className="text-sm text-slate-500">{activeConfig.description}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          const count = (alerts[tab.key] || []).length;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-semibold transition ${isActive ? tab.active : tab.idle}`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {count > 0 && <span className="rounded-full bg-white/30 px-2 py-0.5 text-xs font-bold">{count}</span>}
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex h-56 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-56 flex-col items-center justify-center gap-2 text-center text-slate-500">
            <ShieldAlert className="h-10 w-10 text-slate-300" />
            <p className="text-sm font-semibold">{activeConfig.empty}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-sm text-slate-600">
                <tr>
                  {activeConfig.columns.map((column) => (
                    <th key={column} className="px-4 py-4">{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((item, index) => (
                  <tr key={`${activeTab}-${item.product_id || item.lot_id}-${index}`} className="border-t border-slate-100 hover:bg-slate-50/70">
                    {activeConfig.row(item, { handleDispose: handleDisposeClick }).map((cell, cellIndex) => (
                      <td key={cellIndex} className="px-4 py-4 text-slate-700 first:font-mono first:text-xs first:font-semibold first:text-cyan-700">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
                onClick={confirmDisposeLot}
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
