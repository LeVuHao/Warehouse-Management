'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import api from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import { useDialogStore } from '@/store/useDialogStore';
import {
  Plus, Search, QrCode, Edit2, Trash2, Printer,
  X, AlertCircle, Check, Loader2, Sparkles, Filter,
  LayoutGrid, Package
} from 'lucide-react';

// Zod validation schema for Product creation/updating
const productFormSchema = z.object({
  product_code: z.string().min(3, 'Mã sản phẩm phải có ít nhất 3 ký tự'),
  name: z.string().min(3, 'Tên sản phẩm phải có ít nhất 3 ký tự'),
  category: z.string().min(1, 'Vui lòng chọn danh mục'),
  unit: z.string().min(1, 'Vui lòng chọn đơn vị tính'),
  description: z.string().optional(),
  min_stock: z.coerce.number().min(0, 'Số lượng tồn tối thiểu phải lớn hơn hoặc bằng 0'),
  unit_price: z.coerce.number().min(0, 'Đơn giá bán lẻ phải lớn hơn hoặc bằng 0'),
  location_id: z.string().min(1, 'Vui lòng chọn kệ hàng mặc định'),
  min_days_to_sell: z.coerce.number().min(0, 'Số ngày bán tối thiểu phải lớn hơn hoặc bằng 0'),
  expiry_warning_days: z.coerce.number().min(0, 'Số ngày cảnh báo hạn dùng phải lớn hơn hoặc bằng 0'),
});

