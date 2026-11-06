'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import api from '@/lib/api';
import { createSupplierAction } from '@/app/actions/supplierActions';
import { useAuthStore } from '@/store/useAuthStore';
import { useDialogStore } from '@/store/useDialogStore';
import { 
  Plus, Search, Edit2, Trash2, X, AlertCircle, Eye,
  Check, Loader2, Sparkles, MapPin, Phone, Mail, User, Info, Navigation, Warehouse
} from 'lucide-react';

// Dynamic Leaflet import
const SupplierMap = dynamic(() => import('@/components/SupplierMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[400px] w-full items-center justify-center bg-white dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800/80 rounded-xl text-slate-400">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        <p className="text-xs">Đang tải bản đồ định vị...</p>
      </div>
    </div>
  ),
});

const supplierFormSchema = z.object({
  name: z.string().min(3, 'Tên nhà cung cấp phải có ít nhất 3 ký tự'),
  contact_person: z.string().min(3, 'Tên người đại diện phải có ít nhất 3 ký tự'),
  phone: z.string().min(8, 'Số điện thoại không hợp lệ'),
  email: z.string().email('Địa chỉ email không đúng định dạng'),
  address: z.string().min(5, 'Địa chỉ chi tiết phải có ít nhất 5 ký tự'),
  distance_km: z.coerce.number().min(0.1, 'Khoảng cách phải được tính bằng tuyến đường bộ thực tế'),
  latitude: z.coerce.number().min(-90).max(90, 'Vĩ độ không hợp lệ (-90 đến 90)'),
  longitude: z.coerce.number().min(-180).max(180, 'Kinh độ không hợp lệ (-180 đến 180)'),
});

