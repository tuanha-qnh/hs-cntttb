import React, { useState } from 'react';
import { Upload, ClipboardList, Database, LayoutGrid, CheckCircle2, AlertCircle, FileSpreadsheet, PlusCircle, Trash2, Download } from 'lucide-react';
import { TargetSubscriber, NormalizedSubscriber } from '../types';
import * as XLSX from 'xlsx';

interface Props {
  targetSubscribers: TargetSubscriber[];
  normalizedSubscribers: NormalizedSubscriber[];
  onImportTargets: (newTargets: TargetSubscriber[]) => Promise<any> | void;
  onImportNormalized: (newNormalized: NormalizedSubscriber[]) => Promise<any> | void;
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

  // Chunk progress state for popup modal
  const [progress, setProgress] = useState<{
    isImporting: boolean;
    totalRows: number;
    processedRows: number;
    addedCount: number;
    skippedCount: number;
    percentage: number;
    stageName: string;
    type: 'target' | 'normalized';
  }>({
    isImporting: false,
    totalRows: 0,
    processedRows: 0,
    addedCount: 0,
    skippedCount: 0,
    percentage: 0,
    stageName: '',
    type: 'target'
  });

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

  // Generic scheduler for progressive chunked processing & cloud sync
  const processInChunks = async <T, R>(
    items: T[],
    chunkSize: number,
    type: 'target' | 'normalized',
    parser: (chunk: T[]) => { valid: R[]; skipped: number },
    importer: (valid: R[]) => Promise<any> | void,
    onFinish: (added: number, skipped: number, total: number) => void
  ) => {
    const total = items.length;
    let processed = 0;
    let added = 0;
    let skipped = 0;

    setProgress({
      isImporting: true,
      totalRows: total,
      processedRows: 0,
      addedCount: 0,
      skippedCount: 0,
      percentage: 0,
      stageName: 'Đang bắt đầu xử lý dòng...',
      type
    });

    // Process chunk by chunk sequential
    for (let index = 0; index < total; index += chunkSize) {
      const chunk = items.slice(index, index + chunkSize);
      
      setProgress(prev => ({
        ...prev,
        stageName: `Đang lọc trùng & xử lý dòng ${index + 1} - ${Math.min(index + chunkSize, total)}...`
      }));

      // Relinquish UI thread lock to let browser paint
      await new Promise(resolve => setTimeout(resolve, 30));

      const result = parser(chunk);
      const validItems = result.valid;
      const skippedInChunk = result.skipped;

      if (validItems.length > 0) {
        setProgress(prev => ({
          ...prev,
          stageName: `Đang đồng bộ ${validItems.length} bản ghi mới lên cơ sở dữ liệu cloud...`
        }));
        
        try {
          await importer(validItems);
        } catch (err) {
          console.error("Lỗi đồng bộ mẻ dữ liệu:", err);
        }
      }

      processed += chunk.length;
      added += validItems.length;
      skipped += skippedInChunk;

      const percentage = Math.round((processed / total) * 100);

      setProgress({
        isImporting: true,
        totalRows: total,
        processedRows: processed,
        addedCount: added,
        skippedCount: skipped,
        percentage,
        stageName: `Đã hoàn tất xử lý ${processed}/${total} dòng (${percentage}%)`,
        type
      });

      // Spacing out chunks to prevent UI freeze & rate limit peaks
      await new Promise(resolve => setTimeout(resolve, 75));
    }

    setProgress(prev => ({
      ...prev,
      stageName: '✔️ Hoàn tất đồng bộ dữ liệu!'
    }));

    await new Promise(resolve => setTimeout(resolve, 400));
    setProgress(prev => ({ ...prev, isImporting: false }));
    onFinish(added, skipped, total);
  };

