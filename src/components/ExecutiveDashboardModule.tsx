/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  BarChart3, CheckCircle2, AlertCircle, RefreshCw, Filter, 
  Building2, Target, Download, Grid, Award, HelpCircle, ArrowUpRight, CheckSquare,
  Calendar, TrendingUp
} from 'lucide-react';
import { getBrowserUnifiedRecords } from '../browserDb';

interface UnifiedRecord {
  So_thue_bao: string;
  Tap_thue_bao: string;
  Ma_donvi?: string | null;
  Ten_donvi?: string | null;
  Loai_TB?: string | null;
  Hinh_thuc?: string | null;
  Dthu_T4?: number | null;
  Muc_DT?: string | null;
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
  const [selectedDailyDate, setSelectedDailyDate] = useState<string>('all');
  const [selectedMucDtUnit, setSelectedMucDtUnit] = useState<string>('all');

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

  // Helper to format numbers with local thousand separator (vi-VN)
  const formatNumber = (num: number | undefined | null): string => {
    if (num === undefined || num === null) return '0';
    return num.toLocaleString('vi-VN');
  };

  // Filter out records belonging to "Đơn vị chưa xác định / Phát sinh ngoài tập"
  const dashboardRecords = records.filter(r => {
    const code = (r.Ma_donvi || 'N/A').trim().toUpperCase();
    const name = (r.Ten_donvi || 'Đơn vị chưa xác định / Phát sinh ngoài tập').trim().toLowerCase();
    const isUnidentified = 
      code === 'N/A' || 
      code === '' ||
      name.includes('chưa xác định') || 
      name.includes('phát sinh ngoài tập');
    return !isUnidentified;
  });

  // -----------------------------------------------------------------
  // STATISTICS BY GROUPS & REVENUE
  // -----------------------------------------------------------------
  const groupStats = {
    'KHDN': { total: 0, completed: 0 },
    'CMND 9 số': { total: 0, completed: 0 },
    'CCCD 12 số': { total: 0, completed: 0 },
    'Sai giấy tờ': { total: 0, completed: 0 }
  };

  let totalTargetRevenue = 0;
  let totalCompletedRevenue = 0;

  dashboardRecords.forEach(r => {
    const groupName = classifyGroup(r.Tap_thue_bao);
    if (groupStats[groupName]) {
      groupStats[groupName].total++;
      if (r.IsUpdated) {
        groupStats[groupName].completed++;
      }
    }
    const rev = r.Dthu_T4 ? Number(r.Dthu_T4) : 0;
    totalTargetRevenue += rev;
    if (r.IsUpdated) {
      totalCompletedRevenue += rev;
    }
  });

  const totalUncompletedRevenue = totalTargetRevenue - totalCompletedRevenue;
  const overallRevenueRate = totalTargetRevenue > 0 ? Math.round((totalCompletedRevenue / totalTargetRevenue) * 1000) / 10 : 0;

  const totalTarget = dashboardRecords.length;
  const totalCompleted = dashboardRecords.filter(r => r.IsUpdated).length;
  const totalRemaining = totalTarget - totalCompleted;
  const overallRate = totalTarget > 0 ? Math.round((totalCompleted / totalTarget) * 1000) / 10 : 0;

  // Calculate remaining days from today to 2026-08-21
  const getDaysRemainingToDeadline = (): number => {
    const today = new Date();
    const d1 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const d2 = new Date(2026, 7, 21); // Month is 0-indexed (7 = August)
    const diffTime = d2.getTime() - d1.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 1; // Safely default to 1 if on or after deadline
  };

  const daysRemaining = getDaysRemainingToDeadline();
  const avgNeededPerDay = totalRemaining / daysRemaining;

  // -----------------------------------------------------------------
  // AGGREGATION BY UNITS
  // -----------------------------------------------------------------
  // Unit key is code, value holds name, totals, separate group statistics, and revenue metrics
  const unitMap: Record<string, {
    code: string;
    name: string;
    total: number;
    completed: number;
    remaining: number;
    groups: Record<string, { total: number; completed: number }>;
    targetRevenue: number;
    completedRevenue: number;
    uncompletedRevenue: number;
  }> = {};