export default function SuppliersPage() {
  const { user } = useAuthStore();
  const { showAlert, showConfirm } = useDialogStore();
  const isAdmin = user?.role === 'admin';

  // State
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  
  // Selection (For Map highlighting)
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  
  // Modals & Details Form States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [formErrorMsg, setFormErrorMsg] = useState('');
  
  // View Detail Modal State
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailSupplier, setDetailSupplier] = useState(null);
  const [detailProducts, setDetailProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  
  // Temp coordinates for map selection during Add/Edit
  const [tempLat, setTempLat] = useState(10.762622);
  const [tempLng, setTempLng] = useState(106.660172);

  // Load suppliers
  const loadSuppliers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/suppliers');
      setSuppliers(res.data);
      if (res.data.length > 0) {
        setSelectedSupplier(res.data[0]);
      }
    } catch (err) {
      console.error('Failed to load suppliers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  // Form setup
  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: {
      name: '',
      contact_person: '',
      phone: '',
      email: '',
      address: '',
      distance_km: 0,
      latitude: 10.762622,
      longitude: 106.660172,
    },
  });

  // Geocode address handler (Nominatim API)
  const handleGeocodeAddress = async () => {
    const addressVal = getValues('address');
    if (!addressVal || addressVal.trim().length < 5) {
      alert('Vui lòng điền địa chỉ đầy đủ (ít nhất 5 ký tự) trước khi định vị.');
      return;
    }

    setGeocoding(true);
    setFormErrorMsg('');
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressVal)}&limit=1`
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);

        setValue('latitude', Number(lat.toFixed(6)));
        setValue('longitude', Number(lon.toFixed(6)));
        setTempLat(lat);
        setTempLng(lon);

        // Query OSRM for actual driving distance
        try {
          const osrmRes = await fetch(
            `https://router.project-osrm.org/route/v1/driving/106.660172,10.762622;${lon},${lat}`
          );
          const osrmData = await osrmRes.json();
          if (osrmData.routes && osrmData.routes.length > 0) {
            const roadDistance = Number((osrmData.routes[0].distance / 1000).toFixed(1));
            setValue('distance_km', roadDistance);
          } else {
            setValue('distance_km', 0);
            setFormErrorMsg('Da dinh vi duoc toa do, nhung OSRM chua tim duoc tuyen duong bo thuc te. Vui long thu dia chi khac hoac ghim tren ban do.');
          }
        } catch (e) {
          setValue('distance_km', 0);
          setFormErrorMsg('Khong ket noi duoc OSRM de tinh duong bo thuc te. He thong khong dung khoang cach duong chim bay de thay the.');
        }
      } else {
        setFormErrorMsg('Không tìm thấy tọa độ địa lý cho địa chỉ này. Vui lòng kiểm tra lại chính tả hoặc tự ghim trực tiếp trên bản đồ.');
      }
    } catch (error) {
      console.error('Nominatim Geocoding error:', error);
      setFormErrorMsg('Lỗi kết nối với máy chủ định vị OpenStreetMap. Vui lòng ghim thủ công.');
    } finally {
      setGeocoding(false);
    }
  };

  // Add click
  const handleAddClick = () => {
    setEditingSupplier(null);
    setFormErrorMsg('');
    setTempLat(10.762622);
    setTempLng(106.660172);
    
    setValue('name', '');
    setValue('contact_person', '');
    setValue('phone', '');
    setValue('email', '');
    setValue('address', '');
    setValue('distance_km', 0);
    setValue('latitude', 10.762622);
    setValue('longitude', 106.660172);

    setIsFormOpen(true);
  };

  // Edit click
  const handleEditClick = (supplier) => {
    setEditingSupplier(supplier);
    setFormErrorMsg('');
    setIsFormOpen(true);
    
    setValue('name', supplier.name);
    setValue('contact_person', supplier.contact_person || '');
    setValue('phone', supplier.phone || '');
    setValue('email', supplier.email || '');
    setValue('address', supplier.address || '');
    setValue('distance_km', supplier.distance_km || 0);
    
    const lat = supplier.latitude || 10.762622;
    const lng = supplier.longitude || 106.660172;
    setValue('latitude', lat);
    setValue('longitude', lng);
    setTempLat(lat);
    setTempLng(lng);
  };

  // View Details Modal open
  const handleDetailClick = async (supplier) => {
    setDetailSupplier(supplier);
    setIsDetailOpen(true);
    setLoadingProducts(true);
    try {
      const res = await api.get(`/products?supplier_id=${supplier.id}`);
      setDetailProducts(res.data);
    } catch (error) {
      console.error('Failed to load supplier products', error);
      setDetailProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  // Callback when user clicks on map during select mode
  const handleMapPositionSelected = (lat, lng, distance) => {
    setValue('latitude', Number(lat.toFixed(6)));
    setValue('longitude', Number(lng.toFixed(6)));
    setValue('distance_km', distance);
    setTempLat(lat);
    setTempLng(lng);
    setFormErrorMsg(distance > 0 ? '' : 'Đã ghim tọa độ, nhưng chưa tính được tuyến đường bộ thực tế từ OSRM.');
  };

  // Form submit
  const onSubmit = async (data) => {
    setSubmitLoading(true);
    setFormErrorMsg('');
    try {
      if (Number(data.distance_km) <= 0) {
        setFormErrorMsg('Vui lòng định vị nhà cung cấp và tính được tuyến đường bộ thực tế trước khi lưu.');
        setSubmitLoading(false);
        return;
      }

      if (editingSupplier) {
        await api.put(`/suppliers/${editingSupplier.id}`, data);
      } else {
        const formData = new FormData();
        Object.keys(data).forEach((key) => {
          if (data[key] !== null && data[key] !== undefined) {
            formData.append(key, data[key]);
          }
        });
        
        const result = await createSupplierAction(formData);
        if (!result.success) {
          setFormErrorMsg(result.error);
          setSubmitLoading(false);
          return;
        }
      }
      setIsFormOpen(false);
      showAlert('Thành công', 'Lưu nhà cung cấp thành công!');
      loadSuppliers();
    } catch (err) {
      console.error(err);
      setFormErrorMsg(err.response?.data?.error || 'Có lỗi xảy ra khi lưu nhà cung cấp.');
    } finally {
      setSubmitLoading(false);
    }
  };

  // Delete
  const handleDeleteClick = (supplierId, name) => {
    showConfirm(
      'Xác nhận Xóa',
      `Bạn có chắc muốn ẩn nhà cung cấp "${name}"?`,
      async () => {
        try {
          await api.delete(`/suppliers/${supplierId}`);
          showAlert('Thành công', 'Đã xóa nhà cung cấp thành công.');
          loadSuppliers();
        } catch (err) {
          console.error(err);
          showAlert('Lỗi', err.response?.data?.error || 'Không thể xóa nhà cung cấp.');
        }
      }
    );
  };

  // Filter
  const filteredSuppliers = suppliers.filter(s => {
    return (
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.contact_person?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.address?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            Định vị & Quản lý Nhà cung cấp
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Xem vị trí nhà cung cấp trên bản đồ, tính toán cự ly vận chuyển đường bộ và cập nhật thông tin liên hệ.
          </p>
        </div>
        
        {isAdmin && (
          <button
            onClick={handleAddClick}
            className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-750 active:scale-[0.98] transition-all cursor-pointer"
          >
            <Plus className="h-4.5 w-4.5" />
            Thêm nhà cung cấp
          </button>
        )}
      </div>

      {/* Warehouse Info Banner Card */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900/30 shadow-sm backdrop-blur-md">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 border border-indigo-500/20">
          <Warehouse className="h-5.5 w-5.5" />
        </div>
        <div className="space-y-0.5">
          <p className="text-sm font-bold text-slate-800 dark:text-white">Vị trí trung tâm: Tổng kho Bách Hóa Xanh</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-4">
            Được định vị tại <b>Quận 10, Thành phố Hồ Chí Minh</b> (Tọa độ GPS: <span className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold">10.762622, 106.660172</span>).
            Mọi tuyến đường giao thông đường bộ và cự ly vận tải (km) hiển thị dưới đây đều lấy tổng kho làm điểm xuất phát.
          </p>
        </div>
      </div>

      {/* Main Split Screen Layout */}
      <div className="grid gap-6 lg:grid-cols-12">
        
        {/* Left Side: Supplier List (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 dark:text-slate-500">
              <Search className="h-4 w-4" />
            </span>
            <input
              type="text"
              placeholder="Tìm theo tên nhà cung cấp, địa chỉ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/30 py-2 pr-3 pl-10 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:border-indigo-500/80 focus:outline-none shadow-sm"
            />
          </div>

          {loading ? (
            <div className="flex h-96 flex-col items-center justify-center gap-2 rounded-xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900/10">
              <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
              <span className="text-xs text-slate-500">Đang tải danh sách nhà cung cấp...</span>
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="flex h-96 flex-col items-center justify-center gap-2 rounded-xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900/10 text-center p-4">
              <Info className="h-6 w-6 text-slate-400" />
              <span className="text-xs text-slate-500">Không tìm thấy đối tác nào.</span>
            </div>
          ) : (
            <div className="space-y-3 max-h-[390px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
              {filteredSuppliers.map((sup) => {
                const isSelected = selectedSupplier && selectedSupplier.id === sup.id;
                return (
                  <div
                    key={sup.id}
                    onClick={() => setSelectedSupplier(sup)}
                    className={`relative rounded-xl border p-4 cursor-pointer transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm ${
                      isSelected
                        ? 'border-indigo-500/40 bg-indigo-500/5 dark:bg-indigo-650/5'
                        : 'border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900/10'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="space-y-1">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{sup.name}</h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <User className="h-3 w-3 text-slate-400" />
                          Đại diện: {sup.contact_person || '—'}
                        </p>
                      </div>
                      
                      {sup.distance_km && (
                        <span className="inline-flex items-center gap-1 rounded bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                          <Navigation className="h-2.5 w-2.5" />
                          {sup.distance_km} km
                        </span>
                      )}
                    </div>

                    <p className="mt-2.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-1 flex items-center gap-1.5">
                      <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                      {sup.address || '—'}
                    </p>

                    {/* Action buttons inside card */}
                    <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800/40 pt-2.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDetailClick(sup);
                        }}
                        title="Xem chi tiết"
                        className="rounded p-1 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      
                      {isAdmin && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditClick(sup);
                            }}
                            title="Sửa"
                            className="rounded p-1 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-500 dark:hover:text-blue-400"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(sup.id, sup.name);
                            }}
                            title="Ẩn"
                            className="rounded p-1 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-red-500 dark:hover:text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Leaflet Routing Map (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col h-[450px]">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-900 pb-2 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Bản đồ định vị & Tuyến đường Logistics (OSRM)
            </span>
            {selectedSupplier && selectedSupplier.latitude && (
              <span className="text-[11px] text-indigo-600 dark:text-indigo-400 flex items-center gap-1 font-semibold">
                <Navigation className="h-3 w-3" />
                Đường bộ thực tế: {selectedSupplier.distance_km} km
              </span>
            )}
          </div>
          
          <SupplierMap
            mode="view"
            suppliers={suppliers}
            selectedSupplier={selectedSupplier}
          />
        </div>
      </div>

      {/* Supplier Detail Modal */}
      {isDetailOpen && detailSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg rounded-xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-6 shadow-2xl relative text-slate-800 dark:text-slate-200">
            <button
              onClick={() => setIsDetailOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-650 dark:hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                <Warehouse className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Chi tiết nhà cung cấp
                </h3>
                <p className="text-[11px] text-slate-400 font-medium font-mono uppercase">ID: #{detailSupplier.id}</p>
              </div>
            </div>

            <div className="space-y-3.5 text-sm">
              <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-2.5">
                <span className="text-slate-400 text-xs font-semibold uppercase shrink-0">Tên đối tác:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 text-right pl-4">{detailSupplier.name}</span>
              </div>
              
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2.5">
                <span className="text-slate-400 text-xs font-semibold uppercase">Người đại diện:</span>
                <span className="text-slate-700 dark:text-slate-300 font-medium flex items-center gap-1">
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  {detailSupplier.contact_person || '—'}
                </span>
              </div>

              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2.5">
                <span className="text-slate-400 text-xs font-semibold uppercase">Điện thoại:</span>
                <span className="text-slate-700 dark:text-slate-300 font-mono flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  {detailSupplier.phone || '—'}
                </span>
              </div>

              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2.5">
                <span className="text-slate-400 text-xs font-semibold uppercase">Email liên hệ:</span>
                <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  {detailSupplier.email || '—'}
                </span>
              </div>

              <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-2.5">
                <span className="text-slate-400 text-xs font-semibold uppercase shrink-0">Địa chỉ kho hàng:</span>
                <span className="text-slate-700 dark:text-slate-300 text-right pl-4">{detailSupplier.address || '—'}</span>
              </div>

              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2.5">
                <span className="text-slate-400 text-xs font-semibold uppercase">Cự ly thực tế (OSRM):</span>
                <span className="text-teal-600 dark:text-teal-400 font-bold flex items-center gap-1">
                  <Navigation className="h-3.5 w-3.5" />
                  {detailSupplier.distance_km ? `${detailSupplier.distance_km} km` : '—'}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-xs font-semibold uppercase">Tọa độ GPS:</span>
                <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400">
                  {detailSupplier.latitude && detailSupplier.longitude 
                    ? `${detailSupplier.latitude.toFixed(6)}, ${detailSupplier.longitude.toFixed(6)}` 
                    : 'Chưa xác định'}
                </span>
              </div>
            </div>

            <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-4">
              <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
                <Warehouse className="h-4 w-4 text-indigo-500" />
                Sản phẩm cung cấp
              </h4>
              
              {loadingProducts ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
                </div>
              ) : detailProducts.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                  Nhà cung cấp này chưa cung cấp sản phẩm nào.
                </p>
              ) : (
                <div className="max-h-40 overflow-y-auto pr-1 space-y-2 scrollbar-thin">
                  {detailProducts.map(prod => (
                    <div key={prod.id} className="flex justify-between items-center p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{prod.name}</span>
                        <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400">{prod.product_code}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(prod.unit_price)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setIsDetailOpen(false)}
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-5 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors cursor-pointer"
              >
                Đóng lại
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Supplier Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-4xl rounded-xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-6 shadow-2xl my-8 relative text-slate-800 dark:text-slate-200">
            <button
              onClick={() => setIsFormOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-650 dark:hover:text-white z-50"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">
              {editingSupplier ? 'Chỉnh sửa thông tin đối tác' : 'Đăng ký nhà cung cấp mới'}
            </h3>

            {formErrorMsg && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3.5 text-sm text-red-650 dark:text-red-400">
                <AlertCircle className="h-5 w-5" />
                <p className="font-medium">{formErrorMsg}</p>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-12">
                
                {/* Inputs Panel (5 Cols) */}
                <div className="lg:col-span-5 space-y-4">
                  {/* Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Tên nhà cung cấp *
                    </label>
                    <input
                      {...register('name')}
                      type="text"
                      placeholder="Tên đối tác (ví dụ: CP Food)"
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-2 px-3 text-sm text-slate-800 dark:text-slate-200 focus:border-indigo-500/80 focus:outline-none"
                    />
                    {errors.name && (
                      <p className="text-xs text-red-500 dark:text-red-400">{errors.name.message}</p>
                    )}
                  </div>

                  {/* Representative Person */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Người đại diện liên hệ *
                    </label>
                    <input
                      {...register('contact_person')}
                      type="text"
                      placeholder="Họ và tên người đại diện"
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-2 px-3 text-sm text-slate-800 dark:text-slate-200 focus:border-indigo-500/80 focus:outline-none"
                    />
                    {errors.contact_person && (
                      <p className="text-xs text-red-500 dark:text-red-400">{errors.contact_person.message}</p>
                    )}
                  </div>

                  {/* Contact Number */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Số điện thoại liên lạc *
                    </label>
                    <input
                      {...register('phone')}
                      type="text"
                      placeholder="Số hotline hoặc di động"
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-2 px-3 text-sm text-slate-800 dark:text-slate-200 focus:border-indigo-500/80 focus:outline-none"
                    />
                    {errors.phone && (
                      <p className="text-xs text-red-500 dark:text-red-400">{errors.phone.message}</p>
                    )}
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Địa chỉ Email *
                    </label>
                    <input
                      {...register('email')}
                      type="email"
                      placeholder="doitac@gmail.com"
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-2 px-3 text-sm text-slate-800 dark:text-slate-200 focus:border-indigo-500/80 focus:outline-none"
                    />
                    {errors.email && (
                      <p className="text-xs text-red-500 dark:text-red-400">{errors.email.message}</p>
                    )}
                  </div>

                  {/* Physical Address with search geocode button */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Địa chỉ văn phòng/kho *
                    </label>
                    <div className="flex gap-2">
                      <input
                        {...register('address')}
                        type="text"
                        placeholder="Số nhà, Tên đường, Tỉnh/Thành phố"
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-2 px-3 text-sm text-slate-800 dark:text-slate-200 focus:border-indigo-500/80 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleGeocodeAddress}
                        disabled={geocoding}
                        className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-850 hover:bg-slate-200 dark:hover:bg-slate-800 px-3 text-xs font-semibold text-slate-700 dark:text-white border border-slate-300 dark:border-slate-700 disabled:opacity-50 transition-colors"
                      >
                        {geocoding ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <MapPin className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
                        )}
                        Định vị
                      </button>
                    </div>
                    {errors.address && (
                      <p className="text-xs text-red-500 dark:text-red-400">{errors.address.message}</p>
                    )}
                  </div>

                  {/* Latitude & Longitude */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Vĩ độ (Lat)
                      </label>
                      <input
                        {...register('latitude')}
                        type="number"
                        step="any"
                        readOnly
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 py-2 px-3 text-xs text-slate-500 dark:text-slate-400 focus:outline-none cursor-not-allowed"
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Kinh độ (Lng)
                      </label>
                      <input
                        {...register('longitude')}
                        type="number"
                        step="any"
                        readOnly
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 py-2 px-3 text-xs text-slate-500 dark:text-slate-400 focus:outline-none cursor-not-allowed"
                      />
                    </div>
                  </div>

                  {/* Distance (calculated from OSRM) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Khoảng cách vận chuyển đường bộ (km)
                    </label>
                    <input
                      {...register('distance_km')}
                      type="number"
                      step="any"
                      readOnly
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 py-2 px-3 text-sm text-teal-600 dark:text-teal-400 font-bold focus:outline-none cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Map Selection Panel (7 Cols) */}
                <div className="lg:col-span-7 flex flex-col h-[400px] lg:h-[500px]">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                    Bản đồ chọn vị trí
                  </span>
                  
                  <SupplierMap
                    mode="select"
                    selectedLat={tempLat}
                    selectedLng={tempLng}
                    onPositionSelected={handleMapPositionSelected}
                  />
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
                  className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-750 active:bg-indigo-850 disabled:opacity-50 cursor-pointer"
                >
                  {submitLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Lưu thông tin</span>
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
