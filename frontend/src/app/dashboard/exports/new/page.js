'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDialogStore } from '@/store/useDialogStore';
import QRScannerModal from '@/components/QRScannerModal';
import dynamic from 'next/dynamic';

const SupplierMap = dynamic(() => import('@/components/SupplierMap'), { ssr: false });
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Clock,
  Plus,
  Save,
  Trash2,
  X,
  QrCode,
  MapPin,
  Loader2,
} from 'lucide-react';
import api from '@/lib/api';

const today = () => new Date().toISOString().split('T')[0];

const blankItem = () => ({
  _key: Math.random(),
  productId: '',
  productName: '',
  productCode: '',
  unit: '',
  quantity: '',
  sellingPrice: '',
  totalAmount: 0,
  importDetailId: '',
  lots: [],
  showLots: false,
});

const formatCurrency = (value) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(value || 0));

const daysUntil = (dateValue) => {
  if (!dateValue) return null;
  const end = new Date(dateValue);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Math.ceil((end - start) / 86400000);
};

export default function NewExportPage() {
  const router = useRouter();
  const { showAlert } = useDialogStore();
  const [products, setProducts] = useState([]);
  const [returnableProducts, setReturnableProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [expiryAlerts, setExpiryAlerts] = useState([]);
  const [receiptCode, setReceiptCode] = useState('');
  const [reason, setReason] = useState('SELL');
  const [exportDate, setExportDate] = useState(today());
  const [customerName, setCustomerName] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [note, setNote] = useState('');
  const [items, setItems] = useState([blankItem()]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isExpiryOpen, setIsExpiryOpen] = useState(false);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [distanceKm, setDistanceKm] = useState(null);
  const [estimatedDeliveryDays, setEstimatedDeliveryDays] = useState(null);
  const [geocoding, setGeocoding] = useState(false);

  const handleGeocodeAddress = async () => {
    if (!deliveryAddress || deliveryAddress.trim().length < 5) {
      showAlert('Lỗi', 'Vui lòng điền địa chỉ đầy đủ (ít nhất 5 ký tự) trước khi định vị.');
      return;
    }

    setGeocoding(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(deliveryAddress)}&limit=1`
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);

        setLatitude(Number(lat.toFixed(6)));
        setLongitude(Number(lon.toFixed(6)));

        try {
          const osrmRes = await fetch(
            `https://router.project-osrm.org/route/v1/driving/106.660172,10.762622;${lon},${lat}`
          );
          const osrmData = await osrmRes.json();
          if (osrmData.routes && osrmData.routes.length > 0) {
            const distance = Number((osrmData.routes[0].distance / 1000).toFixed(1));
            setDistanceKm(distance);
            const days = Math.floor(distance / 50) + (distance % 50 > 0 ? 1 : 0) - 1;
            setEstimatedDeliveryDays(Math.max(0, days));
          } else {
            setDistanceKm(0);
            setEstimatedDeliveryDays(0);
          }
        } catch (e) {
          setDistanceKm(0);
          setEstimatedDeliveryDays(0);
        }
      } else {
        showAlert('Lỗi', 'Không tìm thấy tọa độ địa lý cho địa chỉ này. Vui lòng ghim trực tiếp trên bản đồ.');
      }
    } catch (error) {
      console.error('Nominatim Geocoding error:', error);
      showAlert('Lỗi', 'Lỗi kết nối định vị. Vui lòng thử ghim trên bản đồ.');
    } finally {
      setGeocoding(false);
    }
  };


  useEffect(() => {
    const load = async () => {
      try {
        const [codeRes, productRes, supplierRes, alertRes] = await Promise.all([
          api.get('/inventory/next-export-code'),
          api.get('/products?limit=500'),
          api.get('/suppliers?limit=500'),
          api.get('/inventory/alerts'),
        ]);

        setReceiptCode(codeRes.data?.receipt_code || '');
        setProducts(Array.isArray(productRes.data) ? productRes.data : productRes.data?.data || []);
        setSuppliers(Array.isArray(supplierRes.data) ? supplierRes.data : supplierRes.data?.data || []);
        const alerts = alertRes.data?.expiring_soon || [];
        setExpiryAlerts(alerts.filter((lot) => Number(lot.available_lot_stock ?? lot.current_lot_stock ?? 0) > 0));
      } catch (err) {
        setError(err.response?.data?.error || err.response?.data?.message || 'Không thể tải dữ liệu tạo phiếu xuất.');
      }
    };

    load();
  }, []);

  useEffect(() => {
    const loadReturnableProducts = async () => {
      if (reason !== 'RETURN' || !supplierId) {
        setReturnableProducts([]);
        return;
      }

      try {
        const res = await api.get(`/inventory/returnable-products?supplier_id=${supplierId}`);
        setReturnableProducts(res.data?.products || []);
      } catch (err) {
        setReturnableProducts([]);
        setError(err.response?.data?.error || 'Không thể tải sản phẩm có thể trả nhà cung cấp.');
      }
    };

    loadReturnableProducts();
  }, [reason, supplierId]);

  const selectableProducts = reason === 'RETURN' ? returnableProducts : products;

  const resetItems = () => setItems([blankItem()]);

  const handleQrScanSuccess = async (scannedCode) => {
    setIsQrOpen(false);

    let extractedCode = scannedCode;
    try {
      const parsed = JSON.parse(scannedCode);
      if (parsed && parsed.product_code) {
        extractedCode = parsed.product_code;
      }
    } catch (e) {
      // Not JSON, use raw text
    }

    const searchCode = String(extractedCode).trim().toLowerCase();
    const product = selectableProducts.find((p) => String(p.product_code || '').trim().toLowerCase() === searchCode);

    if (!product) {
      if (reason === 'RETURN' && supplierId) {
        showAlert('Cảnh báo', `Sản phẩm quét được không thuộc NCC này.`);
      } else {
        const isJson = extractedCode !== scannedCode ? '(Đã bóc tách từ JSON)' : '(Mã quét thô)';
        showAlert('Lỗi', `Quét được mã: [${extractedCode}] ${isJson}. Nhưng mã này không có trong Hệ thống! (Chỉ chấp nhận các mã như BK001, BK002...)`);
      }
      return;
    }

    let lots = [];
    try {
      const lotRes = await api.get(`/inventory/lots/${product.id}`);
      lots = (lotRes.data?.lots || []).filter((lot) => {
        const available = Number(lot.available_lot_stock ?? lot.current_lot_stock ?? 0);
        if (available <= 0) return false;
        if (reason === 'RETURN') return String(lot.supplier_id) === String(supplierId);
        const remainingDays = daysUntil(lot.expiry_date);
        return lot.expiry_date == null || remainingDays >= Number(product.min_days_to_sell || 7);
      });
    } catch (err) {
      showAlert('Lỗi', 'Không thể tải danh sách lô hàng.');
      return;
    }

    const price = reason === 'RETURN' ? 0 : Number(product.unit_price || 0);
    const newItem = {
      _key: Math.random(),
      productId: String(product.id),
      productName: product.name,
      productCode: product.product_code,
      unit: product.unit || '',
      quantity: '1',
      sellingPrice: price ? String(price) : '',
      totalAmount: price,
      importDetailId: '',
      lots,
      showLots: true,
    };

    setItems((prev) => {
      if (prev.length === 1 && !prev[0].productId) {
        return [newItem];
      }
      return [...prev, newItem];
    });

    showAlert('Thành công', `Đã quét thêm sản phẩm: ${product.name}`);
  };

  const handleReasonChange = (value) => {
    setReason(value);
    if (value === 'RETURN') {
      const itemWithSupplier = items.find((item) => item.lots && item.lots.length > 0 && item.lots[0].supplier_id);
      if (itemWithSupplier) {
        const firstSupplierId = String(itemWithSupplier.lots[0].supplier_id);
        setSupplierId(firstSupplierId);

        setItems((prev) =>
          prev.map((item) => {
            if (item.lots && item.lots.length > 0 && String(item.lots[0].supplier_id) === firstSupplierId) {
              const lot = item.lots[0];
              const price = Number(lot.unit_price || 0);
              const qty = String(lot.available_lot_stock ?? lot.current_lot_stock ?? '');
              return {
                ...item,
                importDetailId: String(lot.lot_id),
                sellingPrice: String(price),
                quantity: qty,
                totalAmount: Number(qty) * price,
              };
            }
            return item;
          })
        );
      } else {
        setSupplierId('');
        setReturnableProducts([]);
      }
    } else {
      setSupplierId('');
      setReturnableProducts([]);
    }
  };

  const handleSupplierChange = (value) => {
    setSupplierId(value);
  };

  const selectedProductIds = items.map((item) => item.productId).filter(Boolean);

  const updateItem = (index, field, value) => {
    setItems((prev) => {
      const next = [...prev];
      const row = { ...next[index], [field]: value };

      if (field === 'quantity' || field === 'sellingPrice') {
        const quantity = parseInt(field === 'quantity' ? value : row.quantity, 10) || 0;
        const price = Number(field === 'sellingPrice' ? value : row.sellingPrice) || 0;
        row.totalAmount = quantity * price;
      }

      if (field === 'importDetailId') {
        const lot = row.lots.find((itemLot) => String(itemLot.lot_id) === String(value));
        if (lot && reason === 'RETURN') {
          const price = Number(lot.unit_price || 0);
          row.sellingPrice = String(price);
          row.quantity = String(lot.available_lot_stock ?? lot.current_lot_stock ?? '');
          row.totalAmount = Number(row.quantity || 0) * price;
        }
      }

      next[index] = row;
      return next;
    });
  };

  const setProduct = async (index, rawValue) => {
    const product = selectableProducts.find(
      (p) =>
        String(p.id) === String(rawValue) ||
        String(p.product_code || '').toLowerCase() === String(rawValue).toLowerCase() ||
        String(p.name || '').toLowerCase() === String(rawValue).toLowerCase()
    );

    if (!product) {
      setItems((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...blankItem(), _key: row._key, productId: rawValue } : row)));
      return;
    }

    let lots = [];
    try {
      const lotRes = await api.get(`/inventory/lots/${product.id}`);
      lots = (lotRes.data?.lots || []).filter((lot) => {
        const available = Number(lot.available_lot_stock ?? lot.current_lot_stock ?? 0);
        if (available <= 0) return false;
        if (reason === 'RETURN') return String(lot.supplier_id) === String(supplierId);
        const remainingDays = daysUntil(lot.expiry_date);
        return lot.expiry_date == null || remainingDays >= Number(product.min_days_to_sell || 7);
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể tải danh sách lô hàng.');
    }

    const price = reason === 'RETURN' ? 0 : Number(product.unit_price || 0);
    setItems((prev) =>
      prev.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              productId: product.id,
              productName: product.name,
              productCode: product.product_code,
              unit: product.unit || '',
              sellingPrice: price ? String(Math.round(price)) : '',
              totalAmount: (parseInt(row.quantity, 10) || 0) * price,
              importDetailId: '',
              lots,
              showLots: true,
            }
          : row
      )
    );
  };

  const addRow = () => setItems((prev) => [...prev, blankItem()]);
  const removeRow = (key) => setItems((prev) => (prev.length === 1 ? prev : prev.filter((row) => row._key !== key)));

  const handleQuickExport = (lot) => {
    const product = products.find((p) => Number(p.id) === Number(lot.product_id));
    const available = Number(lot.available_lot_stock ?? lot.current_lot_stock ?? 0);
    const price = Number(product?.unit_price || 0);
    const quickItem = {
      _key: Math.random(),
      productId: lot.product_id,
      productName: lot.product_name,
      productCode: lot.product_code,
      unit: lot.unit || product?.unit || '',
      quantity: String(available),
      sellingPrice: price ? String(Math.round(price)) : '',
      totalAmount: available * price,
      importDetailId: '',
      lots: [lot],
      showLots: true,
    };

    setItems((prev) => (prev.length === 1 && !prev[0].productId ? [quickItem] : [...prev, quickItem]));
    setIsExpiryOpen(false);
  };

  const handleQuickReturn = (lot) => {
    const product = products.find((p) => Number(p.id) === Number(lot.product_id));
    const available = Number(lot.available_lot_stock ?? lot.current_lot_stock ?? 0);
    const price = Number(lot.unit_price || product?.unit_price || 0);

    setReason('RETURN');
    setSupplierId(String(lot.supplier_id));

    const quickItem = {
      _key: Math.random(),
      productId: String(lot.product_id),
      productName: lot.product_name,
      productCode: lot.product_code,
      unit: lot.unit || product?.unit || '',
      quantity: String(available),
      sellingPrice: price ? String(Math.round(price)) : '',
      totalAmount: available * price,
      importDetailId: String(lot.lot_id),
      lots: [lot],
      showLots: true,
    };

    setItems((prev) => (prev.length === 1 && !prev[0].productId ? [quickItem] : [...prev, quickItem]));
    setIsExpiryOpen(false);
  };

  const productStockMap = useMemo(() => {
    return products.reduce((acc, product) => {
      acc[product.id] = Number(product.current_stock || 0);
      return acc;
    }, {});
  }, [products]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (reason === 'RETURN' && !supplierId) {
      setError('Vui lòng chọn nhà cung cấp để trả hàng.');
      return;
    }

    if (reason === 'SELL' && !customerName.trim()) {
      setError('Vui lòng nhập người nhận hoặc khách hàng.');
      return;
    }

    const validItems = items.filter((item) => item.productId && parseInt(item.quantity, 10) > 0);
    if (validItems.length === 0) {
      setError('Phiếu xuất phải có ít nhất một sản phẩm hợp lệ.');
      return;
    }

    for (const [index, item] of validItems.entries()) {
      const quantity = parseInt(item.quantity, 10) || 0;
      if (reason === 'RETURN') {
        if (!item.importDetailId) {
          setError(`Vui lòng chọn lô hàng cụ thể để trả ở dòng ${index + 1}.`);
          return;
        }
        const lot = item.lots.find((itemLot) => String(itemLot.lot_id) === String(item.importDetailId));
        const available = Number(lot?.available_lot_stock ?? lot?.current_lot_stock ?? 0);
        if (!lot || quantity > available) {
          setError(`Số lượng trả ở dòng ${index + 1} vượt quá tồn khả dụng của lô.`);
          return;
        }
      } else {
        const requestedForProduct = validItems
          .filter((row) => String(row.productId) === String(item.productId))
          .reduce((sum, row) => sum + (parseInt(row.quantity, 10) || 0), 0);
        const available = item.lots.length
          ? item.lots.reduce((sum, lot) => sum + Number(lot.available_lot_stock ?? lot.current_lot_stock ?? 0), 0)
          : productStockMap[item.productId] || 0;

        if (requestedForProduct > available) {
          setError(`Không thể xuất "${item.productName}" vượt quá tồn khả dụng. Yêu cầu ${requestedForProduct}, khả dụng ${available}.`);
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const res = await api.post('/exports', {
        reason,
        export_date: exportDate,
        customer_name: reason === 'SELL' ? customerName : null,
        delivery_address: reason === 'SELL' ? deliveryAddress : null,
        latitude: reason === 'SELL' ? latitude : null,
        longitude: reason === 'SELL' ? longitude : null,
        distance_km: reason === 'SELL' ? distanceKm : null,
        estimated_delivery_days: reason === 'SELL' ? estimatedDeliveryDays : null,
        supplier_id: reason === 'RETURN' ? parseInt(supplierId, 10) : null,
        note,
        items: validItems.map((item) => ({
          product_id: parseInt(item.productId, 10),
          quantity: parseInt(item.quantity, 10),
          selling_price: Number(item.sellingPrice) || 0,
          import_detail_id: item.importDetailId ? parseInt(item.importDetailId, 10) : undefined,
        })),
      });

      showAlert('Thành công', 'Đã tạo phiếu xuất thành công!');
      router.push(`/dashboard/exports/${res.data.id}`);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Lỗi khi tạo phiếu xuất.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {expiryAlerts.length > 0 && reason === 'SELL' && (
        <button
          type="button"
          onClick={() => setIsExpiryOpen(true)}
          className="flex w-full items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left shadow-sm transition hover:bg-amber-100 animate-pulse dark:border-amber-900 dark:bg-amber-950/30"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-amber-100 p-2 text-amber-600 dark:bg-amber-900/70 dark:text-amber-200">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-800 dark:text-amber-200">Có {expiryAlerts.length} lô hàng cần xử lý theo hạn sử dụng</p>
              <p className="text-xs font-medium text-amber-600 dark:text-amber-300">Nhấn để xem chi tiết và thêm nhanh vào phiếu xuất bán.</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-amber-500" />
        </button>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-50">Tạo phiếu xuất kho</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Nhập thông tin phiếu và danh sách sản phẩm cần xuất bán (FEFO tự động) hoặc trả nhà cung cấp (chọn lô trực tiếp).
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-medium text-red-600 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="grid grid-cols-1 gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-2">
          <label className="space-y-1">
            <span className="ml-1 text-xs font-bold uppercase text-slate-500">Lý do xuất</span>
            <select
              value={reason}
              onChange={(event) => handleReasonChange(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="SELL">Bán hàng (SELL)</option>
              <option value="RETURN">Trả hàng nhà cung cấp (RETURN)</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="ml-1 text-xs font-bold uppercase text-slate-500">Mã phiếu xuất</span>
            <input
              readOnly
              value={receiptCode}
              placeholder="Đang tải mã phiếu xuất..."
              className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold text-slate-600 shadow-inner outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            />
          </label>

          <label className="space-y-1">
            <span className="ml-1 text-xs font-bold uppercase text-slate-500">Ngày xuất</span>
            <input
              type="date"
              required
              value={exportDate}
              onChange={(event) => setExportDate(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>

          {reason === 'RETURN' ? (
            <label className="space-y-1">
              <span className="ml-1 text-xs font-bold uppercase text-slate-500">Nhà cung cấp nhận hàng trả</span>
              <select
                required
                value={supplierId}
                onChange={(event) => handleSupplierChange(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="">-- Chọn nhà cung cấp --</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name} ({supplier.contact_person || 'N/A'})
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="space-y-1">
              <span className="ml-1 text-xs font-bold uppercase text-slate-500">Người nhận / Khách hàng</span>
              <input
                required
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Nhập tên khách hàng hoặc người nhận..."
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
          )}

          {reason === 'SELL' && (
            <div className="space-y-1">
              <span className="ml-1 text-xs font-bold uppercase text-slate-500">Địa chỉ giao hàng</span>
              <div className="flex gap-2">
                <input
                  value={deliveryAddress}
                  onChange={(event) => setDeliveryAddress(event.target.value)}
                  placeholder="Nhập địa chỉ giao hàng..."
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 dark:border-slate-700 dark:bg-slate-950"
                />
                <button
                  type="button"
                  onClick={handleGeocodeAddress}
                  disabled={geocoding}
                  className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-white border border-slate-200 dark:border-slate-700 disabled:opacity-50 transition-colors"
                >
                  {geocoding ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <MapPin className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
                  )}
                  Định vị
                </button>
              </div>
            </div>
          )}

          <label className={`space-y-1 ${reason === 'SELL' ? '' : 'md:col-span-2'}`}>
            <span className="ml-1 text-xs font-bold uppercase text-slate-500">Ghi chú phiếu xuất</span>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Nhập ghi chú phiếu xuất..."
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
        </section>

        {reason === 'SELL' && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <MapPin className="h-5 w-5 text-indigo-500" />
                Vị trí giao hàng & Tuyến đường dự kiến (OSRM)
              </h2>
              {distanceKm !== null && (
                <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 px-3 py-1.5 rounded-lg dark:bg-emerald-950/30">
                  Cự ly: {distanceKm} km — Dự kiến: {estimatedDeliveryDays === 0 ? 'Trong ngày' : `${estimatedDeliveryDays} ngày`}
                </div>
              )}
            </div>
            <div className="h-[400px] w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 relative z-0">
              <SupplierMap
                mode="select"
                selectedLat={latitude || 10.762622}
                selectedLng={longitude || 106.660172}
                onPositionSelected={(lat, lng, distance) => {
                  setLatitude(lat);
                  setLongitude(lng);
                  setDistanceKm(distance);
                  // Calculate ETA: 1 day per 50km
                  const days = Math.floor(distance / 50) + (distance % 50 > 0 ? 1 : 0) - 1;
                  setEstimatedDeliveryDays(Math.max(0, days));
                }}
              />
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {reason === 'SELL' ? 'Chi tiết sản phẩm xuất bán' : 'Chi tiết sản phẩm trả NCC'}
            </h2>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setIsQrOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-600 flex-1 sm:flex-initial"
              >
                <QrCode className="h-4 w-4" />
                Quét mã QR
              </button>
              <button
                type="button"
                onClick={addRow}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-cyan-600 flex-1 sm:flex-initial"
              >
                <Plus className="h-4 w-4" />
                Thêm sản phẩm
              </button>
            </div>
          </div>

          <div className="space-y-5">
            {items.map((item, index) => {
              const product = selectableProducts.find((p) => String(p.id) === String(item.productId));
              const isDuplicated = item.productId && selectedProductIds.filter((id) => String(id) === String(item.productId)).length > 1;
              const availableStock = item.lots.reduce((sum, lot) => sum + Number(lot.available_lot_stock ?? lot.current_lot_stock ?? 0), 0);
              const requestedForProduct = items
                .filter((row) => String(row.productId) === String(item.productId))
                .reduce((sum, row) => sum + (parseInt(row.quantity, 10) || 0), 0);
              const stockWarning = item.productId && reason !== 'RETURN' && requestedForProduct > availableStock;
              const supplierLots = reason === 'RETURN'
                ? item.lots.filter((lot) => String(lot.supplier_id) === String(supplierId))
                : item.lots;

              return (
                <div
                  key={item._key}
                  className={`rounded-2xl border p-5 transition ${
                    isDuplicated || stockWarning
                      ? 'border-red-300 bg-red-50/30 dark:border-red-800 dark:bg-red-950/20'
                      : 'border-slate-200 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-800/50'
                  }`}
                >
                  <div className="grid grid-cols-12 items-end gap-4">
                    <div className="col-span-12 sm:col-span-4 md:col-span-2">
                      <label className="space-y-1 block">
                        <span className="ml-1 text-[10px] font-bold uppercase text-slate-500">ID sản phẩm</span>
                        <input
                          list={`export-product-list-${index}`}
                          required
                          disabled={reason === 'RETURN' && !supplierId}
                          value={item.productId}
                          onChange={(event) => setProduct(index, event.target.value)}
                          placeholder={reason === 'RETURN' && !supplierId ? 'Chọn NCC trước...' : 'Nhập ID...'}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-800"
                        />
                        <datalist id={`export-product-list-${index}`}>
                          {selectableProducts.map((productItem) => (
                            <option key={productItem.id} value={productItem.id}>
                              {productItem.id} - {productItem.name} (Tồn: {productItem.current_stock || 0})
                            </option>
                          ))}
                        </datalist>
                      </label>
                    </div>

                    <div className="col-span-12 sm:col-span-8 md:col-span-4">
                      <label className="space-y-1 block">
                        <span className="ml-1 text-[10px] font-bold uppercase text-slate-500">Tên sản phẩm</span>
                        <input
                          readOnly
                          value={item.productName}
                          placeholder="Tên sản phẩm"
                          className="w-full cursor-not-allowed rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 font-semibold text-slate-500 outline-none dark:border-slate-700 dark:bg-slate-800"
                        />
                      </label>
                    </div>

                    {reason === 'RETURN' && (
                      <div className="col-span-8 sm:col-span-8 md:col-span-4">
                        <label className="space-y-1 block">
                          <span className="ml-1 text-[10px] font-bold uppercase text-slate-500">Chọn lô hàng trả</span>
                          <select
                            required
                            disabled={!supplierId || !item.productId}
                            value={item.importDetailId}
                            onChange={(event) => updateItem(index, 'importDetailId', event.target.value)}
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-800"
                          >
                            <option value="">-- Chọn lô hàng --</option>
                            {supplierLots.map((lot) => (
                              <option key={lot.lot_id} value={lot.lot_id}>
                                {lot.batch_code || 'Không mã'} - HSD {lot.expiry_date ? new Date(lot.expiry_date).toLocaleDateString('vi-VN') : 'Không hạn'} - Khả dụng {lot.available_lot_stock ?? lot.current_lot_stock}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    )}

                    <div className={reason === 'RETURN' ? 'col-span-4 sm:col-span-4 md:col-span-2' : 'col-span-4 sm:col-span-4 md:col-span-2'}>
                      <label className="space-y-1 block">
                        <span className="ml-1 text-[10px] font-bold uppercase text-slate-500">Số lượng xuất</span>
                        <input
                          type="number"
                          min="1"
                          required
                          max={reason === 'RETURN' && item.importDetailId ? Number(supplierLots.find((lot) => String(lot.lot_id) === String(item.importDetailId))?.available_lot_stock || '') : undefined}
                          value={item.quantity}
                          onChange={(event) => updateItem(index, 'quantity', event.target.value)}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950"
                        />
                      </label>
                    </div>

                    {reason === 'SELL' && (
                      <>
                        <div className="col-span-4 sm:col-span-4 md:col-span-2">
                          <label className="space-y-1 block">
                            <span className="ml-1 text-[10px] font-bold uppercase text-slate-500">Đơn giá xuất</span>
                            <input
                              type="number"
                              min="0"
                              step="1000"
                              required
                              value={item.sellingPrice}
                              onChange={(event) => updateItem(index, 'sellingPrice', event.target.value)}
                              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950"
                            />
                          </label>
                        </div>
                        <div className="col-span-4 sm:col-span-4 md:col-span-2">
                          <label className="space-y-1 block">
                            <span className="ml-1 text-[10px] font-bold uppercase text-slate-400">Thành tiền</span>
                            <input
                              readOnly
                              value={formatCurrency(item.totalAmount)}
                              className="w-full cursor-not-allowed rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 font-bold text-slate-600 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            />
                          </label>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="mt-3 space-y-2 text-xs font-medium">
                    {isDuplicated && <p className="text-amber-600">Cảnh báo: trùng lặp sản phẩm xuất trên nhiều dòng.</p>}
                    {stockWarning && <p className="text-red-500">Không đủ tồn khả dụng. Yêu cầu {requestedForProduct}, khả dụng {availableStock}.</p>}
                    {reason === 'RETURN' && !supplierId && <p className="text-amber-600">Vui lòng chọn nhà cung cấp trước khi chọn sản phẩm trả.</p>}
                    {reason === 'RETURN' && supplierId && item.productId && supplierLots.length === 0 && (
                      <p className="text-red-500">Sản phẩm này không có lô hàng nào thuộc nhà cung cấp đã chọn.</p>
                    )}
                    {product && (
                      <p className="text-slate-500 dark:text-slate-400">
                        Danh mục: <span className="font-semibold text-slate-700 dark:text-slate-200">{product.category}</span> | Tồn khả dụng: <span className="font-bold text-cyan-600">{availableStock}</span> {item.unit}
                      </p>
                    )}

                    {reason === 'SELL' && item.lots.length > 0 && (
                      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                        <button
                          type="button"
                          onClick={() => setItems((prev) => prev.map((row) => (row._key === item._key ? { ...row, showLots: !row.showLots } : row)))}
                          className="flex w-full items-center justify-between bg-slate-100 px-4 py-2 text-xs font-bold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-200"
                        >
                          <span className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5" />
                            Chi tiết các lô theo FEFO
                          </span>
                          {item.showLots ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                        {item.showLots && (
                          <div className="overflow-x-auto bg-white dark:bg-slate-900">
                            <table className="w-full text-left text-[11px]">
                              <thead>
                                <tr>
                                  <th className="px-3 py-2">Mã lô</th>
                                  <th className="px-3 py-2">Hạn sử dụng</th>
                                  <th className="px-3 py-2">Còn lại</th>
                                  <th className="px-3 py-2 text-right">Tồn khả dụng</th>
                                  <th className="px-3 py-2 text-right text-cyan-600">Đề xuất lấy</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {(() => {
                                  let remaining = parseInt(item.quantity, 10) || 0;
                                  return item.lots.map((lot) => {
                                    const available = Number(lot.available_lot_stock ?? lot.current_lot_stock ?? 0);
                                    const pick = Math.min(remaining, available);
                                    remaining -= pick;
                                    const days = daysUntil(lot.expiry_date);
                                    const isExpiring = days !== null && days <= Number(product?.expiry_warning_days || 30);

                                    return (
                                      <tr key={lot.lot_id} className={pick > 0 ? 'bg-cyan-50/50 dark:bg-cyan-950/20' : ''}>
                                        <td className="px-3 py-2 font-semibold">{lot.batch_code || 'N/A'}</td>
                                        <td className={`px-3 py-2 ${isExpiring ? 'font-bold text-amber-600' : ''}`}>{lot.expiry_date ? new Date(lot.expiry_date).toLocaleDateString('vi-VN') : 'Không hạn'}</td>
                                        <td className="px-3 py-2">{days !== null ? `${days} ngày` : '-'}</td>
                                        <td className="px-3 py-2 text-right">{available}</td>
                                        <td className="px-3 py-2 text-right font-bold text-cyan-600">{pick > 0 ? pick : '-'}</td>
                                      </tr>
                                    );
                                  });
                                })()}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeRow(item._key)}
                      disabled={items.length === 1}
                      className="inline-flex items-center gap-1 rounded-xl border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:border-red-900 dark:bg-red-950/30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Xóa dòng
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-6 py-3 font-semibold text-white shadow-md shadow-indigo-100 transition-all hover:bg-indigo-600 active:scale-95 disabled:opacity-60 dark:shadow-none"
            >
              <Save className="h-4 w-4" />
              {submitting ? 'Đang lưu...' : reason === 'RETURN' ? 'Tạo đề xuất trả NCC' : 'Lưu phiếu xuất'}
            </button>
          </div>
        </section>
      </form>

      {isExpiryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={() => setIsExpiryOpen(false)}>
          <div className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-amber-100 bg-amber-50 px-6 py-4 dark:border-amber-900 dark:bg-amber-950/30">
              <h3 className="flex items-center gap-2 text-lg font-bold text-amber-700 dark:text-amber-200">
                <AlertTriangle className="h-5 w-5" />
                Danh sách lô hàng sắp hết hạn
              </h3>
              <button type="button" onClick={() => setIsExpiryOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-white/60 dark:hover:bg-slate-800">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-6">
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th className="px-4 py-3">Sản phẩm</th>
                      <th className="px-4 py-3">Mã lô</th>
                      <th className="px-4 py-3">Hạn sử dụng</th>
                      <th className="px-4 py-3">Còn lại</th>
                      <th className="px-4 py-3 text-right">Tồn khả dụng</th>
                      <th className="px-4 py-3 text-center">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {expiryAlerts.map((lot) => (
                      <tr key={lot.lot_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-800 dark:text-slate-100">{lot.product_name}</p>
                          <p className="text-xs text-slate-400">{lot.product_code}</p>
                          {lot.supplier_id && (
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              NCC: <span className="font-semibold">{suppliers.find((s) => Number(s.id) === Number(lot.supplier_id))?.name || `ID ${lot.supplier_id}`}</span>
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium">{lot.batch_code || 'N/A'}</td>
                        <td className="px-4 py-3 font-bold text-red-500">{lot.expiry_date ? new Date(lot.expiry_date).toLocaleDateString('vi-VN') : '-'}</td>
                        <td className="px-4 py-3 font-bold text-red-600">{lot.days_until_expiry} ngày</td>
                        <td className="px-4 py-3 text-right font-bold">{lot.available_lot_stock ?? lot.current_lot_stock} {lot.unit}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleQuickExport(lot)}
                              className="inline-flex items-center gap-1 rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm shadow-cyan-500/20 hover:bg-cyan-600 transition"
                            >
                              Xuất bán ngay
                              <ArrowRight className="h-3 w-3" />
                            </button>
                            {lot.supplier_id && (
                              <button
                                type="button"
                                onClick={() => handleQuickReturn(lot)}
                                className="inline-flex items-center gap-1 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm shadow-orange-500/20 hover:bg-orange-600 transition"
                              >
                                Trả NCC ngay
                                <ArrowRight className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
      {isQrOpen && (
        <QRScannerModal isOpen={isQrOpen} onClose={() => setIsQrOpen(false)} onScanSuccess={handleQrScanSuccess} />
      )}
    </div>
  );
}
