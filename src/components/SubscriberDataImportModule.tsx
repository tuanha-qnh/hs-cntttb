import React, { useState } from 'react';
import { Upload, ClipboardList, Database, LayoutGrid, CheckCircle2, AlertCircle, FileSpreadsheet, PlusCircle, Trash2, Download } from 'lucide-react';
import { TargetSubscriber, NormalizedSubscriber } from '../types';
import * as XLSX from 'xlsx';

interface Props {
  targetSubscribers: TargetSubscriber[];
  normalizedSubscribers: NormalizedSubscriber[];
  onImportTargets: (newTargets: TargetSubscriber[]) => void;
  onImportNormalized: (newNormalized: NormalizedSubscriber[]) => void;
  onClearTargets?: () => void;
  onClearNormalized?: () => void;
}

export default function SubscriberDataImportModule({
  targetSubscribers,
  normalizedSubscribers,
  onImportTargets,
  onImportNormalized,
  onClearTargets,
  onClearNormalized,
}: Props) {
  const [activeImportType, setActiveImportType] = useState<'target' | 'normalized'>('target');
  
  // Custom input method tabs
  const [targetInputMethod, setTargetInputMethod] = useState<'file' | 'paste'>('file');
  const [normalizedInputMethod, setNormalizedInputMethod] = useState<'file' | 'paste'>('file');

  // States for target import
  const [targetPasteArea, setTargetPasteArea] = useState('');
  const [targetSinglePhone, setTargetSinglePhone] = useState('');
  const [targetSingleSegment, setTargetSingleSegment] = useState('');
  const [targetImportStats, setTargetImportStats] = useState<{ total: number; added: number; skipped: number } | null>(null);

  // States for normalized import
  const [normalizedPasteArea, setNormalizedPasteArea] = useState('');
  const [normSinglePhone, setNormSinglePhone] = useState('');
  const [normSingleUser, setNormSingleUser] = useState('');
  const [normSingleHrm, setNormSingleHrm] = useState('');
  const [normSingleChannel, setNormSingleChannel] = useState('');
  const [normSingleDate, setNormSingleDate] = useState('');
  const [normalizedImportStats, setNormalizedImportStats] = useState<{ total: number; added: number; skipped: number } | null>(null);

  // Download Sample Excel Template
  const handleDownloadTemplate = (type: 'target' | 'normalized') => {
    try {
      const wb = XLSX.utils.book_new();
      let data: any[] = [];
      let filename = '';
      
      if (type === 'target') {
        data = [
          ['So_thue_bao', 'Tap_thue_bao'],
          ['0914111222', 'Chiến dịch Địa bàn Hạ Long QN'],
          ['0888999888', 'Khách hàng VIP 2026'],
          ['0915666777', 'Thuê bao rà soát đợt 3']
        ];
        filename = 'Mau_DS_TB_MUCTIEU.xlsx';
      } else {
        data = [
          ['So_thue_bao', 'User_capnhat', 'Ma_hrm_CN', 'Kenh_CN', 'Ngay_CN'],
          ['0914111222', 'Nguyễn Văn A', 'HRM_0123', 'Cửa hàng Hạ Long', '28/05/2026'],
          ['0888999888', 'Trần Thị B', 'HRM_9988', 'App MyVNPT', '28/05/2026']
        ];
        filename = 'Mau_KQ_CNTTTB.xlsx';
      }
      
      const ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      XLSX.writeFile(wb, filename);
    } catch (err: any) {
      alert('Không khởi tạo được file mẫu: ' + err.message);
    }
  };

  // Unified File parser logic for excel / csv
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>, type: 'target' | 'normalized') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
        if (rows.length === 0) {
          alert('File Excel rỗng!');
          return;
        }

        // Check if first line resembles header metadata, if yes skip
        const isHeader = String(rows[0][0] || '').toLowerCase().includes('thue') || 
                         String(rows[0][0] || '').toLowerCase().includes('so_thue_bao') ||
                         String(rows[0][0] || '').toLowerCase().includes('sđt') ||
                         String(rows[0][0] || '').toLowerCase().includes('phone');
        
        const startIndex = isHeader ? 1 : 0;
        let dupCount = 0;
        let totalLines = 0;

        if (type === 'target') {
          const parsedTargets: TargetSubscriber[] = [];
          
          for (let i = startIndex; i < rows.length; i++) {
            const row = rows[i];
            if (!row || !row[0]) continue;
            
            const phoneWord = String(row[0]).trim().replace(/\s+/g, '');
            const segmentWord = String(row[1] || 'Excel Import').trim();
            
            if (!phoneWord) continue;
            totalLines++;
            
            if (/^\d{9,11}$/.test(phoneWord)) {
              const isAlreadyExisting = targetSubscribers.some(t => t.phoneNumber === phoneWord) || 
                                        parsedTargets.some(t => t.phoneNumber === phoneWord);
              if (isAlreadyExisting) {
                dupCount++;
              } else {
                parsedTargets.push({
                  phoneNumber: phoneWord,
                  segment: segmentWord,
                  importedAt: new Date().toISOString(),
                });
              }
            } else {
              dupCount++;
            }
          }
          
          if (parsedTargets.length > 0) {
            onImportTargets(parsedTargets);
          }
          setTargetImportStats({
            total: totalLines,
            added: parsedTargets.length,
            skipped: dupCount
          });
          alert(`Đã nạp thành công! Đọc ${totalLines} hàng dòng dán hoặc Excel, thêm mới ${parsedTargets.length} mục tiêu. Bỏ qua trùng lặp: ${dupCount}.`);
        } else {
          // Normalized
          const parsedNormalized: NormalizedSubscriber[] = [];
          
          for (let i = startIndex; i < rows.length; i++) {
            const row = rows[i];
            if (!row || !row[0]) continue;
            
            const phoneWord = String(row[0]).trim().replace(/\s+/g, '');
            const rawUser = String(row[1] || 'Giao dịch viên').trim();
            const rawHrm = String(row[2] || 'HRM_001').trim();
            const rawChannel = String(row[3] || 'Quầy giao dịch').trim();
            const rawDate = String(row[4] || new Date().toLocaleDateString('vi-VN')).trim();
            
            if (!phoneWord) continue;
            totalLines++;
            
            if (/^\d{9,11}$/.test(phoneWord)) {
              const isAlreadyExisting = normalizedSubscribers.some(n => n.phoneNumber === phoneWord) ||
                                        parsedNormalized.some(n => n.phoneNumber === phoneWord);
              if (isAlreadyExisting) {
                dupCount++;
              } else {
                parsedNormalized.push({
                  phoneNumber: phoneWord,
                  updatedByUser: rawUser,
                  hrmCode: rawHrm,
                  channel: rawChannel,
                  updatedAt: rawDate,
                  importedAt: new Date().toISOString(),
                });
              }
            } else {
              dupCount++;
            }
          }
          
          if (parsedNormalized.length > 0) {
            onImportNormalized(parsedNormalized);
          }
          setNormalizedImportStats({
            total: totalLines,
            added: parsedNormalized.length,
            skipped: dupCount
          });
          alert(`Đã nạp thành công! Đọc ${totalLines} hàng dòng dán hoặc Excel, thêm mới ${parsedNormalized.length} thuê bao chuẩn hóa. Bỏ qua trùng lặp: ${dupCount}.`);
        }
      } catch (err: any) {
        alert('Lỗi phân tích file Excel / CSV: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // Parse Target Subscribers (bulk text paste)
  const handleBulkImportTargets = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPasteArea.trim()) {
      alert('Vui lòng dán dữ liệu danh sách khách hàng mục tiêu.');
      return;
    }

    const lines = targetPasteArea.split('\n');
    const parsedTargets: TargetSubscriber[] = [];
    let dupCount = 0;

    lines.forEach(line => {
      if (!line.trim()) return;
      // Accept either comma, semicolon or TAB delimiter
      const parts = line.split(/[,;\t]/);
      const rawPhone = parts[0]?.trim().replace(/\s+/g, '');
      const rawSegment = parts[1]?.trim() || 'Tập chiến dịch cơ bản';

      if (rawPhone && /^\d{9,11}$/.test(rawPhone)) {
        // Strict duplicate check against existing master DB state
        const isAlreadyExisting = targetSubscribers.some(t => t.phoneNumber === rawPhone) || 
                                  parsedTargets.some(t => t.phoneNumber === rawPhone);
        if (isAlreadyExisting) {
          dupCount++;
        } else {
          parsedTargets.push({
            phoneNumber: rawPhone,
            segment: rawSegment,
            importedAt: new Date().toISOString(),
          });
        }
      }
    });

    if (parsedTargets.length > 0) {
      onImportTargets(parsedTargets);
    }

    setTargetImportStats({
      total: lines.filter(l => l.trim()).length,
      added: parsedTargets.length,
      skipped: dupCount
    });

    setTargetPasteArea('');
    alert(`Import thành công! Đã thêm mới ${parsedTargets.length} thuê bao mục tiêu. Bỏ qua trùng lặp: ${dupCount}.`);
  };

  // Add individual Target Subscriber
  const handleAddSingleTarget = (e: React.FormEvent) => {
    e.preventDefault();
    const phone = targetSinglePhone.trim().replace(/\s+/g, '');
    const segment = targetSingleSegment.trim() || 'Tập bổ sung thủ công';

    if (!phone || !/^\d{9,11}$/.test(phone)) {
      alert('Số thuê bao không hợp lệ (yêu cầu từ 9 - 11 chữ số).');
      return;
    }

    const isAlreadyExisting = targetSubscribers.some(t => t.phoneNumber === phone);
    if (isAlreadyExisting) {
      alert(`⚠️ Số thuê bao "${phone}" đã tồn tại trong danh sách dữ liệu mục tiêu! Hệ thống đã loại bỏ để chống trùng lắp.`);
      return;
    }

    onImportTargets([{
      phoneNumber: phone,
      segment,
      importedAt: new Date().toISOString()
    }]);

    setTargetSinglePhone('');
    setTargetSingleSegment('');
    alert('Thêm thuê bao mục tiêu đơn lẻ thành công!');
  };

  // Parse Standardized / Normalized list (bulk text paste)
  const handleBulkImportNormalized = (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalizedPasteArea.trim()) {
      alert('Vui lòng dán dữ liệu danh sách thuê bao chuẩn hóa.');
      return;
    }

    const lines = normalizedPasteArea.split('\n');
    const parsedNormalized: NormalizedSubscriber[] = [];
    let dupCount = 0;

    lines.forEach(line => {
      if (!line.trim()) return;
      // Split by comma, semicolon or TAB
      const parts = line.split(/[,;\t]/);
      const rawPhone = parts[0]?.trim().replace(/\s+/g, '');
      const rawUser = parts[1]?.trim() || 'Hệ thống tự động';
      const rawHrm = parts[2]?.trim() || 'HRM_UNKNOWN';
      const rawChannel = parts[3]?.trim() || 'Cửa hàng';
      const rawDate = parts[4]?.trim() || new Date().toLocaleDateString('vi-VN');

      if (rawPhone && /^\d{9,11}$/.test(rawPhone)) {
        // Strict duplicate check matches against both master DB state & newly parsed state
        const isAlreadyExisting = normalizedSubscribers.some(n => n.phoneNumber === rawPhone) ||
                                  parsedNormalized.some(n => n.phoneNumber === rawPhone);
        if (isAlreadyExisting) {
          dupCount++;
        } else {
          parsedNormalized.push({
            phoneNumber: rawPhone,
            updatedByUser: rawUser,
            hrmCode: rawHrm,
            channel: rawChannel,
            updatedAt: rawDate,
            importedAt: new Date().toISOString(),
          });
        }
      }
    });

    if (parsedNormalized.length > 0) {
      onImportNormalized(parsedNormalized);
    }

    setNormalizedImportStats({
      total: lines.filter(l => l.trim()).length,
      added: parsedNormalized.length,
      skipped: dupCount
    });

    setNormalizedPasteArea('');
    alert(`Import thành công! Đã thêm mới ${parsedNormalized.length} thuê bao đã chuẩn hóa. Bỏ qua trùng lặp: ${dupCount}.`);
  };

  // Add individual Normalized Subscriber
  const handleAddSingleNormalized = (e: React.FormEvent) => {
    e.preventDefault();
    const phone = normSinglePhone.trim().replace(/\s+/g, '');
    const user = normSingleUser.trim() || 'Giao dịch viên';
    const hrm = normSingleHrm.trim() || 'HRM_001';
    const channel = normSingleChannel.trim() || 'Quầy giao dịch';
    const date = normSingleDate.trim() || new Date().toLocaleDateString('vi-VN');

    if (!phone || !/^\d{9,11}$/.test(phone)) {
      alert('Số thuê bao không hợp lệ (yêu cầu từ 9 - 11 chữ số).');
      return;
    }

    const isAlreadyExisting = normalizedSubscribers.some(n => n.phoneNumber === phone);
    if (isAlreadyExisting) {
      alert(`⚠️ Số thuê bao "${phone}" đã được khai báo chuẩn hóa trước đó! Hệ thống tự động từ chối chèn trùng.`);
      return;
    }

    onImportNormalized([{
      phoneNumber: phone,
      updatedByUser: user,
      hrmCode: hrm,
      channel,
      updatedAt: date,
      importedAt: new Date().toISOString()
    }]);

    setNormSinglePhone('');
    setNormSingleUser('');
    setNormSingleHrm('');
    setNormSingleChannel('');
    setNormSingleDate('');
    alert('Thêm thuê bao chuẩn hóa đơn lẻ thành công!');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-200">
      {/* Choice Header tabs */}
      <div className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveImportType('target')}
            className={`px-4 py-2 rounded-lg text-xs font-bold font-sans flex items-center gap-2 transition-all cursor-pointer ${
              activeImportType === 'target'
                ? 'bg-[#005BAA] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            1. KHÀCH HÀNG MỤC TIÊU ({targetSubscribers.length})
          </button>
          <button
            onClick={() => setActiveImportType('normalized')}
            className={`px-4 py-2 rounded-lg text-xs font-bold font-sans flex items-center gap-2 transition-all cursor-pointer ${
              activeImportType === 'normalized'
                ? 'bg-[#005BAA] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            2. THUÊ BAO ĐÃ CHUẨN HÓA ({normalizedSubscribers.length})
          </button>
        </div>

        {/* Action to delete records if needed */}
        <div className="flex gap-2">
          {activeImportType === 'target' && onClearTargets && targetSubscribers.length > 0 && (
            <button
              onClick={() => {
                if (confirm('Bạn có chắc chắn muốn xóa toàn bộ CSDL Khách hàng mục tiêu?')) {
                  onClearTargets();
                }
              }}
              className="text-[11px] font-bold text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Xóa CSDL Mục tiêu
            </button>
          )}

          {activeImportType === 'normalized' && onClearNormalized && normalizedSubscribers.length > 0 && (
            <button
              onClick={() => {
                if (confirm('Bạn có chắc chắn muốn xóa toàn bộ CSDL Thuê bao chuẩn hóa?')) {
                  onClearNormalized();
                }
              }}
              className="text-[11px] font-bold text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Xóa CSDL Chuẩn hóa
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left container columns for input (Upload / Paste) */}
        <div className="lg:col-span-2 space-y-6">
          {activeImportType === 'target' ? (
            /* TARGET IMPORT CARD CONTAINER */
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-[#005BAA]">
                  <ClipboardList className="w-5 h-5" />
                  <h3 className="text-sm font-bold uppercase tracking-wide">
                    Import Khách Hàng Mục Tiêu
                  </h3>
                </div>
              </div>

              {/* Selector for Input Method */}
              <div className="flex border-b border-slate-100 pb-1.5 gap-4">
                <button
                  type="button"
                  onClick={() => setTargetInputMethod('file')}
                  className={`pb-1 text-xs font-bold font-sans flex items-center gap-1.5 transition-all cursor-pointer ${
                    targetInputMethod === 'file'
                      ? 'text-[#005BAA] border-b-2 border-[#005BAA]'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Nạp từ File Excel (.xlsx, .xls, .csv)
                </button>
                <button
                  type="button"
                  onClick={() => setTargetInputMethod('paste')}
                  className={`pb-1 text-xs font-bold font-sans flex items-center gap-1.5 transition-all cursor-pointer ${
                    targetInputMethod === 'paste'
                      ? 'text-[#005BAA] border-b-2 border-[#005BAA]'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  Sao chép / Dán văn bản thô
                </button>
              </div>

              {targetInputMethod === 'file' ? (
                <div className="space-y-4 pt-1 animate-in fade-in duration-150">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-blue-50/40 p-4 rounded-xl border border-blue-100">
                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-slate-700 block">Tải file biểu mẫu chuẩn</span>
                      <p className="text-[10px] text-slate-500 font-sans">Sử dụng file Excel mẫu để điền danh sách thuê bao nhanh chóng, tránh sai thứ tự cột.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDownloadTemplate('target')}
                      className="px-3.5 py-1.5 bg-white border border-blue-200 text-[#005BAA] hover:bg-blue-50 hover:text-blue-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer font-sans"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Tải file mẫu .xlsx
                    </button>
                  </div>

                  <div className="border-2 border-dashed border-slate-200 hover:border-[#005BAA] transition-all p-8 rounded-2xl text-center bg-slate-50/50 hover:bg-blue-50/10 space-y-3 relative group">
                    <input
                      type="file"
                      accept=".xlsx, .xls, .csv"
                      onChange={(e) => handleFileImport(e, 'target')}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="mx-auto bg-blue-50 text-[#005BAA] group-hover:bg-[#005BAA] group-hover:text-white p-3 rounded-full inline-flex transition-all">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-700 font-sans">Kéo thả file Excel / CSV hoặc nhấp để chọn file</p>
                      <p className="text-[10px] text-slate-400 font-sans">Chấp nhận định dạng file .xlsx, .xls, .csv. Hệ thống chuẩn hóa tự động lọc trùng!</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="pt-1 animate-in fade-in duration-150 space-y-4">
                  <p className="text-[11px] text-slate-500 font-sans leading-relaxed">
                    Chuẩn định dạng: <strong className="font-mono bg-slate-100 text-slate-700 px-1 rounded">Số_thuê_bao,Tập_thuê_bao</strong>. Có thể copy dữ liệu nhiều dòng từ Microsoft Excel dán trực tiếp vào khung dưới đây. Hệ thống tự động lọc trùng!
                  </p>

                  <form onSubmit={handleBulkImportTargets} className="space-y-4">
                    <textarea
                      rows={8}
                      value={targetPasteArea}
                      onChange={(e) => setTargetPasteArea(e.target.value)}
                      placeholder="Ví dụ dán dữ liệu:&#10;0888999888,Tập chuẩn hóa đợt 1&#10;0911222333,Tập Khách hàng VIP Quảng Ninh&#10;0912333444,Quầy Hạ Long bổ sung"
                      className="w-full p-4 bg-slate-50 border border-slate-205 rounded-xl text-xs font-mono tracking-wider focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#005BAA]"
                    />

                    <div className="flex items-center justify-between">
                      <div className="text-[10px] text-slate-400 font-sans">
                        * Định dạng hợp lệ: Số điện thoại từ 9 đến 11 chữ số.
                      </div>
                      <button
                        type="submit"
                        className="bg-[#005BAA] hover:bg-blue-700 text-white font-bold text-xs px-6 py-2 rounded-xl transition-all hover:shadow-md cursor-pointer flex items-center gap-1.5"
                      >
                        <Upload className="w-4 h-4" />
                        Bắt đầu Import dữ liệu
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Targets Stats notification wrapper */}
              {targetImportStats && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px] font-sans uppercase">Tổng dòng đọc</span>
                    <p className="font-bold font-mono text-slate-800 text-base">{targetImportStats.total}</p>
                  </div>
                  <div>
                    <span className="text-green-500 text-[10px] font-sans uppercase font-bold">Mới cập nhật</span>
                    <p className="font-bold font-mono text-green-700 text-base">+{targetImportStats.added}</p>
                  </div>
                  <div>
                    <span className="text-amber-500 text-[10px] font-sans uppercase font-bold">Bỏ qua (Trùng lặp)</span>
                    <p className="font-bold font-mono text-amber-600 text-base">{targetImportStats.skipped}</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* NORMALIZED IMPORT CARD CONTAINER */
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-green-600">
                  <FileSpreadsheet className="w-5 h-5" />
                  <h3 className="text-sm font-bold uppercase tracking-wide">
                    Import Danh Sách Chuẩn Hóa
                  </h3>
                </div>
              </div>

              {/* Selector for Input Method */}
              <div className="flex border-b border-slate-100 pb-1.5 gap-4">
                <button
                  type="button"
                  onClick={() => setNormalizedInputMethod('file')}
                  className={`pb-1 text-xs font-bold font-sans flex items-center gap-1.5 transition-all cursor-pointer ${
                    normalizedInputMethod === 'file'
                      ? 'text-green-600 border-b-2 border-green-600'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Nạp từ File Excel (.xlsx, .xls, .csv)
                </button>
                <button
                  type="button"
                  onClick={() => setNormalizedInputMethod('paste')}
                  className={`pb-1 text-xs font-bold font-sans flex items-center gap-1.5 transition-all cursor-pointer ${
                    normalizedInputMethod === 'paste'
                      ? 'text-green-600 border-b-2 border-green-600'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  Sao chép / Dán văn bản thô
                </button>
              </div>

              {normalizedInputMethod === 'file' ? (
                <div className="space-y-4 pt-1 animate-in fade-in duration-150">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-green-50/40 p-4 rounded-xl border border-green-100">
                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-slate-700 block">Tải file biểu mẫu chuẩn hóa</span>
                      <p className="text-[10px] text-slate-500 font-sans">File Excel mẫu với đầy đủ 5 cột thông tin thuê bao, người cập nhật, mã HRM, kênh và ngày cập nhật.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDownloadTemplate('normalized')}
                      className="px-3.5 py-1.5 bg-white border border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer font-sans"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Tải file mẫu .xlsx
                    </button>
                  </div>

                  <div className="border-2 border-dashed border-slate-200 hover:border-green-600 transition-all p-8 rounded-2xl text-center bg-slate-50/50 hover:bg-green-50/10 space-y-3 relative group">
                    <input
                      type="file"
                      accept=".xlsx, .xls, .csv"
                      onChange={(e) => handleFileImport(e, 'normalized')}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="mx-auto bg-green-50 text-green-600 group-hover:bg-green-600 group-hover:text-white p-3 rounded-full inline-flex transition-all">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-700 font-sans">Kéo thả file Excel / CSV hoặc nhấp để chọn file</p>
                      <p className="text-[10px] text-slate-400 font-sans">Chấp nhận định dạng file .xlsx, .xls, .csv. Hệ thống tự động loại bỏ trùng lặp cũ.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="pt-1 animate-in fade-in duration-150 space-y-4">
                  <p className="text-[11px] text-slate-500 font-sans leading-relaxed">
                    Độ rộng cột phân cách: <strong className="font-mono bg-slate-100 text-slate-700 px-1 rounded">Số_thuê_bao,User_cập_nhật,Mã_HRM,Kênh_cập_nhật,Ngày_cập_nhật(DD/MM/YYYY)</strong>. Có thể Copy/Paste nguyên bảng từ Excel/Sheets.
                  </p>

                  <form onSubmit={handleBulkImportNormalized} className="space-y-4">
                    <textarea
                      rows={8}
                      value={normalizedPasteArea}
                      onChange={(e) => setNormalizedPasteArea(e.target.value)}
                      placeholder="Ví dụ dán dữ liệu:&#10;0888999888,Nguyễn Văn A,HRM_0123,App MyVNPT,28/05/2026&#10;0911777888,Trần Thị B,HRM_9988,Quầy giao dịch HL,27/05/2026"
                      className="w-full p-4 bg-slate-50 border border-slate-205 rounded-xl text-xs font-mono tracking-wider focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-green-500"
                    />

                    <div className="flex items-center justify-between">
                      <div className="text-[10px] text-slate-400 font-sans">
                        * Tự động lọc trùng thông minh, giữ lại và cảnh báo để không cho phép nạp đè dữ liệu cũ.
                      </div>
                      <button
                        type="submit"
                        className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs px-6 py-2 rounded-xl transition-all hover:shadow-md cursor-pointer flex items-center gap-1.5"
                      >
                        <Upload className="w-4 h-4" />
                        Nạp dữ liệu chuẩn hóa
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Normalized Stats notification wrapper */}
              {normalizedImportStats && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px] font-sans uppercase">Tổng dòng phân tích</span>
                    <p className="font-bold font-mono text-slate-800 text-base">{normalizedImportStats.total}</p>
                  </div>
                  <div>
                    <span className="text-green-500 text-[10px] font-sans uppercase font-bold">Mới đồng bộ</span>
                    <p className="font-bold font-mono text-green-700 text-base">+{normalizedImportStats.added}</p>
                  </div>
                  <div>
                    <span className="text-amber-500 text-[10px] font-sans uppercase font-bold">Trùng lặp (Đã hủy)</span>
                    <p className="font-bold font-mono text-amber-600 text-base">{normalizedImportStats.skipped}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MASTER STATE SAMPLE TABLE VIEW VIEW */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden text-xs">
            <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-bold text-slate-800 font-sans uppercase tracking-wide flex items-center gap-2">
                <Database className="w-4 h-4 text-slate-500" />
                Tổng hợp bản ghi vừa tạo hành trình ({activeImportType === 'target' ? targetSubscribers.length : normalizedSubscribers.length})
              </h3>
            </div>

            <div className="overflow-y-auto max-h-[300px]">
              {activeImportType === 'target' ? (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans">
                      <th className="px-4 py-2 w-12">STT</th>
                      <th className="px-4 py-2">Số thuê bao</th>
                      <th className="px-4 py-2">Nhóm / Tập khách hàng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {targetSubscribers.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="text-center py-8 text-slate-400">
                          Chưa có dữ liệu thuê bao mục tiêu.
                        </td>
                      </tr>
                    ) : (
                      targetSubscribers.map((item, id) => (
                        <tr key={id} className="hover:bg-slate-50 text-slate-700 font-sans text-xs">
                          <td className="px-4 py-2 font-mono text-slate-400 font-semibold">{id + 1}</td>
                          <td className="px-4 py-2 font-bold font-mono text-slate-900">{item.phoneNumber}</td>
                          <td className="px-4 py-2">
                            <span className="bg-slate-100 border px-2 py-0.5 rounded text-[10px] text-slate-650 font-bold font-sans">
                              {item.segment}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans">
                      <th className="px-4 py-2 w-12">STT</th>
                      <th className="px-4 py-2">Số thuê bao</th>
                      <th className="px-4 py-2">Giao dịch viên</th>
                      <th className="px-4 py-2">Mã HRM</th>
                      <th className="px-4 py-2">Kênh GD</th>
                      <th className="px-4 py-2">Ngày nhập</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {normalizedSubscribers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-slate-400">
                          Chưa có dữ liệu thuê bao chuẩn hóa.
                        </td>
                      </tr>
                    ) : (
                      normalizedSubscribers.map((item, id) => (
                        <tr key={id} className="hover:bg-slate-50 text-slate-700 text-xs">
                          <td className="px-4 py-2 font-mono text-slate-400 font-semibold">{id + 1}</td>
                          <td className="px-4 py-2 font-bold font-mono text-[#005BAA]">{item.phoneNumber}</td>
                          <td className="px-4 py-2 font-semibold text-slate-800">{item.updatedByUser}</td>
                          <td className="px-4 py-2 font-mono text-slate-500">{item.hrmCode}</td>
                          <td className="px-4 py-2 text-slate-650">{item.channel}</td>
                          <td className="px-4 py-2 font-mono text-slate-400">{item.updatedAt}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Right single item container entry details */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-5 space-y-4">
            <div className="flex items-center gap-1.5 text-slate-700">
              <PlusCircle className="w-4 h-4 text-[#005BAA]" />
              <h4 className="text-xs font-bold uppercase tracking-wide">
                Khai báo thủ công đơn lẻ
              </h4>
            </div>

            {activeImportType === 'target' ? (
              /* TARGET SINGLE ROW FORM FORM */
              <form onSubmit={handleAddSingleTarget} className="space-y-3 font-sans text-xs">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Số thuê bao mục tiêu*</label>
                  <input
                    required
                    type="text"
                    placeholder="VD: 0914111222"
                    value={targetSinglePhone}
                    onChange={(e) => setTargetSinglePhone(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Tập thuê bao / Chiến dịch*</label>
                  <input
                    required
                    type="text"
                    placeholder="VD: Tập địa bàn Hạ Long"
                    value={targetSingleSegment}
                    onChange={(e) => setTargetSingleSegment(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-[#005BAA] hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  Thêm vào danh bạ mục tiêu
                </button>
              </form>
            ) : (
              /* NORMALIZED SINGLE ROW FORM FORM */
              <form onSubmit={handleAddSingleNormalized} className="space-y-3 font-sans text-xs">
                <div className="space-y-1 shadow-2xs">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Số thuê bao đã chuẩn hóa*</label>
                  <input
                    required
                    type="text"
                    placeholder="VD: 0888999888"
                    value={normSinglePhone}
                    onChange={(e) => setNormSinglePhone(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Cán bộ cập nhật*</label>
                  <input
                    required
                    type="text"
                    placeholder="VD: Nguyễn Văn Toàn"
                    value={normSingleUser}
                    onChange={(e) => setNormSingleUser(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Mã HRM cán bộ*</label>
                  <input
                    required
                    type="text"
                    placeholder="VD: QN_1245"
                    value={normSingleHrm}
                    onChange={(e) => setNormSingleHrm(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Kênh giao dịch cập nhật*</label>
                  <input
                    required
                    type="text"
                    placeholder="VD: Cửa hàng Hạ Long"
                    value={normSingleChannel}
                    onChange={(e) => setNormSingleChannel(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Ngày giờ cập nhật*</label>
                  <input
                    required
                    type="text"
                    placeholder="VD: 28/05/2026"
                    value={normSingleDate}
                    onChange={(e) => setNormSingleDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none font-mono"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  Thêm vào danh sách chuẩn hóa
                </button>
              </form>
            )}
          </div>

          {/* Quick Info Tip card */}
          <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 text-xs font-sans text-blue-700 space-y-2">
            <h5 className="font-bold flex items-center gap-1">
              <AlertCircle className="w-4 h-4 text-[#005BAA]" />
              Nguyên tắc Chống Trùng lắp
            </h5>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Dù nhập bằng danh sách Excel (Paste) hay nhập đơn lẻ thủ công, số thuê bao đóng vai trò là Primary Key trường độc bản. Bất kỳ đầu số nào đã tồn tại trong CSDL sẽ lập tức bị hủy/bỏ qua, bảo vệ tính trung thực và ngăn phình to CSDL của ứng dụng.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
