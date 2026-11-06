'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/useAuthStore';
import { useDialogStore } from '@/store/useDialogStore';
import { io } from 'socket.io-client';
import {
  ArrowUpFromLine, ArrowLeft, CheckCircle2,
  XCircle, Clock, AlertCircle, Building2, Truck, Navigation,
  Calendar, User, FileText, ShoppingCart, Share2, PackageOpen, CornerUpLeft,
  MapPin, Hash, DollarSign, Loader2, Printer
} from 'lucide-react';
import dynamic from 'next/dynamic';

const SupplierMap = dynamic(() => import('@/components/SupplierMap'), { ssr: false });

import api from '@/lib/api';
// ─── Configs ──────────────────────────────────────────────────
const STATUS_MAP = {
  PENDING_APPROVAL: { label: 'Chờ duyệt', color: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30', icon: Clock },
  DELIVERING:       { label: 'Đang giao hàng', color: 'bg-cyan-500/15 text-cyan-500 border-cyan-500/30', icon: Truck },
  COMPLETED:        { label: 'Hoàn tất',  color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 },
  CANCELLED:        { label: 'Đã huỷ',    color: 'bg-red-500/15 text-red-400 border-red-500/30',       icon: XCircle },
};

const REASON_MAP = {
  SELL:     { label: 'Bán hàng',     color: 'text-blue-500 bg-blue-500/10 border-blue-500/20', icon: ShoppingCart },
  RETURN:   { label: 'Trả nhà CC',   color: 'text-amber-500 bg-amber-500/10 border-amber-500/20', icon: CornerUpLeft },
  INTERNAL: { label: 'Xuất nội bộ',  color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20', icon: Share2 },
  DISPOSE:  { label: 'Xuất huỷ',     color: 'text-red-500 bg-red-500/10 border-red-500/20', icon: PackageOpen },
};

function StatusBadge({ status }) {
  const cfg = STATUS_MAP[status] || { label: status, color: 'bg-slate-500/15 text-slate-400 border-slate-500/30', icon: AlertCircle };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold ${cfg.color}`}>
      <Icon className="h-4 w-4" />
      {cfg.label}
    </span>
  );
}

function ReasonBadge({ reason }) {
  const cfg = REASON_MAP[reason] || { label: reason, color: 'text-slate-500 bg-slate-500/10', icon: AlertCircle };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold ${cfg.color}`}>
      <Icon className="h-4 w-4" />
      {cfg.label}
    </span>
  );
}