  dashboardRecords.forEach(r => {
    const code = (r.Ma_donvi || 'N/A').trim();
    const name = (r.Ten_donvi || 'Đơn vị chưa xác định / Phát sinh ngoài tập').trim();
    const groupName = classifyGroup(r.Tap_thue_bao);
    const revenue = r.Dthu_T4 ? Number(r.Dthu_T4) : 0;

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
        },
        targetRevenue: 0,
        completedRevenue: 0,
        uncompletedRevenue: 0,
      };
    }

    // Accumulate total
    unitMap[code].total++;
    if (r.IsUpdated) {
      unitMap[code].completed++;
    } else {
      unitMap[code].remaining++;
    }

    // Accumulate revenue
    unitMap[code].targetRevenue += revenue;
    if (r.IsUpdated) {
      unitMap[code].completedRevenue += revenue;
    } else {
      unitMap[code].uncompletedRevenue += revenue;
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
    const revenueRate = unit.targetRevenue > 0 ? Math.round((unit.completedRevenue / unit.targetRevenue) * 1000) / 10 : 0;
    return { ...unit, rate, revenueRate };
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

  // Rank all active units by performance rate (highest to lowest) for the quick emulation list (total 9 units)
  const quickEmulationRanking = [...unitList]
    .filter(u => u.total > 0)
    .sort((a, b) => b.rate - a.rate);

  // -----------------------------------------------------------------
  // OUTSTANDING / UNCOMPLETED BY MUC_DT (REVENUE RANGE) STATISTICS
  // -----------------------------------------------------------------
  // Extract all distinct Muc_DT values from dashboardRecords
  const allMucDtValues: string[] = Array.from(
    new Set(
      dashboardRecords
        .map(r => String(r.Muc_DT || "Khác"))
        .filter(Boolean)
    )
  );
  // Sort them logically: Dưới 50k -> 50k - 100k -> 100k - 200k -> Trên 200k
  const standardMucDtOrder = ["Dưới 50k", "50k - 100k", "100k - 200k", "Trên 200k"];
  allMucDtValues.sort((a: string, b: string) => {
    const idxA = standardMucDtOrder.indexOf(a);
    const idxB = standardMucDtOrder.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  // Filter based on selected unit
  const mucDtFilteredRecords = selectedMucDtUnit === 'all'
    ? dashboardRecords
    : dashboardRecords.filter(r => r.Ma_donvi === selectedMucDtUnit);

  // Compute stats per Muc_DT: total target, completed, outstanding count, and outstanding revenue
  const mucDtStats = allMucDtValues.map(level => {
    const totalRecords = mucDtFilteredRecords.filter(r => (r.Muc_DT || "Khác") === level);
    const outstandingRecords = totalRecords.filter(r => !r.IsUpdated);
    const outstandingCount = outstandingRecords.length;
    const outstandingRevenue = outstandingRecords.reduce((sum, r) => sum + (r.Dthu_T4 ? Number(r.Dthu_T4) : 0), 0);
    const totalCount = totalRecords.length;
    const totalRevenue = totalRecords.reduce((sum, r) => sum + (r.Dthu_T4 ? Number(r.Dthu_T4) : 0), 0);
    
    return {
      level,
      outstandingCount,
      outstandingRevenue,
      totalCount,
      totalRevenue
    };
  });

  // -----------------------------------------------------------------
  // DAILY PERFORMANCE COMPUTATION (BY DATE & UNIT)
  // -----------------------------------------------------------------
  const activeUpdatedRecords = dashboardRecords.filter(r => r.IsUpdated && r.Ngay_CN !== null && r.Ngay_CN !== undefined && String(r.Ngay_CN).trim() !== '');
  
  const parseAndNormalizeDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return 'Khác';
    const trimmed = String(dateStr).trim();
    
    // Lấy phần ngày trước khoảng trắng (nếu có giờ phút giây, ví dụ "2026-06-19 21:12:45")
    const datePart = trimmed.split(' ')[0];
    
    // Chấp nhận định dạng Việt Nam/Oracle dd/mm/yyyy
    if (datePart.includes('/')) {
      const parts = datePart.split('/');
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${year}-${month}-${day}`;
      }
    }
    
    // Chấp nhận định dạng chuẩn yyyy-mm-dd
    if (datePart.includes('-')) {
      const parts = datePart.split('-');
      if (parts.length === 3) {
        const year = parts[0];
        const month = parts[1].padStart(2, '0');
        const day = parts[2].padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }
    
    // Trích xuất phần YYYY-MM-DD nếu dài hơn
    if (trimmed.length >= 10) {
      const possibleDate = trimmed.substring(0, 10);
      if (possibleDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return possibleDate;
      }
    }
    
    return 'Khác';
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
                <p className="text-2xl font-black text-slate-800 font-mono leading-none">{formatNumber(totalTarget)}</p>
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
                <p className="text-2xl font-black text-emerald-600 font-mono leading-none">{formatNumber(totalCompleted)}</p>
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
                <p className="text-2xl font-black text-amber-600 font-mono leading-none">{formatNumber(totalRemaining)}</p>
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
                        <span className="text-xs font-bold text-slate-800 font-mono">{formatNumber(item.total)}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 font-sans uppercase block text-emerald-600">ĐÃ ĐẠT</span>
                        <span className="text-xs font-bold text-emerald-600 font-mono">{formatNumber(item.completed)}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 font-sans uppercase block text-amber-600">CÒN TỒN</span>
                        <span className="text-xs font-bold text-amber-600 font-mono">{formatNumber(remaining)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* VISUAL CHART AREA COMPARE */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Replaced redundant chart with Muc_DT outstanding quantity & revenue evaluation */}
            <div className="lg:col-span-8 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5 mb-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    <h3 className="font-bold text-slate-800 text-xs font-sans uppercase tracking-wider">
                      Phân tích Thuê bao & Doanh thu Còn tồn theo Mức Doanh thu
                    </h3>
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-slate-450 font-bold font-sans uppercase whitespace-nowrap">Phạm vi:</span>
                    <select 
                      value={selectedMucDtUnit} 
                      onChange={(e) => setSelectedMucDtUnit(e.target.value)}
                      className="text-[11px] bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-amber-500 focus:border-amber-500 font-sans font-medium max-w-[170px] sm:max-w-xs truncate"
                    >
                      <option value="all">Toàn tỉnh Quảng Ninh</option>
                      {unitList.map(u => (
                        <option key={u.code} value={u.code}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Scope outstanding quick statistics cards */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-amber-50/40 border border-amber-100/70 rounded-xl p-3 text-center">
                    <span className="text-[9px] text-amber-700 font-bold font-sans uppercase tracking-wider block">THUÊ BAO CHƯA CẬP NHẬT</span>
                    <strong className="text-xl font-mono font-black text-amber-800 block mt-0.5">
                      {formatNumber(mucDtStats.reduce((sum, item) => sum + item.outstandingCount, 0))}
                    </strong>
                    <span className="text-[9px] text-slate-400 font-medium">thuê bao còn tồn</span>
                  </div>
                  <div className="bg-rose-50/40 border border-rose-100/70 rounded-xl p-3 text-center">
                    <span className="text-[9px] text-rose-700 font-bold font-sans uppercase tracking-wider block">DOANH THU CHƯA CẬP NHẬT</span>
                    <strong className="text-xl font-mono font-black text-rose-800 block mt-0.5">
                      {formatNumber(mucDtStats.reduce((sum, item) => sum + item.outstandingRevenue, 0))} đ
                    </strong>
                    <span className="text-[9px] text-slate-400 font-medium">chưa ghi nhận doanh thu</span>
                  </div>
                </div>

                {/* Level list with dual indicators */}
                <div className="space-y-3">
                  {mucDtStats.map((item) => {
                    const countPercent = item.totalCount > 0 ? (item.outstandingCount / item.totalCount) * 100 : 0;
                    const revenuePercent = item.totalRevenue > 0 ? (item.outstandingRevenue / item.totalRevenue) * 100 : 0;
                    
                    return (
                      <div key={item.level} className="p-3 bg-slate-50/40 hover:bg-slate-50 border border-slate-100/80 rounded-xl transition-all space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-450" />
                            <span className="font-bold text-slate-800 text-[11px] font-sans">{item.level}</span>
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[9px] text-slate-500 font-medium">
                            <span>
                              Số lượng tồn: <strong className="text-amber-700 font-black">{formatNumber(item.outstandingCount)}</strong> / {formatNumber(item.totalCount)} TB
                            </span>
                            <span>|</span>
                            <span>
                              Doanh thu tồn: <strong className="text-rose-700 font-black">{formatNumber(item.outstandingRevenue)}</strong> / {formatNumber(item.totalRevenue)} đ
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                          {/* Count bar */}
                          <div className="space-y-0.5">
                            <div className="flex justify-between text-[8px] text-slate-400 font-bold uppercase tracking-wider">
                              <span>Tỷ lệ tồn thuê bao</span>
                              <span className="font-mono text-amber-750 font-bold">{Math.round(countPercent)}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/30">
                              <div 
                                className="h-full bg-linear-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-300"
                                style={{ width: `${countPercent}%` }}
                              />
                            </div>
                          </div>

                          {/* Revenue bar */}
                          <div className="space-y-0.5">
                            <div className="flex justify-between text-[8px] text-slate-400 font-bold uppercase tracking-wider">
                              <span>Tỷ lệ tồn doanh thu</span>
                              <span className="font-mono text-rose-750 font-bold">{Math.round(revenuePercent)}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/30">
                              <div 
                                className="h-full bg-linear-to-r from-rose-400 to-rose-500 rounded-full transition-all duration-300"
                                style={{ width: `${revenuePercent}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 text-[10px] text-slate-400 italic mt-3 flex flex-col sm:flex-row justify-between sm:items-center gap-1">
                <span>Số liệu tổng hợp động dựa trên thuê bao chưa cập nhật (IsUpdated = false).</span>
                <span className="font-bold text-amber-600">Độ ưu tiên rà soát: Trên 200k &gt; 100k-200k</span>
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

                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 font-sans uppercase tracking-wider block mb-2">
                    Xếp hạng kết quả Đơn vị thực hiện chỉ tiêu
                  </span>
                  
                  <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1">
                    {quickEmulationRanking.length > 0 ? (
                      quickEmulationRanking.slice(0, 9).map((u, idx) => {
                        const rankNum = idx + 1;
                        let rankBadge = '';
                        let rankBg = 'bg-slate-50 border-slate-150 text-slate-700';
                        if (rankNum === 1) {
                          rankBadge = '🥇';
                          rankBg = 'bg-amber-50/50 border-amber-200 text-amber-800 font-bold';
                        } else if (rankNum === 2) {
                          rankBadge = '🥈';
                          rankBg = 'bg-slate-100/50 border-slate-200 text-slate-800 font-bold';
                        } else if (rankNum === 3) {
                          rankBadge = '🥉';
                          rankBg = 'bg-amber-100/20 border-amber-250 text-amber-900 font-bold';
                        } else {
                          rankBadge = `#${rankNum}`;
                        }

                        return (
                          <div 
                            key={u.code} 
                            className={`flex items-center justify-between gap-3 text-xs border rounded-xl p-2 transition-all hover:bg-slate-50 ${rankBg}`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className="font-mono text-[10px] w-7 shrink-0 text-center font-bold">
                                {rankBadge}
                              </span>
                              <div className="truncate">
                                <p className="font-bold text-slate-800 truncate text-[11px]">{u.name}</p>
                                <p className="text-[9px] text-slate-400 font-mono">Đã đạt: {formatNumber(u.completed)}/{formatNumber(u.total)}</p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-black font-mono text-[#005BAA] text-xs">{u.rate}%</span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-[11px] text-slate-400 font-sans italic">Chưa ghi nhận đơn vị nòng cốt.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 text-[10px] text-slate-400 italic">
                Bảng xếp hạng cập nhật thời gian thực dựa trên kết quả đạt của cả 9 Đơn vị.
              </div>
            </div>
          </div>

          {/* PHÂN TÍCH & ĐÁNH GIÁ TIẾN ĐỘ DOANH THU */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left Column: Biểu đồ tỷ lệ hoàn thành doanh thu của toàn tỉnh và từng đơn vị */}
            <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    <h3 className="font-bold text-slate-800 text-xs font-sans uppercase tracking-wider">
                      Biểu đồ & Đánh giá tỷ lệ hoàn thành doanh thu
                    </h3>
                  </div>
                  <span className="text-[9px] text-slate-400 font-mono font-bold">Đồng bộ từ Dthu_T4</span>
                </div>

                {/* Toàn tỉnh summary card */}
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl p-4 mb-5">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">TIẾN ĐỘ DOANH THU TOÀN TỈNH</span>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-3xl font-black text-emerald-700 font-mono leading-none">{overallRevenueRate}%</span>
                        <span className="text-[10px] text-emerald-605 font-sans font-semibold">
                          (Đã đạt {formatNumber(totalCompletedRevenue)} đ / {formatNumber(totalTargetRevenue)} đ)
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        overallRevenueRate >= 80 ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                        overallRevenueRate >= 50 ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                        'bg-rose-100 text-rose-800 border border-rose-200'
                      }`}>
                        {overallRevenueRate >= 80 ? 'Hoàn thành Tốt' : overallRevenueRate >= 50 ? 'Tiến độ Đạt' : 'Cần Đẩy Mạnh'}
                      </span>
                      <span className="text-[9px] text-slate-450 mt-1 font-medium">Tổng tồn: {formatNumber(totalUncompletedRevenue)} đ</span>
                    </div>
                  </div>

                  {/* Province progress bar */}
                  <div className="w-full h-3 bg-white border border-emerald-200/50 rounded-full overflow-hidden mt-3 shadow-2xs">
                    <div 
                      className="h-full bg-linear-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
                      style={{ width: `${overallRevenueRate}%` }}
                    />
                  </div>
                </div>

                {/* Từng đơn vị progress list */}
                <div className="space-y-3.5">
                  <span className="text-[10px] font-bold text-slate-400 font-sans uppercase tracking-wider block">
                    Chi tiết tỷ lệ hoàn thành doanh thu từng Đơn vị
                  </span>

                  <div className="space-y-2.5 max-h-[290px] overflow-y-auto pr-1">
                    {[...unitList]
                      .filter(u => u.total > 0)
                      .sort((a, b) => b.revenueRate - a.revenueRate) // Sort by revenue rate descending
                      .map((u, idx) => {
                        const barColor = 
                          u.revenueRate >= 80 ? 'bg-emerald-500' :
                          u.revenueRate >= 50 ? 'bg-amber-500' :
                          'bg-rose-500';

                        return (
                          <div key={u.code} className="border border-slate-100 rounded-xl p-2.5 hover:bg-slate-50/50 transition-all">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <div className="truncate pr-2">
                                <span className="font-bold text-slate-850 text-[11px] block truncate">{u.name}</span>
                                <span className="text-[9px] text-slate-400 font-mono block">Mã đơn vị: {u.code}</span>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="font-black font-mono text-slate-800 text-xs">{u.revenueRate}%</span>
                                <span className="text-[9px] text-slate-400 block font-mono">
                                  {formatNumber(u.completedRevenue)} / {formatNumber(u.targetRevenue)} đ
                                </span>
                              </div>
                            </div>

                            {/* Progress bar container */}
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-150/40">
                              <div 
                                className={`h-full ${barColor} rounded-full transition-all duration-300`}
                                style={{ width: `${Math.min(u.revenueRate, 100)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100 text-[10px] text-slate-400 italic mt-3">
                Doanh thu hoàn thành tính trên các thuê bao thuộc danh sách mục tiêu có trạng thái cập nhật (IsUpdated = true).
              </div>
            </div>

            {/* Right Column: Bảng tổng doanh thu của tập thuê bao chưa cập nhật của từng đơn vị */}
            <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-4">
                  <div className="flex items-center gap-2">
                    <Grid className="w-4 h-4 text-amber-500" />
                    <h3 className="font-bold text-slate-800 text-xs font-sans uppercase tracking-wider">
                      Doanh thu chưa cập nhật theo Đơn vị
                    </h3>
                  </div>
                  <span className="text-[9px] text-slate-400 font-mono font-bold">Còn lại cần rà soát</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse font-sans text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[9px] border-b border-slate-200">
                        <th className="py-2 px-2 text-center">STT</th>
                        <th className="py-2 px-2">Đơn vị</th>
                        <th className="py-2 px-2 text-right">Doanh thu tồn</th>
                        <th className="py-2 px-2 text-center">Thuê bao tồn</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {[...unitList]
                        .filter(u => u.total > 0)
                        .sort((a, b) => b.uncompletedRevenue - a.uncompletedRevenue) // Sort by uncompleted revenue descending
                        .map((u, idx) => {
                          return (
                            <tr key={u.code} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-2 px-2 text-center font-mono text-slate-400 text-[10px]">{idx + 1}</td>
                              <td className="py-2 px-2">
                                <p className="font-bold text-slate-850 text-[10px] leading-tight truncate max-w-[140px]">{u.name}</p>
                                <span className="text-[8px] font-mono text-slate-400 block uppercase">Mã: {u.code}</span>
                              </td>
                              <td className="py-2 px-2 text-right font-bold font-mono text-amber-600 text-[11px]">
                                {formatNumber(u.uncompletedRevenue)} đ
                              </td>
                              <td className="py-2 px-2 text-center font-semibold font-mono text-slate-500 text-[10px]">
                                {formatNumber(u.remaining)}
                              </td>
                            </tr>
                          );
                        })}
                      {unitList.filter(u => u.total > 0).length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-4 text-center text-slate-400 italic">
                            Chưa có thông tin doanh thu đơn vị.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 text-[10px] text-slate-400 italic mt-3">
                Bảng số liệu sắp xếp theo tổng doanh thu chưa cập nhật giảm dần, hỗ trợ ưu tiên phân bổ nguồn lực rà soát.
              </div>
            </div>
          </div>

          {/* DAILY PERFORMANCE ASSESSMENT MODULE */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#005BAA]" />
                <div>
                  <h3 className="font-bold text-slate-800 text-xs font-sans uppercase tracking-wider">
                    Đánh giá kết quả số lượng cập nhật theo Ngày & Đơn vị phụ trách
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Hệ thống trích xuất thống kê trực tiếp sản lượng rà soát hàng ngày thu thập từ trường dữ liệu <code className="font-mono text-[#005BAA] bg-blue-50 px-1 py-0.5 rounded font-bold">NGAY_CN</code>.
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

            {/* INTERACTIVE MULTI-CRITERIA FILTER BAR */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 border border-slate-150 p-4 rounded-xl">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" /> Chọn ngày sản lượng để lọc xem kết quả:
                </label>
                <select
                  value={selectedDailyDate}
                  onChange={(e) => setSelectedDailyDate(e.target.value)}
                  className="bg-white border border-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#005BAA] font-sans font-bold text-slate-700 w-full"
                >
                  <option value="all">-- Hiển thị tất cả các ngày --</option>
                  {availableDatesStr.map(d => {
                    const parts = d.split('-');
                    const formatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
                    const count = dailySystemCounts[d] || 0;
                    return (
                      <option key={d} value={d}>
                        Ngày {formatted} (Đã rà soát: {formatNumber(count)} thuê bao)
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" /> Chọn Đơn vị rà soát:
                </label>
                <select
                  value={selectedDailyUnit}
                  onChange={(e) => setSelectedDailyUnit(e.target.value)}
                  disabled={dailyViewMode === 'system'}
                  className="bg-white border border-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#005BAA] font-sans font-bold text-slate-700 w-full disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                >
                  <option value="all">-- Tất cả {allUniqueUnits.length} Đơn vị --</option>
                  {allUniqueUnits.map(u => (
                    <option key={u.code} value={u.code}>
                      {u.name} ({u.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {dailyViewMode === 'system' ? (
              <div className="space-y-4">
                {/* Banner thông tin tính toán chỉ tiêu tốc độ */}
                <div className="bg-blue-50/40 border border-blue-100 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-slate-700">
                    <TrendingUp className="w-4 h-4 text-[#005BAA]" />
                    <div>
                      <span>Thời gian đến hạn rà soát (<strong>21/08/2026</strong>): Còn lại <strong>{daysRemaining} ngày</strong>. </span>
                      <span>Tổng tồn hiện tại: <strong>{formatNumber(totalRemaining)}</strong> thuê bao.</span>
                    </div>
                  </div>
                  <div className="bg-[#005BAA]/10 border border-[#005BAA]/20 rounded-lg px-2.5 py-1 text-[#005BAA] font-extrabold font-mono text-center">
                    Bình quân cần đạt: {formatNumber(Math.ceil(avgNeededPerDay))} TB / Ngày
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse font-sans text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                        <th className="py-2.5 px-4 w-12 text-center">STT</th>
                        <th className="py-2.5 px-3 text-left">Ngày cập nhật sản lượng</th>
                        <th className="py-2.5 px-4 text-center font-bold bg-blue-50/20 text-[#005BAA]">Đã cập nhật trong ngày (Tính từ NGAY_CN)</th>
                        <th className="py-2.5 px-3 text-center">Tổng lũy kế đã hoàn thành phát sinh đến Ngày</th>
                        <th className="py-2.5 px-3 text-center">Đánh giá tốc độ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150/60">
                      {systemDailyReport.filter(d => selectedDailyDate === 'all' || d.date === selectedDailyDate).length > 0 ? (
                        (() => {
                          const filtered = [...systemDailyReport]
                            .filter(d => selectedDailyDate === 'all' || d.date === selectedDailyDate)
                            .reverse();
                          const displayed = selectedDailyDate === 'all' ? filtered.slice(0, 3) : filtered;
                          return displayed.map((day, dIdx) => {
                            const r = day.dailyDiff;
                            const a = avgNeededPerDay;
                            let scoreLabel = "";
                            let scoreColor = "";

                            if (totalRemaining <= 0) {
                              scoreLabel = "Đạt yêu cầu";
                              scoreColor = "bg-emerald-50 text-emerald-700 border-emerald-150";
                            } else {
                              if (r < a) {
                                scoreLabel = "Không đạt yêu cầu";
                                scoreColor = "bg-rose-50 text-rose-700 border-rose-150";
                              } else if (r > 1.1 * a) {
                                scoreLabel = "Kết quả rất tốt";
                                scoreColor = "bg-emerald-50 text-emerald-700 border-emerald-150 animate-pulse";
                              } else {
                                scoreLabel = "Đạt yêu cầu";
                                scoreColor = "bg-indigo-50 text-indigo-700 border-indigo-150";
                              }
                            }
                            return (
                              <tr key={day.date} className="hover:bg-slate-50/50 transition-colors">
                                <td className="py-3 px-4 font-mono text-center text-slate-400">{dIdx + 1}</td>
                                <td className="py-3 px-3 font-semibold text-slate-800 flex items-center gap-1.5">
                                  <Calendar className="w-3.5 h-3.5 text-slate-400 font-bold" />
                                  {day.formattedDate}
                                  {selectedDailyDate === 'all' && dIdx === 0 && (
                                    <span className="bg-red-100 text-red-800 font-black text-[8px] px-1.5 py-0.5 rounded font-mono tracking-wider animate-pulse">LATEST</span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-center font-mono bg-blue-50/5">
                                  <div className="inline-flex items-center gap-1 text-xs font-black text-emerald-600 bg-emerald-50 border border-emerald-100/70 px-2.5 py-1 rounded-xl shadow-xs">
                                    <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500 font-bold" />
                                    +{formatNumber(day.dailyDiff)} thuê bao
                                  </div>
                                </td>
                                <td className="py-3 px-3 text-center font-mono text-slate-700 font-bold">{formatNumber(day.cumulativeToday)} thuê bao</td>
                                <td className="py-3 px-3 text-center">
                                  <span className={`text-[9px] font-black uppercase text-center border px-2.5 py-1 rounded-full ${scoreColor}`}>
                                    {scoreLabel}
                                  </span>
                                </td>
                              </tr>
                            );
                          });
                        })()
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400 italic font-sans text-xs">
                            Chưa ghi nhận số liệu cập nhật khớp ngày nào. Hãy hoàn tất nhập thêm dữ liệu cập nhật để hiển thị.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  {selectedDailyDate === 'all' && systemDailyReport.length > 3 && (
                    <p className="text-[10px] text-slate-400 font-sans italic mt-2.5 text-right">
                      * Đang hiển thị tối đa 3 ngày gần nhất theo yêu cầu. Để xem tất cả, vui lòng lọc từng ngày cụ thể trên thanh công cụ.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              // Units View Mode
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse font-sans text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                        <th className="py-2.5 px-4 w-12 text-center">STT</th>
                        <th className="py-2.5 px-3 text-left">Đơn vị chịu trách nhiệm</th>
                        <th className="py-2.5 px-3 text-left">Ngày đánh giá</th>
                        <th className="py-2.5 px-4 text-center font-bold bg-blue-50/25 text-[#005BAA]">Đã cập nhật thực tế trong ngày (Từ NGAY_CN)</th>
                        <th className="py-2.5 px-3 text-center">Tổng lũy kế cộng dồn đến ngày</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {unitDailyReport.filter(item => {
                        const matchUnit = selectedDailyUnit === 'all' || item.unitCode === selectedDailyUnit;
                        const matchDate = selectedDailyDate === 'all' || item.date === selectedDailyDate;
                        return matchUnit && matchDate;
                      }).length > 0 ? (
                        [...unitDailyReport]
                          .filter(item => {
                            const matchUnit = selectedDailyUnit === 'all' || item.unitCode === selectedDailyUnit;
                            const matchDate = selectedDailyDate === 'all' || item.date === selectedDailyDate;
                            return matchUnit && matchDate;
                          })
                          .reverse()
                          .map((row, rIdx) => (
                            <tr key={`${row.unitCode}-${row.date}`} className="hover:bg-slate-50/40 transition-colors">
                              <td className="py-2.5 px-4 font-mono text-center text-slate-400">{rIdx + 1}</td>
                              <td className="py-2.5 px-3">
                                <div className="font-bold text-slate-800">{row.unitName}</div>
                                <div className="text-[10px] font-mono text-slate-400 mt-0.5">Mã: {row.unitCode}</div>
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-slate-700 font-mono">{row.formattedDate}</td>
                              <td className="py-2.5 px-4 text-center bg-blue-50/5">
                                {row.dailyDiff > 0 ? (
                                  <div className="inline-flex items-center gap-1 font-mono font-bold text-emerald-600 bg-emerald-50 text-[11px] px-2.5 py-0.5 rounded-md border border-emerald-100/55">
                                    +{formatNumber(row.dailyDiff)} thuê bao
                                  </div>
                                ) : (
                                  <span className="text-slate-350 font-mono font-bold text-slate-300">0</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-600">{formatNumber(row.cumulativeToday)}</td>
                            </tr>
                          ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400 italic font-sans text-xs">
                            Không tìm thấy dữ liệu rà soát phù hợp cho lựa chọn ngày hoặc đơn vị hiện tại.
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
                            {formatNumber(u.total)}
                          </td>
                          <td className="py-3 px-2 text-center font-bold font-mono text-emerald-600 text-xs">
                            {formatNumber(u.completed)}
                          </td>
                          <td className="py-3 px-2 text-center font-bold font-mono text-amber-600 text-xs">
                            {formatNumber(u.remaining)}
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
                            <span className="font-mono">{formatNumber(u.groups['KHDN'].completed)} / <b>{formatNumber(u.groups['KHDN'].total)}</b></span>
                            <span className="text-[9px] text-[#4f46e5] font-semibold block">
                              {u.groups['KHDN'].total > 0 ? `${Math.round((u.groups['KHDN'].completed / u.groups['KHDN'].total)*100)}%` : '-'}
                            </span>
                          </td>
                          
                          {/* CMND 9 Số */}
                          <td className="py-3 px-3 text-center hidden md:table-cell bg-cyan-50/10">
                            <span className="font-mono">{formatNumber(u.groups['CMND 9 số'].completed)} / <b>{formatNumber(u.groups['CMND 9 số'].total)}</b></span>
                            <span className="text-[9px] text-cyan-500 font-semibold block">
                              {u.groups['CMND 9 số'].total > 0 ? `${Math.round((u.groups['CMND 9 số'].completed / u.groups['CMND 9 số'].total)*100)}%` : '-'}
                            </span>
                          </td>
                          
                          {/* CCCD 12 Số */}
                          <td className="py-3 px-3 text-center hidden md:table-cell bg-purple-50/10">
                            <span className="font-mono">{formatNumber(u.groups['CCCD 12 số'].completed)} / <b>{formatNumber(u.groups['CCCD 12 số'].total)}</b></span>
                            <span className="text-[9px] text-purple-500 font-semibold block">
                              {u.groups['CCCD 12 số'].total > 0 ? `${Math.round((u.groups['CCCD 12 số'].completed / u.groups['CCCD 12 số'].total)*100)}%` : '-'}
                            </span>
                          </td>
                          
                          {/* Sai Giấy Tờ */}
                          <td className="py-3 px-3 text-center hidden md:table-cell bg-rose-50/10">
                            <span className="font-mono">{formatNumber(u.groups['Sai giấy tờ'].completed)} / <b>{formatNumber(u.groups['Sai giấy tờ'].total)}</b></span>
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