  // Unified File parser logic for excel / csv
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>, type: 'target' | 'normalized') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
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
        const dataRows = rows.slice(startIndex).filter(row => row && row[0] !== undefined);

        if (type === 'target') {
          const processedPhonesInSession = new Set<string>();

          const targetParser = (chunk: any[]) => {
            const valid: TargetSubscriber[] = [];
            let skipped = 0;

            for (const row of chunk) {
              if (!row || row[0] === undefined || row[0] === null) {
                skipped++;
                continue;
              }
              const phoneWord = String(row[0]).trim().replace(/\s+/g, '');
              const segmentWord = String(row[1] || 'Excel Import').trim();

              if (!phoneWord || !/^\d{9,11}$/.test(phoneWord)) {
                skipped++;
                continue;
              }

              const isAlreadyExisting = targetSubscribers.some(t => t.phoneNumber === phoneWord) || 
                                        processedPhonesInSession.has(phoneWord);
              if (isAlreadyExisting) {
                skipped++;
              } else {
                processedPhonesInSession.add(phoneWord);
                valid.push({
                  phoneNumber: phoneWord,
                  segment: segmentWord,
                  importedAt: new Date().toISOString(),
                });
              }
            }
            return { valid, skipped };
          };

          await processInChunks(
            dataRows,
            200,
            'target',
            targetParser,
            onImportTargets,
            (added, skipped, total) => {
              setTargetImportStats({
                total,
                added,
                skipped
              });
              alert(`Nhập tệp dữ liệu mục tiêu thành công!\nTổng số: ${total} dòng\nThêm mới thành công: ${added} mục\nBỏ qua (trùng/lỗi): ${skipped} mục.`);
            }
          );
        } else {
          // Normalized
          const processedPhonesInSession = new Set<string>();

          const normalizedParser = (chunk: any[]) => {
            const valid: NormalizedSubscriber[] = [];
            let skipped = 0;

            for (const row of chunk) {
              if (!row || row[0] === undefined || row[0] === null) {
                skipped++;
                continue;
              }
              const phoneWord = String(row[0]).trim().replace(/\s+/g, '');
              const rawUser = String(row[1] || 'Giao dịch viên').trim();
              const rawHrm = String(row[2] || 'HRM_001').trim();
              const rawChannel = String(row[3] || 'Quầy giao dịch').trim();
              const rawDate = String(row[4] || new Date().toLocaleDateString('vi-VN')).trim();

              if (!phoneWord || !/^\d{9,11}$/.test(phoneWord)) {
                skipped++;
                continue;
              }

              const isAlreadyExisting = normalizedSubscribers.some(n => n.phoneNumber === phoneWord) ||
                                        processedPhonesInSession.has(phoneWord);
              if (isAlreadyExisting) {
                skipped++;
              } else {
                processedPhonesInSession.add(phoneWord);
                valid.push({
                  phoneNumber: phoneWord,
                  updatedByUser: rawUser,
                  hrmCode: rawHrm,
                  channel: rawChannel,
                  updatedAt: rawDate,
                  importedAt: new Date().toISOString(),
                });
              }
            }
            return { valid, skipped };
          };

          await processInChunks(
            dataRows,
            200,
            'normalized',
            normalizedParser,
            onImportNormalized,
            (added, skipped, total) => {
              setNormalizedImportStats({
                total,
                added,
                skipped
              });
              alert(`Nhập tệp dữ liệu chuẩn hóa thành công!\nTổng số: ${total} dòng\nThêm mới thành công: ${added} mục\nBỏ qua (trùng/lỗi): ${skipped} mục.`);
            }
          );
        }
      } catch (err: any) {
        alert('Lỗi phân tích file Excel / CSV: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // Parse Target Subscribers (bulk text paste)
  const handleBulkImportTargets = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPasteArea.trim()) {
      alert('Vui lòng dán dữ liệu danh sách khách hàng mục tiêu.');
      return;
    }

    const lines = targetPasteArea.split('\n').filter(l => l.trim());
    const processedPhonesInSession = new Set<string>();

    const targetLineParser = (chunk: string[]) => {
      const valid: TargetSubscriber[] = [];
      let skipped = 0;

      chunk.forEach(line => {
        const parts = line.split(/[,;\t]/);
        const rawPhone = parts[0]?.trim().replace(/\s+/g, '');
        const rawSegment = parts[1]?.trim() || 'Tập chiến dịch cơ bản';

        if (rawPhone && /^\d{9,11}$/.test(rawPhone)) {
          const isAlreadyExisting = targetSubscribers.some(t => t.phoneNumber === rawPhone) || 
                                    processedPhonesInSession.has(rawPhone);
          if (isAlreadyExisting) {
            skipped++;
          } else {
            processedPhonesInSession.add(rawPhone);
            valid.push({
              phoneNumber: rawPhone,
              segment: rawSegment,
              importedAt: new Date().toISOString(),
            });
          }
        } else {
          skipped++;
        }
      });
      return { valid, skipped };
    };

    await processInChunks(
      lines,
      200,
      'target',
      targetLineParser,
      onImportTargets,
      (added, skipped, total) => {
        setTargetImportStats({
          total,
          added,
          skipped
        });
        setTargetPasteArea('');
        alert(`Dán dữ liệu danh sách thuê bao mục tiêu thành công!\nTổng số: ${total} dòng\nThêm mới: ${added} mục\nBỏ qua trùng lặp/sai sót: ${skipped} mục.`);
      }
    );
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
  const handleBulkImportNormalized = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalizedPasteArea.trim()) {
      alert('Vui lòng dán dữ liệu danh sách thuê bao chuẩn hóa.');
      return;
    }

    const lines = normalizedPasteArea.split('\n').filter(l => l.trim());
    const processedPhonesInSession = new Set<string>();

    const normalizedLineParser = (chunk: string[]) => {
      const valid: NormalizedSubscriber[] = [];
      let skipped = 0;

      chunk.forEach(line => {
        const parts = line.split(/[,;\t]/);
        const rawPhone = parts[0]?.trim().replace(/\s+/g, '');
        const rawUser = parts[1]?.trim() || 'Hệ thống tự động';
        const rawHrm = parts[2]?.trim() || 'HRM_UNKNOWN';
        const rawChannel = parts[3]?.trim() || 'Cửa hàng';
        const rawDate = parts[4]?.trim() || new Date().toLocaleDateString('vi-VN');

        if (rawPhone && /^\d{9,11}$/.test(rawPhone)) {
          const isAlreadyExisting = normalizedSubscribers.some(n => n.phoneNumber === rawPhone) ||
                                    processedPhonesInSession.has(rawPhone);
          if (isAlreadyExisting) {
            skipped++;
          } else {
            processedPhonesInSession.add(rawPhone);
            valid.push({
              phoneNumber: rawPhone,
              updatedByUser: rawUser,
              hrmCode: rawHrm,
              channel: rawChannel,
              updatedAt: rawDate,
              importedAt: new Date().toISOString(),
            });
          }
        } else {
          skipped++;
        }
      });
      return { valid, skipped };
    };

    await processInChunks(
      lines,
      200,
      'normalized',
      normalizedLineParser,
      onImportNormalized,
      (added, skipped, total) => {
        setNormalizedImportStats({
          total,
          added,
          skipped
        });
        setNormalizedPasteArea('');
        alert(`Dán dữ liệu thuê bao chuẩn hóa thành công!\nTổng số: ${total} dòng dán\nThêm mới: ${added} mục\nBỏ qua trùng cấu trúc hoặc dữ liệu cũ: ${skipped} mục.`);
      }
    );
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

      {/* Visual Import Progress Popup Modal */}
      {progress.isImporting && (
        <div id="import-progress-popup" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white border border-slate-200/90 shadow-2xl rounded-2xl overflow-hidden p-6 relative">
            {/* Design blue decorative header line */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#005BAA] to-cyan-500"></div>

            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-[#005BAA]">
                  <Database className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <h3 className="font-sans font-bold text-slate-800 text-sm">Hệ thống đang nạp dữ liệu...</h3>
                  <p className="font-sans text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                    {progress.type === 'target' ? 'Thuê bao mục tiêu' : 'Thuê bao chuẩn hóa'}
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4.5 space-y-3 font-sans text-xs">
                <div className="flex justify-between items-center text-slate-650">
                  <span>Trạng thái:</span>
                  <span className="font-bold text-slate-800 text-right max-w-[240px] truncate">{progress.stageName}</span>
                </div>

                <div className="grid grid-cols-3 gap-2.5 pt-1.5 text-center">
                  <div className="bg-white border border-slate-100 rounded-lg p-2 shadow-2xs">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Tổng dòng</div>
                    <div className="text-sm font-extrabold text-slate-700 font-mono mt-0.5">{progress.totalRows}</div>
                  </div>
                  <div className="bg-green-50/50 border border-green-100 rounded-lg p-2 shadow-2xs">
                    <div className="text-[10px] text-green-600 font-bold uppercase">Mới</div>
                    <div className="text-sm font-extrabold text-green-700 font-mono mt-0.5">+{progress.addedCount}</div>
                  </div>
                  <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-2 shadow-2xs">
                    <div className="text-[10px] text-amber-600 font-bold uppercase">Bỏ qua / Trùng</div>
                    <div className="text-sm font-extrabold text-amber-700 font-mono mt-0.5">+{progress.skippedCount}</div>
                  </div>
                </div>
              </div>

              {/* Graphical Bar Progress percentage indicator */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-bold font-sans">
                  <span className="text-slate-500 font-medium">Tiến trình nạp và đồng bộ:</span>
                  <span className="text-[#005BAA] font-extrabold font-mono text-sm">{progress.percentage}%</span>
                </div>
                
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden shadow-inner border border-slate-200/50">
                  <div 
                    className="bg-gradient-to-r from-[#005BAA] to-cyan-500 h-full rounded-full transition-all duration-300 bg-[length:24px_24px] bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] animate-[pulse_1.5s_infinite_ease-in-out]"
                    style={{ width: `${progress.percentage}%` }}
                  ></div>
                </div>

                <p className="text-[10px] text-slate-400 text-center italic pt-1 font-sans">
                  💡 Vui lòng không đóng trình duyệt hoặc làm mới trang để đảm bảo dữ liệu toàn vẹn.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