function formatCurrency(n) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n || 0);
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ExportDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { token, user } = useAuthStore();
  const { showConfirm } = useDialogStore();

  const [receipt, setReceipt]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [actionLoading, setActionLoading] = useState('');

  // Reject modal
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Cancel modal
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // ── Fetch receipt ───────────────────────────────────────────
  const fetchReceipt = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/exports/${id}`);
      setReceipt(res.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    fetchReceipt();
    
    // Connect to Socket.io for realtime updates on receipt status
    const getSocketUrl = () => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';
      return apiUrl.replace(/\/api\/?$/, '');
    };
    const socket = io(getSocketUrl());
    socket.on('new_notification', () => {
      fetchReceipt();
    });

    return () => {
      socket.disconnect();
    };
  }, [fetchReceipt]);

  // ── Workflow actions ────────────────────────────────────────
  const doAction = async (action, body = {}) => {
    setActionLoading(action);
    setError('');
    try {
      await api.patch(`/exports/${id}/${action}`, body);
      await fetchReceipt();
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Thao tác thất bại');
    } finally {
      setActionLoading('');
    }
  };

  const handleApprove = () => {
    showConfirm(
      'Phê duyệt Phiếu xuất',
      'Phê duyệt phiếu xuất kho và tự động trừ tồn kho hiện tại?',
      () => doAction('approve')
    );
  };

  const handleCompleteDelivery = () => {
    showConfirm(
      'Xác nhận giao hàng',
      'Xác nhận đã giao hàng thành công tới khách hàng?',
      () => doAction('complete-delivery')
    );
  };

  const submitReject = () => {
    doAction('reject', { rejection_note: rejectReason });
    setShowReject(false);
    setRejectReason('');
  };

  const submitCancel = () => {
    doAction('cancel', { cancel_reason: cancelReason });
    setShowCancel(false);
    setCancelReason('');
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
          <p className="text-sm text-slate-400">Đang tải phiếu xuất...</p>
        </div>
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-red-400 mb-3" />
          <p className="text-sm text-red-400">{error || 'Không tìm thấy phiếu xuất'}</p>
          <Link href="/dashboard/exports" className="mt-3 text-sm text-indigo-400 hover:underline inline-block">
            ← Quay lại danh sách
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/exports"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 shadow-lg shadow-indigo-600/30">
              <ArrowUpFromLine className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">{receipt.receipt_code}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Chi tiết phiếu xuất kho</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-100 dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 shadow-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <Printer className="h-4 w-4" />
            In phiếu / Lưu PDF
          </button>
          <ReasonBadge reason={receipt.reason} />
          <StatusBadge status={receipt.status} />
        </div>
      </div>

      {/* ── Print Header (Only visible when printing) ─────────── */}
      <div className="hidden print:block mb-8 border-b-2 border-slate-900 pb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold uppercase">Phiếu Xuất Kho</h1>
            <p className="text-sm mt-1">Mã phiếu: <strong>{receipt.receipt_code}</strong></p>
            <p className="text-sm mt-1">Loại phiếu: <strong>{REASON_MAP[receipt.reason]?.label || receipt.reason}</strong></p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold">HỆ THỐNG QUẢN LÝ KHO</h2>
            <p className="text-sm mt-1">Ngày in: {new Date().toLocaleDateString('vi-VN')}</p>
          </div>
        </div>
      </div>

      {/* ── Error ───────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400 flex items-center gap-2 print:hidden">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Action Buttons ──────────────────────────────────────── */}
      {receipt.status !== 'CANCELLED' && (
        <div className="flex gap-3 print:hidden">
          {receipt.status === 'PENDING_APPROVAL' && user?.role === 'admin' && (
            <>
              <button
                onClick={handleApprove}
                disabled={!!actionLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-emerald-500 disabled:opacity-50 transition-colors"
              >
                {actionLoading === 'approve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Phê duyệt & Trừ kho
              </button>
              <button
                onClick={() => setShowReject(true)}
                disabled={!!actionLoading}
                className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
              >
                Từ chối duyệt
              </button>
            </>
          )}
          {receipt.status === 'DELIVERING' && (
            <button
              onClick={handleCompleteDelivery}
              disabled={!!actionLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-cyan-500 disabled:opacity-50 transition-colors"
            >
              {actionLoading === 'complete-delivery' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
              Xác nhận đã giao hàng
            </button>
          )}
          {user?.role === 'admin' && receipt.status === 'COMPLETED' && (
            <button
              onClick={() => setShowCancel(true)}
              disabled={!!actionLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
            >
              <XCircle className="h-4 w-4" />
              Huỷ phiếu xuất
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── LEFT: Info ────────────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-5">
          {/* General info */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Thông tin chung</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div><span className="text-slate-500 dark:text-slate-400">Ngày xuất:</span> <span className="font-semibold text-slate-800 dark:text-slate-200">{formatDate(receipt.export_date)}</span></div>
              </div>
              
              {receipt.reason === 'SELL' && (
                <>
                  <div className="flex items-start gap-3">
                    <User className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                    <div><span className="text-slate-500 dark:text-slate-400">Khách hàng:</span> <span className="font-semibold text-slate-800 dark:text-slate-200">{receipt.customer_name || 'Khách lẻ'}</span></div>
                  </div>
                  {receipt.delivery_address && (
                    <div className="flex items-start gap-3">
                      <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                      <div><span className="text-slate-500 dark:text-slate-400">Giao đến:</span> <span className="font-semibold text-slate-800 dark:text-slate-200">{receipt.delivery_address}</span></div>
                    </div>
                  )}
                </>
              )}

              {receipt.reason === 'RETURN' && (
                <div className="flex items-start gap-3">
                  <Building2 className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                  <div><span className="text-slate-500 dark:text-slate-400">Nhà cung cấp:</span> <span className="font-semibold text-slate-800 dark:text-slate-200">{receipt.supplier?.name || '—'}</span></div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <DollarSign className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div><span className="text-slate-500 dark:text-slate-400">Tổng tiền:</span> <span className="font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(receipt.total_amount)}</span></div>
              </div>
            </div>
          </div>

          {/* Audit info */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Lịch sử xử lý</h2>
            <div className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
              <p>Tạo bởi <span className="font-semibold text-slate-700 dark:text-slate-300">{receipt.creator?.full_name}</span> lúc {formatDateTime(receipt.created_at)}</p>
              
              {receipt.approver && (
                <p>
                  {receipt.status === 'COMPLETED' ? 'Phê duyệt' : 'Từ chối'} bởi <span className="font-semibold text-slate-700 dark:text-slate-300">{receipt.approver.full_name}</span> lúc {formatDateTime(receipt.approved_at)}
                </p>
              )}

              {receipt.rejection_note && (
                <div className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-400">
                  <p className="font-semibold text-xs mb-1">Lý do từ chối:</p>
                  <p>{receipt.rejection_note}</p>
                </div>
              )}

              {receipt.note && (
                <div className="mt-2 rounded-lg bg-slate-50 dark:bg-slate-800 p-3">
                  <p className="font-semibold text-xs text-slate-600 dark:text-slate-400 mb-1">Ghi chú:</p>
                  <p className="text-slate-600 dark:text-slate-400">{receipt.note}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT: Details Table ──────────────────────────────── */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <PackageOpen className="h-4 w-4 text-indigo-400" />
                Chi tiết xuất hàng ({receipt.details?.length || 0} dòng)
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">#</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Sản phẩm</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">SL xuất</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Đơn giá</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Thành tiền</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Lô xuất (FEFO)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {receipt.details?.map((d, i) => (
                    <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">{d.product?.name || '—'}</p>
                        <p className="text-xs text-slate-400">{d.product?.product_code} · {d.product?.unit}</p>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-emerald-600 dark:text-emerald-400">-{d.quantity}</td>
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">
                        {formatCurrency(d.selling_price)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800 dark:text-slate-200">
                        {formatCurrency(d.quantity * Number(d.selling_price))}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{d.import_detail?.batch_code || '—'}</p>
                        {d.import_detail?.expiry_date && (
                          <p className="text-xs text-amber-500 dark:text-amber-400 mt-0.5">HSD: {formatDate(d.import_detail.expiry_date)}</p>
                        )}
                        {d.import_detail?.lot_location && (
                          <p className="text-[10px] text-indigo-400 flex items-center gap-1 mt-1">
                            <MapPin className="h-2.5 w-2.5" />
                            {d.import_detail.lot_location.location_code}
                          </p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50">
                    <td colSpan={4} className="px-4 py-3 text-right text-sm font-bold text-slate-600 dark:text-slate-300 uppercase">
                      Tổng cộng
                    </td>
                    <td className="px-4 py-3 text-right text-base font-bold text-indigo-600 dark:text-indigo-400">
                      {formatCurrency(receipt.total_amount)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Map Info */}
          {receipt.reason === 'SELL' && receipt.latitude && receipt.longitude && (
            <div className="mt-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-indigo-400" />
                  Thông tin vận chuyển & Bản đồ tracking
                </h2>
              </div>
              <div className="p-5 flex flex-col gap-4">
                <div className="flex flex-wrap gap-6 text-sm bg-slate-50 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block mb-1 text-xs uppercase font-bold">Điểm đến</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{receipt.delivery_address}</span>
                  </div>
                  <div className="border-l border-slate-200 dark:border-slate-700 pl-6">
                    <span className="text-slate-500 dark:text-slate-400 block mb-1 text-xs uppercase font-bold">Cự ly</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400 text-lg">{receipt.distance_km} km</span>
                  </div>
                  <div className="border-l border-slate-200 dark:border-slate-700 pl-6">
                    <span className="text-slate-500 dark:text-slate-400 block mb-1 text-xs uppercase font-bold">Dự kiến hoàn thành</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-lg">
                      {receipt.estimated_delivery_days === 0 ? 'Trong ngày' : `${receipt.estimated_delivery_days} ngày`}
                    </span>
                  </div>
                </div>
                <div className="h-96 w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm relative z-0">
                  <SupplierMap 
                    mode="view"
                    suppliers={[{
                      id: 1, 
                      name: receipt.customer_name || 'Khách hàng', 
                      latitude: receipt.latitude, 
                      longitude: receipt.longitude,
                      distance_km: receipt.distance_km
                    }]}
                    selectedSupplier={{
                      id: 1, 
                      latitude: receipt.latitude, 
                      longitude: receipt.longitude
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── REJECT MODAL ────────────────────────────────────────── */}
      {showReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4" onClick={() => setShowReject(false)}>
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-white dark:bg-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4">
              <h2 className="text-lg font-bold text-red-400 flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Từ chối phê duyệt
              </h2>
              <button onClick={() => setShowReject(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Lý do từ chối phiếu trả hàng nhà cung cấp <span className="font-semibold text-slate-800 dark:text-slate-200">{receipt.receipt_code}</span>:
              </p>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Ví dụ: Tồn kho không khớp..."
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              />
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowReject(false)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Huỷ
                </button>
                <button
                  onClick={submitReject}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-red-500 transition-colors"
                >
                  Từ chối phiếu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CANCEL MODAL ────────────────────────────────────────── */}
      {showCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4" onClick={() => setShowCancel(false)}>
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-white dark:bg-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4">
              <h2 className="text-lg font-bold text-red-400 flex items-center gap-2">
                <XCircle className="h-5 w-5" />
                Huỷ phiếu xuất
              </h2>
              <button onClick={() => setShowCancel(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Bạn có chắc muốn huỷ phiếu <span className="font-semibold text-slate-800 dark:text-slate-200">{receipt.receipt_code}</span>?
              </p>
              <textarea
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Nhập lý do..."
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              />
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowCancel(false)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Không
                </button>
                <button
                  onClick={submitCancel}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-red-500 transition-colors"
                >
                  Xác nhận huỷ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
