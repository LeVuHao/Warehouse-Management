'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/useAuthStore';
import { io } from 'socket.io-client';
import {
  ArrowDownToLine, ArrowLeft, Truck, Package, CheckCircle2,
  XCircle, Clock, AlertCircle, ClipboardCheck, Building2,
  Calendar, User, FileText, MapPin, Hash, DollarSign, Edit3,
  Loader2, Printer, Download
} from 'lucide-react';

import api from '@/lib/api';
// ─── Status config ────────────────────────────────────────────
const STATUS_MAP = {
  IN_TRANSIT:  { label: 'Đang vận chuyển', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30',     icon: Truck,        step: 1 },
  ARRIVED:     { label: 'Đã về kho',        color: 'bg-amber-500/15 text-amber-400 border-amber-500/30',  icon: Package,      step: 2 },
  INSPECTING:  { label: 'Đang kiểm tra',    color: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30', icon: Clock,      step: 3 },
  PENDING_APPROVAL: { label: 'Chờ duyệt', color: 'bg-orange-500/15 text-orange-400 border-orange-500/30', icon: Clock, step: 4 },
  COMPLETED:   { label: 'Hoàn tất',         color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', icon: CheckCircle2, step: 5 },
  CANCELLED:   { label: 'Đã huỷ',           color: 'bg-red-500/15 text-red-400 border-red-500/30',        icon: XCircle,      step: 0 },
};

const STATUS_FLOW = ['IN_TRANSIT', 'ARRIVED', 'INSPECTING', 'PENDING_APPROVAL', 'COMPLETED'];

const DATE_SENSITIVE_CATEGORIES = ['Thực phẩm tươi sống', 'Đồ uống và bánh kẹo', 'Thực phẩm khô và Nhu yếu phẩm'];

const makeAutoBatchCode = (receiptCode, detailId) => `LOT-${String(receiptCode || '').replace(/^PN/, '')}-${detailId}`;

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

export default function ImportDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { token, user } = useAuthStore();

  const [receipt, setReceipt]   = useState(null);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const printRef = useRef(null);

  const handlePrint = () => {
    window.print();
  };

  // Inspect modal
  const [showInspect, setShowInspect]     = useState(false);
  const [inspectNotes, setInspectNotes]   = useState('');
  const [inspectDetails, setInspectDetails] = useState([]);
  const [sendEmailNotification, setSendEmailNotification] = useState(true);

  // Cancel modal
  const [showCancel, setShowCancel]     = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // ── Fetch receipt ───────────────────────────────────────────
  const fetchReceipt = useCallback(async () => {
    setLoading(true);
    try {
      const [res, locationRes] = await Promise.all([
        api.get(`/imports/${id}`),
        api.get('/locations'),
      ]);
      setReceipt(res.data);
      setLocations(Array.isArray(locationRes.data) ? locationRes.data : []);
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
      const res = await api.patch(`/imports/${id}/${action}`, body);
      await fetchReceipt();
      return true;
    } catch (e) {
      const msg = e.response?.data?.error || e.response?.data?.message || e.message;
      setError(msg);
      return false;
    } finally {
      setActionLoading('');
    }
  };

  const handleArrive = () => doAction('arrive');
  const handleComplete = () => doAction('complete');

  const handleInspect = () => {
    if (!receipt) return;
    setError('');
    setInspectDetails(
      receipt.details.map((d) => {
        const category = d.product?.category || '';
        const defaultLocation = locations.find(
          (loc) => loc.zone?.trim().toLowerCase() === category.trim().toLowerCase()
        );

        return {
          detail_id: d.id,
          product_name: d.product?.name || '',
          product_category: category,
          expected: d.expected_quantity ?? d.quantity,
          received_qty: String(d.received_quantity ?? d.quantity),
          accepted_qty: String(d.accepted_quantity ?? d.quantity),
          rejected_qty: String(d.rejected_quantity ?? 0),
          batch_code: d.batch_code || makeAutoBatchCode(receipt.receipt_code, d.id),
          mfg_date: d.mfg_date ? String(d.mfg_date).slice(0, 10) : '',
          expiry_date: d.expiry_date ? String(d.expiry_date).slice(0, 10) : '',
          location_id: d.location_id ? String(d.location_id) : (defaultLocation ? String(defaultLocation.id) : ''),
        };
      })
    );
    setInspectNotes('');
    setSendEmailNotification(true);
    setShowInspect(true);
  };

  const submitInspect = async () => {
    setError('');
    for (const item of inspectDetails) {
      const received = parseInt(item.received_qty, 10) || 0;
      const accepted = parseInt(item.accepted_qty, 10) || 0;
      const rejected = parseInt(item.rejected_qty, 10) || 0;

      if (accepted > received) {
        setError(`Sản phẩm "${item.product_name}": Số lượng chấp nhận không được lớn hơn số lượng nhận.`);
        return;
      }
      if (accepted + rejected !== received) {
        setError(`Sản phẩm "${item.product_name}": Số lượng đạt và lỗi phải bằng số lượng nhận.`);
        return;
      }
      if (!item.batch_code?.trim()) {
        setError(`Sản phẩm "${item.product_name}" bắt buộc có mã lô.`);
        return;
      }
      if (DATE_SENSITIVE_CATEGORIES.includes(item.product_category) && (!item.mfg_date || !item.expiry_date)) {
        setError(`Sản phẩm "${item.product_name}" cần nhập NSX và HSD.`);
        return;
      }
      if (item.mfg_date && item.expiry_date && new Date(item.mfg_date) >= new Date(item.expiry_date)) {
        setError(`Sản phẩm "${item.product_name}": Hạn sử dụng (HSD) phải sau Ngày sản xuất (NSX).`);
        return;
      }
      if (!item.location_id) {
        setError(`Sản phẩm "${item.product_name}" cần chọn vị trí kệ.`);
        return;
      }
    }

    const ok = await doAction('inspect', {
      issue_notes: inspectNotes,
      send_email_notification: sendEmailNotification,
      details: inspectDetails.map((d) => ({
        detail_id: d.detail_id,
        received_qty: parseInt(d.received_qty) || 0,
        accepted_qty: parseInt(d.accepted_qty) || 0,
        rejected_qty: parseInt(d.rejected_qty) || 0,
        batch_code: d.batch_code,
        mfg_date: d.mfg_date || null,
        expiry_date: d.expiry_date || null,
        location_id: d.location_id ? parseInt(d.location_id, 10) : null,
      })),
    });
    if (ok) {
      setShowInspect(false);
    }
  };

  const submitCancel = () => {
    doAction('cancel', { cancel_reason: cancelReason });
    setShowCancel(false);
    setCancelReason('');
  };

  // ── Loading state ───────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          <p className="text-sm text-slate-400">Đang tải phiếu nhập...</p>
        </div>
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-red-400 mb-3" />
          <p className="text-sm text-red-400">{error || 'Không tìm thấy phiếu nhập'}</p>
          <Link href="/dashboard/imports" className="mt-3 text-sm text-indigo-400 hover:underline inline-block">
            ← Quay lại danh sách
          </Link>
        </div>
      </div>
    );
  }

  const currentStep = STATUS_MAP[receipt.status]?.step || 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between no-print">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/imports"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 shadow-lg shadow-indigo-600/30">
              <ArrowDownToLine className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">{receipt.receipt_code}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Chi tiết phiếu nhập kho</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handlePrint} className="no-print inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">In / Tải PDF</span>
          </button>
          <StatusBadge status={receipt.status} />
        </div>
      </div>

      {/* ── Error ───────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div ref={printRef} className="print-content space-y-6 print:bg-white print:text-black">
        {/* Printable Header inside PDF (only visible when printing or in PDF) */}
        <div className="hidden print:block mb-8 border-b pb-4">
          <h1 className="text-2xl font-bold text-center mb-2">PHIẾU NHẬP KHO</h1>
          <p className="text-center text-sm">Mã phiếu: {receipt.receipt_code}</p>
          <p className="text-center text-sm">Trạng thái: {STATUS_MAP[receipt.status]?.label}</p>
        </div>

      {/* ── Progress Steps ──────────────────────────────────────── */}
      {receipt.status !== 'CANCELLED' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center justify-between">
            {STATUS_FLOW.map((st, i) => {
              const cfg = STATUS_MAP[st];
              const Icon = cfg.icon;
              const done = currentStep >= cfg.step;
              const active = receipt.status === st;
              return (
                <div key={st} className="flex items-center flex-1">
                  <div className="flex flex-col items-center gap-1.5">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all ${
                      active
                        ? 'border-indigo-500 bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : done
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : 'border-slate-300 dark:border-slate-700 text-slate-400'
                    }`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                      active ? 'text-indigo-500' : done ? 'text-emerald-500' : 'text-slate-400'
                    }`}>
                      {cfg.label}
                    </span>
                  </div>
                  {i < STATUS_FLOW.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 rounded-full ${
                      currentStep > cfg.step ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Action Buttons ──────────────────────────────────────── */}
      {!['COMPLETED', 'CANCELLED'].includes(receipt.status) && (
        <div className="flex flex-wrap gap-3">
          {receipt.status === 'IN_TRANSIT' && (
            <button
              onClick={handleArrive}
              disabled={!!actionLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-amber-500 disabled:opacity-50 transition-colors"
            >
              {actionLoading === 'arrive' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
              Xác nhận hàng đã về kho
            </button>
          )}
          {receipt.status === 'ARRIVED' && (
            user?.role === 'admin' ? (
              <div className="inline-flex items-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-4 py-2.5 text-sm font-semibold text-indigo-500">
                <Clock className="h-4 w-4" />
                Chờ nhân viên kiểm kho
              </div>
            ) : (
              <button
                onClick={handleInspect}
                disabled={!!actionLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-500 disabled:opacity-50 transition-colors"
              >
                {actionLoading === 'inspect' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
                Kiểm tra hàng hoá
              </button>
            )
          )}
          {['INSPECTING', 'PENDING_APPROVAL'].includes(receipt.status) && user?.role === 'admin' && (
            <button
              onClick={handleComplete}
              disabled={!!actionLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-emerald-500 disabled:opacity-50 transition-colors"
            >
              {actionLoading === 'complete' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Hoàn tất nhập kho
            </button>
          )}
          {receipt.status === 'PENDING_APPROVAL' && user?.role !== 'admin' && (
            <div className="inline-flex items-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-2.5 text-sm font-semibold text-orange-500">
              <Clock className="h-4 w-4" />
              Đang chờ Admin duyệt nhập kho
            </div>
          )}
          <button
            onClick={() => setShowCancel(true)}
            disabled={!!actionLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
          >
            <XCircle className="h-4 w-4" />
            Huỷ phiếu
          </button>
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
                <Hash className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div><span className="text-slate-500 dark:text-slate-400">Mã phiếu:</span> <span className="font-semibold text-slate-800 dark:text-slate-200">{receipt.receipt_code}</span></div>
              </div>
              <div className="flex items-start gap-3">
                <Building2 className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div><span className="text-slate-500 dark:text-slate-400">Nhà cung cấp:</span> <span className="font-semibold text-slate-800 dark:text-slate-200">{receipt.supplier?.name || '—'}</span></div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div><span className="text-slate-500 dark:text-slate-400">Ngày nhập:</span> <span className="font-semibold text-slate-800 dark:text-slate-200">{formatDate(receipt.import_date)}</span></div>
              </div>
              <div className="flex items-start gap-3">
                <DollarSign className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div><span className="text-slate-500 dark:text-slate-400">Tổng tiền:</span> <span className="font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(receipt.total_amount)}</span></div>
              </div>
              <div className="flex items-start gap-3">
                <User className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <div><span className="text-slate-500 dark:text-slate-400">Người tạo:</span> <span className="font-semibold text-slate-800 dark:text-slate-200">{receipt.creator?.full_name || '—'}</span></div>
              </div>
            </div>
          </div>

          {/* Shipping info */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Truck className="h-4 w-4 text-blue-400" />
              Vận chuyển
            </h2>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-slate-500 dark:text-slate-400">Dự kiến vận chuyển:</span>{' '}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {receipt.estimated_delivery_days ? `${receipt.estimated_delivery_days} ngày` : '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Dự kiến đến:</span>{' '}
                <span className="font-semibold text-slate-800 dark:text-slate-200">{formatDate(receipt.estimated_arrival_date)}</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Thực tế đến:</span>{' '}
                <span className="font-semibold text-slate-800 dark:text-slate-200">{formatDateTime(receipt.actual_arrival_at)}</span>
              </div>
              {receipt.transport_note && (
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3 text-xs text-slate-600 dark:text-slate-400">
                  {receipt.transport_note}
                </div>
              )}
            </div>
          </div>

          {/* Audit info */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Lịch sử xử lý</h2>
            <div className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
              <p>Tạo bởi <span className="font-semibold text-slate-700 dark:text-slate-300">{receipt.creator?.full_name}</span> lúc {formatDateTime(receipt.created_at)}</p>
              {receipt.inspector && (
                <p>Kiểm tra bởi <span className="font-semibold text-slate-700 dark:text-slate-300">{receipt.inspector.full_name}</span> lúc {formatDateTime(receipt.inspected_at)}</p>
              )}
              {receipt.completer && (
                <p>Hoàn tất bởi <span className="font-semibold text-slate-700 dark:text-slate-300">{receipt.completer.full_name}</span> lúc {formatDateTime(receipt.completed_at)}</p>
              )}
              {receipt.issue_notes && (
                <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-400">
                  <p className="font-semibold text-xs mb-1">Ghi chú vấn đề:</p>
                  <p>{receipt.issue_notes}</p>
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
                <Package className="h-4 w-4 text-indigo-400" />
                Chi tiết sản phẩm ({receipt.details?.length || 0} dòng)
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">#</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Sản phẩm</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">SL đặt</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">SL nhận</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Chấp nhận</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Đơn giá</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Thành tiền</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Lô / HSD</th>
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
                      <td className="px-4 py-3 text-center font-semibold text-slate-800 dark:text-slate-200">{d.quantity}</td>
                      <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-400">
                        {d.received_quantity ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {d.accepted_quantity != null ? (
                          <span className={`font-semibold ${d.accepted_quantity < d.quantity ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {d.accepted_quantity}
                          </span>
                        ) : '—'}
                        {d.rejected_quantity > 0 && (
                          <span className="text-xs text-red-400 ml-1">(lỗi: {d.rejected_quantity})</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">
                        {formatCurrency(d.unit_price)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800 dark:text-slate-200">
                        {formatCurrency((d.accepted_quantity ?? d.quantity) * Number(d.unit_price))}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-slate-500 dark:text-slate-400">{d.batch_code || makeAutoBatchCode(receipt.receipt_code, d.id)}</p>
                        {d.expiry_date && (
                          <p className="text-xs text-slate-400">HSD: {formatDate(d.expiry_date)}</p>
                        )}
                        {d.lot_location && (
                          <p className="text-xs text-indigo-400 flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3" />
                            {d.lot_location.location_code}
                          </p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50">
                    <td colSpan={6} className="px-4 py-3 text-right text-sm font-bold text-slate-600 dark:text-slate-300 uppercase">
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
        </div>
      </div>

      {/* ── INSPECT MODAL ───────────────────────────────────────── */}
      {showInspect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4" onClick={() => setShowInspect(false)}>
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700 bg-white dark:bg-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-indigo-400" />
                Kiểm tra hàng hoá
              </h2>
              <button onClick={() => setShowInspect(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            
            {/* Hiển thị thông báo lỗi bên trong Modal */}
            {error && (
              <div className="mx-6 mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="p-6 space-y-4">
              {inspectDetails.map((d, i) => {
                const rQty = parseInt(d.received_qty, 10) || 0;
                const aQty = parseInt(d.accepted_qty, 10) || 0;
                const isQtyInvalid = aQty > rQty;
                const isDateInvalid = d.mfg_date && d.expiry_date && new Date(d.mfg_date) >= new Date(d.expiry_date);
                const isSensitiveMissingDate = DATE_SENSITIVE_CATEGORIES.includes(d.product_category) && (!d.mfg_date || !d.expiry_date);

                return (
                  <div key={d.detail_id} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4 space-y-3">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {d.product_name} <span className="text-xs text-slate-400 font-normal">(Yêu cầu đặt: {d.expected})</span>
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">SL nhận</label>
                        <input
                          type="number" min="0"
                          value={d.received_qty}
                          onChange={(e) => {
                            const v = e.target.value;
                            setInspectDetails((prev) => prev.map((r, j) => {
                              if (j !== i) return r;
                              const currentRQty = parseInt(v, 10) || 0;
                              const currentAQty = parseInt(r.accepted_qty, 10) || 0;
                              const nextAcc = Math.min(currentAQty, currentRQty);
                              const rejQty = Math.max(0, currentRQty - nextAcc);
                              return { 
                                ...r, 
                                received_qty: v, 
                                accepted_qty: String(nextAcc), 
                                rejected_qty: String(rejQty) 
                              };
                            }));
                          }}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">SL chấp nhận</label>
                        <input
                          type="number" min="0"
                          value={d.accepted_qty}
                          onChange={(e) => {
                            const v = e.target.value;
                            setInspectDetails((prev) => prev.map((r, j) => {
                              if (j !== i) return r;
                              const currentRQty = parseInt(r.received_qty, 10) || 0;
                              const currentAQty = parseInt(v, 10) || 0;
                              const rejQty = Math.max(0, currentRQty - currentAQty);
                              return { 
                                ...r, 
                                accepted_qty: v, 
                                rejected_qty: String(rejQty) 
                              };
                            }));
                          }}
                          className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                            isQtyInvalid 
                              ? 'border-red-500 focus:ring-red-500 bg-red-50/50 dark:bg-red-950/20' 
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                          }`}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">SL lỗi (Tự động)</label>
                        <input
                          type="number"
                          value={d.rejected_qty}
                          readOnly
                          disabled
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-3 py-2 text-sm text-slate-400 dark:text-slate-500 cursor-not-allowed focus:outline-none"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                      <div>
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Mã lô</label>
                        <input
                          type="text"
                          value={d.batch_code}
                          onChange={(e) => {
                            const v = e.target.value;
                            setInspectDetails((prev) => prev.map((r, j) => j === i ? { ...r, batch_code: v } : r));
                          }}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-cyan-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">NSX</label>
                        <input
                          type="date"
                          value={d.mfg_date}
                          onChange={(e) => {
                            const v = e.target.value;
                            setInspectDetails((prev) => prev.map((r, j) => j === i ? { ...r, mfg_date: v } : r));
                          }}
                          className={`w-full rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800 ${
                            isDateInvalid || (isSensitiveMissingDate && !d.mfg_date)
                              ? 'border-red-500 focus:ring-red-500 dark:border-red-500/50' 
                              : 'border-slate-200 dark:border-slate-700'
                          }`}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">HSD</label>
                        <input
                          type="date"
                          value={d.expiry_date}
                          onChange={(e) => {
                            const v = e.target.value;
                            setInspectDetails((prev) => prev.map((r, j) => j === i ? { ...r, expiry_date: v } : r));
                          }}
                          className={`w-full rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800 ${
                            isDateInvalid || (isSensitiveMissingDate && !d.expiry_date)
                              ? 'border-red-500 focus:ring-red-500 dark:border-red-500/50' 
                              : 'border-slate-200 dark:border-slate-700'
                          }`}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Vị trí kệ</label>
                        <select
                          value={d.location_id}
                          onChange={(e) => {
                            const v = e.target.value;
                            setInspectDetails((prev) => prev.map((r, j) => j === i ? { ...r, location_id: v } : r));
                          }}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800"
                        >
                          <option value="">-- Chọn kệ --</option>
                          {(() => {
                            const sameZone = locations.filter((loc) => !d.product_category || loc.zone?.trim().toLowerCase() === d.product_category.trim().toLowerCase());
                            const list = sameZone.length ? sameZone : locations;
                            return list.map((loc) => (
                              <option key={loc.id} value={String(loc.id)}>
                                {loc.location_code} - Trống: {loc.available_capacity ?? Math.max(0, (loc.max_capacity || 0) - (loc.current_occupied || 0))}
                              </option>
                            ));
                          })()}
                        </select>
                      </div>
                    </div>

                    {/* Cảnh báo validate thời gian thực */}
                    {isQtyInvalid && (
                      <p className="text-xs text-red-500 dark:text-red-400 font-semibold flex items-center gap-1.5 mt-1">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Số lượng chấp nhận ({aQty}) không được lớn hơn số lượng nhận ({rQty}).
                      </p>
                    )}
                    {isDateInvalid && (
                      <p className="text-xs text-red-500 dark:text-red-400 font-semibold flex items-center gap-1.5 mt-1">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Hạn sử dụng (HSD) phải sau Ngày sản xuất (NSX).
                      </p>
                    )}
                    {isSensitiveMissingDate && (
                      <p className="text-xs text-amber-500 dark:text-amber-400 font-semibold flex items-center gap-1.5 mt-1">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Sản phẩm thuộc nhóm nhạy cảm ngày, vui lòng nhập đầy đủ NSX và HSD.
                      </p>
                    )}
                  </div>
                );
              })}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Ghi chú vấn đề</label>
                <textarea
                  rows={3}
                  value={inspectNotes}
                  onChange={(e) => setInspectNotes(e.target.value)}
                  placeholder="Mô tả vấn đề nếu có..."
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
              <div className="flex items-center gap-2.5 py-1">
                <input
                  type="checkbox"
                  id="sendEmailNotification"
                  checked={sendEmailNotification}
                  onChange={(e) => setSendEmailNotification(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="sendEmailNotification" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                  Gửi thông báo email cho Quản trị viên
                </label>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowInspect(false)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Huỷ
                </button>
                <button
                  onClick={submitInspect}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-500 transition-colors"
                >
                  <ClipboardCheck className="h-4 w-4" />
                  Lưu kết quả kiểm tra
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
                Huỷ phiếu nhập
              </h2>
              <button onClick={() => setShowCancel(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Bạn có chắc muốn huỷ phiếu <span className="font-semibold text-slate-800 dark:text-slate-200">{receipt.receipt_code}</span>?
              </p>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Lý do huỷ</label>
                <textarea
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Nhập lý do..."
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                />
              </div>
              <div className="flex justify-end gap-3">
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
                  <XCircle className="h-4 w-4" />
                  Xác nhận huỷ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      </div> {/* End print-content */}

    </div>
  );
}
