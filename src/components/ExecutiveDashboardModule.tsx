/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  BarChart3, CheckCircle2, AlertCircle, RefreshCw, Sliders, Filter, 
  Building2, Target, Download, Grid, Award, HelpCircle, ArrowUpRight, CheckSquare,
  Calendar, TrendingUp
} from 'lucide-react';
import { getBrowserUnifiedRecords } from '../browserDb';

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

interface ExecutiveDashboardModuleProps {
  cloudflareConfig?: {
    enabled: boolean;
    workerUrl: string;
    apiSecret: string;
  };
}

// Group classifier based on instructions
export function classifyGroup(tapStr: string): 'KHDN' | 'CMND 9 số' | 'CCCD 12 số' | 'Sai giấy tờ' {
  const norm = (tapStr || '').toLowerCase().trim();
  if (norm.includes('khdn') || norm.includes('doanh nghiệp') || norm.includes('doanh nghiep') || norm === 'khdn') {
    return 'KHDN';
  }
  if (norm.includes('9 số') || norm.includes('9 so') || norm.includes('cmnd') || norm.includes('chứng minh')) {
    return 'CMND 9 số';
  }
  if (norm.includes('12 số') || norm.includes('12 so') || norm.includes('cccd') || norm.includes('căn cước') || norm.includes('can cuoc')) {
    return 'CCCD 12 số';
  }
  return 'Sai giấy tờ';
}

