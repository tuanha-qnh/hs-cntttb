/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Search, RefreshCw, BarChart2, CheckCircle2, AlertCircle, Database, 
  HelpCircle, ChevronRight, Filter, Download, User as UserIcon, Calendar, Info
} from 'lucide-react';

interface UnifiedRecord {
  So_thue_bao: string;
  Tap_thue_bao: string;
  IsUpdated: boolean;
  User_capnhat?: string | null;
  Ma_hrm_CN?: string | null;
  Kenh_CN?: string | null;
  Ngay_CN?: string | null;
}

export default function SubscriberUpdateLookupModule() {
  const [records, setRecords] = useState<UnifiedRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search and filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'updated' | 'pending'>('all');
  const [batchFilter, setBatchFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Real-time lookup modal/box
  const [lookupPhone, setLookupPhone] = useState('');
  const [lookupResult, setLookupResult] = useState<any | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const fetchDatabase = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/subscriber-status/list');
      if (!resp.ok) {
        throw new Error('Không thể kết nối danh sách CSDL D1. Vui lòng kiểm tra lại cấu hình kết nối.');
      }
      const data = await resp.json();
      if (data.success) {
        setRecords(data.records || []);
      } else {
        throw new Error(data.error || 'Lỗi không xác định.');
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi hệ thống khi tải cơ sở dữ liệu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatabase();
  }, []);

  const handlePhoneLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const phone = lookupPhone.trim();
    if (!phone) return;

    setLookupLoading(true);
    setLookupError(null);
    setLookupResult(null);

    try {
      const resp = await fetch(`/api/subscriber-status/lookup?phone=${encodeURIComponent(phone)}`);
      if (!resp.ok) {
        throw new Error('Lỗi liên kết CSDL D1.');
      }
      const data = await resp.json();
      setLookupResult(data);
      
      // Refresh the main list to show any automatic sync changes
      if (data.synchronized) {
        fetchDatabase();
      }
    } catch (err: any) {
      setLookupError(err.message || 'Lỗi hệ thống bất ngờ.');
    } finally {
      setLookupLoading(false);
    }
  };

  // Get distinct batches for filter
  const distinctBatches: string[] = Array.from(new Set<string>(records.map((r) => r.Tap_thue_bao || ""))).filter(Boolean);

  // Filtered dataset
  const filteredRecords = records.filter((r) => {
    // 1. Search term match
    const textMatch = 
      r.So_thue_bao.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
      (r.User_capnhat && r.User_capnhat.toLowerCase().includes(searchTerm.toLowerCase().trim())) ||
      (r.Ma_hrm_CN && r.Ma_hrm_CN.toLowerCase().includes(searchTerm.toLowerCase().trim())) ||
      (r.Kenh_CN && r.Kenh_CN.toLowerCase().includes(searchTerm.toLowerCase().trim()));

    // 2. Status match
    const statusMatch = 
      statusFilter === 'all' ||
      (statusFilter === 'updated' && r.IsUpdated) ||
      (statusFilter === 'pending' && !r.IsUpdated);

    // 3. Batch match
    const batchMatch = 
      batchFilter === 'all' || 
      r.Tap_thue_bao === batchFilter;

    return textMatch && statusMatch && batchMatch;
  });

  // KPI metadata calculations
  const totalInDb = records.length;
  const totalUpdatedInDb = records.filter(r => r.IsUpdated).length;
  const totalPendingInDb = totalInDb - totalUpdatedInDb;
  const completionRateInDb = totalInDb > 0 ? Math.round((totalUpdatedInDb / totalInDb) * 100) : 0;

  // Pagination bounds calculation
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredRecords.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (p: number) => {
    if (p >= 1 && p <= totalPages) {
      setCurrentPage(p);
    }
  };

  // Export CSV Helper
  const downloadCSVD1 = () => {
    if (filteredRecords.length === 0) return;
    
    // CSV Header row
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // Add BOM for Vietnamese characters
    csvContent += "STT,Số thuê bao,Tập thuê bao,Trạng thái TTTB,Cập nhật bởi,Mã HRM,Kênh cập nhật,Ngày hoàn thành\n";
    
    filteredRecords.forEach((r, idx) => {
      const statusStr = r.IsUpdated ? "ĐÃ HOÀN THÀNH" : "CHƯA CẬP NHẬT";
      const user = r.User_capnhat || "";
      const hrm = r.Ma_hrm_CN || "";
      const kenh = r.Kenh_CN || "";
      const ngay = r.Ngay_CN || "";
      
      const row = [
        idx + 1,
        `"${r.So_thue_bao}"`,
        `"${r.Tap_thue_bao}"`,
        `"${statusStr}"`,
        `"${user}"`,
        `"${hrm}"`,
        `"${kenh}"`,
        `"${ngay}"`
      ].join(",");
      
      csvContent += row + "\n";
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `CSDL_D1_Tinh_Trang_Cap_Nhat_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* KPI Stats Widgets Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50/50 rounded-full -mr-8 -mt-8 flex items-center justify-center">
            <Database className="w-10 h-10 text-slate-300" />
          </div>
          <span className="text-[10px] text-slate-400 font-sans font-bold uppercase tracking-wider">Tập CSDL (D1)</span>
          <h3 className="text-2xl font-black font-mono text-slate-800 mt-2">
            {records.length > 0 ? records.length.toLocaleString('vi-VN') : 0}
          </h3>
          <p className="text-[10px] text-slate-500 font-sans mt-1">Tổng dải số thuê bao mục tiêu</p>
        </div>

        {/* Goal Card completed */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full -mr-8 -mt-8 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-100" />
          </div>
          <span className="text-[10px] text-emerald-600 font-sans font-bold uppercase tracking-wider">Đã hoàn tất</span>
          <h3 className="text-2xl font-black font-mono text-emerald-600 mt-2">
            {totalUpdatedInDb.toLocaleString('vi-VN')}
          </h3>
          <p className="text-[10px] text-slate-500 font-sans mt-1">Ghi nhận KQ_CNTTTB thành công</p>
        </div>

        {/* Pending Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-full -mr-8 -mt-8 flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-amber-100" />
          </div>
          <span className="text-[10px] text-amber-600 font-sans font-bold uppercase tracking-wider">Chưa cập nhật</span>
          <h3 className="text-2xl font-black font-mono text-amber-600 mt-2">
            {totalPendingInDb.toLocaleString('vi-VN')}
          </h3>
          <p className="text-[10px] text-slate-500 font-sans mt-1">Cần hoàn thiện TTTB bổ sung</p>
        </div>

        {/* Rate completion percentage */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs relative overflow-hidden">
          <div className="absolute top-bg-indigo-50 right-0 w-24 h-24 bg-[#005BAA]/5 rounded-full -mr-8 -mt-8 flex items-center justify-center">
            <BarChart2 className="w-10 h-10 text-blue-100" />
          </div>
          <span className="text-[10px] text-[#005BAA] font-sans font-bold uppercase tracking-wider">Tỷ lệ tiến độ</span>
          <h3 className="text-2xl font-black font-mono text-[#005BAA] mt-2">
            {completionRateInDb}%
          </h3>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden border border-slate-200">
            <div className="bg-[#005BAA] h-full" style={{ width: `${completionRateInDb}%` }}></div>
          </div>
        </div>
      </div>

      {/* Grid: Left - Real-time lookup Checker // Right - Advanced filters & Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left column: Realtime search panel (4cols) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase font-sans flex items-center gap-1.5">
                <Search className="w-4 h-4 text-[#005BAA]" />
                TRA CỨU NHANH TRỰC TUYẾN
              </h4>
              <p className="text-[10px] text-slate-400 font-sans mt-0.5">Xác thực đồng bộ trực tiếp hai bảng trong CSDL D1</p>
            </div>

            <form onSubmit={handlePhoneLookup} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase font-sans block">
                  Số điện thoại VinaPhone *
                </label>
                <div className="flex gap-1.5">
                  <input
                    required
                    type="text"
                    placeholder="Ví dụ: 0912112233"
                    value={lookupPhone}
                    onChange={(e) => setLookupPhone(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-[#005BAA] outline-none transition-all font-sans font-bold tracking-wider"
                  />
                  <button
                    type="submit"
                    disabled={lookupLoading}
                    className="px-4 py-2 bg-[#005BAA] hover:bg-blue-600 text-white font-bold text-xs rounded-lg transition-all shadow-md cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {lookupLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    Tra cứu
                  </button>
                </div>
              </div>
            </form>

            {lookupError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 font-sans flex items-center gap-1.5 leading-relaxed">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{lookupError}</span>
              </div>
            )}

            {lookupResult && (
              <div className="p-4 bg-slate-50 border border-slate-250/80 rounded-xl space-y-3.5 animate-in fade-in duration-200">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="font-mono text-xs font-bold text-[#005BAA]">
                    {lookupPhone}
                  </span>
                  {lookupResult.found ? (
                    lookupResult.IsUpdated ? (
                      <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] font-extrabold rounded-md font-sans uppercase">
                        Đã cập nhật
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-amber-50 border border-amber-250 text-amber-700 text-[9px] font-extrabold rounded-md font-sans uppercase">
                        Chưa cập nhật
                      </span>
                    )
                  ) : (
                    <span className="px-2 py-0.5 bg-rose-50 border border-rose-200 text-rose-700 text-[9px] font-extrabold rounded-md font-sans uppercase">
                      Không tồn tại
                    </span>
                  )}
                </div>

                {lookupResult.found ? (
                  <div className="space-y-2 text-xs text-slate-700 font-sans">
                    <div className="space-y-0.5">
                      <span className="text-[9px] uppercase tracking-wider text-slate-405 font-bold block">Tập dải số mục tiêu</span>
                      <p className="font-semibold text-slate-800 text-[11px] leading-relaxed">
                        {lookupResult.Tap_thue_bao}
                      </p>
                    </div>

                    {lookupResult.IsUpdated ? (
                      <>
                        <div className="h-[1px] bg-slate-200/80 my-2"></div>
                        <div className="grid grid-cols-2 gap-3 pt-1">
                          <div className="space-y-0.5">
                            <span className="text-[9px] uppercase tracking-wider text-slate-405 font-bold block">Giao dịch viên</span>
                            <p className="font-bold text-slate-800 text-[11px] flex items-center gap-1 truncate" title={lookupResult.User_capnhat}>
                              <UserIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                              {lookupResult.User_capnhat || "N/A"}
                            </p>
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-[9px] uppercase tracking-wider text-slate-405 font-bold block">Mã HRM đại lý</span>
                            <p className="font-mono font-bold text-indigo-700 text-[11px]">
                              {lookupResult.Ma_hrm_CN || "N/A"}
                            </p>
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-[9px] uppercase tracking-wider text-slate-405 font-bold block">Kênh cập nhật</span>
                            <p className="font-bold text-slate-800 text-[11px]">
                              {lookupResult.Kenh_CN || "N/A"}
                            </p>
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-[9px] uppercase tracking-wider text-slate-405 font-bold block">Thời gian lưu</span>
                            <p className="font-mono text-slate-600 text-[10px] break-all">
                              {lookupResult.Ngay_CN || "N/A"}
                            </p>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="bg-amber-500/5 border border-amber-500/10 p-3 rounded-lg text-amber-800 text-[11px] flex items-start gap-1.5 leading-relaxed font-medium">
                        <Info className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                        <span>Hãy thực hiện cập nhật tệp thuê bao này qua module "Cập nhật TTTB" hoặc tải lên file Kết quả thực hiện qua "Upload dữ liệu".</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 font-sans font-medium text-center py-2">
                    Thuê bao không thuộc cơ sở dữ liệu dải số mục tiêu đợt này.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* User Guide Card */}
          <div className="bg-[#005BAA]/5 border border-blue-105 p-5 rounded-2xl space-y-2.5">
            <h5 className="text-xs font-bold text-[#005BAA] font-sans flex items-center gap-1.5 uppercase">
              <HelpCircle className="w-4 h-4 text-[#005BAA]" />
              Nguyên lý thiết kế đồng bộ CSDL D1
            </h5>
            <div className="text-[11px] text-slate-600 font-sans space-y-2 leading-relaxed">
              <p>
                <b>1. Tệp dải số mục tiêu (DS_TB_MUCTIEU):</b> Danh sách được duyệt cần thực hiện chuẩn hóa thông tin thuê bao (do TTKD hoặc Admin phân bổ về).
              </p>
              <p>
                <b>2. Kết quả cập nhật (KQ_CNTTTB):</b> Ghi nhận thời gian thực từ các giao dịch viên, hỗ trợ đồng bộ chéo tự động khi thực hiện hoạt động chuẩn hóa offline/online.
              </p>
            </div>
          </div>
        </div>

        {/* Right column: Filter and table with search (8cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
            
            {/* Table Filters Toolbar header */}
            <div className="p-4 bg-slate-50/50 border-b border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="w-full md:max-w-xs relative">
                <input
                  type="text"
                  placeholder="Tìm số máy, user, mã hrm, kênh..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#005BAA] font-sans transition-all"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>

              {/* Badges status action / filters */}
              <div className="w-full md:w-auto flex flex-wrap items-center gap-2">
                <div className="flex border border-slate-200 bg-white p-1 rounded-lg text-xs font-bold gap-0.5 shadow-3xs">
                  <button
                    onClick={() => { setStatusFilter('all'); setCurrentPage(1); }}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer text-[11px] ${
                      statusFilter === 'all' ? 'bg-[#005BAA] text-white' : 'text-slate-500 hover:text-slate-850'
                    }`}
                  >
                    Tất cả
                  </button>
                  <button
                    onClick={() => { setStatusFilter('updated'); setCurrentPage(1); }}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer text-[11px] flex items-center gap-1 ${
                      statusFilter === 'updated' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-slate-850'
                    }`}
                  >
                    ● Đã CN
                  </button>
                  <button
                    onClick={() => { setStatusFilter('pending'); setCurrentPage(1); }}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer text-[11px] flex items-center gap-1 ${
                      statusFilter === 'pending' ? 'bg-amber-600 text-white' : 'text-slate-500 hover:text-slate-850'
                    }`}
                  >
                    ● Chưa CN
                  </button>
                </div>

                {/* Batch dropdown */}
                <select
                  value={batchFilter}
                  onChange={(e) => {
                    setBatchFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-600 font-sans focus:outline-none focus:ring-1 focus:ring-blue-100 cursor-pointer shadow-3xs"
                >
                  <option value="all">Tất cả dải dán</option>
                  {distinctBatches.map((batch, idx) => (
                    <option key={idx} value={batch}>
                      {batch.length > 25 ? `${batch.substring(0, 25)}...` : batch}
                    </option>
                  ))}
                </select>

                <button
                  onClick={downloadCSVD1}
                  disabled={filteredRecords.length === 0}
                  className="px-2.5 py-1.5 text-xs bg-[#005BAA]/5 border border-blue-100 hover:bg-[#005BAA] hover:text-white transition-all text-[#005BAA] rounded-lg font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                  title="Xuất bảng dữ liệu CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  Xuất Excel
                </button>

                <button
                  onClick={fetchDatabase}
                  disabled={loading}
                  className="p-1.5 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-slate-500 hover:text-slate-800 transition-colors cursor-pointer shadow-3xs"
                  title="Tải lại danh sách"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* List Table content */}
            <div className="overflow-x-auto min-h-[400px]">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-24 text-slate-400 font-sans space-y-2">
                  <RefreshCw className="w-8 h-8 text-[#005BAA] animate-spin" />
                  <span className="text-xs font-semibold">Đang liên kết dữ liệu hệ thống D1...</span>
                </div>
              ) : error ? (
                <div className="text-center py-24 px-6 text-slate-405 font-sans space-y-1">
                  <p className="text-xs font-bold text-red-600">❌ Lỗi liên kết dịch vụ nén JSON</p>
                  <p className="text-[11px] leading-relaxed text-slate-400">{error}</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-200/80 text-slate-500 text-[10px] font-bold uppercase font-sans tracking-wider">
                      <th className="px-5 py-3 w-12 text-center">STT</th>
                      <th className="px-5 py-3">Số thuê bao VinaPhone</th>
                      <th className="px-5 py-3">Tập thuê bao</th>
                      <th className="px-5 py-3">Trạng thái</th>
                      <th className="px-5 py-3">Giao dịch viên</th>
                      <th className="px-5 py-3">Mã HRM</th>
                      <th className="px-5 py-3">Kênh giao dịch</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedData.length > 0 ? (
                      paginatedData.map((r, idx) => (
                        <tr key={idx} className="hover:bg-blue-50/25 transition-colors text-slate-700 text-xs font-sans even:bg-slate-50/20">
                          <td className="px-5 py-3.5 font-bold font-mono text-[10px] text-slate-400 text-center">
                            {String(startIndex + idx + 1).padStart(2, '0')}
                          </td>
                          <td 
                            className="px-5 py-3.5 font-mono font-bold text-slate-800 tracking-wider cursor-pointer hover:text-[#005BAA] transition-colors"
                            onClick={() => {
                              setLookupPhone(r.So_thue_bao);
                              setLookupResult({
                                found: true,
                                IsUpdated: r.IsUpdated,
                                So_thue_bao: r.So_thue_bao,
                                Tap_thue_bao: r.Tap_thue_bao,
                                User_capnhat: r.User_capnhat,
                                Ma_hrm_CN: r.Ma_hrm_CN,
                                Kenh_CN: r.Kenh_CN,
                                Ngay_CN: r.Ngay_CN,
                              });
                            }}
                          >
                            {r.So_thue_bao}
                          </td>
                          <td className="px-5 py-3.5 text-slate-500 max-w-[150px] truncate" title={r.Tap_thue_bao}>
                            {r.Tap_thue_bao}
                          </td>
                          <td className="px-5 py-3.5">
                            {r.IsUpdated ? (
                              <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 font-sans font-bold text-[9px] rounded-md uppercase">
                                Đã cập nhật
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-slate-100 border border-slate-200/50 text-slate-400 font-sans font-medium text-[9px] rounded-md uppercase">
                                Chưa cập nhật
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 font-sans font-bold text-slate-650 truncate max-w-[120px]" title={r.User_capnhat || ""}>
                            {r.User_capnhat || <span className="text-slate-350 font-medium italic">Chưa có</span>}
                          </td>
                          <td className="px-5 py-3.5 font-mono text-xs font-semibold text-indigo-700">
                            {r.Ma_hrm_CN || "-"}
                          </td>
                          <td className="px-5 py-3.5 font-sans text-slate-500 text-[11px] font-medium">
                            {r.Kenh_CN || "-"}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="text-center py-20 text-slate-400 font-sans font-medium text-xs">
                          Không tìm thấy số thuê bao có trạng thái phù hợp.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination footer block */}
            {totalPages > 1 && !loading && (
              <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-150 flex items-center justify-between text-xs font-sans text-slate-500">
                <span>
                  Trang <strong>{currentPage}</strong> / <strong>{totalPages}</strong> (Hiển thị dải {startIndex + 1} - {Math.min(startIndex + itemsPerPage, filteredRecords.length)})
                </span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => handlePageChange(currentPage - 1)}
                    className="px-2.5 py-1 rounded bg-white border border-slate-205 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-bold"
                  >
                    Trước
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    // sliding window around page
                    const startPage = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
                    return startPage + i;
                  }).filter(p => p <= totalPages).map((pageNum) => (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`px-2.5 py-1 rounded border cursor-pointer font-bold ${
                        pageNum === currentPage
                          ? 'bg-[#005BAA] text-white border-[#005BAA]'
                          : 'bg-white border-slate-205 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  ))}
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => handlePageChange(currentPage + 1)}
                    className="px-2.5 py-1 rounded bg-white border border-slate-205 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-bold"
                  >
                    Sau
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>

      </div>

    </div>
  );
}
