'use client';

import { useEffect, useState } from 'react';
import { FileSpreadsheet, Loader2, PackageSearch, Search, Warehouse } from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '@/lib/api';

const formatNumber = (value) => Number(value || 0).toLocaleString('vi-VN');

export default function InventoryPage() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const loadInventory = async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory', {
        params: lowStockOnly ? { low_stock_only: true } : {},
      });
      setInventory(res.data.inventory || []);
    } catch (error) {
      console.error('Failed to load inventory:', error);
      setInventory([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, [lowStockOnly]);

  const filteredInventory = inventory.filter((item) => {
    const term = search.toLowerCase();
    return (
      item.product_code?.toLowerCase().includes(term) ||
      item.product_name?.toLowerCase().includes(term) ||
      item.category?.toLowerCase().includes(term)
    );
  });

  const exportExcel = () => {
    const rows = filteredInventory.map((item, index) => ({
      STT: index + 1,
      'Mã SP': item.product_code,
      'Tên sản phẩm': item.product_name,
      'Danh mục': item.category,
      'Đơn vị': item.unit,
      'Tổng nhập': item.total_imported,
      'Tổng xuất': item.total_exported,
      'Tồn hiện tại': item.current_stock,
      'Ngưỡng tối thiểu': item.min_stock,
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'BaoCaoTonKho');
    XLSX.writeFile(workbook, `Bao_Cao_Ton_Kho_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500 text-white shadow-lg shadow-cyan-200">
              <Warehouse className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Tồn kho hiện tại</h1>
              <p className="text-sm text-slate-500">Hiển thị số lượng tồn real-time của từng sản phẩm trong kho.</p>
            </div>
          </div>

          <button
            onClick={exportExcel}
            disabled={filteredInventory.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700 disabled:opacity-50 disabled:shadow-none"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Xuất Excel
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm theo mã, tên sản phẩm hoặc danh mục..."
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
          />
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-600">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(event) => setLowStockOnly(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
          />
          Chỉ xem tồn thấp
        </label>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex h-56 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
          </div>
        ) : filteredInventory.length === 0 ? (
          <div className="flex h-56 flex-col items-center justify-center gap-2 text-center text-slate-500">
            <PackageSearch className="h-10 w-10 text-slate-300" />
            <p className="text-sm font-semibold">Chưa có dữ liệu tồn kho phù hợp</p>
            <p className="text-xs">Dữ liệu sẽ xuất hiện sau khi có phiếu nhập/xuất hoàn tất.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-sm text-slate-600">
                <tr>
                  <th className="px-4 py-4">Mã SP</th>
                  <th className="px-4 py-4">Tên sản phẩm</th>
                  <th className="px-4 py-4">Danh mục</th>
                  <th className="px-4 py-4">Đơn vị</th>
                  <th className="px-4 py-4 text-right">Tổng nhập</th>
                  <th className="px-4 py-4 text-right">Tổng xuất</th>
                  <th className="px-4 py-4 text-right">Tồn hiện tại</th>
                  <th className="px-4 py-4 text-right">Ngưỡng tối thiểu</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map((item) => {
                  const isLow = Number(item.current_stock || 0) < Number(item.min_stock || 0);
                  return (
                    <tr key={item.product_id} className="border-t border-slate-100 hover:bg-slate-50/70">
                      <td className="px-4 py-4 font-mono text-xs font-semibold text-cyan-700">{item.product_code}</td>
                      <td className="px-4 py-4 font-semibold text-slate-800">{item.product_name}</td>
                      <td className="px-4 py-4 text-slate-500">{item.category || '-'}</td>
                      <td className="px-4 py-4 text-slate-500">{item.unit || '-'}</td>
                      <td className="px-4 py-4 text-right text-slate-700">{formatNumber(item.total_imported)}</td>
                      <td className="px-4 py-4 text-right text-slate-700">{formatNumber(item.total_exported)}</td>
                      <td className={`px-4 py-4 text-right font-bold ${isLow ? 'text-red-600' : 'text-emerald-600'}`}>
                        {formatNumber(item.current_stock)}
                      </td>
                      <td className="px-4 py-4 text-right text-slate-500">{formatNumber(item.min_stock)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