export default function ExecutiveDashboardModule({ cloudflareConfig }: ExecutiveDashboardModuleProps) {
  const [records, setRecords] = useState<UnifiedRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingLocalFallback, setUsingLocalFallback] = useState(false);
  const [hadCloudError, setHadCloudError] = useState(false);

  // Filters and sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<'all' | 'KHDN' | 'CMND 9 số' | 'CCCD 12 số' | 'Sai giấy tờ'>('all');
  const [minTargetFilter, setMinTargetFilter] = useState<number>(0);
  const [sortField, setSortField] = useState<'name' | 'target' | 'completed' | 'rate'>('rate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Daily view options
  const [dailyViewMode, setDailyViewMode] = useState<'system' | 'units'>('system');
  const [selectedDailyUnit, setSelectedDailyUnit] = useState<string>('all');

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
        const errMsg = parsedErr?.error || errorText || 'Không thể liên kết dữ liệu điều hành.';
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
      console.warn("Lỗi tải từ nguồn chính, tự động thử phương án CSDL dự phòng máy chủ local hoặc trình duyệt:", err);
      
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

      // Browser local storage offline fallback
      console.warn("Both cloud and express backend API failed. Initializing offline browser-only mock/local storage engine.");
      const fallbackList = getBrowserUnifiedRecords();
      setRecords(fallbackList);
      setUsingLocalFallback(true);
      // We set hadCloudError to true to show the warning explanation banner to guide the user
      setHadCloudError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatabase();
  }, []);

  // -----------------------------------------------------------------
  // STATISTICS BY GROUPS
  // -----------------------------------------------------------------
  const groupStats = {
    'KHDN': { total: 0, completed: 0 },
    'CMND 9 số': { total: 0, completed: 0 },
    'CCCD 12 số': { total: 0, completed: 0 },
    'Sai giấy tờ': { total: 0, completed: 0 }
  };

  records.forEach(r => {
    const groupName = classifyGroup(r.Tap_thue_bao);
    if (groupStats[groupName]) {
      groupStats[groupName].total++;
      if (r.IsUpdated) {
        groupStats[groupName].completed++;
      }
    }
  });

  const totalTarget = records.length;
  const totalCompleted = records.filter(r => r.IsUpdated).length;
  const totalRemaining = totalTarget - totalCompleted;
  const overallRate = totalTarget > 0 ? Math.round((totalCompleted / totalTarget) * 1000) / 10 : 0;

  // -----------------------------------------------------------------
  // AGGREGATION BY UNITS
  // -----------------------------------------------------------------
  // Unit key is code, value holds name, totals, and separate group statistics
  const unitMap: Record<string, {
    code: string;
    name: string;
    total: number;
    completed: number;
    remaining: number;
    groups: Record<string, { total: number; completed: number }>;
  }> = {};

  records.forEach(r => {
    const code = (r.Ma_donvi || 'N/A').trim();
    const name = (r.Ten_donvi || 'Đơn vị chưa xác định / Phát sinh ngoài tập').trim();
    const groupName = classifyGroup(r.Tap_thue_bao);

    if (!unitMap[code]) {
      unitMap[code] = {
        code,
        name,
        total: 0,
        completed: 0,
        remaining: 0,
        groups: {
          'KHDN': { total: 0, completed: 0 },
          'CMND 9 số': { total: 0, completed: 0 },
          'CCCD 12 số': { total: 0, completed: 0 },
          'Sai giấy tờ': { total: 0, completed: 0 }
        }
      };
    }

    // Accumulate total
    unitMap[code].total++;
    if (r.IsUpdated) {
      unitMap[code].completed++;
    } else {
      unitMap[code].remaining++;
    }

    // Acc group
    if (unitMap[code].groups[groupName]) {
      unitMap[code].groups[groupName].total++;
      if (r.IsUpdated) {
        unitMap[code].groups[groupName].completed++;
      }
    }
  });

  // Convert map to list and filter
  const unitList = Object.values(unitMap).map(unit => {
    const rate = unit.total > 0 ? Math.round((unit.completed / unit.total) * 100) : 0;
    return { ...unit, rate };
  });

  // Apply search term and dynamic filters
  const filteredUnits = unitList.filter(u => {
    // Search match
    const matchesSearch = 
      u.name.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
      u.code.toLowerCase().includes(searchTerm.toLowerCase().trim());
      
    // Target threshold matching
    const matchesMinTarget = u.total >= minTargetFilter;

    // Matching group content if a specific group is filtered (must have at least 1 record in that group)
    const matchesGroup = selectedGroupFilter === 'all' || u.groups[selectedGroupFilter].total > 0;

    return matchesSearch && matchesMinTarget && matchesGroup;
  });

  // Sorting
  const sortedUnits = [...filteredUnits].sort((a, b) => {
    let valA: any = 0;
    let valB: any = 0;

    if (sortField === 'name') {
      valA = a.name;
      valB = b.name;
    } else if (sortField === 'target') {
      valA = a.total;
      valB = b.total;
    } else if (sortField === 'completed') {
      valA = a.completed;
      valB = b.completed;
    } else if (sortField === 'rate') {
      valA = a.rate;
      valB = b.rate;
    }

    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Rank and evaluate for summary lists
  const sortedByRate = [...unitList].filter(u => u.total >= 3).sort((a, b) => b.rate - a.rate);
  const bestPerformingUnits = sortedByRate.filter(u => u.rate >= 75).slice(0, 3);
  const slowPerformingUnits = sortedByRate.filter(u => u.rate < 40).slice(0, 3);

  // -----------------------------------------------------------------
  // DAILY PERFORMANCE COMPUTATION (BY DATE & UNIT)
  // -----------------------------------------------------------------
  const activeUpdatedRecords = records.filter(r => r.IsUpdated);
  
  const parseAndNormalizeDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return 'Khác';
    const trimmed = dateStr.trim();
    if (trimmed.includes('/')) {
      const parts = trimmed.split('/');
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${year}-${month}-${day}`;
      }
    }
    // Trích xuất phần YYYY-MM-DD
    if (trimmed.length > 10) {
      return trimmed.substring(0, 10);
    }
    return trimmed;
  };

  // Lấy ra tất cả các ngày duy nhất có cập nhật và sắp xếp tăng dần
  const availableDatesStr: string[] = Array.from(new Set<string>(
    activeUpdatedRecords
      .map(r => parseAndNormalizeDate(r.Ngay_CN))
      .filter((d: string): d is string => d !== 'Khác' && d.match(/^\d{4}-\d{2}-\d{2}$/) !== null)
  )).sort();

  // Tạo map chứa danh sách đơn vị hiện có
  const allUniqueUnits = Object.values(unitMap).map(u => ({ code: u.code, name: u.name }));

  // Tạo map lượng cập nhật theo: [unitCode][date] = count
  const dailyUnitCounts: Record<string, Record<string, number>> = {};
  allUniqueUnits.forEach(u => {
    dailyUnitCounts[u.code] = {};
    availableDatesStr.forEach(d => {
      dailyUnitCounts[u.code][d] = 0;
    });
  });

  // Gom theo tổng hệ thống: [date] = count
  const dailySystemCounts: Record<string, number> = {};
  availableDatesStr.forEach(d => {
    dailySystemCounts[d] = 0;
  });

  activeUpdatedRecords.forEach(r => {
    const uCode = (r.Ma_donvi || 'N/A').trim();
    const dStr = parseAndNormalizeDate(r.Ngay_CN);
    
    if (dStr !== 'Khác' && dailySystemCounts[dStr] !== undefined) {
      dailySystemCounts[dStr]++;
    }
    
    if (dailyUnitCounts[uCode] && dStr !== 'Khác' && dailyUnitCounts[uCode][dStr] !== undefined) {
      dailyUnitCounts[uCode][dStr]++;
    }
  });

  // Tính lũy kế và phát sinh từng ngày của Toàn hệ thống
  const systemDailyReport = availableDatesStr.map((date, idx) => {
    let cumulativeToday = 0;
    for (let i = 0; i <= idx; i++) {
      cumulativeToday += dailySystemCounts[availableDatesStr[i]];
    }
    
    let cumulativeYesterday = 0;
    for (let i = 0; i < idx; i++) {
      cumulativeYesterday += dailySystemCounts[availableDatesStr[i]];
    }

    const dailyDiff = cumulativeToday - cumulativeYesterday;

    return {
      date,
      formattedDate: date.split('-').reverse().join('/'), // DD/MM/YYYY
      cumulativeYesterday,
      cumulativeToday,
      dailyDiff,
    };
  });

  // Tính luỹ kế và phát sinh chi tiết cho Đơn vị x Ngày
  const unitDailyReport: Array<{
    date: string;
    formattedDate: string;
    unitCode: string;
    unitName: string;
    cumulativeYesterday: number;
    cumulativeToday: number;
    dailyDiff: number;
  }> = [];

  allUniqueUnits.forEach(unit => {
    availableDatesStr.forEach((date, idx) => {
      let cumulativeToday = 0;
      for (let i = 0; i <= idx; i++) {
        cumulativeToday += dailyUnitCounts[unit.code][availableDatesStr[i]] || 0;
      }

      let cumulativeYesterday = 0;
      for (let i = 0; i < idx; i++) {
        cumulativeYesterday += dailyUnitCounts[unit.code][availableDatesStr[i]] || 0;
      }

      const dailyDiff = cumulativeToday - cumulativeYesterday;

      unitDailyReport.push({
        date,
        formattedDate: date.split('-').reverse().join('/'),
        unitCode: unit.code,
        unitName: unit.name,
        cumulativeYesterday,
        cumulativeToday,
        dailyDiff,
      });
    });
  });

  const handleSort = (field: 'name' | 'target' | 'completed' | 'rate') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Export CSV function for executive report
  const handleExportCSV = () => {
    if (sortedUnits.length === 0) return;

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "STT,Mã Đơn Vị,Tên Đơn Vị,Tổng Chỉ Tiêu,Đã Hoàn Thành,Còn Lại,Tỷ Lệ Đạt (%),Chỉ Tiêu KHDN,KHDN Hoàn Thành,Chỉ Tiêu CMND 9 số,CMND 9 số Hoàn Thành,Chỉ Tiêu CCCD 12 số,CCCD 12 số Hoàn Thành,Chỉ Tiêu Sai giấy tờ,Sai giấy tờ Hoàn Thành,Đánh Giá Sơ Bộ\n";

    sortedUnits.forEach((u, index) => {
      let evaluation = "Chưa đạt tiến độ";
      if (u.rate >= 80) evaluation = "Hoàn thành xuất sắc";
      else if (u.rate >= 50) evaluation = "Đạt yêu cầu";

      const r = [
        index + 1,
        u.code,
        `"${u.name}"`,
        u.total,
        u.completed,
        u.remaining,
        `${u.rate}%`,
        u.groups['KHDN'].total,
        u.groups['KHDN'].completed,
        u.groups['CMND 9 số'].total,
        u.groups['CMND 9 số'].completed,
        u.groups['CCCD 12 số'].total,
        u.groups['CCCD 12 số'].completed,
        u.groups['Sai giấy tờ'].total,
        u.groups['Sai giấy tờ'].completed,
        `"${evaluation}"`
      ];
      csvContent += r.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Bao_Cao_Dieu_Hanh_Don_Vi_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Evaluation badges styling helper
  const getEvaluationBadgeObj = (rate: number, total: number) => {
    if (total === 0) {
      return {
        label: 'Không có chỉ tiêu',
        colorClass: 'bg-slate-100 text-slate-500 border-slate-200',
        detail: 'Đơn vị chưa nhận chỉ tiêu thuê bao mục tiêu.'
      };
    }
    if (rate >= 80) {
      return {
        label: 'Xuất sắc / Làm tốt',
        colorClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        detail: 'Học tập nhân rộng! Tỷ lệ thực hiện rất cao.'
      };
    }
    if (rate >= 50) {
      return {
        label: 'Khá / Đạt yêu cầu',
        colorClass: 'bg-amber-50 text-amber-700 border-amber-200',
        detail: 'Đạt tiến độ ổn định, cần tháo gỡ ca khó.'
      };
    }
    return {
      label: 'Chưa tốt / Chậm',
      colorClass: 'bg-rose-50 text-rose-700 border-rose-200',
      detail: 'Tiến độ rất chậm. Yêu cầu tăng cường rà soát đôn đốc.'
    };
  };

  return (
    <div className="space-y-6">
      {/* HEADER SECTION WITH REFRESH BUTTON */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h3 className="font-bold text-slate-800 text-sm font-sans uppercase tracking-wider flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#005BAA]" />
            Hệ thống Báo cáo Điều hành & Đánh giá kết quả Đơn vị
          </h3>
          <p className="text-xs text-slate-500 font-sans mt-1">
            Số liệu tự động thống kê và phân tách theo các nhóm chỉ tiêu thuê bao mục tiêu.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button 
            onClick={fetchDatabase}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Làm mới số liệu
          </button>
        </div>
      </div>

      {/* CLOUDFLARE FALLBACK EXPLANATIVE BANNER */}
      {hadCloudError && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 flex items-start gap-3 shadow-2xs">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
          <div className="text-xs font-sans">
            <h4 className="font-bold text-amber-950 uppercase">Kết nối phụ thuộc Đám mây Worker tạm gián đoạn</h4>
            <p className="mt-1 font-medium leading-relaxed">
              Hệ thống đã tự động kích hoạt tính năng <strong className="text-amber-950">Dự phòng dữ liệu Offline (CSDL máy chủ local)</strong> để báo cáo của bạn luôn sẵn sàng và hiển thị đầy đủ.
            </p>
            <p className="mt-1 text-slate-500 text-[11px]">
              Vui lòng kiểm tra lại trạng thái Worker (CORS, Endpoint URL hoặc bảo mật token x-api-secret) trong mục <span className="underline cursor-pointer opacity-90 font-bold" onClick={() => window.location.reload()}>Cấu hình hệ thống</span>.
            </p>
          </div>
        </div>
      )}

      {loading && records.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center flex flex-col items-center justify-center space-y-3">
          <div className="w-10 h-10 border-4 border-[#005BAA]/25 border-t-[#005BAA] rounded-full animate-spin"></div>
          <p className="text-xs text-slate-500 font-sans">Đang truy vấn CSDL và tính toán báo cáo điều hành...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-xs uppercase font-sans">Lỗi tải dữ liệu</h4>
            <p className="text-xs font-medium font-sans mt-0.5">{error}</p>
            <button 
              onClick={fetchDatabase}
              className="mt-3 px-3 py-1 bg-white hover:bg-red-100 border border-red-200 text-red-800 rounded-md text-xs font-bold transition-all cursor-pointer"
            >
              Thử lại ngay
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* GENERAL OVERALL KPI METRICS */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Metric 1: Total target */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between relative overflow-hidden group transition-all hover:border-slate-300">
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 font-sans uppercase tracking-widest block">TỔNG CHỈ TIÊU CHIẾN DỊCH</span>
                <p className="text-2xl font-black text-slate-800 font-mono leading-none">{totalTarget}</p>
                <p className="text-[10px] text-slate-500 font-sans">Thuê bao trong tập DS_TB_MUCTIEU</p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span className="flex items-center gap-1"><Target className="w-3.5 h-3.5 text-[#005BAA]" /> Chỉ tiêu giao phó</span>
                <span className="font-bold font-mono">100%</span>
              </div>
            </div>

            {/* Metric 2: Completed */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between relative overflow-hidden group transition-all hover:border-slate-300">
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 font-sans uppercase tracking-widest block">ĐÃ HOÀN THÀNH CẬP NHẬT</span>
                <p className="text-2xl font-black text-emerald-600 font-mono leading-none">{totalCompleted}</p>
                <p className="text-[10px] text-slate-500 font-sans">Đã đối khớp thành công KQ_CNTTTB</p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-emerald-600 font-medium">
                <span className="flex items-center gap-1"><CheckSquare className="w-3.5 h-3.5 text-emerald-500" /> Tỷ lệ đạt lũy kế</span>
                <span className="font-bold font-mono">{overallRate}%</span>
              </div>
            </div>

            {/* Metric 3: Remaining */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between relative overflow-hidden group transition-all hover:border-slate-300">
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 font-sans uppercase tracking-widest block">HỒ SƠ CÒN LẠI PHẢI THỰC HIỆN</span>
                <p className="text-2xl font-black text-amber-600 font-mono leading-none">{totalRemaining}</p>
                <p className="text-[10px] text-slate-500 font-sans">Cần khẩn trương phân khai hoàn thiện</p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span className="flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5 text-amber-500" /> Tỷ lệ tồn kho</span>
                <span className="font-bold font-mono text-amber-600">{totalTarget > 0 ? Math.round((totalRemaining / totalTarget) * 100) : 0}%</span>
              </div>
            </div>

            {/* Metric 4: General overall progress visualization */}
            <div className="bg-white p-5 rounded-2xl border border-[#005BAA]/10 shadow-xs flex flex-col justify-between bg-gradient-to-br from-white to-blue-50/20">
              <div className="space-y-2">
                <span className="text-[9px] font-bold text-[#005BAA] font-sans uppercase tracking-widest block">TIẾN ĐỘ CHUNG TOÀN HỆ THỐNG</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-[#005BAA] font-mono leading-none">{overallRate}%</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase ${
                    overallRate >= 80 ? 'bg-emerald-100 text-emerald-800' :
                    overallRate >= 50 ? 'bg-amber-100 text-amber-800' :
                    'bg-rose-100 text-rose-800'
                  }`}>
                    {overallRate >= 80 ? 'TỐT' : overallRate >= 50 ? 'ĐẠT' : 'CHẬM'}
                  </span>
                </div>
              </div>
              <div className="space-y-1.5 mt-3">
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                  <div 
                    className="h-full bg-linear-to-r from-[#005BAA] to-cyan-500 rounded-full transition-all duration-500" 
                    style={{ width: `${overallRate}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400 font-sans text-right italic font-medium">Báo cáo: {records.length > 0 ? "Tổng hợp tự động" : "Chưa có dữ liệu"}</p>
              </div>
            </div>
          </div>

          {/* DETAILED STATS BY 4 MANDATED SUBSCRIBER GROUPS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider font-sans flex items-center gap-2">
                <Grid className="w-4 h-4 text-[#005BAA]" />
                Số liệu theo 4 nhóm thuê bao mục tiêu bắt buộc
              </h4>
              <span className="text-[10px] text-slate-400 italic">Tách biệt theo cơ cấu văn bản chỉ tiêu</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {(Object.keys(groupStats) as Array<keyof typeof groupStats>).map(grp => {
                const item = groupStats[grp];
                const rate = item.total > 0 ? Math.round((item.completed / item.total) * 100) : 0;
                const remaining = item.total - item.completed;
                
                // Color mapping for groups
                let colorClass = "from-blue-500 to-[#005BAA]";
                let lightBgClass = "bg-[#005BAA]/5";
                let textAccentClass = "text-[#005BAA]";
                let groupLabel = "Nhóm Thuê bao";

                if (grp === 'KHDN') {
                  colorClass = "from-indigo-500 to-indigo-600";
                  lightBgClass = "bg-indigo-50/50";
                  textAccentClass = "text-indigo-600";
                  groupLabel = "Khách hàng Doanh nghiệp";
                } else if (grp === 'CMND 9 số') {
                  colorClass = "from-cyan-500 to-cyan-600";
                  lightBgClass = "bg-cyan-50/50";
                  textAccentClass = "text-cyan-600";
                  groupLabel = "Khớp khớp thông tin CMND 9 số";
                } else if (grp === 'CCCD 12 số') {
                  colorClass = "from-purple-500 to-purple-600";
                  lightBgClass = "bg-purple-50/50";
                  textAccentClass = "text-purple-600";
                  groupLabel = "Căn cước Công dân 12 số";
                } else {
                  colorClass = "from-rose-500 to-rose-600";
                  lightBgClass = "bg-rose-50/30";
                  textAccentClass = "text-rose-600";
                  groupLabel = "Sai lệch, rách nát hỏng giấy tờ";
                }

                return (
                  <div key={grp} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between transition-all hover:shadow-xs hover:border-slate-350">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-black border px-2 py-0.5 rounded-md ${
                          grp === 'KHDN' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                          grp === 'CMND 9 số' ? 'bg-cyan-50 text-cyan-700 border-cyan-100' :
                          grp === 'CCCD 12 số' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                          'bg-rose-50 text-rose-700 border-rose-100'
                        }`}>
                          {grp}
                        </span>
                        <span className={`text-sm font-semibold font-mono ${textAccentClass}`}>{rate}%</span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-sans mt-0.5 leading-tight">{groupLabel}</p>
                    </div>

                    {/* Progress representation */}
                    <div className="my-4">
                      {/* Interactive ring inside or pretty progress horizontal bar */}
                      <div className="w-full h-2 bg-slate-100/85 rounded-full overflow-hidden border border-slate-200/20">
                        <div 
                          className={`h-full bg-gradient-to-r ${colorClass} rounded-full`}
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center pt-3 border-t border-slate-100">
                      <div>
                        <span className="text-[9px] text-slate-400 font-sans uppercase block">CHỈ TIÊU</span>
                        <span className="text-xs font-bold text-slate-800 font-mono">{item.total}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 font-sans uppercase block text-emerald-600">ĐÃ ĐẠT</span>
                        <span className="text-xs font-bold text-emerald-600 font-mono">{item.completed}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 font-sans uppercase block text-amber-600">CÒN TỒN</span>
                        <span className="text-xs font-bold text-amber-600 font-mono">{remaining}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* VISUAL CHART AREA COMPARE */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Embedded SVG chart for comparative volumes */}
            <div className="lg:col-span-8 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#005BAA]" />
                  <h3 className="font-bold text-slate-800 text-xs font-sans uppercase tracking-wider">
                    Sản lượng chỉ tiêu & Đã cập nhật theo từng Nhóm Thuê bao
                  </h3>
                </div>
                <span className="text-[9px] text-slate-400 font-mono">Biểu đồ so sánh trực quan</span>
              </div>

              {/* Draw responsive Custom SVG chart */}
              <div className="h-[210px] w-full relative flex items-center justify-center">
                <svg viewBox="0 0 500 200" className="w-full h-full overflow-visible">
                  {/* Grid Lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
                    const y = 30 + 130 * ratio; // range from y=30 to y=160
                    return (
                      <line 
                        key={index} 
                        x1="40" 
                        y1={y} 
                        x2="480" 
                        y2={y} 
                        className="stroke-slate-100" 
                        strokeWidth="1" 
                      />
                    );
                  })}

                  {/* Render 4 Groups double columns */}
                  {Object.entries(groupStats).map(([grp, item], idx) => {
                    // Maximum scale threshold calculate
                    const maxScaleVal = Math.max(...Object.values(groupStats).map(g => g.total), 10);
                    const colWidth = 24;
                    const groupSpacing = 110;
                    const startX = 65 + idx * groupSpacing;

                    // Height calculation
                    const targetHeight = item.total > 0 ? (item.total / maxScaleVal) * 120 : 0;
                    const completedHeight = item.completed > 0 ? (item.completed / maxScaleVal) * 120 : 0;

                    // Y positions
                    const targetY = 160 - targetHeight;
                    const completedY = 160 - completedHeight;

                    // Dynamic colors
                    let targetColor = "#cbd5e1"; // Base target: light gray
                    let completedColor = "#005BAA"; // Default completed
                    
                    if (grp === 'KHDN') completedColor = "#4f46e5";
                    else if (grp === 'CMND 9 số') completedColor = "#0891b2";
                    else if (grp === 'CCCD 12 số') completedColor = "#7c3aed";
                    else if (grp === 'Sai giấy tờ') completedColor = "#e11d48";

                    return (
                      <g key={grp}>
                        {/* Target Column (Gray) */}
                        <rect 
                          x={startX} 
                          y={targetY} 
                          width={colWidth} 
                          height={targetHeight} 
                          fill={targetColor}
                          rx="3"
                          className="transition-all hover:opacity-90"
                        />
                        {/* Tooltip text for Target */}
                        <text 
                          x={startX + colWidth/2} 
                          y={targetY - 5} 
                          textAnchor="middle" 
                          className="fill-slate-400 font-mono text-[9px] font-bold"
                        >
                          {item.total}
                        </text>

                        {/* Completed Column (Colored) */}
                        <rect 
                          x={startX + colWidth + 4} 
                          y={completedY} 
                          width={colWidth} 
                          height={completedHeight} 
                          fill={completedColor}
                          rx="3"
                          className="transition-all hover:opacity-95"
                        />
                        {/* Tooltip text for Completed */}
                        <text 
                          x={startX + colWidth + colWidth/2 + 4} 
                          y={completedY - 5} 
                          textAnchor="middle" 
                          className="fill-slate-700 font-mono text-[9px] font-bold"
                          style={{ fill: completedColor }}
                        >
                          {item.completed}
                        </text>

                        {/* X-Axis labels */}
                        <text 
                          x={startX + colWidth + 2} 
                          y="180" 
                          textAnchor="middle" 
                          className="fill-slate-600 font-bold font-sans text-[10px]"
                        >
                          {grp}
                        </text>
                      </g>
                    );
                  })}

                  <line x1="30" y1="160" x2="490" y2="160" className="stroke-slate-300" strokeWidth="1.5" />
                </svg>
              </div>

              {/* Legends */}
              <div className="flex items-center justify-center gap-6 text-[10px] text-slate-500 font-sans mt-2">
                <span className="flex items-center gap-1.5"><span className="w-3.5 h-2.5 bg-slate-300 rounded" /> Chỉ tiêu mục tiêu cần thực hiện</span>
                <span className="flex items-center gap-1.5"><span className="w-3.5 h-2.5 bg-[#005BAA] rounded" /> Đã hoàn thành cập nhật thực tế</span>
              </div>
            </div>

            {/* PRELIMINARY HIGHLIGHTS & ACTION PLANNERS */}
            <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
                  <Award className="w-4 h-4 text-[#005BAA]" />
                  <h3 className="font-bold text-slate-800 text-xs font-sans uppercase tracking-wider">
                    Đánh giá thi đua nhanh
                  </h3>
                </div>

                <div className="space-y-4">
                  {/* Well Performing Units card */}
                  <div className="space-y-2">
                    <span className="text-[9px] font-bold text-emerald-600 font-sans uppercase tracking-widest block">⭐ Đơn vị làm tốt tiêu biểu</span>
                    <div className="space-y-1.5">
                      {bestPerformingUnits.length > 0 ? (
                        bestPerformingUnits.map((u, idx) => (
                          <div key={u.code} className="flex items-center justify-between text-xs bg-emerald-50/40 border border-emerald-100/50 px-2.5 py-1.5 rounded-xl">
                            <span className="font-medium text-slate-700 truncate max-w-[160px]">{u.name}</span>
                            <span className="font-bold text-emerald-600 font-mono">{u.rate}%</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-[11px] text-slate-400 font-sans">Chưa ghi nhận đơn vị nào đạt &ge; 75% hoàn thành chỉ tiêu.</p>
                      )}
                    </div>
                  </div>

                  {/* Slow Progress Units card */}
                  <div className="space-y-2 pt-2 border-t border-slate-150/50">
                    <span className="text-[9px] font-bold text-rose-500 font-sans uppercase tracking-widest block">⚠️ Đôn đốc khẩn tiến độ chậm</span>
                    <div className="space-y-1.5">
                      {slowPerformingUnits.length > 0 ? (
                        slowPerformingUnits.map((u, idx) => (
                          <div key={u.code} className="flex items-center justify-between text-xs bg-rose-50/40 border border-rose-100/40 px-2.5 py-1.5 rounded-xl">
                            <span className="font-medium text-slate-700 truncate max-w-[160px]">{u.name}</span>
                            <span className="font-bold text-rose-500 font-mono">{u.rate}%</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-[11px] text-slate-400 font-sans">Chúc mừng! Không có đơn vị nào chậm tiến độ (&lt; 40%).</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 text-[10px] text-slate-400 italic">
                Lưu ý: Chỉ xếp hạng đánh giá đối với các đơn vị được giao phó trên 3 chỉ tiêu.
              </div>
            </div>
          </div>

          {/* DAILY PERFORMANCE ASSESSMENT MODULE */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#005BAA]" />
                <div>
                  <h3 className="font-bold text-slate-800 text-xs font-sans uppercase tracking-wider">
                    Bảng đánh giá kết quả số lượng cập nhật theo Ngày & Đơn vị phụ trách
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Tính toán lượng cập nhật thực tế theo hiệu số của lũy kế hôm nay trừ lũy kế hôm trước (đã bóc tách qua từng đợt import nhiều lần).
                  </p>
                </div>
              </div>
              
              {/* Mode toggles */}
              <div className="flex bg-slate-100 p-1 rounded-xl self-start sm:self-center">
                <button
                  onClick={() => setDailyViewMode('system')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                    dailyViewMode === 'system' 
                      ? 'bg-white text-[#005BAA] shadow-xs' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  Toàn hệ thống
                </button>
                <button
                  onClick={() => setDailyViewMode('units')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                    dailyViewMode === 'units' 
                      ? 'bg-white text-[#005BAA] shadow-xs' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  Theo từng Đơn vị
                </button>
              </div>
            </div>

            {dailyViewMode === 'system' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse font-sans text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                      <th className="py-2.5 px-4 w-12 text-center">STT</th>
                      <th className="py-2.5 px-3 text-left">Ngày cập nhật sản lượng</th>
                      <th className="py-2.5 px-3 text-center">Lũy kế hoàn hoàn thành đến Ngày trước (A)</th>
                      <th className="py-2.5 px-3 text-center">Lũy kế hoàn thành đến Hôm nay (B)</th>
                      <th className="py-2.5 px-4 text-center font-bold bg-blue-50/20 text-[#005BAA]">Lượng phát sinh hoàn thành (Hiệu số B - A)</th>
                      <th className="py-2.5 px-3 text-center">Đánh giá chung</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150/60">
                    {systemDailyReport.length > 0 ? (
                      [...systemDailyReport].reverse().map((day, dIdx) => {
                        const scoreLabel = day.dailyDiff >= 100 ? "Tốc độ Đột phá" : day.dailyDiff >= 20 ? "Tốc độ Ổn định" : "Cần đẩy mạnh";
                        const scoreColor = day.dailyDiff >= 100 ? "bg-emerald-50 text-emerald-700 border-emerald-150" :
                                           day.dailyDiff >= 20 ? "bg-indigo-50 text-indigo-700 border-indigo-150" :
                                           "bg-amber-50 text-amber-700 border-amber-150";
                        return (
                          <tr key={day.date} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-3 px-4 font-mono text-center text-slate-400">{dIdx + 1}</td>
                            <td className="py-3 px-3 font-semibold text-slate-800 flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-400 font-bold" />
                              {day.formattedDate}
                              {dIdx === 0 && (
                                <span className="bg-red-100 text-red-800 font-black text-[8px] px-1.5 py-0.5 rounded font-mono tracking-wider animate-pulse">LATEST</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center font-mono text-slate-500 font-medium">{day.cumulativeYesterday}</td>
                            <td className="py-3 px-3 text-center font-mono text-slate-800 font-bold">{day.cumulativeToday}</td>
                            <td className="py-3 px-4 text-center font-mono bg-blue-50/5">
                              <div className="inline-flex items-center gap-1 text-xs font-black text-emerald-600 bg-emerald-50 border border-emerald-100/70 px-2.5 py-1 rounded-xl shadow-xs">
                                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500 font-bold" />
                                +{day.dailyDiff} thuê bao
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className={`text-[9px] font-black uppercase text-center border px-2 py-0.5 rounded-full ${scoreColor}`}>
                                {scoreLabel}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400 italic font-sans text-xs">
                          Chưa ghi nhận số liệu cập nhật dập ngày nào. Hãy hoàn tất nhập thêm dữ liệu cập nhật để hiển thị.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              // Units View Mode
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-150">
                  <span className="text-[11px] font-bold text-slate-600 font-sans flex items-center gap-1.5 shrink-0">
                    <Filter className="w-3.5 h-3.5 text-slate-500" /> Lọc Đơn vị chi tiết:
                  </span>
                  <select
                    value={selectedDailyUnit}
                    onChange={(e) => setSelectedDailyUnit(e.target.value)}
                    className="bg-white border border-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#005BAA] font-sans font-bold text-slate-700 min-w-[220px]"
                  >
                    <option value="all">-- Hiển thị tất cả Đơn vị cập nhật --</option>
                    {allUniqueUnits.map(u => (
                      <option key={u.code} value={u.code}>
                        {u.name} ({u.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse font-sans text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                        <th className="py-2.5 px-4 w-12 text-center">STT</th>
                        <th className="py-2.5 px-3 text-left">Đơn vị chịu trách nhiệm</th>
                        <th className="py-2.5 px-3 text-left">Ngày đánh giá</th>
                        <th className="py-2.5 px-3 text-center">Lũy kế ngày trước (A)</th>
                        <th className="py-2.5 px-3 text-center">Lũy kế ngày hôm nay (B)</th>
                        <th className="py-2.5 px-4 text-center font-bold bg-blue-50/25 text-[#005BAA]">Đã cập nhật thực tế (Hiệu số B - A)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {unitDailyReport.filter(item => selectedDailyUnit === 'all' || item.unitCode === selectedDailyUnit).length > 0 ? (
                        [...unitDailyReport]
                          .filter(item => selectedDailyUnit === 'all' || item.unitCode === selectedDailyUnit)
                          .reverse()
                          .map((row, rIdx) => (
                            <tr key={`${row.unitCode}-${row.date}`} className="hover:bg-slate-50/40 transition-colors">
                              <td className="py-2.5 px-4 font-mono text-center text-slate-400">{rIdx + 1}</td>
                              <td className="py-2.5 px-3">
                                <div className="font-bold text-slate-800">{row.unitName}</div>
                                <div className="text-[10px] font-mono text-slate-400 mt-0.5">Mã: {row.unitCode}</div>
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-slate-700 font-mono">{row.formattedDate}</td>
                              <td className="py-2.5 px-3 text-center font-mono text-slate-500">{row.cumulativeYesterday}</td>
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800">{row.cumulativeToday}</td>
                              <td className="py-2.5 px-4 text-center">
                                {row.dailyDiff > 0 ? (
                                  <div className="inline-flex items-center gap-1 font-mono font-bold text-emerald-600 bg-emerald-50 text-[11px] px-2.5 py-0.5 rounded-md border border-emerald-100/55">
                                    +{row.dailyDiff}
                                  </div>
                                ) : (
                                  <span className="text-slate-350 font-mono">-</span>
                                )}
                              </td>
                            </tr>
                          ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400 italic font-sans text-xs">
                            Không tìm thấy dữ liệu phát sinh cho lựa chọn đơn vị hiện tại.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* ADVANCED PERFORMANCE VIEW BY DETAILED TABLE */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            {/* Table Controller Header bar */}
            <div className="bg-slate-50/80 border-b border-slate-200/60 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-500" />
                <h4 className="font-bold text-xs text-slate-800 uppercase tracking-widest">
                  Chi tiết tiến độ thực hiện của từng Đơn Vị phụ trách
                </h4>
              </div>

              {/* Filters bar */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Search Box */}
                <input 
                  type="text"
                  placeholder="Tìm theo Mã hoặc Tên Đơn vị..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-[#005BAA] w-48 font-sans"
                />

                {/* Filter Group filter */}
                <span className="text-[11px] text-slate-400 font-sans flex items-center gap-1"><Filter className="w-3 h-3" /> Lọc</span>
                <select
                  value={selectedGroupFilter}
                  onChange={(e: any) => setSelectedGroupFilter(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-650 focus:outline-none"
                >
                  <option value="all">Tất cả nhóm</option>
                  <option value="KHDN">Có khách KHDN</option>
                  <option value="CMND 9 số">Có CMND 9 số</option>
                  <option value="CCCD 12 số">Có CCCD 12 số</option>
                  <option value="Sai giấy tờ">Có sai giấy tờ</option>
                </select>

                <select
                  value={minTargetFilter}
                  onChange={(e) => setMinTargetFilter(Number(e.target.value))}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-650 focus:outline-none"
                >
                  <option value="0">Mọi quy mô</option>
                  <option value="5">Chỉ tiêu &ge; 5</option>
                  <option value="15">Chỉ tiêu &ge; 15</option>
                  <option value="50">Chỉ tiêu &ge; 50</option>
                </select>

                {/* Export Button */}
                <button 
                  onClick={handleExportCSV}
                  disabled={sortedUnits.length === 0}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-[#005BAA] hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-all cursor-pointer disabled:opacity-40"
                >
                  <Download className="w-3 h-3" />
                  Xuất Excel/CSV
                </button>
              </div>
            </div>

            {/* Main Table responsive scroll container */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-sans text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200/80">
                    <th className="py-3 px-4 w-12 text-center">STT</th>
                    <th className="py-3 px-3 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('name')}>
                      Đơn vị {sortField === 'name' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th className="py-3 px-2 text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort('target')}>
                      Chỉ tiêu {sortField === 'target' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th className="py-3 px-2 text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort('completed')}>
                      Đã Đạt {sortField === 'completed' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th className="py-3 px-2 text-center">Còn Tồn</th>
                    <th className="py-3 px-3 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('rate')}>
                      Tỷ Lệ Đạt {sortField === 'rate' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th className="py-3 px-3 text-center hidden md:table-cell bg-indigo-50/20">KHDN</th>
                    <th className="py-3 px-3 text-center hidden md:table-cell bg-cyan-50/20">CMND 9 Số</th>
                    <th className="py-3 px-3 text-center hidden md:table-cell bg-purple-50/20">CCCD 12 Số</th>
                    <th className="py-3 px-3 text-center hidden md:table-cell bg-rose-50/20">Sai Giấy Tờ</th>
                    <th className="py-3 px-4 text-center">Nhận Xét Sơ Bộ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {sortedUnits.length > 0 ? (
                    sortedUnits.map((u, index) => {
                      const evalBadge = getEvaluationBadgeObj(u.rate, u.total);
                      
                      return (
                        <tr key={u.code} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 font-mono text-center text-slate-400">{index + 1}</td>
                          <td className="py-3 px-3">
                            <div className="font-semibold text-slate-800">{u.name}</div>
                            <div className="text-[10px] font-mono text-[#005BAA] font-bold mt-0.5 uppercase">Mã đơn vị: {u.code}</div>
                          </td>
                          <td className="py-3 px-2 text-center font-bold font-mono text-slate-800 text-xs">
                            {u.total}
                          </td>
                          <td className="py-3 px-2 text-center font-bold font-mono text-emerald-600 text-xs">
                            {u.completed}
                          </td>
                          <td className="py-3 px-2 text-center font-bold font-mono text-amber-600 text-xs">
                            {u.remaining}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <span className="font-bold font-mono text-slate-800 w-9 text-right">{u.rate}%</span>
                              <div className="w-16 h-1.5 bg-slate-100/90 rounded-full overflow-hidden border border-slate-200/20 shrink-0 hidden sm:block">
                                <div 
                                  className={`h-full rounded-full ${
                                    u.rate >= 80 ? 'bg-emerald-500' :
                                    u.rate >= 50 ? 'bg-amber-500' :
                                    'bg-rose-500'
                                  }`}
                                  style={{ width: `${u.rate}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          
                          {/* KHDN */}
                          <td className="py-3 px-3 text-center hidden md:table-cell bg-indigo-50/10">
                            <span className="font-mono">{u.groups['KHDN'].completed} / <b>{u.groups['KHDN'].total}</b></span>
                            <span className="text-[9px] text-[#4f46e5] font-semibold block">
                              {u.groups['KHDN'].total > 0 ? `${Math.round((u.groups['KHDN'].completed / u.groups['KHDN'].total)*100)}%` : '-'}
                            </span>
                          </td>
                          
                          {/* CMND 9 Số */}
                          <td className="py-3 px-3 text-center hidden md:table-cell bg-cyan-50/10">
                            <span className="font-mono">{u.groups['CMND 9 số'].completed} / <b>{u.groups['CMND 9 số'].total}</b></span>
                            <span className="text-[9px] text-cyan-500 font-semibold block">
                              {u.groups['CMND 9 số'].total > 0 ? `${Math.round((u.groups['CMND 9 số'].completed / u.groups['CMND 9 số'].total)*100)}%` : '-'}
                            </span>
                          </td>
                          
                          {/* CCCD 12 Số */}
                          <td className="py-3 px-3 text-center hidden md:table-cell bg-purple-50/10">
                            <span className="font-mono">{u.groups['CCCD 12 số'].completed} / <b>{u.groups['CCCD 12 số'].total}</b></span>
                            <span className="text-[9px] text-purple-500 font-semibold block">
                              {u.groups['CCCD 12 số'].total > 0 ? `${Math.round((u.groups['CCCD 12 số'].completed / u.groups['CCCD 12 số'].total)*100)}%` : '-'}
                            </span>
                          </td>
                          
                          {/* Sai Giấy Tờ */}
                          <td className="py-3 px-3 text-center hidden md:table-cell bg-rose-50/10">
                            <span className="font-mono">{u.groups['Sai giấy tờ'].completed} / <b>{u.groups['Sai giấy tờ'].total}</b></span>
                            <span className="text-[9px] text-rose-500 font-semibold block">
                              {u.groups['Sai giấy tờ'].total > 0 ? `${Math.round((u.groups['Sai giấy tờ'].completed / u.groups['Sai giấy tờ'].total)*100)}%` : '-'}
                            </span>
                          </td>

                          {/* Evaluation comment badge */}
                          <td className="py-3 px-4 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className={`text-[9px] font-black border px-2 py-0.5 rounded-full ${evalBadge.colorClass}`}>
                                {evalBadge.label}
                              </span>
                              <span className="text-[9px] text-slate-400 block max-w-[150px] leading-tight truncate-two-lines text-center">
                                {evalBadge.detail}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-400 font-sans italic">
                        Không tìm thấy đơn vị nào khớp với điều kiện lọc hiện tại.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer info bar */}
            <div className="bg-slate-50 border-t border-slate-150 p-3.5 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 font-bold font-sans">
              <span>Đang hiển thị {sortedUnits.length} Đơn vị hoạt động có thuê bao bàn giao</span>
              <span className="font-mono text-[10px] text-[#005BAA]">ĐỒNG BỘ DỮ LIỆU ĐÁM MÂY D1 CHUẨN XÁC</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
