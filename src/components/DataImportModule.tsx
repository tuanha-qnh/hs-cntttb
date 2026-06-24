import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Database, CheckCircle, AlertCircle, FileText, Check, Layers, User, Calendar, RefreshCw } from 'lucide-react';
import { saveBrowserMuctieu, saveBrowserKetqua } from '../browserDb';

interface DataImportModuleProps {
  currentUser: {
    username: string;
    role: string;
    canImportData?: boolean;
  };
  cloudflareConfig?: {
    enabled: boolean;
    workerUrl: string;
    apiSecret: string;
  };
}

export default function DataImportModule({ currentUser, cloudflareConfig }: DataImportModuleProps) {
  // Check permission guard
  const hasPermission = currentUser.role === 'Admin' || currentUser.canImportData === true;

  const [activeImportType, setActiveImportType] = useState<'muctieu' | 'ketqua'>('muctieu');
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // Progress overlay state
  const [uploadProgress, setUploadProgress] = useState<{
    status: 'idle' | 'parsing' | 'uploading' | 'completed' | 'error';
    percentage: number;
    currentRecord: number;
    totalRecords: number;
    message: string;
  }>({
    status: 'idle',
    percentage: 0,
    currentRecord: 0,
    totalRecords: 0,
    message: '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!hasPermission) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-2xl p-6 text-center font-sans">
        <AlertCircle className="w-12 h-12 text-red-650 mx-auto mb-3" />
        <h3 className="font-bold text-sm">TRUY CẬP BỊ TỪ CHỐI</h3>
        <p className="text-xs text-red-650/80 mt-1 max-w-md mx-auto">
          Tài khoản của bạn chưa được cấp quyền truy cập để khai thác module Import/Upload dữ liệu. Vui lòng liên hệ Quản trị viên hệ thống để kích hoạt quyền.
        </p>
      </div>
    );
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv',
        'text/plain'
      ];
      const isCSV = file.name.endsWith('.csv');
      const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

      if (validTypes.includes(file.type) || isCSV || isExcel) {
        setSelectedFile(file);
      } else {
        alert("Chỉ chấp nhận file định dạng Excel (.xlsx, .xls) hoặc CSV (.csv, .txt)!");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  // Helper matching keys for case-insensitive and Vietnamese headers
  const findKey = (row: any, candidates: string[]): string | null => {
    const keys = Object.keys(row);
    for (const cand of candidates) {
      const lowerCand = cand.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "");
      for (const key of keys) {
        const lowerKey = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "");
        if (lowerKey === lowerCand || lowerKey.includes(lowerCand) || lowerCand.includes(lowerKey)) {
          return key;
        }
      }
    }
    return null;
  };

  const executeUpload = async () => {
    if (!selectedFile) return;

    setUploadProgress({
      status: 'parsing',
      percentage: 0,
      currentRecord: 0,
      totalRecords: 0,
      message: 'Đang giải nén và phân tích cấu trúc tệp dữ liệu...',
    });

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json(worksheet) as any[];

        if (!rawRows || rawRows.length === 0) {
          throw new Error("Tệp dữ liệu rỗng hoặc không đúng định dạng.");
        }

        const mappedRecords: any[] = [];

        if (activeImportType === 'muctieu') {
          // Fields: So_thue_bao (SĐT), Tap_thue_bao, Ma_donvi, Ten_donvi, Loai_TB, Hinh_thuc, Dthu_T4, Muc_DT
          for (const row of rawRows) {
            const phoneKey = findKey(row, ['so_thue_bao', 'so_dien_thoai', 'phoneNumber', 'sdt', 'so thue bao']);
            const groupKey = findKey(row, ['tap_thue_bao', 'tap', 'group', 'category', 'tap thue bao']);
            const unitCodeKey = findKey(row, ['ma_donvi', 'ma_dv', 'unitid', 'ma_don_vi', 'ma don vi', 'ma dv', 'madonvi']);
            const unitNameKey = findKey(row, ['ten_donvi', 'ten_dv', 'unitname', 'ten_don_vi', 'ten don vi', 'ten dv', 'don vi', 'don_vi', 'tendonvi']);
            const loaiTbKey = findKey(row, ['loai_tb', 'loai_thue_bao', 'loaitb', 'loai thue bao', 'loai_hinh_thue_bao', 'loai tb']);
            const hinhThucKey = findKey(row, ['hinh_thuc', 'hinh_thuc_dau_noi', 'hinhthuc', 'hinh thuc']);
            const dthuT4Key = findKey(row, ['dthu_t4', 'doanh_thu', 'doanh_thu_t4', 'dthu', 'doanh thu', 'dthut4', 'dt_t4', 'dthuthang4', 'dthu t4']);
            const mucDtKey = findKey(row, ['muc_dt', 'muc_doanh_thu', 'mucdt', 'muc doanh thu', 'muc dt']);

            const sdt = phoneKey ? String(row[phoneKey]).trim() : '';
            const tap = groupKey ? String(row[groupKey]).trim() : 'Mặc định';
            const ma_dv = unitCodeKey ? String(row[unitCodeKey]).trim() : '';
            const ten_dv = unitNameKey ? String(row[unitNameKey]).trim() : '';
            const loai_tb = loaiTbKey ? String(row[loaiTbKey]).trim() : '';
            const hinh_thuc = hinhThucKey ? String(row[hinhThucKey]).trim() : '';
            const dthu_t4 = dthuT4Key ? Number(row[dthuT4Key]) : 0;
            const muc_dt = mucDtKey ? String(row[mucDtKey]).trim() : '';

            if (sdt) {
              mappedRecords.push({
                So_thue_bao: sdt,
                Tap_thue_bao: tap,
                Ma_donvi: ma_dv,
                Ten_donvi: ten_dv,
                Loai_TB: loai_tb,
                Hinh_thuc: hinh_thuc,
                Dthu_T4: isNaN(dthu_t4) ? 0 : dthu_t4,
                Muc_DT: muc_dt,
              });
            }
          }
        } else {
          // Fields: so_thue_bao, User_capnhat, Ma_hrm_CN, Kenh_CN, Ngay_CN
          for (const row of rawRows) {
            const phoneKey = findKey(row, ['so_thue_bao', 'so_dien_thoai', 'phoneNumber', 'sdt', 'so thue bao']);
            const userKey = findKey(row, ['user_capnhat', 'user', 'nguoi_dung', 'gdv', 'giao dich vien']);
            const hrmKey = findKey(row, ['ma_hrm_cn', 'hrm', 'ma hrm', 'ma_hrm']);
            const channelKey = findKey(row, ['kenh_cn', 'kenh', 'kenh cap nhat', 'kenh_cap_nhat']);
            const dateKey = findKey(row, ['ngay_cn', 'ngay', 'ngay cap nhat', 'ngay_cap_nhat']);

            const sdt = phoneKey ? String(row[phoneKey]).trim() : '';
            const user = userKey ? String(row[userKey]).trim() : currentUser.username;
            const hrm = hrmKey ? String(row[hrmKey]).trim() : 'N/A';
            const kenh = channelKey ? String(row[channelKey]).trim() : 'WebPortal';
            
            // Xử lý chuẩn hóa ngày cập nhật (Ngay_CN) từ bất kỳ định dạng nào (bao gồm số của Excel dạng 46192) về định dạng dd/mm/yyyy
            const rawNgay = dateKey ? row[dateKey] : null;
            let ngay = '';
            
            if (rawNgay !== null && rawNgay !== undefined && String(rawNgay).trim() !== '') {
              const strVal = String(rawNgay).trim();
              const numVal = Number(strVal);
              
              if (!isNaN(numVal) && numVal > 20000 && numVal < 60000) {
                // Là số serial của Excel (Ví dụ 46192 -> 19/06/2026)
                // Epoch của Excel là 30/12/1899 do lỗi tính năm nhuận 1900 của Excel, số ngày chênh lệch là 25569.
                const date = new Date((numVal - 25569) * 86400 * 1000);
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const year = date.getFullYear();
                ngay = `${day}/${month}/${year}`;
              } else if (strVal.includes('-')) {
                // Xử lý yyyy-mm-dd hoặc yyyy-mm-dd hh:mm:ss sang dd/mm/yyyy
                const datePart = strVal.split(' ')[0];
                const parts = datePart.split('-');
                if (parts.length === 3 && parts[0].length === 4) {
                  ngay = `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
                } else {
                  ngay = strVal;
                }
              } else {
                ngay = strVal;
              }
            } else {
              // Mặc định lấy ngày hôm nay với định dạng dd/mm/yyyy
              const today = new Date();
              const day = String(today.getDate()).padStart(2, '0');
              const month = String(today.getMonth() + 1).padStart(2, '0');
              const year = today.getFullYear();
              ngay = `${day}/${month}/${year}`;
            }

            if (sdt) {
              mappedRecords.push({
                so_thue_bao: sdt,
                User_capnhat: user,
                Ma_hrm_CN: hrm,
                Kenh_CN: kenh,
                Ngay_CN: ngay,
              });
            }
          }
        }

        if (mappedRecords.length === 0) {
          throw new Error("Không lọc được số điện thoại hợp lệ từ tệp đã tải lên. Vui lòng kiểm tra tiêu đề cột.");
        }

        // Start batch upload in chunks of 2000 records (optimized for paid Cloudflare D1 plan) to make imports extremely fast
        setUploadProgress({
          status: 'uploading',
          percentage: 0,
          currentRecord: 0,
          totalRecords: mappedRecords.length,
          message: `Bắt đầu cập nhật ${mappedRecords.length} dòng dữ liệu lên Cloud D1...`,
        });

        const batchSize = 2000;
        const totalBatches = Math.ceil(mappedRecords.length / batchSize);
        
        // Backup to browser-only local storage database so that offline fallbacks always have latest imports
        try {
          if (activeImportType === 'muctieu') {
            saveBrowserMuctieu(mappedRecords, true);
          } else {
            saveBrowserKetqua(mappedRecords, true);
          }
          console.log("Successfully backed up imported records to browser storage.");
        } catch (storageErr) {
          console.error("Lỗi sao lưu cục bộ trình duyệt:", storageErr);
        }

        const isCloud = cloudflareConfig?.enabled && cloudflareConfig?.workerUrl;
        const baseUrl = isCloud ? cloudflareConfig.workerUrl.trim().replace(/\/+$/, '') : '';
        const endpoint = activeImportType === 'muctieu' 
          ? `${baseUrl}/api/subscriber-status/upload-muctieu` 
          : `${baseUrl}/api/subscriber-status/upload-ketqua`;

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        
        if (isCloud && cloudflareConfig?.apiSecret) {
          headers['x-api-secret'] = cloudflareConfig.apiSecret;
        }

        if (isCloud) {
          for (let i = 0; i < totalBatches; i++) {
            const start = i * batchSize;
            const end = Math.min(start + batchSize, mappedRecords.length);
            const chunk = mappedRecords.slice(start, end);

            const resp = await fetch(endpoint, {
              method: 'POST',
              headers,
              body: JSON.stringify({ 
                records: chunk,
                isFirstBatch: i === 0 
              }),
            });

            if (!resp.ok) {
              const errorText = await resp.text().catch(() => '');
              let parsedErr;
              try { parsedErr = JSON.parse(errorText); } catch(e) {}
              const errMsg = parsedErr?.error || errorText || 'Không nhận diện được cấu hình DB.';
              throw new Error(`Lỗi tải lên dữ liệu lô thứ ${i + 1} lên mây: ${errMsg}`);
            }

            const pct = Math.round((end / mappedRecords.length) * 100);
            setUploadProgress({
              status: 'uploading',
              percentage: pct,
              currentRecord: end,
              totalRecords: mappedRecords.length,
              message: `Đang truyền tải lô dữ liệu (${end}/${mappedRecords.length} dòng)...`,
            });
          }
        } else {
          // Fall back to local Express API
          try {
            const localEndpoint = activeImportType === 'muctieu' 
              ? `/api/subscriber-status/upload-muctieu` 
              : `/api/subscriber-status/upload-ketqua`;

            const resp = await fetch(localEndpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                records: mappedRecords,
                isFirstBatch: true 
              }),
            });
            if (!resp.ok) {
              throw new Error("Không thể kết nối API local");
            }
          } catch (localErr) {
            console.warn("Máy chủ cục bộ không khả dụng. Dữ liệu đã lưu tạm thời trực tiếp trên bộ nhớ Trình duyệt (localStorage).");
          }
        }

        setUploadProgress({
          status: 'completed',
          percentage: 100,
          currentRecord: mappedRecords.length,
          totalRecords: mappedRecords.length,
          message: `Đã hoàn tất import thành công cho ${mappedRecords.length} dòng thuê bao (Dữ liệu đã sẵn sàng trên cả CSDL đồng bộ lẫn trình duyệt ngoại tuyến)!`,
        });

        setSelectedFile(null); // Reset file selection after success

      } catch (err: any) {
        setUploadProgress({
          status: 'error',
          percentage: 0,
          currentRecord: 0,
          totalRecords: 0,
          message: err.message || 'Lỗi xử lý file bất ngờ.',
        });
      }
    };

    reader.onerror = () => {
      setUploadProgress({
        status: 'error',
        percentage: 0,
        currentRecord: 0,
        totalRecords: 0,
        message: 'Lỗi đọc tệp tin cục bộ từ trình duyệt.',
      });
    };

    reader.readAsBinaryString(selectedFile);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Selector Import Type */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => {
            setActiveImportType('muctieu');
            setSelectedFile(null);
          }}
          className={`p-5 rounded-2xl border text-left cursor-pointer transition-all flex items-start gap-4 ${
            activeImportType === 'muctieu'
              ? 'bg-[#005BAA]/5 border-[#005BAA] shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-350'
          }`}
        >
          <div className={`p-3 rounded-xl ${activeImportType === 'muctieu' ? 'bg-[#005BAA] text-white' : 'bg-slate-100 text-slate-500'}`}>
            <Layers className="w-5 h-5" />
          </div>
          <div className="space-y-1 font-sans">
            <h4 className="text-xs font-bold text-slate-900 uppercase">Tập thuê bao mục tiêu</h4>
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
              Bảng dữ liệu: <b>DS_TB_MUCTIEU</b>.<br />
              Cấu trúc: <b>So_thue_bao (SĐT), Tap_thue_bao, Ma_donvi, Ten_donvi, Loai_TB, Hinh_thuc, Dthu_T4, Muc_DT</b>.
            </p>
          </div>
        </button>

        <button
          onClick={() => {
            setActiveImportType('ketqua');
            setSelectedFile(null);
          }}
          className={`p-5 rounded-2xl border text-left cursor-pointer transition-all flex items-start gap-4 ${
            activeImportType === 'ketqua'
              ? 'bg-[#005BAA]/5 border-[#005BAA] shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-350'
          }`}
        >
          <div className={`p-3 rounded-xl ${activeImportType === 'ketqua' ? 'bg-[#005BAA] text-white' : 'bg-slate-100 text-slate-500'}`}>
            <Database className="w-5 h-5" />
          </div>
          <div className="space-y-1 font-sans">
            <h4 className="text-xs font-bold text-slate-900 uppercase">Danh sách đã cập nhật</h4>
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
              Bảng dữ liệu: <b>KQ_CNTTTB</b>.<br />
              Cấu trúc: <b>so_thue_bao, User_capnhat, Ma_hrm_CN, Kenh_CN, Ngay_CN</b>.
            </p>
          </div>
        </button>
      </div>

      {/* Main Drag Drop Panel */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 text-center shadow-2xs">
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all ${
            dragActive ? 'border-[#005BAA] bg-[#005BAA]/2' : 'border-slate-205 hover:bg-slate-50/50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".xlsx, .xls, .csv, .txt"
            onChange={handleFileChange}
          />

          <div className="space-y-3 font-sans">
            <div className="inline-flex p-3.5 bg-[#005BAA]/5 text-[#005BAA] rounded-full mx-auto">
              <Upload className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">
                Kéo thả file dữ liệu vào đây, hoặc click để chọn file
              </p>
              <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-tight">
                Chấp nhận file Excel (.xlsx, .xls) hoặc CSV (.csv, .txt)
              </p>
            </div>
          </div>
        </div>

        {selectedFile && (
          <div className="mt-5 p-4 bg-slate-50 rounded-xl border border-slate-150 flex items-center justify-between font-sans">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#005BAA]/5 text-[#005BAA] rounded-lg">
                <FileText className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-slate-800">{selectedFile.name}</p>
                <p className="text-[10px] text-slate-450">Kích thước: {(selectedFile.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
            <button
              onClick={executeUpload}
              className="px-5 py-2.5 bg-[#005BAA] hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition shadow-md cursor-pointer flex items-center gap-2 active:scale-95"
            >
              <Database className="w-4 h-4" />
              Tiến hành tải lên CSDL D1
            </button>
          </div>
        )}
      </div>

      {/* Real-time Progress overlay popup */}
      {uploadProgress.status !== 'idle' && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden font-sans">
            <div className="bg-slate-50 border-b border-slate-200 px-5 py-4 flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                <RefreshCw className={`w-4 h-4 text-[#005BAA] ${uploadProgress.status !== 'completed' && uploadProgress.status !== 'error' ? 'animate-spin' : ''}`} />
                Tiến trình nạp dữ liệu CSDL D1
              </h4>
              {(uploadProgress.status === 'completed' || uploadProgress.status === 'error') && (
                <button
                  onClick={() => setUploadProgress({ ...uploadProgress, status: 'idle' })}
                  className="text-slate-400 hover:text-slate-700 font-bold text-sm cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="p-6 space-y-5">
              {uploadProgress.status === 'error' ? (
                <div className="space-y-3 text-center">
                  <div className="inline-flex p-3 bg-red-50 text-red-650 rounded-full">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 uppercase">Tải lên thất bại</h5>
                    <p className="text-[11px] text-red-650 mt-1 leading-relaxed">{uploadProgress.message}</p>
                  </div>
                </div>
              ) : uploadProgress.status === 'completed' ? (
                <div className="space-y-4 text-center">
                  <div className="inline-flex p-3 bg-green-50 text-green-650 rounded-full">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 uppercase">Hoàn tất ghi đè dữ liệu</h5>
                    <p className="text-[11px] text-slate-650 mt-1.5 leading-relaxed">{uploadProgress.message}</p>
                  </div>
                  <button
                    onClick={() => setUploadProgress({ ...uploadProgress, status: 'idle' })}
                    className="w-full py-2 bg-[#005BAA] hover:bg-blue-700 text-white text-xs font-bold rounded-lg cursor-pointer transition"
                  >
                    Đóng cửa sổ
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-1.5 text-left">
                    <div className="flex justify-between text-[11px] font-bold text-slate-500">
                      <span>{uploadProgress.status === 'parsing' ? 'Đang đọc và phân tách file...' : 'Đang xử lý tải lên ghi đè...'}</span>
                      <span className="font-mono">{uploadProgress.percentage}%</span>
                    </div>

                    {/* Progress slider base */}
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-205">
                      <div
                        className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress.percentage}%` }}
                      />
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-150 text-[11px] space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Số lượng đã nạp:</span>
                      <span className="font-mono font-bold text-[#005BAA]">{uploadProgress.currentRecord} / {uploadProgress.totalRecords} thuê bao</span>
                    </div>
                    <p className="text-slate-500 mt-1 border-t pt-1 border-slate-150 leading-relaxed italic">{uploadProgress.message}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
