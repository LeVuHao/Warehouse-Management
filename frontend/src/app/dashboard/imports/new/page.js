'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDialogStore } from '@/store/useDialogStore';
import QRScannerModal from '@/components/QRScannerModal';
import {
  Building2,
  Plus,
  Save,
  Scale,
  Trash2,
  Truck,
  X,
  AlertCircle,
  QrCode,
} from 'lucide-react';
import api from '@/lib/api';
import { createImportAction } from '../create/actions';

const today = () => new Date().toISOString().split('T')[0];

const blankItem = () => ({
  _key: Math.random(),
  productId: '',
  productName: '',
  quantity: '',
  price: '',
  totalAmount: 0,
  isNewProduct: true,
  category: '',
});

const formatCurrency = (value) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(value || 0));

const calculateDeliveryDays = (distance) => {
  if (distance === null || distance === undefined || distance === '') return 2;
  const km = Number(distance);
  if (km <= 20) return 1;
  if (km <= 100) return 2;
  if (km <= 300) return 3;
  return 5;
};

const getArrivalDate = (dateValue, days) => {
  if (!dateValue) return '';
  const next = new Date(dateValue);
  next.setDate(next.getDate() + Number(days || 0));
  return next.toISOString().split('T')[0];
};

export default function NewImportPage() {
  const router = useRouter();
  const { showAlert } = useDialogStore();
  const [allProducts, setAllProducts] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [receiptCode, setReceiptCode] = useState('');
  const [importDate, setImportDate] = useState(today());
  const [supplierId, setSupplierId] = useState('');
  const [note, setNote] = useState('');
  const [items, setItems] = useState([blankItem()]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [isQrOpen, setIsQrOpen] = useState(false);

  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [compareProductId, setCompareProductId] = useState('');
  const [compareData, setCompareData] = useState([]);
  const [isComparing, setIsComparing] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [codeRes, productRes, supplierRes, locationRes] = await Promise.all([
          api.get('/inventory/next-import-code'),
          api.get('/products?limit=500'),
          api.get('/suppliers?limit=500'),
          api.get('/locations'),
        ]);

        setReceiptCode(codeRes.data?.receipt_code || '');
        const products = Array.isArray(productRes.data) ? productRes.data : productRes.data?.data || [];
        setAllProducts(products);
        setProductOptions(products);
        setSuppliers(Array.isArray(supplierRes.data) ? supplierRes.data : supplierRes.data?.data || []);
        setLocations(Array.isArray(locationRes.data) ? locationRes.data : locationRes.data?.data || []);
      } catch (err) {
        setError(err.response?.data?.error || err.response?.data?.message || 'Không thể tải dữ liệu tạo phiếu nhập.');
      }
    };

    load();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('draft') !== 'replenishment' || allProducts.length === 0) return;

    try {
      const rawDraft = localStorage.getItem('replenishmentDraft');
      if (!rawDraft) return;

      const draft = JSON.parse(rawDraft);
      const nextSupplierId = String(draft.supplierId || '');
      setSupplierId(nextSupplierId);
      setNote(draft.note || '');

      const filtered = nextSupplierId
        ? allProducts.filter((p) => (p.supplier_ids || []).includes(Number(nextSupplierId)))
        : allProducts;
      setProductOptions(filtered.length ? filtered : allProducts);

      const draftItems = (draft.items || []).map((draftItem) => {
        const product = allProducts.find((p) => String(p.id) === String(draftItem.productId || draftItem.product_id));
        const supplierPrice = (product?.supplier_prices || []).find((sp) => Number(sp.supplier_id) === Number(nextSupplierId));
        const quantity = draftItem.quantity ? String(draftItem.quantity) : '';
        const price = Number(draftItem.price ?? draftItem.unit_price ?? supplierPrice?.contract_price ?? product?.unit_price ?? 0);

        return {
          _key: Math.random(),
          productId: product?.id || draftItem.productId || draftItem.product_id || '',
          productName: product?.name || draftItem.productName || draftItem.product_name || '',
          quantity,
          price: price ? String(price) : '',
          totalAmount: (Number(quantity) || 0) * price,
          isNewProduct: !product,
          category: product?.category || draftItem.category || '',
        };
      });

      if (draftItems.length) setItems(draftItems);
      localStorage.removeItem('replenishmentDraft');
    } catch (err) {
      console.error('Failed to read replenishment draft:', err);
    }
  }, [allProducts]);

  const selectedSupplier = suppliers.find((s) => String(s.id) === String(supplierId));
  const deliveryDays = calculateDeliveryDays(selectedSupplier?.distance_km);
  const estimatedArrival = getArrivalDate(importDate, deliveryDays);

  const selectedProductIds = items.map((item) => item.productId).filter(Boolean);

  const zoneFreeCapacity = useMemo(() => {
    return locations.reduce((acc, loc) => {
      const free = Number(loc.max_capacity || 0) - Number(loc.current_occupied || 0);
      acc[loc.zone] = (acc[loc.zone] || 0) + Math.max(0, free);
      return acc;
    }, {});
  }, [locations]);

  const formTotalByCategory = (category) =>
    items.reduce((sum, item) => {
      if (item.category !== category) return sum;
      return sum + (parseInt(item.quantity, 10) || 0);
    }, 0);

  const resetItems = () => setItems([blankItem()]);

  const handleQrScanSuccess = (scannedCode) => {
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
    const product = allProducts.find((p) => String(p.product_code).trim().toLowerCase() === searchCode);
    if (!product) {
      const isJson = extractedCode !== scannedCode ? '(Đã bóc tách từ JSON)' : '(Mã quét thô)';
      showAlert('Lỗi', `Quét được mã: [${extractedCode}] ${isJson}. Nhưng mã này không có trong Hệ thống! (Chỉ chấp nhận các mã như BK001, BK002...)`);
      return;
    }

    if (supplierId && productOptions.length > 0) {
      const isValidSupplier = productOptions.some(p => p.id === product.id);
      if (!isValidSupplier) {
        showAlert('Cảnh báo', `Sản phẩm ${product.name} không thuộc nhà cung cấp đã chọn.`);
        return;
      }
    }

    const newItem = {
      _key: Math.random(),
      productId: product.id,
      productName: product.name,
      quantity: '1',
      price: product.unit_price ? String(product.unit_price) : '',
      totalAmount: product.unit_price ? product.unit_price : 0,
      isNewProduct: false,
      category: product.category || '',
    };

    setItems((prev) => {
      if (prev.length === 1 && !prev[0].productId) {
        return [newItem];
      }
      return [...prev, newItem];
    });
    
    showAlert('Thành công', `Đã quét sản phẩm: ${product.name}`);
  };

  const handleSupplierChange = (value) => {
    setSupplierId(value);
    const nextSupplierId = Number(value);
    const filtered = value
      ? allProducts.filter((p) => (p.supplier_ids || []).includes(nextSupplierId))
      : allProducts;
    setProductOptions(filtered);
  };

  const updateItem = (index, field, value) => {
    setItems((prev) => {
      const next = [...prev];
      const row = { ...next[index], [field]: value };

      if (field === 'productId') {
        const product = productOptions.find(
          (p) =>
            String(p.id) === String(value) ||
            String(p.product_code || '').toLowerCase() === String(value).toLowerCase() ||
            String(p.name || '').toLowerCase() === String(value).toLowerCase()
        );

        if (product) {
          const supplierPrice = (product.supplier_prices || []).find((sp) => Number(sp.supplier_id) === Number(supplierId));
          const price = Number(supplierPrice?.contract_price ?? product.unit_price ?? 0);
          row.productId = product.id;
          row.productName = product.name;
          row.category = product.category || '';
          row.price = price ? String(price) : '';
          row.isNewProduct = false;
          row.totalAmount = (parseInt(row.quantity, 10) || 0) * price;
        } else {
          row.productName = '';
          row.category = '';
          row.price = '';
          row.totalAmount = 0;
          row.isNewProduct = true;
        }
      }

      if (field === 'quantity') {
        row.totalAmount = (parseInt(value, 10) || 0) * (Number(row.price) || 0);
      }

      next[index] = row;
      return next;
    });
  };

  const addRow = () => setItems((prev) => [...prev, blankItem()]);
  const removeRow = (key) => setItems((prev) => (prev.length === 1 ? prev : prev.filter((row) => row._key !== key)));

  const openCompare = () => {
    setCompareProductId('');
    setCompareData([]);
    setIsCompareOpen(true);
  };

  const fetchCompare = async (productId) => {
    setCompareProductId(productId);
    setCompareData([]);
    if (!productId) return;

    setIsComparing(true);
    try {
      const res = await api.get(`/products/${productId}/suppliers`);
      setCompareData(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể tải dữ liệu so sánh nhà cung cấp.');
    } finally {
      setIsComparing(false);
    }
  };

  const chooseCompareSupplier = (nextSupplierId) => {
    handleSupplierChange(String(nextSupplierId));
    setIsCompareOpen(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!supplierId) {
      setError('Vui lòng chọn nhà cung cấp.');
      return;
    }

    const validItems = items.filter((item) => item.productId && parseInt(item.quantity, 10) > 0);
    if (validItems.length === 0) {
      setError('Phiếu nhập phải có ít nhất một sản phẩm hợp lệ.');
      return;
    }

    // Check if any product does not exist in the system
    const nonExistentItems = validItems.filter((item) => {
      const productObj = allProducts.find((p) => String(p.id) === String(item.productId));
      return !productObj;
    });

    if (nonExistentItems.length > 0) {
      const ids = nonExistentItems.map((item) => `"${item.productId}"`).join(', ');
      setError(`ID/Mã sản phẩm không tồn tại trong hệ thống: ${ids}. Vui lòng chọn sản phẩm hợp lệ.`);
      return;
    }

    // Check if any product does not belong to the selected supplier
    const invalidSupplierItems = validItems.filter((item) => {
      const productObj = allProducts.find((p) => String(p.id) === String(item.productId));
      return productObj && !(productObj.supplier_ids || []).includes(Number(supplierId));
    });

    if (invalidSupplierItems.length > 0) {
      const names = invalidSupplierItems.map((item) => `"${item.productName}"`).join(', ');
      setError(`Có sản phẩm không thuộc nhà cung cấp đã chọn: ${names}. Vui lòng kiểm tra lại.`);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        supplier_id: parseInt(supplierId, 10),
        import_date: importDate,
        note: note || undefined,
        estimated_delivery_days: deliveryDays,
        details: validItems.map((item) => ({
          product_id: parseInt(item.productId, 10),
          quantity: parseInt(item.quantity, 10),
          unit_price: Number(item.price) || 0,
        })),
      };

      const res = await api.post('/imports', payload);
      showAlert('Thành công', 'Đã tạo phiếu nhập thành công!');
      router.push(`/dashboard/imports/${res.data.id}`);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Lỗi khi tạo phiếu nhập.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-50">Tạo phiếu nhập kho</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Nhập thông tin phiếu và danh sách sản phẩm cần nhập vào các phân khu kệ hàng phù hợp
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
            <span className="ml-1 text-xs font-bold uppercase text-slate-500">Mã phiếu nhập</span>
            <input
              readOnly
              value={receiptCode}
              placeholder="Đang tải mã phiếu..."
              className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold text-slate-600 shadow-inner outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            />
          </label>

          <label className="space-y-1">
            <span className="ml-1 text-xs font-bold uppercase text-slate-500">Ngày nhập</span>
            <input
              type="date"
              required
              value={importDate}
              onChange={(event) => setImportDate(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>

          <div className="space-y-1">
            <div className="ml-1 flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-slate-500">Nhà cung cấp</span>
              <button type="button" onClick={openCompare} className="flex items-center gap-1 text-xs font-semibold text-cyan-600 hover:text-cyan-700">
                <Scale className="h-3.5 w-3.5" />
                So sánh NCC
              </button>
            </div>
            <select
              required
              value={supplierId}
              onChange={(event) => handleSupplierChange(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">-- Chọn nhà cung cấp --</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>

          <label className="space-y-1">
            <span className="ml-1 text-xs font-bold uppercase text-slate-500">Ghi chú</span>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Nhập ghi chú phiếu nhập..."
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>

          {selectedSupplier && (
            <div className="grid gap-4 rounded-xl border border-cyan-100 bg-cyan-50/60 p-4 text-sm text-cyan-900 dark:border-cyan-900/50 dark:bg-cyan-950/30 dark:text-cyan-100 md:col-span-2 md:grid-cols-2">
              <div className="flex items-start gap-3">
                <Building2 className="mt-0.5 h-5 w-5 text-cyan-600 dark:text-cyan-300" />
                <div>
                  <p className="font-bold">Thông tin nhà cung cấp</p>
                  <p>Người liên hệ: {selectedSupplier.contact_person || 'Chưa cập nhật'}</p>
                  <p>SĐT: {selectedSupplier.phone || 'Chưa cập nhật'}</p>
                  <p>Email: {selectedSupplier.email || 'Chưa cập nhật'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 border-t border-cyan-200 pt-3 dark:border-cyan-900 md:border-l md:border-t-0 md:pl-4 md:pt-0">
                <Truck className="mt-0.5 h-5 w-5 text-cyan-600 dark:text-cyan-300" />
                <div>
                  <p className="font-bold">Theo dõi vận chuyển dự kiến</p>
                  <p>Khoảng cách: {selectedSupplier.distance_km != null ? `${selectedSupplier.distance_km} km` : 'Chưa cập nhật'}</p>
                  <p>Thời gian giao dự kiến: {deliveryDays} ngày</p>
                  <p>Ngày dự kiến nhận: <span className="font-bold">{estimatedArrival ? new Date(estimatedArrival).toLocaleDateString('vi-VN') : '-'}</span></p>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Chi tiết sản phẩm nhập</h2>
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
                Thêm dòng
              </button>
            </div>
          </div>

          <div className="space-y-5">
            {items.map((item, index) => {
              const product = productOptions.find((p) => String(p.id) === String(item.productId));
              const productObj = allProducts.find((p) => String(p.id) === String(item.productId));
              const isInvalidSupplier = supplierId && productObj && !(productObj.supplier_ids || []).includes(Number(supplierId));
              const isProductNotFound = item.productId && !productObj;
              const isDuplicated = item.productId && selectedProductIds.filter((id) => String(id) === String(item.productId)).length > 1;
              const capacityNeeded = formTotalByCategory(item.category);
              const capacityFree = zoneFreeCapacity[item.category] || 0;
              const capacityWarning = item.category && capacityNeeded > capacityFree;

              return (
                <div
                  key={item._key}
                  className={`rounded-2xl border p-5 transition ${
                    isInvalidSupplier || isProductNotFound
                      ? 'border-red-300 bg-red-50/40 dark:border-red-900/30 dark:bg-red-950/20'
                      : isDuplicated || capacityWarning
                      ? 'border-amber-300 bg-amber-50/40 dark:border-amber-700 dark:bg-amber-950/20'
                      : 'border-slate-200 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-800/50'
                  }`}
                >
                  <div className="grid grid-cols-12 items-end gap-4">
                    <div className="col-span-12 sm:col-span-4 md:col-span-2">
                      <label className="space-y-1 block">
                        <span className="ml-1 text-[10px] font-bold uppercase text-slate-500">ID sản phẩm</span>
                        <input
                          list={`import-product-list-${index}`}
                          required
                          value={item.productId}
                          onChange={(event) => updateItem(index, 'productId', event.target.value)}
                          placeholder="Nhập ID..."
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950"
                        />
                        <datalist id={`import-product-list-${index}`}>
                          {productOptions.map((productItem) => (
                            <option key={productItem.id} value={productItem.id}>
                              {productItem.id} - {productItem.name}
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
                          placeholder="Tự động điền theo ID..."
                          className="w-full rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 font-semibold text-slate-500 outline-none cursor-not-allowed dark:border-slate-700 dark:bg-slate-800"
                        />
                      </label>
                    </div>

                    <div className="col-span-4 sm:col-span-4 md:col-span-2">
                      <label className="space-y-1 block">
                        <span className="ml-1 text-[10px] font-bold uppercase text-slate-500">Số lượng</span>
                        <input
                          type="number"
                          min="1"
                          required
                          value={item.quantity}
                          onChange={(event) => updateItem(index, 'quantity', event.target.value)}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950"
                        />
                      </label>
                    </div>

                    <div className="col-span-4 sm:col-span-4 md:col-span-2">
                      <label className="space-y-1 block">
                        <span className="ml-1 text-[10px] font-bold uppercase text-slate-500">Đơn giá nhập</span>
                        <input
                          readOnly
                          value={item.price ? formatCurrency(item.price) : '0 đ'}
                          className="w-full cursor-not-allowed rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 font-semibold text-slate-500 outline-none dark:border-slate-700 dark:bg-slate-800"
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
                  </div>

                  <div className="mt-3 space-y-1 text-xs font-medium">
                    {isProductNotFound && (
                      <p className="text-red-500 font-bold">
                        Cảnh báo: Sản phẩm này không tồn tại trong hệ thống.
                      </p>
                    )}
                    {isInvalidSupplier && !isProductNotFound && (
                      <p className="text-red-500 font-bold">
                        Cảnh báo: Sản phẩm này không được cung cấp bởi nhà cung cấp đã chọn.
                      </p>
                    )}
                    {isDuplicated && <p className="text-amber-600">Cảnh báo: sản phẩm bị lặp, hệ thống sẽ cộng dồn số lượng khi nhập.</p>}
                    {capacityWarning && (
                      <p className="text-red-500">
                        Phân khu "{item.category}" không đủ sức chứa trống. Cần {capacityNeeded}, còn trống {capacityFree}.
                      </p>
                    )}
                    {product && (
                      <p className="text-slate-500 dark:text-slate-400">
                        Danh mục: <span className="font-semibold text-slate-700 dark:text-slate-200">{product.category}</span> | Sức chứa trống toàn khu: <span className="font-semibold">{capacityFree}</span>
                      </p>
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
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 font-semibold text-white shadow-md shadow-emerald-100 transition-all hover:bg-emerald-600 active:scale-95 disabled:opacity-60 dark:shadow-none"
            >
              <Save className="h-4 w-4" />
              {submitting ? 'Đang lưu...' : 'Lưu phiếu nhập'}
            </button>
          </div>
        </section>
      </form>

      {isCompareOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={() => setIsCompareOpen(false)}>
          <div className="flex max-h-[82vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-950">
              <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
                <Scale className="h-5 w-5 text-cyan-600" />
                So sánh nhà cung cấp
              </h3>
              <button type="button" onClick={() => setIsCompareOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-6">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Chọn sản phẩm cần nhập</span>
                <select
                  value={compareProductId}
                  onChange={(event) => fetchCompare(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="">-- Chọn sản phẩm --</option>
                  {allProducts
                    .filter((product) => (product.supplier_prices || []).length >= 2)
                    .map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.product_code} - {product.name} ({product.supplier_prices.length} NCC)
                      </option>
                    ))}
                </select>
              </label>

              {isComparing ? (
                <div className="py-8 text-center text-slate-500">Đang tìm kiếm...</div>
              ) : compareProductId && compareData.length === 0 ? (
                <div className="rounded-xl border border-slate-100 bg-slate-50 py-8 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                  Không có nhà cung cấp nào cho sản phẩm này.
                </div>
              ) : compareData.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr>
                        <th className="p-3 font-semibold text-slate-600">Nhà cung cấp</th>
                        <th className="p-3 font-semibold text-slate-600">Giá hợp đồng</th>
                        <th className="p-3 font-semibold text-slate-600">Khoảng cách</th>
                        <th className="p-3 font-semibold text-slate-600">Giao hàng</th>
                        <th className="p-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {compareData.map((supplier, index) => (
                        <tr key={supplier.supplier_id} className={index === 0 ? 'bg-emerald-50/70 dark:bg-emerald-950/20' : ''}>
                          <td className="p-3 font-semibold text-slate-800 dark:text-slate-100">
                            {supplier.supplier_name}
                            {index === 0 && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Tốt nhất</span>}
                          </td>
                          <td className="p-3 font-semibold text-cyan-700">{formatCurrency(supplier.contract_price)}</td>
                          <td className="p-3 text-slate-600 dark:text-slate-300">{supplier.distance_km != null ? `${supplier.distance_km} km` : '-'}</td>
                          <td className="p-3 text-slate-600 dark:text-slate-300">{supplier.lead_time_days || calculateDeliveryDays(supplier.distance_km)} ngày</td>
                          <td className="p-3 text-right">
                            <button
                              type="button"
                              onClick={() => chooseCompareSupplier(supplier.supplier_id)}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                            >
                              Chọn
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
      <QRScannerModal 
        isOpen={isQrOpen} 
        onClose={() => setIsQrOpen(false)} 
        onScanSuccess={handleQrScanSuccess} 
      />
    </div>
  );
}