export default function ProductsPage() {
  const { user } = useAuthStore();
  const { showAlert, showConfirm } = useDialogStore();
  const isAdmin = user?.role === 'admin';

  // Component states
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [activeTab, setActiveTab] = useState('products');

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [qrCodeData, setQrCodeData] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [formErrorMsg, setFormErrorMsg] = useState('');

  // Selected suppliers in the form (linking prices)
  const [selectedSuppliers, setSelectedSuppliers] = useState({}); // { [supplierId]: { contractPrice, leadTime } }

  // Load master data
  const loadData = async () => {
    setLoading(true);
    try {
      const [prodRes, locRes, supRes] = await Promise.all([
        api.get('/products'),
        api.get('/locations'),
        api.get('/suppliers')
      ]);
      setProducts(prodRes.data);
      setLocations(locRes.data);
      setSuppliers(supRes.data);
    } catch (err) {
      console.error('Failed to load products page data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Form setup
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      product_code: '',
      name: '',
      category: '',
      unit: '',
      description: '',
      min_stock: 10,
      unit_price: 0,
      location_id: '',
      min_days_to_sell: 7,
      expiry_warning_days: 30,
    },
  });

  const categoryValue = watch('category');

  // Auto-generate product code logic like TTCS
  const getCategoryPrefix = (categoryName) => {
    const categoryPrefixes = {
      'Thực phẩm tươi sống': 'TS',
      'Thực phẩm khô và Nhu yếu phẩm': 'TK',
      'Đồ uống và bánh kẹo': 'BK',
      'Hóa mỹ phẩm': 'MP',
      'Đồ dùng gia đình': 'GD'
    };
    if (categoryPrefixes[categoryName]) {
      return categoryPrefixes[categoryName];
    }
    if (!categoryName) return 'SP';
    const normalized = categoryName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const words = normalized.split(/\s+/);
    const initials = words.map(w => w[0]).join('').toUpperCase().replace(/[^A-Z]/g, '');
    return initials.slice(0, 3) || 'SP';
  };

  const generateNextProductCode = (categoryName) => {
    const prefix = getCategoryPrefix(categoryName);
    const matchingCodes = products
      .filter(p => p.category === categoryName || p.product_code?.startsWith(prefix))
      .map(p => {
        const code = p.product_code || '';
        const numPart = code.substring(prefix.length);
        const num = parseInt(numPart, 10);
        return isNaN(num) ? 0 : num;
      });

    const maxNum = matchingCodes.length > 0 ? Math.max(...matchingCodes) : 0;
    const nextNum = maxNum + 1;
    const padLength = 3;
    return `${prefix}${String(nextNum).padStart(padLength, '0')}`;
  };

  const handleCategoryChange = (e) => {
    const categoryName = e.target.value;
    if (categoryName) {
      if (!editingProduct || categoryName !== editingProduct.category) {
        const nextCode = generateNextProductCode(categoryName);
        setValue('product_code', nextCode, { shouldValidate: true });
      } else {
        setValue('product_code', editingProduct.product_code, { shouldValidate: true });
      }
    } else {
      setValue('product_code', '', { shouldValidate: true });
    }
  };

  // Open Form for Adding
  const handleAddClick = () => {
    setEditingProduct(null);
    setFormErrorMsg('');
    setSelectedSuppliers({});
    reset({
      product_code: '',
      name: '',
      category: '',
      unit: '',
      description: '',
      min_stock: 10,
      unit_price: 0,
      location_id: '',
      min_days_to_sell: 7,
      expiry_warning_days: 30,
    });
    setIsFormOpen(true);
  };

  // Open Form for Editing
  const handleEditClick = async (product) => {
    setEditingProduct(product);
    setFormErrorMsg('');
    setIsFormOpen(true);
    setSubmitLoading(true);

    try {
      // Set basic form values
      setValue('product_code', product.product_code);
      setValue('name', product.name);
      setValue('category', product.category || '');
      setValue('unit', product.unit || '');
      setValue('description', product.description || '');
      setValue('min_stock', product.min_stock);
      setValue('unit_price', product.unit_price || 0);
      setValue('location_id', product.location_id ? String(product.location_id) : '');
      setValue('min_days_to_sell', product.min_days_to_sell);
      setValue('expiry_warning_days', product.expiry_warning_days);

      // Load associated supplier prices
      const supRes = await api.get(`/products/${product.id}/suppliers`);
      const mappedSups = {};
      supRes.data.forEach(item => {
        mappedSups[item.supplier_id] = {
          checked: true,
          contract_price: item.contract_price,
          lead_time_days: item.lead_time_days
        };
      });
      setSelectedSuppliers(mappedSups);
    } catch (err) {
      console.error('Error fetching product supplier prices:', err);
      setFormErrorMsg('Không thể tải bảng giá nhà cung cấp của sản phẩm này.');
    } finally {
      setSubmitLoading(false);
    }
  };

  // Open QR Code Modal
  const handleQrClick = async (product) => {
    setIsQrOpen(true);
    setQrLoading(true);
    setQrCodeData(null);
    try {
      const res = await api.get(`/products/${product.id}/qrcode`);
      setQrCodeData(res.data);
    } catch (err) {
      console.error('Failed to load QR code:', err);
    } finally {
      setQrLoading(false);
    }
  };

  // Handle Supplier Selection Checkbox
  const handleSupplierCheck = (supplierId, isChecked) => {
    setSelectedSuppliers(prev => {
      const updated = { ...prev };
      if (isChecked) {
        updated[supplierId] = {
          checked: true,
          contract_price: 0,
          lead_time_days: 2
        };
      } else {
        delete updated[supplierId];
      }
      return updated;
    });
  };

  // Handle Supplier Contract Value Changes
  const handleSupplierValChange = (supplierId, field, val) => {
    setSelectedSuppliers(prev => {
      const updated = { ...prev };
      if (updated[supplierId]) {
        updated[supplierId][field] = Number(val);
      }
      return updated;
    });
  };

  // Handle Form Submit (Add/Update)
  const onSubmit = async (data) => {
    setSubmitLoading(true);
    setFormErrorMsg('');

    // Prepare supplier prices payload
    const supplier_ids = Object.keys(selectedSuppliers).map(sid => ({
      supplier_id: parseInt(sid),
      contract_price: selectedSuppliers[sid].contract_price,
      lead_time_days: selectedSuppliers[sid].lead_time_days
    }));

    const payload = {
      ...data,
      location_id: data.location_id ? parseInt(data.location_id) : null,
      supplier_ids
    };

    try {
      // 1. Perform duplicate check
      const duplicateRes = await api.get('/products/check-duplicate', {
        params: {
          product_code: data.product_code,
          name: data.name,
          exclude_id: editingProduct?.id
        }
      });

      if (duplicateRes.data.exists) {
        setFormErrorMsg(duplicateRes.data.message);
        setSubmitLoading(false);
        return;
      }

      // 2. Add or Update
      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, payload);
      } else {
        await api.post('/products', payload);
      }

      setIsFormOpen(false);
      showAlert('Thành công', 'Lưu sản phẩm thành công!');
      loadData();
    } catch (err) {
      console.error('Submit failed:', err);
      setFormErrorMsg(err.response?.data?.error || 'Có lỗi xảy ra trong quá trình lưu sản phẩm.');
    } finally {
      setSubmitLoading(false);
    }
  };

  // Handle Product Delete (Soft delete)
  const handleDeleteClick = (productId, name) => {
    showConfirm(
      'Xác nhận Xóa',
      `Bạn có chắc chắn muốn ẩn sản phẩm "${name}" khỏi hệ thống? Thao tác này không thể hoàn tác.`,
      async () => {
        try {
          await api.delete(`/products/${productId}`);
          showAlert('Thành công', 'Đã xóa sản phẩm thành công.');
          loadData();
        } catch (err) {
          console.error('Delete failed:', err);
          showAlert('Lỗi', err.response?.data?.error || 'Không thể xóa sản phẩm.');
        }
      }
    );
  };

  // Print QR Code Label
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>In nhãn QR Code - ${qrCodeData.product_code}</title>
          <style>
            body { font-family: sans-serif; text-align: center; padding: 20px; }
            .label-box { border: 2px dashed #000; padding: 15px; display: inline-block; max-width: 320px; }
            img { width: 220px; height: 220px; margin: 10px 0; }
            h2 { margin: 0; font-size: 20px; }
            p { margin: 4px 0; font-size: 13px; color: #333; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div class="label-box">
            <h2>MÃ QR SẢN PHẨM</h2>
            <img src="${qrCodeData.qr_code_image}" />
            <p><strong>Mã hàng:</strong> ${qrCodeData.product_code}</p>
            <p><strong>Mã quét:</strong> Thông tin & Kệ hàng</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Filter products locally on client side (or combines with search queries)
  const filteredProducts = products.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.product_code.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = categoryFilter === '' || p.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  // Unique categories list for dropdown filter
  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            Danh mục Sản phẩm &amp; Kệ hàng
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Quản lý thông tin hàng hóa, sơ đồ kệ kho lưu trữ và nhà cung cấp liên kết.
          </p>
        </div>

        {isAdmin && activeTab === 'products' && (
          <button
            onClick={handleAddClick}
            className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-700 active:scale-[0.98] transition-all cursor-pointer"
          >
            <Plus className="h-4.5 w-4.5" />
            Thêm sản phẩm mới
          </button>
        )}
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-4 border-b border-slate-200/60 dark:border-slate-800/80 pb-px">
        <button
          onClick={() => setActiveTab('products')}
          className={`flex items-center gap-2 border-b-2 pb-2.5 text-sm font-semibold transition-all cursor-pointer ${activeTab === 'products'
            ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 font-bold'
            : 'border-transparent text-slate-500 hover:text-slate-750 dark:hover:text-slate-350'
            }`}
        >
          <Package className="h-4.5 w-4.5" />
          Sản phẩm ({products.length})
        </button>
        <button
          onClick={() => setActiveTab('locations')}
          className={`flex items-center gap-2 border-b-2 pb-2.5 text-sm font-semibold transition-all cursor-pointer ${activeTab === 'locations'
            ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 font-bold'
            : 'border-transparent text-slate-500 hover:text-slate-750 dark:hover:text-slate-350'
            }`}
        >
          <LayoutGrid className="h-4.5 w-4.5" />
          Kệ hàng ({locations.length})
        </button>
      </div>

      {activeTab === 'products' && (
        <>
          {/* Search & Filter Toolbar */}
          <div className="flex flex-col gap-4 rounded-xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900/30 p-4 backdrop-blur-md sm:flex-row sm:items-center">
            {/* Search */}
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 dark:text-slate-500">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="text"
                placeholder="Tìm theo tên sản phẩm hoặc mã hàng..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-2 pr-3 pl-10 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-650 focus:border-indigo-500/80 focus:outline-none"
              />
            </div>

            {/* Category Filter */}
            <div className="relative w-full sm:w-60">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 dark:text-slate-500">
                <Filter className="h-4 w-4" />
              </span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-2 pr-8 pl-10 text-sm text-slate-700 dark:text-slate-300 focus:border-indigo-500/80 focus:outline-none appearance-none"
              >
                <option value="">Tất cả danh mục ({categories.length})</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Main Table Content */}
          {loading ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
              <p className="text-sm text-slate-500 dark:text-slate-400">Đang tải danh sách hàng hóa...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-250 dark:border-slate-800 bg-white dark:bg-slate-900/10 p-8 text-center">
              <AlertCircle className="h-8 w-8 text-slate-400" />
              <p className="text-sm text-slate-550 dark:text-slate-400">Không tìm thấy sản phẩm nào phù hợp.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900/20 backdrop-blur-md">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-950/60 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200/60 dark:border-slate-800">
                    <tr>
                      <th className="py-3.5 px-4">Mã hàng</th>
                      <th className="py-3.5 px-4">Tên sản phẩm</th>
                      <th className="py-3.5 px-4">Phân mục</th>
                      <th className="py-3.5 px-4">Đơn vị</th>
                      <th className="py-3.5 px-4">Giá bán lẻ</th>
                      <th className="py-3.5 px-4">Vị trí kệ</th>
                      <th className="py-3.5 px-4 text-center">Tồn kho</th>
                      <th className="py-3.5 px-4 text-center">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                    {filteredProducts.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-medium text-indigo-600 dark:text-indigo-400">{p.product_code}</td>
                        <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-slate-100 max-w-xs truncate" title={p.name}>
                          {p.name}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 dark:text-slate-450">{p.category || '—'}</td>
                        <td className="py-3.5 px-4 text-slate-500 dark:text-slate-455">{p.unit || '—'}</td>
                        <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-200">
                          {p.unit_price ? `${Number(p.unit_price).toLocaleString()} đ` : '—'}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-blue-600 dark:text-blue-400">{p.location_code || 'Chưa xếp kệ'}</td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${p.is_low_stock
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            }`}>
                            {p.current_stock}
                            {p.is_low_stock && ' (Hụt)'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleQrClick(p)}
                              title="Xem mã QR"
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-white transition-colors"
                            >
                              <QrCode className="h-4.5 w-4.5" />
                            </button>

                            {isAdmin && (
                              <>
                                <button
                                  onClick={() => handleEditClick(p)}
                                  title="Chỉnh sửa"
                                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                >
                                  <Edit2 className="h-4.5 w-4.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteClick(p.id, p.name)}
                                  title="Xóa"
                                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                                >
                                  <Trash2 className="h-4.5 w-4.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'locations' && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900/20 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-450 dark:text-slate-500">Tổng số kệ hàng</p>
              <p className="mt-2 text-3xl font-bold text-slate-800 dark:text-white">{locations.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900/20 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-450 dark:text-slate-500">Tổng sức chứa</p>
              <p className="mt-2 text-3xl font-bold text-indigo-650 dark:text-indigo-400">
                {locations.reduce((s, l) => s + (l.max_capacity || 0), 0).toLocaleString()}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900/20 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-450 dark:text-slate-500">Tổng trống khả dụng</p>
              <p className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                {(locations.reduce((s, l) => s + (l.max_capacity || 0), 0) - locations.reduce((s, l) => s + (l.current_occupied || 0), 0)).toLocaleString()}
              </p>
            </div>
          </div>

          {/* 5 Zones Visual Warehouse Map */}
          {locations.length === 0 ? (
            <div className="rounded-2xl border border-slate-250 dark:border-slate-800 bg-white dark:bg-slate-900/10 p-10 text-center text-slate-400 dark:text-slate-500">
              Chưa có kệ hàng nào được cấu hình trong hệ thống.
            </div>
          ) : (() => {
            const predefinedZones = [
              {
                name: "Thực phẩm tươi sống",
                color: "emerald",
                icon: (props) => (
                  <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c-1.2 0-2.4.3-3.5 1-2 1.2-3.5 3.3-3.5 5.7c0 4.3 4.2 7.7 7 8.3c2.8-.6 7-4 7-8.3c0-2.4-1.5-4.5-3.5-5.7C14.4 3.3 13.2 3 12 3z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 5c0 1 1 2 2.5 2s2.5-1 2.5-2" />
                  </svg>
                ),
                desc: "Khu vực bảo quản thịt, cá, rau củ quả tươi sống hàng ngày."
              },
              {
                name: "Thực phẩm khô và Nhu yếu phẩm",
                color: "amber",
                icon: (props) => (
                  <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 10a9 9 0 0018 0M6 10v2a6 6 0 0012 0v-2M12 10V4M10 6.5h4" />
                  </svg>
                ),
                desc: "Mì ăn liền, gia vị, dầu ăn, gạo và các nhu yếu phẩm đóng chai/gói."
              },
              {
                name: "Đồ uống và bánh kẹo",
                color: "indigo",
                icon: (props) => (
                  <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <rect x="5" y="4" width="6" height="15" rx="1.5" />
                    <path d="M8 4V2M5 8h6M15 11l4-4M19 11l-4-4M15 7l4 4M19 7l-4 4" />
                  </svg>
                ),
                desc: "Nước ngọt, bia, sữa, các loại bánh kẹo ngọt và đồ ăn vặt."
              },
              {
                name: "Hóa mỹ phẩm",
                color: "rose",
                icon: (props) => (
                  <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 22h6V10H9v12zM9 10l3-5 3 5M12 2v3M9 8h6" />
                  </svg>
                ),
                desc: "Dầu gội, bột giặt, nước rửa chén, kem đánh răng và mỹ phẩm chăm sóc."
              },
              {
                name: "Đồ dùng gia đình",
                color: "sky",
                icon: (props) => (
                  <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3M9 21V13h6v8" />
                  </svg>
                ),
                desc: "Chén bát, chổi, khăn lau, hộp đựng thực phẩm và đồ gia dụng nhỏ."
              }
            ];

            return (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {predefinedZones.map((zone) => {
                  const zoneLocs = locations.filter((loc) => loc.zone === zone.name);

                  const colors = {
                    emerald: { text: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/20', border: 'border-emerald-100 dark:border-emerald-900/50', badge: 'bg-emerald-100 text-emerald-800', bar: 'bg-emerald-500', shadow: 'shadow-emerald-100/50' },
                    amber: { text: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-955/20', border: 'border-amber-100 dark:border-amber-900/50', badge: 'bg-amber-100 text-amber-800', bar: 'bg-amber-500', shadow: 'shadow-amber-100/50' },
                    indigo: { text: 'text-indigo-700 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/20', border: 'border-indigo-100 dark:border-indigo-900/50', badge: 'bg-indigo-100 text-indigo-800', bar: 'bg-indigo-500', shadow: 'shadow-indigo-100/50' },
                    rose: { text: 'text-rose-700 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/20', border: 'border-rose-100 dark:border-rose-900/50', badge: 'bg-rose-100 text-rose-800', bar: 'bg-rose-500', shadow: 'shadow-rose-100/50' },
                    sky: { text: 'text-sky-700 dark:text-sky-400', bg: 'bg-sky-50 dark:bg-sky-950/20', border: 'border-sky-100 dark:border-sky-900/50', badge: 'bg-sky-100 text-sky-800', bar: 'bg-sky-500', shadow: 'shadow-sky-100/50' }
                  }[zone.color];

                  return (
                    <div key={zone.name} className={`rounded-2xl border ${colors.border} bg-white dark:bg-slate-900/20 p-5 shadow-sm space-y-4 hover:shadow-md transition duration-200`}>
                      {/* Zone Header */}
                      <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                        <div className={`p-2.5 rounded-xl ${colors.bg} ${colors.text}`}>
                          <zone.icon className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800 dark:text-white text-sm">{zone.name}</h3>
                          <p className="text-[11px] text-slate-450 dark:text-slate-500 leading-tight">{zone.desc}</p>
                        </div>
                      </div>

                      {/* Shelves Layout inside Zone */}
                      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                        {zoneLocs.length === 0 ? (
                          <div className="col-span-2 rounded-xl bg-slate-50 dark:bg-slate-950/30 py-6 text-center text-xs text-slate-400 dark:text-slate-500 italic">
                            Chưa có kệ hàng ở phân khu này
                          </div>
                        ) : (
                          zoneLocs.map((loc) => {
                            const pct = loc.max_capacity > 0
                              ? Math.min(100, Math.round((loc.current_occupied / loc.max_capacity) * 100))
                              : 0;
                            const barColor =
                              pct >= 90 ? 'bg-red-500'
                                : pct >= 70 ? 'bg-amber-500'
                                  : 'bg-indigo-600 dark:bg-indigo-500';
                            const statusLabel =
                              pct >= 100 ? { text: 'Đầy', cls: 'bg-red-500/10 text-red-650 dark:text-red-400 border border-red-500/20' }
                                : pct >= 70 ? { text: 'Gần đầy', cls: 'bg-amber-500/10 text-amber-650 dark:text-amber-400 border border-amber-500/20' }
                                  : { text: 'Còn trống', cls: 'bg-emerald-500/10 text-emerald-650 dark:text-emerald-400 border border-emerald-500/20' };

                            return (
                              <div key={loc.id} className="rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-55/30 dark:bg-slate-950/10 p-3.5 space-y-3">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <p className="font-bold text-slate-700 dark:text-slate-200 text-xs">{loc.name}</p>
                                    <p className="text-[9px] font-mono text-slate-450 dark:text-slate-500 uppercase tracking-wide mt-0.5">{loc.location_code}</p>
                                  </div>
                                  <span className={`rounded px-1.5 py-0.5 text-[8.5px] font-bold ${statusLabel.cls}`}>
                                    {statusLabel.text}
                                  </span>
                                </div>

                                {/* Progress bar */}
                                <div className="space-y-1">
                                  <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400">
                                    <span>Đã xếp: <strong className="text-slate-700 dark:text-slate-300">{loc.current_occupied.toLocaleString()}</strong></span>
                                    <span><strong className="text-slate-700 dark:text-slate-300">{pct}%</strong></span>
                                  </div>
                                  <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                                    <div
                                      className={`h-1.5 rounded-full transition-all duration-300 ${barColor}`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>

                                {/* Stats Info */}
                                <div className="grid grid-cols-2 gap-2 text-center text-[10px] pt-1">
                                  <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-2">
                                    <p className="text-[8px] font-semibold text-slate-400 uppercase tracking-wide">Tối đa</p>
                                    <p className="mt-0.5 font-bold text-slate-700 dark:text-slate-300">{loc.max_capacity.toLocaleString()}</p>
                                  </div>
                                  <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-2">
                                    <p className="text-[8px] font-semibold text-slate-400 uppercase tracking-wide">Còn trống</p>
                                    <p className="mt-0.5 font-bold text-emerald-600 dark:text-emerald-400">
                                      {Math.max(0, loc.max_capacity - loc.current_occupied).toLocaleString()}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* QR Code Viewer Modal */}
      {isQrOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl animate-fade-in relative text-slate-800 dark:text-slate-200">
            <button
              onClick={() => setIsQrOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-650 dark:hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 text-center">
              Nhãn Mã QR Sản Phẩm
            </h3>

            {qrLoading ? (
              <div className="flex h-56 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
              </div>
            ) : qrCodeData ? (
              <div className="flex flex-col items-center">
                <div className="rounded-lg bg-white p-3 border-2 border-dashed border-slate-200 dark:border-slate-350">
                  <img
                    src={qrCodeData.qr_code_image}
                    alt="QR Code"
                    className="h-48 w-48 object-contain"
                  />
                </div>
                <div className="mt-4 text-center space-y-1">
                  <p className="text-xs text-slate-400">Mã sản phẩm (Product Code)</p>
                  <p className="font-mono text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                    {qrCodeData.product_code}
                  </p>
                </div>

                <button
                  onClick={handlePrint}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 py-2 text-sm font-semibold text-slate-700 dark:text-white transition-colors cursor-pointer"
                >
                  <Printer className="h-4.5 w-4.5" />
                  In nhãn dán
                </button>
              </div>
            ) : (
              <p className="text-sm text-red-500 dark:text-red-400 text-center">Không thể sinh mã QR Code.</p>
            )}
          </div>
        </div>
      )}

      {/* Add / Edit Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 bg-slate-950/60 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl my-8 relative text-slate-850 dark:text-slate-200">
            <button
              onClick={() => setIsFormOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-650 dark:hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">
              {editingProduct ? 'Chỉnh sửa thông tin sản phẩm' : 'Thêm sản phẩm mới vào kho'}
            </h3>

            {formErrorMsg && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3.5 text-sm text-red-650 dark:text-red-400">
                <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
                <p className="font-medium">{formErrorMsg}</p>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

              {/* ── THÔNG TIN SẢN PHẨM ── */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Thông tin sản phẩm</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Danh mục <span className="text-red-500">*</span></label>
                    <select {...register('category', { onChange: handleCategoryChange })}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 py-2 px-3 text-sm text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none">
                      <option value="">Chọn danh mục</option>
                      <option value="Thực phẩm tươi sống">Thực phẩm tươi sống</option>
                      <option value="Thực phẩm khô và Nhu yếu phẩm">Thực phẩm khô và Nhu yếu phẩm</option>
                      <option value="Đồ uống và bánh kẹo">Đồ uống và bánh kẹo</option>
                      <option value="Hóa mỹ phẩm">Hóa mỹ phẩm</option>
                      <option value="Đồ dùng gia đình">Đồ dùng gia đình</option>
                    </select>
                    {errors.category && <p className="text-xs text-red-500">{errors.category.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Tên sản phẩm <span className="text-red-500">*</span></label>
                    <input {...register('name')} type="text" placeholder="Ví dụ: Sữa tươi Vinamilk"
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 py-2 px-3 text-sm text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none" />
                    {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Mã sản phẩm <span className="text-red-500">*</span></label>
                    <input {...register('product_code')} disabled={!categoryValue || !!editingProduct} type="text"
                      placeholder={categoryValue ? 'Ví dụ: TS011' : 'Vui lòng chọn danh mục trước'}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 py-2 px-3 text-sm text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-900 disabled:cursor-not-allowed" />
                    {errors.product_code && <p className="text-xs text-red-500">{errors.product_code.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Đơn vị tính <span className="text-red-500">*</span></label>
                    <input {...register('unit')} type="text" placeholder="Ví dụ: Hộp, Thùng, Lon, Kg..."
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 py-2 px-3 text-sm text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none" />
                    {errors.unit && <p className="text-xs text-red-500">{errors.unit.message}</p>}
                  </div>
                  {/* Đơn giá — nửa dòng trái */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Đơn giá bán (đ) <span className="text-red-500">*</span></label>
                    <input {...register('unit_price')} type="number" placeholder="Ví dụ: 350000"
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 py-2 px-3 text-sm text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none" />
                    {errors.unit_price && <p className="text-xs text-red-500">{errors.unit_price.message}</p>}
                  </div>
                </div>
              </div>

              {/* ── THIẾT LẬP KHO & CẢNH BÁO ── */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-3">Thiết lập kho &amp; cảnh báo</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Kệ mặc định <span className="text-red-500">*</span></label>
                    <select {...register('location_id')}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 py-2 px-3 text-sm text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none">
                      <option value="">Chọn kệ</option>
                      {locations.map(loc => (
                        <option key={loc.id} value={String(loc.id)}>{loc.location_code} ({loc.name})</option>
                      ))}
                    </select>
                    {errors.location_id && <p className="text-xs text-red-500">{errors.location_id.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Tồn tối thiểu <span className="text-red-500">*</span></label>
                    <input {...register('min_stock')} type="number" min={0} placeholder="0"
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 py-2 px-3 text-sm text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none" />
                    {errors.min_stock && <p className="text-xs text-red-500">{errors.min_stock.message}</p>}
                  </div>
                  {/* Hạn bán = min_days_to_sell */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Hạn bán (ngày) <span className="text-red-500">*</span></label>
                    <input {...register('min_days_to_sell')} type="number" min={0} placeholder="7"
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 py-2 px-3 text-sm text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none" />
                    {errors.min_days_to_sell && <p className="text-xs text-red-500">{errors.min_days_to_sell.message}</p>}
                    <p className="text-[11px] text-slate-400 leading-snug">Không xuất nếu HSD còn lại dưới số ngày này</p>
                  </div>
                  {/* Cảnh báo HSD = expiry_warning_days */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Cảnh báo HSD <span className="text-red-500">*</span></label>
                    <input {...register('expiry_warning_days')} type="number" min={0} placeholder="30"
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 py-2 px-3 text-sm text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none" />
                    {errors.expiry_warning_days && <p className="text-xs text-red-500">{errors.expiry_warning_days.message}</p>}
                    <p className="text-[11px] text-slate-400 leading-snug">Gửi cảnh báo khi HSD còn dưới số ngày này</p>
                  </div>
                </div>
              </div>


              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Mô tả sản phẩm
                </label>
                <textarea
                  {...register('description')}
                  rows={2}
                  placeholder="Ghi chú chi tiết thông tin sản phẩm..."
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-2 px-3 text-sm text-slate-800 dark:text-slate-200 focus:border-indigo-500/80 focus:outline-none"
                ></textarea>
              </div>

              {/* Linking Contract Prices (Multiple Suppliers Selection) */}
              <div className="space-y-3 rounded-lg border border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/20 p-4">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                  Liên kết nhà cung cấp và bảng giá bán buôn
                </label>
                <p className="text-[11px] text-slate-500">
                  Chọn nhà cung cấp phân phối sản phẩm này và điền giá nhập hợp đồng.
                </p>

                <div className="max-h-40 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                  {suppliers.map(sup => {
                    const isChecked = !!selectedSuppliers[sup.id];
                    return (
                      <div key={sup.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 rounded border border-slate-200 dark:border-slate-800/60 bg-white dark:bg-slate-950/40">
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => handleSupplierCheck(sup.id, e.target.checked)}
                            className="rounded border-slate-300 dark:border-slate-800 text-indigo-650 focus:ring-indigo-500 h-4 w-4 bg-white dark:bg-slate-900"
                          />
                          <span className="truncate max-w-[280px]">{sup.name}</span>
                        </label>

                        {isChecked && (
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-slate-500">Giá nhập (đ):</span>
                              <input
                                type="number"
                                value={selectedSuppliers[sup.id].contract_price}
                                onChange={(e) => handleSupplierValChange(sup.id, 'contract_price', e.target.value)}
                                className="w-20 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-0.5 px-1.5 text-xs text-slate-800 dark:text-slate-200 text-right focus:border-indigo-500/80 focus:outline-none"
                              />
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-slate-500">Giao (ngày):</span>
                              <input
                                type="number"
                                value={selectedSuppliers[sup.id].lead_time_days}
                                onChange={(e) => handleSupplierValChange(sup.id, 'lead_time_days', e.target.value)}
                                className="w-12 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-0.5 px-1.5 text-xs text-slate-800 dark:text-slate-200 text-center focus:border-indigo-500/80 focus:outline-none"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-750 active:bg-indigo-800 disabled:opacity-50 cursor-pointer"
                >
                  {submitLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Lưu thay đổi</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
