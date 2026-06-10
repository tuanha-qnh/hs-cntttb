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
  Ma_donvi?: string | null;
  Ten_donvi?: string | null;
  IsUpdated: boolean;
  User_capnhat?: string | null;
  Ma_hrm_CN?: string | null;
  Kenh_CN?: string | null;
  Ngay_CN?: string | null;
}

interface SubscriberUpdateLookupModuleProps {
  cloudflareConfig?: {
    enabled: boolean;
    workerUrl: string;
    apiSecret: string;
  };
}

export default function SubscriberUpdateLookupModule({ cloudflareConfig }: SubscriberUpdateLookupModuleProps) {
  const [records, setRecords] = useState<UnifiedRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingLocalFallback, setUsingLocalFallback] = useState(false);
  const [hadCloudError, setHadCloudError] = useState(false);

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
    setHadCloudError(false);
    
    const isCloud = cloudflareConfig?.enabled && cloudflareConfig?.workerUrl;

    try {
      const baseUrl = isCloud ? cloudflareConfig.workerUrl.trim().replace(/\/+$/, '') : '';
      const endpoint = `${baseUrl}/api/subscriber-status/list`;

      const headers: Record<string, string> = {};
      if (isCloud && cloudflareConfig?.apiSecret) {
        headers['x-api-secret'] = cloudflareConfig.apiSecret;
      }

      const resp = await fetch(endpoint, { headers });
      if (!resp.ok) {
        const errorText = await resp.text().catch(() => '');
        let parsedErr;
        try { parsedErr = JSON.parse(errorText); } catch(e) {}
        const errMsg = parsedErr?.error || errorText || 'Không thể kết nối danh sách CSDL D1. Kiểm tra lại cấu hình liên kết.';
        throw new Error(errMsg);
      }
      const data = await resp.json();
      if (data.success) {
        setRecords(data.records || []);
        setUsingLocalFallback(false);
      } else {
        throw new Error(data.error || 'Lỗi không xác định.');
      }
    } catch (err: any) {
      console.warn("Lỗi tải từ nguồn chính, tự động thử phương án CSDL dự phòng máy chủ local:", err);
      
      // Automatic silent / friendly fallback to local database
      try {
        const localResp = await fetch('/api/subscriber-status/list');
        if (localResp.ok) {
          const localData = await localResp.json();
          if (localData.success) {
            setRecords(localData.records || []);
            setUsingLocalFallback(true);
            if (isCloud) {
              setHadCloudError(true);
            }
            return;
          }
        }
      } catch (localErr: any) {
        console.error("Local fallback also failed:", localErr);
      }

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
      const isCloud = cloudflareConfig?.enabled && cloudflareConfig?.workerUrl;
      const baseUrl = isCloud ? cloudflareConfig.workerUrl.trim().replace(/\/+$/, '') : '';
      const endpoint = `${baseUrl}/api/subscriber-status/lookup?phone=${encodeURIComponent(phone)}`;

      const headers: Record<string, string> = {};
      if (isCloud && cloudflareConfig?.apiSecret) {
        headers['x-api-secret'] = cloudflareConfig.apiSecret;
      }

      const resp = await fetch(endpoint, { headers });
      if (!resp.ok) {
        const errorText = await resp.text().catch(() => '');
        let parsedErr;
        try { parsedErr = JSON.parse(errorText); } catch(e) {}
        const errMsg = parsedErr?.error || errorText || 'Lỗi liên kết CSDL D1.';
        throw new Error(errMsg);
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
    csvContent += "STT,Số thuê bao,Tập thuê bao,Mã đơn vị mục tiêu,Tên đơn vị chỉ tiêu,Trạng thái TTTB,Cập nhật bởi,Mã HRM,Kênh cập nhật,Ngày hoàn thành\n";
    
    filteredRecords.forEach((r, idx) => {
      const statusStr = r.IsUpdated ? "ĐÃ HOÀN THÀNH" : "CHƯA CẬP NHẬT";
      const user = r.User_capnhat || "";
      const hrm = r.Ma_hrm_CN || "";
      const kenh = r.Kenh_CN || "";
      const ngay = r.Ngay_CN || "";
      const ma_dv = r.Ma_donvi || "";
      const ten_dv = r.Ten_donvi || "";
      
      const row = [
        idx + 1,
        `"${r.So_thue_bao}"`,
        `"${r.Tap_thue_bao}"`,
        `"${ma_dv}"`,
        `"${ten_dv}"`,
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
      
      {/* CLOUDFLARE FALLBACK EXPLANATIVE BANNER */}
      {hadCloudError && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 flex items-start gap-3 shadow-2xs">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
          <div className="text-xs font-sans">
            <h4 className="font-bold text-amber-950 uppercase">Kết nối CSDL Đám mây Worker tạm gián đoạn</h4>
            <p className="mt-1 font-medium leading-relaxed">
              Hệ thống đã tự động kích hoạt tính năng <strong className="text-amber-950">Dự phòng dữ liệu Offline (CSDL máy chủ local)</strong> để các tác vụ tra cứu & báo cáo luôn sẵn sàng.
            </p>
            <p className="mt-1 text-slate-500 text-[11px]">
              Vui lòng kiểm tra lại cấu hình kết nối Cloudflare Worker nếu bạn muốn sử dụng đồng bộ đám mây trực tuyến.
            </p>
          </div>
        </div>
      )}

      {/* KPI Stats Widgets Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

      {/* Centered Search Panel */}
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-205 shadow-sm space-y-5">
          <div className="text-center space-y-2 border-b border-slate-100 pb-4">
            <div className="inline-flex p-3 bg-[#005BAA]/5 text-[#005BAA] rounded-full">
              <Search className="w-6 h-6 text-[#005BAA]" />
            </div>
            <h4 className="text-sm font-extrabold text-slate-800 uppercase font-sans">
              HỆ THỐNG TRA CỨU KẾT QUẢ CHUẨN HÓA TTTB
            </h4>
            <p className="text-xs text-slate-400 font-sans max-w-md mx-auto leading-relaxed">
              Nhập số thuê bao VinaPhone để tra cứu nhanh tiến độ cập nhật thông tin trong cơ sở dữ liệu dải số mục tiêu trực tuyến.
            </p>
          </div>

          <form onSubmit={handlePhoneLookup} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase font-sans tracking-wide block">
                Số máy VinaPhone cần kiểm tra *
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  required
                  type="text"
                  placeholder="Ví dụ: 0912112233, 84913..."
                  value={lookupPhone}
                  onChange={(e) => setLookupPhone(e.target.value)}
                  className="w-full text-sm px-4 py-3 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-105 focus:border-[#005BAA] outline-none transition-all font-sans font-bold tracking-widest text-[#005BAA]"
                />
                <button
                  type="submit"
                  disabled={lookupLoading}
                  className="px-6 py-3 bg-[#005BAA] hover:bg-blue-600 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 shrink-0"
                >
                  {lookupLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span>TRA CỨU TRẠNG THÁI</span>
                </button>
              </div>
            </div>
          </form>

          {lookupError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-sans flex items-start gap-2 animate-in slide-in-from-top-2 duration-200">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
              <div className="space-y-1">
                <p className="font-bold">Đã xảy ra lỗi thực thi:</p>
                <p>{lookupError}</p>
              </div>
            </div>
          )}

          {lookupResult && (
            <div className="p-5 bg-slate-50/70 border border-slate-205 rounded-2xl space-y-4 animate-in fade-in duration-300">
              <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#005BAA]"></span>
                  <span className="font-mono text-sm font-extrabold text-[#005BAA] tracking-wider">
                    {lookupPhone}
                  </span>
                </div>
                {lookupResult.found ? (
                  lookupResult.IsUpdated ? (
                    <span className="px-3 py-1 bg-emerald-50 border border-emerald-250 text-emerald-700 text-[10px] font-extrabold rounded-lg font-sans uppercase tracking-wider">
                      Đã hoàn thành cập nhật
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-amber-50 border border-amber-250 text-amber-700 text-[10px] font-extrabold rounded-lg font-sans uppercase tracking-wider">
                      Chưa cập nhật TTTB
                    </span>
                  )
                ) : (
                  <span className="px-3 py-1 bg-rose-50 border border-rose-250 text-rose-705 text-[10px] font-extrabold rounded-lg font-sans uppercase tracking-wider">
                    Không thuộc tập KH mục tiêu
                  </span>
                )}
              </div>

              {lookupResult.found ? (
                <div className="space-y-3 text-xs text-slate-700 font-sans">
                  <div className="bg-white p-3.5 rounded-xl border border-slate-150 space-y-2.5">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-slate-404 font-black block">Phần phân tập chỉ tiêu</span>
                      <p className="font-bold text-slate-800 text-xs mt-0.5 leading-relaxed">
                        {lookupResult.Tap_thue_bao}
                      </p>
                    </div>
                    {(lookupResult.Ma_donvi || lookupResult.Ten_donvi) && (
                      <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                        {lookupResult.Ma_donvi && (
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Mã đơn vị chỉ tiêu</span>
                            <p className="font-mono font-bold text-slate-700 text-xs mt-0.5">{lookupResult.Ma_donvi}</p>
                          </div>
                        )}
                        {lookupResult.Ten_donvi && (
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Tên đơn vị phụ trách</span>
                            <p className="font-sans font-bold text-slate-700 text-xs mt-0.5">{lookupResult.Ten_donvi}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {lookupResult.IsUpdated ? (
                    <div className="bg-white p-4 rounded-xl border border-slate-150 space-y-3">
                      <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-black">Chi tiết hoàn thành đồng bộ</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Giao dịch viên thực hiện</span>
                          <p className="font-bold text-slate-800 text-xs flex items-center gap-1.5 font-sans">
                            <UserIcon className="w-3.5 h-3.5 text-blue-500" />
                            {lookupResult.User_capnhat || "N/A"}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Mã HRM điểm bán</span>
                          <p className="font-mono font-bold text-indigo-700 text-xs">
                            {lookupResult.Ma_hrm_CN || "N/A"}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Kênh giao dịch cập nhật</span>
                          <p className="font-bold text-slate-800 text-xs">
                            {lookupResult.Kenh_CN || "N/A"}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Thời gian lưu mây</span>
                          <p className="font-mono text-slate-600 text-[11px]">
                            {lookupResult.Ngay_CN || "N/A"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200/60 p-4 rounded-xl text-amber-900 text-xs flex items-start gap-2.5 leading-relaxed font-sans font-medium">
                      <Info className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" />
                      <div>
                        <p className="font-bold text-amber-950 mb-1">Thuê bao này chưa chuẩn hóa!</p>
                        <span>Hãy thực hiện cập nhật thông tin cho thuê bao qua chức năng offline tại ứng dụng, hoặc nạp file Excel Kết Quả thực hiện mới qua tab "Tải dữ liệu lên cơ sở dữ liệu".</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-slate-100 p-4 rounded-xl text-center text-slate-500 text-xs font-sans font-medium py-6">
                  Số thuê bao <strong className="text-slate-800 font-mono tracking-wider">{lookupPhone}</strong> hiện không nằm trong danh sách các dải số mục tiêu đợt chuẩn hóa này.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Informative description block */}
        <div className="bg-[#005BAA]/5 border border-blue-150 p-6 rounded-2xl flex items-start gap-4 shadow-3xs">
          <div className="p-2 bg-[#005BAA] text-white rounded-xl shrink-0">
            <Database className="w-5 h-5 animate-pulse" />
          </div>
          <div className="space-y-1.5 font-sans">
            <h5 className="text-xs font-extrabold text-[#005BAA] uppercase tracking-wider">
              NGUYÊN LÝ HOẠT ĐỘNG TRA CỨU LIÊN KẾT D1
            </h5>
            <p className="text-xs text-slate-600 leading-relaxed font-sans font-medium">
              CSDL D1 trên mây lưu trữ đồng thời hai bảng dữ liệu độc lập: <strong>DS_TB_MUCTIEU</strong> (Tập chỉ tiêu ban đầu) và <strong>KQ_CNTTTB</strong> (Kết quả cập nhật). Chức năng tra cứu giúp đối soát đồng thời cả hai bảng và tính toán các chỉ số thống kê tổng hợp của toàn tỉnh tức thời.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
