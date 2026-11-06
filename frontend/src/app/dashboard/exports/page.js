'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { io } from 'socket.io-client';
import { useAuthStore } from '@/store/useAuthStore';
import { useDialogStore } from '@/store/useDialogStore';
import {
  ArrowUpFromLine, Plus, Search, Filter, RefreshCw,
  Eye, Trash2, ChevronLeft, ChevronRight, TrendingDown,
  ShoppingCart, CornerUpLeft, PackageOpen, Share2, AlertCircle,
  CheckCircle2, XCircle, Clock, Download, Wifi
} from 'lucide-react';
import * as XLSX from 'xlsx';

import api from '@/lib/api';
// ─── Status & Reason config ───────────────────────────────────
const STATUS_MAP = {
  PENDING_APPROVAL: { label: 'Chờ duyệt', color: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30', icon: Clock },
  COMPLETED:        { label: 'Hoàn tất',  color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 },
  CANCELLED:        { label: 'Đã huỷ',    color: 'bg-red-500/15 text-red-400 border-red-500/30',       icon: XCircle },
};

const REASON_MAP = {
  SELL:     { label: 'Bán hàng',     color: 'text-blue-500 bg-blue-500/10', icon: ShoppingCart },
  RETURN:   { label: 'Trả nhà CC',   color: 'text-amber-500 bg-amber-500/10', icon: CornerUpLeft },
  INTERNAL: { label: 'Xuất nội bộ',  color: 'text-indigo-500 bg-indigo-500/10', icon: Share2 },
  DISPOSE:  { label: 'Xuất huỷ',     color: 'text-red-500 bg-red-500/10', icon: PackageOpen },
};

function StatusBadge({ status }) {
  const cfg = STATUS_MAP[status] || { label: status, color: 'bg-slate-500/15 text-slate-400 border-slate-500/30', icon: AlertCircle };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${cfg.color}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function ReasonBadge({ reason }) {
  const cfg = REASON_MAP[reason] || { label: reason, color: 'text-slate-500 bg-slate-500/10', icon: AlertCircle };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold ${cfg.color}`}>
      <Icon className="h-3.5 w-3.5" />
      {cfg.label}
    </span>
  );
}

function formatCurrency(n) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n || 0);
}

export default function ExportsPage() {
  const router = useRouter();
  const { token, user } = useAuthStore();
  const { showConfirm, showAlert } = useDialogStore();

  const [receipts, setReceipts]   = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 15, total_pages: 1 });
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  // Input states
  const [search, setSearch]     = useState('');
  const [status, setStatus]     = useState('');
  const [reason, setReason]     = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate]     = useState('');
  const [page, setPage]         = useState(1);

  // Filter states applied to API
  const [filterSearch, setFilterSearch] = useState('');
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterReason, setFilterReason] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  // Suggestions state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const searchContainerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!search.trim()) {
        setSuggestions([]);
        return;
      }
      try {
        const res = await api.get(`/exports?search=${encodeURIComponent(search)}&limit=10`);
        const items = res.data.data || [];
        const term = search.toLowerCase();
        const matches = new Set();
        
        items.forEach(r => {
          if (r.receipt_code?.toLowerCase().includes(term)) matches.add(r.receipt_code);
          const targetName = r.reason === 'SELL' ? r.customer_name : r.supplier_name;
          if (targetName?.toLowerCase().includes(term)) matches.add(targetName);
          if (r.product_names && Array.isArray(r.product_names)) {
            r.product_names.forEach(p => {
              if (p?.toLowerCase().includes(term)) matches.add(p);
            });
          }
        });
        setSuggestions(Array.from(matches).slice(0, 6));
      } catch (e) {}
    };

    const delayDebounceFn = setTimeout(() => {
      fetchSuggestions();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  // Stats
  const [stats, setStats] = useState(null);
  const [isLive, setIsLive] = useState(false);

  // ── fetch list ─────────────────────────────────────────────
  const fetchReceipts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page, limit: 15,
        ...(filterSearch   && { search: filterSearch }),
        ...(filterStatus   && { status: filterStatus }),
        ...(filterReason   && { reason: filterReason }),
        ...(filterFromDate && { from_date: filterFromDate }),
        ...(filterToDate   && { to_date: filterToDate }),
      });
      const res = await api.get(`/exports?${params}`);
      const data = res.data;
      setReceipts(data.data || []);
      setPagination(data.pagination || {});
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, page, filterSearch, filterStatus, filterReason, filterFromDate, filterToDate, refreshKey]);

  // ── fetch stats ────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/exports/stats');
      setStats(res.data);
    } catch (_) {}
  }, [token]);

  useEffect(() => { fetchReceipts(); fetchStats(); }, [fetchReceipts, fetchStats]);

  // ── Socket.IO: Realtime auto-refresh ───────────────────────
  useEffect(() => {
    const socketUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api').replace(/\/api\/?$/, '');
    const socket = io(socketUrl, { reconnectionAttempts: 5 });

    socket.on('connect', () => setIsLive(true));
    socket.on('disconnect', () => setIsLive(false));
    socket.on('connect_error', () => setIsLive(false));

    // Khi có sự kiện mới (admin duyệt phếu RETURN, tạo phếu xuất mới...) → tự reload
    socket.on('new_notification', () => {
      fetchReceipts();
      fetchStats();
    });

    return () => socket.disconnect();
  }, [fetchReceipts, fetchStats]);

  const applyFilter = () => {
    setFilterSearch(search);
    setFilterFromDate(fromDate);
    setFilterToDate(toDate);
    setFilterStatus(status);
    setFilterReason(reason);
    setPage(1);
    setRefreshKey(k => k + 1);
  };

  // ── delete ─────────────────────────────────────────────────
  const handleDelete = (id, code) => {
    showConfirm(
      'Xác nhận Xóa',
      `Bạn có chắc muốn xóa vĩnh viễn phiếu xuất ${code}?`,
      async () => {
        try {
          await api.delete(`/exports/${id}`);
          showAlert('Thành công', 'Đã xóa phiếu xuất thành công.');
          fetchReceipts();
          fetchStats();
        } catch (e) {
          showAlert('Lỗi', e.response?.data?.error || e.message);
        }
      }
    );
  };

  const handleExportExcel = () => {
    if (receipts.length === 0) return;
    const data = receipts.map((r, i) => ({
      'STT': i + 1,
      'Mã phiếu': r.receipt_code,
      'Loại xuất': r.reason === 'SELL' ? 'Xuất bán' : r.reason === 'RETURN' ? 'Trả NCC' : r.reason === 'INTERNAL' ? 'Nội bộ' : 'Huỷ',
      'Đối tác': r.reason === 'SELL' ? (r.customer_name || 'Khách lẻ') : (r.supplier_name || '—'),
      'Ngày xuất': r.export_date,
      'Tổng tiền (VNĐ)': r.total_amount,
      'Trạng thái': STATUS_MAP[r.status]?.label || r.status,
      'Ghi chú': r.note || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "PhieuXuatKho");
    XLSX.writeFile(workbook, `Danh_Sach_Phieu_Xuat_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* ── Page Header ────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 shadow-lg shadow-indigo-600/30">
            <ArrowUpFromLine className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Phiếu xuất kho</h1>
              {isLive && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <Wifi className="h-2.5 w-2.5" />
                  LIVE
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {pagination.total} phiếu xuất
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-emerald-500 active:bg-emerald-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            Xuất Excel
          </button>
          <Link
            href="/dashboard/exports/new"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-500 active:bg-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Tạo phiếu xuất
          </Link>
        </div>
      </div>

      {/* ── Stats Cards ─────────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(REASON_MAP).map(([key, cfg]) => {
            const found = stats.by_reason?.find((b) => b.reason === key);
            const Icon = cfg.icon;
            return (
              <button
                key={key}
                onClick={() => { setReason(key === reason ? '' : key); setPage(1); }}
                className={`group flex flex-col gap-1.5 rounded-xl border p-4 text-left transition-all hover:scale-[1.02] cursor-pointer
                  ${reason === key
                    ? 'border-indigo-500 bg-indigo-600/10 ring-1 ring-indigo-500/40'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <Icon className={`h-4 w-4 ${reason === key ? 'text-indigo-400' : 'text-slate-400'}`} />
                  <span className={`text-xs font-bold ${reason === key ? 'text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`}>
                    {found?.count || 0}
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 leading-tight">{cfg.label}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Filters ─────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]" ref={searchContainerRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Tìm mã phiếu, khách hàng, NCC, sản phẩm..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setShowSuggestions(false);
                applyFilter();
              }
            }}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg overflow-hidden">
              {suggestions.map((sug, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setSearch(sug);
                    setShowSuggestions(false);
                    setFilterSearch(sug);
                    setFilterFromDate(fromDate);
                    setFilterToDate(toDate);
                    setFilterStatus(status);
                    setFilterReason(reason);
                    setPage(1);
                    setRefreshKey(k => k + 1);
                  }}
                  className="px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition-colors"
                >
                  {sug}
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Status Filter */}
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">-- Tất cả trạng thái --</option>
          <option value="PENDING_APPROVAL">Chờ duyệt</option>
          <option value="COMPLETED">Hoàn tất</option>
          <option value="CANCELLED">Đã huỷ</option>
        </select>
        {/* From Date */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Từ</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            onClick={(e) => e.target.showPicker && e.target.showPicker()}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            title="Từ ngày"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Đến</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            onClick={(e) => e.target.showPicker && e.target.showPicker()}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            title="Đến ngày"
          />
        </div>
        <button
          type="button"
          onClick={applyFilter}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
        >
          <Filter className="h-4 w-4 pointer-events-none" />
          Lọc
        </button>
        {(search || status || reason || fromDate || toDate || filterSearch || filterStatus || filterReason || filterFromDate || filterToDate) && (
          <button
            type="button"
            onClick={() => { 
              setSearch(''); setStatus(''); setReason(''); setFromDate(''); setToDate(''); 
              setFilterSearch(''); setFilterStatus(''); setFilterReason(''); setFilterFromDate(''); setFilterToDate(''); 
              setPage(1); 
              setRefreshKey(k => k + 1);
            }}
            className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className="h-4 w-4 pointer-events-none" />
            Xoá lọc
          </button>
        )}
      </div>

      {/* ── Error ───────────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Mã phiếu</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Loại xuất / Đối tượng</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Ngày xuất</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">SP</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Tổng tiền</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Trạng thái</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : receipts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <ArrowUpFromLine className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-700 mb-3" />
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Không có phiếu xuất nào</p>
                    <p className="text-xs text-slate-400 dark:text-slate-600 mt-1">Thử thay đổi bộ lọc hoặc tạo phiếu mới</p>
                  </td>
                </tr>
              ) : (
                receipts.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                        {r.receipt_code}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1 items-start">
                        <ReasonBadge reason={r.reason} />
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          {r.reason === 'SELL' ? (r.customer_name || 'Khách lẻ') : (r.supplier_name || '—')}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{r.export_date}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
                        {r.items_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800 dark:text-slate-200">
                      {formatCurrency(r.total_amount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <Link
                          href={`/dashboard/exports/${r.id}`}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                          title="Xem chi tiết"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        {user?.role === 'admin' && r.status === 'CANCELLED' && (
                          <button
                            onClick={() => handleDelete(r.id, r.receipt_code)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-500 transition-colors"
                            title="Xoá phiếu"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ──────────────────────────────────────── */}
        {pagination.total_pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 px-4 py-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Trang {pagination.page} / {pagination.total_pages} — {pagination.total} phiếu
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page <= 1}
                className="rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pagination.total_pages, p + 1))}
                disabled={pagination.page >= pagination.total_pages}
                className="rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
