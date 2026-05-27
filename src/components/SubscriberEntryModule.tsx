/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { User, Phone, CreditCard, UploadCloud, Image, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { SubscriberRecord, CloudflareConfig } from '../types';

interface Props {
  cloudflareConfig: CloudflareConfig;
  onRecordCreated: (record: SubscriberRecord) => void;
  currentUser: { id: string; fullName: string; unitId: string; nameUnit: string };
}

export default function SubscriberEntryModule({ cloudflareConfig, onRecordCreated, currentUser }: Props) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [phoneError, setPhoneError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validate Vietnamese phone number format
  const validatePhone = (num: string) => {
    const cleansed = num.trim();
    if (!cleansed) return 'Số thuê bao không được bỏ trống';
    const vietnamPhoneRegex = /^(03|05|07|08|09|01[2|6|8|9])+([0-9]{8})$/;
    const v2Regex = /^(\+84|0)(3|5|7|8|9)([0-9]{8})$/;
    if (!v2Regex.test(cleansed)) {
      return 'Số điện thoại không đúng định dạng VinaPhone/Việt Nam (Ví dụ: 0912345678)';
    }
    return '';
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPhoneNumber(val);
    if (val) {
      setPhoneError(validatePhone(val));
    } else {
      setPhoneError('');
    }
  };

  const compressAndResizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new window.Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const max_size = 1200; // kích thước rộng/cao tối đa thích hợp cho hồ sơ thanh toán / scan phiếu
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > max_size) {
              height *= max_size / width;
              width = max_size;
            }
          } else {
            if (height > max_size) {
              width *= max_size / height;
              height = max_size;
            }
          }
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            // Nén sang định dạng JPEG với chất lượng 0.75 để giảm dung lượng ảnh xuống còn ~100-200 KB siêu nhanh
            const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
            resolve(dataUrl);
          } else {
            resolve(event.target?.result as string); // Fallback nếu trình duyệt không hỗ trợ Canvas 2D
          }
        };
        img.onerror = (err) => {
          reject(err);
        };
      };
      reader.onerror = (err) => {
        reject(err);
      };
    });
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng tải lên tệp định dạng hình ảnh (PNG, JPG, JPEG).');
      return;
    }
    setImageFile(file);
    
    try {
      // Tiến hành nén ảnh trước khi đặt preview base64 gửi lên Worker
      const compressedDataUrl = await compressAndResizeImage(file);
      setImagePreview(compressedDataUrl);
    } catch (err) {
      console.error('Lỗi nén ảnh:', err);
      // Fallback nếu việc nén gặp lỗi ngoài dự kiến
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validations
    const phoneErr = validatePhone(phoneNumber);
    if (phoneErr) {
      setPhoneError(phoneErr);
      return;
    }
    if (!fullName.trim()) {
      alert('Vui lòng điền Họ và tên thuê bao');
      return;
    }
    if (!idNumber.trim()) {
      alert('Vui lòng điền số Giấy tờ (CCCD/CMND/Hộ chiếu)');
      return;
    }
    if (!imagePreview) {
      alert('Vui lòng tải lên ảnh chụp Phiếu yêu cầu cập nhật TTTB');
      return;
    }

    setStatus('uploading');
    setErrorMessage('');

    try {
      const recordId = 'REC_' + Date.now();
      const createdAt = new Date().toISOString();

      let finalImageUrl = imagePreview; // Default to base64 if local mode

      // If Cloudflare connection is activated, upload metadata & image to Cloudflare Workers API
      if (cloudflareConfig.enabled && cloudflareConfig.workerUrl) {
        let cleanUrl = cloudflareConfig.workerUrl.trim();
        if (cleanUrl.endsWith('/')) {
          cleanUrl = cleanUrl.slice(0, -1);
        }

        const response = await fetch(`${cleanUrl}/api/subscribers`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-secret': cloudflareConfig.apiSecret,
          },
          body: JSON.stringify({
            id: recordId,
            phoneNumber: phoneNumber.trim(),
            fullName: fullName.trim(),
            idNumber: idNumber.trim(),
            createdAt,
            createdBy: currentUser.id,
            creatorName: currentUser.fullName,
            unitId: currentUser.unitId,
            unitName: currentUser.nameUnit,
            imageBase64: imagePreview,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Lỗi từ máy chủ Cloudflare API (${response.status})`);
        }

        const resData = await response.json();
        if (resData.imageUrl) {
          finalImageUrl = resData.imageUrl;
        }
      }

      // Record logic callback (pushes records either straight from server response or local builder)
      const newRecord: SubscriberRecord = {
        id: recordId,
        phoneNumber: phoneNumber.trim(),
        fullName: fullName.trim(),
        idNumber: idNumber.trim(),
        createdAt,
        createdBy: currentUser.id,
        creatorName: currentUser.fullName,
        unitId: currentUser.unitId,
        unitName: currentUser.nameUnit,
        imageUrl: finalImageUrl,
      };

      onRecordCreated(newRecord);
      setStatus('success');

      // Reset form variables
      setTimeout(() => {
        setPhoneNumber('');
        setFullName('');
        setIdNumber('');
        setImageFile(null);
        setImagePreview(null);
        setStatus('idle');
      }, 2000);

    } catch (err: any) {
      console.error(err);
      setStatus('error');
      
      const isFetchError = err.message && (
        err.message.toLowerCase().includes('fetch') || 
        err.message.toLowerCase().includes('network') ||
        err.message.toLowerCase().includes('failed')
      );
      
      if (isFetchError) {
        setErrorMessage(
          'Không thể kết nối đến Cloudflare Worker (Lỗi Fetch/CORS). Vui lòng: ' +
          '1) Truy cập mục "Đồng bộ đám mây" tại màn hình đăng nhập để kiểm tra xem bạn đã copy & nạp đè phiên bản mã nguồn mới nhất cho Cloudflare Worker chưa (mã mới đã giải quyết 100% CORS). ' +
          '2) Kiểm tra xem bạn đã liên kết đúng cơ sở dữ liệu DB (D1) và R2_BUCKET trong Cloudflare Dashboard chưa. ' +
          '3) Đảm bảo Worker của bạn đã được triển khai thành công lên môi trường Cloudflare.'
        );
      } else {
        setErrorMessage(err.message || 'Lỗi hệ thống không thể tải hồ sơ lên. Vui lòng kiểm tra lại kết cấu API mạng.');
      }
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left panel instructions */}
      <div className="lg:col-span-4 bg-slate-900 border border-slate-800 text-white p-6 rounded-2xl shadow-sm space-y-5 relative overflow-hidden">
        {/* Technical cover decoration */}
        <div className="absolute top-0 left-0 w-24 h-[1px] bg-gradient-to-r from-blue-500 to-transparent"></div>
        <div className="absolute top-0 left-0 w-[1px] h-24 bg-gradient-to-b from-blue-500 to-transparent"></div>
        
        <div className="space-y-1">
          <h3 className="text-sm font-bold font-sans uppercase tracking-wider text-slate-100">
            Hồ sơ & Quy trình nghiệp vụ
          </h3>
          <span className="w-8 h-0.5 bg-[#005BAA] block rounded"></span>
        </div>
        
        <p className="text-xs text-slate-400 leading-relaxed font-sans">
          Thực hiện đúng quy tắc và tiến trình thu thập tài liệu số hóa, bảo mật tối đa danh tính thuê bao theo đúng văn bản chỉ đạo và Nghị định 49/CP.
        </p>
        
        <div className="space-y-4 pt-1 text-xs">
          <div className="flex items-start gap-3">
            <span className="bg-slate-800 border border-slate-700 w-5 h-5 rounded-md text-cyan-400 font-mono text-[10px] flex items-center justify-center shrink-0">1</span>
            <p className="font-sans leading-relaxed text-slate-300">Điền chính xác <strong className="text-slate-100">Số điện thoại thuê bao</strong> cần cập nhật sản lượng.</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="bg-slate-800 border border-slate-700 w-5 h-5 rounded-md text-cyan-400 font-mono text-[10px] flex items-center justify-center shrink-0">2</span>
            <p className="font-sans leading-relaxed text-slate-300">Nhập đúng họ & tên trùng khớp với thông tin trên <strong className="text-slate-100">CCCD/Hộ chiếu</strong> gốc.</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="bg-slate-800 border border-slate-700 w-5 h-5 rounded-md text-cyan-400 font-mono text-[10px] flex items-center justify-center shrink-0">3</span>
            <p className="font-sans leading-relaxed text-slate-300">Tải tệp ảnh chụp chất lượng cao, rõ chữ ký của chính phủ và đối tượng.</p>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-4 mt-2">
          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
            <div className={`w-2 h-2 rounded-full ${cloudflareConfig.enabled ? 'bg-cyan-400 animate-pulse' : 'bg-amber-400'}`} />
            <span>
              STG: {cloudflareConfig.enabled ? 'CLOUDFLARE SYNC R2/D1' : 'MÔ PHỎNG OFFLINE STATE'}
            </span>
          </div>
        </div>
      </div>

      {/* Right panel form logic */}
      <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <form onSubmit={handleUploadSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Phone Number */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 font-sans uppercase tracking-wider text-[10px]">
                <Phone className="w-3.5 h-3.5 text-[#005BAA]" />
                Số thuê bao VinaPhone *
              </label>
              <div className="relative">
                <input
                  required
                  type="text"
                  placeholder="Ví dụ: 0912345678"
                  value={phoneNumber}
                  onChange={handlePhoneChange}
                  className={`w-full text-xs px-3.5 py-2.5 rounded-lg border focus:ring-2 outline-none transition-all font-mono tracking-wide ${
                    phoneError ? 'border-red-300 bg-red-50/10 focus:ring-red-100' : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/30 focus:bg-white focus:ring-blue-100 focus:border-[#005BAA]'
                  }`}
                />
              </div>
              {phoneError && (
                <p className="text-[11px] text-red-500 font-sans flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {phoneError}
                </p>
              )}
            </div>

            {/* Full Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 font-sans uppercase tracking-wider text-[10px]">
                <User className="w-3.5 h-3.5 text-[#005BAA]" />
                Họ và tên chủ thuê bao *
              </label>
              <input
                required
                type="text"
                placeholder="Nhập tên viết hoa có dấu"
                value={fullName}
                onChange={(e) => setFullName(e.target.value.toUpperCase())}
                className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-100/30 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-[#005BAA] outline-none transition-all font-sans uppercase tracking-wide"
              />
            </div>

            {/* Identity Doc Number */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 font-sans uppercase tracking-wider text-[10px]">
                <CreditCard className="w-3.5 h-3.5 text-[#005BAA]" />
                Số giấy tờ tùy thân (CCCD / CMND / Hộ chiếu) *
              </label>
              <input
                required
                type="text"
                placeholder="Nhập chính xác mã chữ số trên thẻ căn cước"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-100/30 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-[#005BAA] outline-none transition-all font-mono"
              />
            </div>
          </div>

          {/* Draggable upload canvas */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 font-sans uppercase tracking-wider text-[10px]">
              <Image className="w-3.5 h-3.5 text-[#005BAA]" />
              Phiếu yêu cầu cập nhật TTTB (Chụp ảnh và tải lên) *
            </label>

            <div
              id="drop-zone"
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={triggerFileSelect}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[180px] ${
                dragActive ? 'border-[#005BAA] bg-blue-50/40' : 'border-slate-200/90 hover:border-[#005BAA] bg-slate-50/30 hover:bg-slate-100/20'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {imagePreview ? (
                <div className="space-y-3 relative group w-full max-w-xs transition-transform duration-200">
                  <img
                    src={imagePreview}
                    alt="Phiếu yêu cầu"
                    className="max-h-52 mx-auto rounded-lg shadow-sm border border-slate-200 object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-slate-900/80 text-white p-2 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity rounded-b-lg flex items-center justify-center gap-1">
                    <UploadCloud className="w-3 h-3" /> Click hoặc Kéo thả lần nữa để đổi ảnh
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono">
                    {imageFile ? imageFile.name : 'image_document.jpg'} ({Math.round((imagePreview.length * 3) / 4 / 1024)} KB)
                  </p>
                </div>
              ) : (
                <div className="space-y-2 py-2">
                  <div className="bg-[#005BAA]/5 p-3 rounded-full inline-flex text-slate-450 border border-blue-100">
                    <UploadCloud className="w-5 h-5 text-[#005BAA]" />
                  </div>
                  <p className="text-xs font-semibold text-slate-700 font-sans">
                    Kéo và thả ảnh tại đây hoặc nhấp chuột để chọn từ thiết bị
                  </p>
                  <p className="text-[10px] text-slate-400 font-sans">
                    Chấp nhận định dạng JPEG, JPG, PNG từ camera điện thoại hoặc máy scan
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Action indicator states */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <div>
              {status === 'uploading' && (
                <div className="flex items-center gap-2 text-xs text-[#005BAA] font-semibold font-sans">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Đang đồng bộ dữ liệu lên hệ thống đám mây...
                </div>
              )}
              {status === 'success' && (
                <div className="flex items-center gap-2 text-xs text-emerald-600 font-semibold font-sans">
                  <CheckCircle className="w-4 h-4" />
                  Lưu hồ sơ thành công! Dữ liệu đã đồng bộ an toàn.
                </div>
              )}
              {status === 'error' && (
                <div className="flex items-center gap-2 text-xs text-red-500 font-semibold font-sans">
                  <AlertTriangle className="w-4 h-4" />
                  Lỗi: {errorMessage}
                </div>
              )}
            </div>

            <button
              id="btn-upload-record"
              type="submit"
              disabled={status === 'uploading' || status === 'success'}
              className="px-6 py-2.5 rounded-lg text-white font-semibold text-xs bg-[#005BAA] hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors font-sans shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              Lưu & Đồng bộ Hồ sơ
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
