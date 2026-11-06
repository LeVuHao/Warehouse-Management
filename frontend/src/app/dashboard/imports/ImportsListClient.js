'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/useAuthStore';
import { io } from 'socket.io-client';
import {
  ArrowDownToLine, Plus, Search, Filter, RefreshCw,
  Eye, Trash2, ChevronLeft, ChevronRight, TrendingDown,
  Truck, CheckCircle2, XCircle, Clock, Package, AlertCircle, Download
} from 'lucide-react';
import * as XLSX from 'xlsx';

import api from '@/lib/api';
// ─── Status config ────────────────────────────────────────────
const STATUS_MAP = {
  IN_TRANSIT:  { label: 'Đang vận chuyển', color: 'bg-blue-500/15 text-blue-600 border-blue-500/30', card: 'border-blue-200 bg-blue-50 text-blue-700 shadow-blue-100', icon: Truck },
  ARRIVED:     { label: 'Đã về kho',        color: 'bg-amber-500/15 text-amber-600 border-amber-500/30', card: 'border-amber-200 bg-amber-50 text-amber-700 shadow-amber-100', icon: Package },
  INSPECTING:  { label: 'Đang kiểm tra',    color: 'bg-cyan-500/15 text-cyan-600 border-cyan-500/30', card: 'border-cyan-200 bg-cyan-50 text-cyan-700 shadow-cyan-100', icon: Clock },
  PENDING_APPROVAL: { label: 'Chờ duyệt', color: 'bg-orange-500/15 text-orange-600 border-orange-500/30', card: 'border-orange-200 bg-orange-50 text-orange-700 shadow-orange-100', icon: Clock },
  COMPLETED:   { label: 'Hoàn tất',         color: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30', card: 'border-emerald-200 bg-emerald-50 text-emerald-700 shadow-emerald-100', icon: CheckCircle2 },
  CANCELLED:   { label: 'Đã huỷ',           color: 'bg-red-500/15 text-red-600 border-red-500/30', card: 'border-red-200 bg-red-50 text-red-700 shadow-red-100', icon: XCircle },
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

function formatCurrency(n) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n || 0);
}

export default function ImportsListClient({ initialData = null }) {
  const router = useRouter();
  const { token, user } = useAuthStore();

  const [receipts, setReceipts]   = useState(initialData?.data || []);
  const [pagination, setPagination] = useState(
    initialData?.pagination || { total: 0, page: 1, limit: 15, total_pages: 1 }
  );
  const [loading, setLoading]     = useState(!initialData);
  const [error, setError]         = useState('');

  // Input states
  const [search, setSearch]     = useState('');
  const [status, setStatus]     = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate]     = useState('');
  
  // Filter states applied to API
  const [filterSearch, setFilterSearch] = useState('');
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  
  const [page, setPage]         = useState(1);

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
        const res = await api.get(`/imports?search=${encodeURIComponent(search)}&limit=10`);
        const items = res.data.data || [];
        const term = search.toLowerCase();
        const matches = new Set();
        
        items.forEach(r => {
          if (r.receipt_code?.toLowerCase().includes(term)) matches.add(r.receipt_code);
          const targetName = r.supplier_name;
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

  // ── fetch list ─────────────────────────────────────────────
  const fetchReceipts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page, limit: 15,
        ...(filterSearch   && { search: filterSearch }),
        ...(status         && { status }),
        ...(filterFromDate && { from_date: filterFromDate }),
        ...(filterToDate   && { to_date: filterToDate }),
      });
      const res = await api.get(`/imports?${params}`);
      const data = res.data;
      setReceipts(data.data || []);
      setPagination(data.pagination || {});
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, page, filterSearch, status, filterFromDate, filterToDate, refreshKey]);

  // ── fetch stats ────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/imports/stats');
      setStats(res.data);
    } catch (_) {}
  }, [token]);

  useEffect(() => {
    fetchReceipts();
    fetchStats();
    
    // Connect to Socket.io for realtime updates on receipt list and stats
    const getSocketUrl = () => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';
      return apiUrl.replace(/\/api\/?$/, '');
    };
    const socket = io(getSocketUrl());
    socket.on('new_notification', () => {
      fetchReceipts();
      fetchStats();
    });

    return () => {
      socket.disconnect();
    };
  }, [fetchReceipts, fetchStats]);

  // reset page khi filter thay đổi
  const applyFilter = () => {
    setFilterSearch(search);
    setFilterFromDate(fromDate);
    setFilterToDate(toDate);
    setPage(1);
    setRefreshKey(k => k + 1);
  };

  // ── delete ─────────────────────────────────────────────────
  const handleDelete = async (id, code) => {
    if (!confirm(`Xoá phiếu nhập ${code}?`)) return;
    try {
      await api.delete(`/imports/${id}`);
      fetchReceipts();
      fetchStats();
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    }
  };

  const handleExportExcel = () => {
    if (receipts.length === 0) return;
    const data = receipts.map((r, i) => ({
      'STT': i + 1,
      'Mã phiếu': r.receipt_code,
      'Nhà cung cấp': r.supplier?.name || '',
      'Ngày nhập': r.import_date ? new Date(r.import_date).toLocaleDateString('vi-VN') : '',
      'Tổng tiền (VNĐ)': r.total_amount,
      'Trạng thái': STATUS_MAP[r.status]?.label || r.status,
      'Ghi chú': r.note || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "PhieuNhapKho");
    XLSX.writeFile(workbook, `Danh_Sach_Phieu_Nhap_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* ── Page Header ────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 shadow-lg shadow-indigo-600/30">
            <ArrowDownToLine className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Phiếu nhập kho</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {pagination.total} phiếu nhập
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
            href="/dashboard/imports/new"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-500 active:bg-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Tạo phiếu nhập
          </Link>
        </div>
      </div>

      {/* ── Stats Cards ─────────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {Object.entries(STATUS_MAP).map(([key, cfg]) => {
            const found = stats.by_status?.find((b) => b.status === key);
            const Icon = cfg.icon;
            return (
              <button
                key={key}
                onClick={() => { setStatus(key === status ? '' : key); setPage(1); }}
                className={`group flex min-h-[96px] flex-col justify-between gap-2 rounded-xl border p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer
                  ${status === key
                    ? `${cfg.card} ring-2 ring-cyan-400/50`
                    : cfg.card
                  }`}
              >
                <div className="flex items-center justify-between">
                  <Icon className="h-5 w-5 opacity-80" />
                  <span className="text-lg font-extrabold">
                    {found?.count || 0}
                  </span>
                </div>
                <p className="text-sm font-bold leading-tight">{cfg.label}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Filters ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]" ref={searchContainerRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Tìm mã phiếu, NCC, sản phẩm..."
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
            {(search || status || fromDate || toDate || filterSearch || filterFromDate || filterToDate) && (
              <button
                type="button"
                onClick={() => {
                  setSearch(''); setFromDate(''); setToDate(''); setStatus('');
                  setFilterSearch(''); setFilterFromDate(''); setFilterToDate('');
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
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Nhà cung cấp</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Ngày nhập</th>
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
                    <ArrowDownToLine className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-700 mb-3" />
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Không có phiếu nhập nào</p>
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
                      <span className="font-medium text-slate-800 dark:text-slate-200">{r.supplier_name}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{r.import_date}</td>
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
                          href={`/dashboard/imports/${r.id}`}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                          title="Xem chi tiết"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        {user?.role === 'admin' && ['IN_TRANSIT', 'CANCELLED'].includes(r.status) && (
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
