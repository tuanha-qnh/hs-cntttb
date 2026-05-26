/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Search, Eye, Calendar, User, Clipboard, Phone, Building2, Tag, ArrowLeft, Download, X } from 'lucide-react';
import { SubscriberRecord } from '../types';

interface Props {
  records: SubscriberRecord[];
  onSearchRequest?: (q: string) => void;
}

export default function SubscriberLookupModule({ records }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState<SubscriberRecord | null>(null);
  const itemsPerPage = 6;

  // Client-side smart filtering
  const filteredRecords = records.filter((r) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      r.phoneNumber.toLowerCase().includes(term) ||
      r.fullName.toLowerCase().includes(term) ||
      r.idNumber.toLowerCase().includes(term) ||
      (r.unitName && r.unitName.toLowerCase().includes(term))
    );
  });

  // Pagination bounds calculation
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredRecords.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (p: number) => {
    if (p >= 1 && p <= totalPages) {
      setCurrentPage(p);
    }
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Search Header Banner Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="w-full md:max-w-md relative">
          <input
            type="text"
            placeholder="Tìm Số thuê bao, Mã CCCD, Tên chủ thuê..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200/90 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#005BAA] font-sans transition-all"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
        </div>
        
        <div className="text-[11px] text-slate-500 font-sans font-medium">
          Đang hiển thị <span className="font-mono font-bold text-[#005BAA] bg-[#005BAA]/5 px-2 py-0.5 rounded border border-blue-100">{filteredRecords.length}</span> trên tổng số <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-250">{records.length}</span> hồ sơ lưu kho.
        </div>
      </div>

      {/* Main Grid View */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200/80 text-slate-500 text-[10px] font-bold uppercase font-sans tracking-wider">
                <th className="px-6 py-3.5 w-16">STT</th>
                <th className="px-6 py-3.5">Số thuê bao VinaPhone</th>
                <th className="px-6 py-3.5">Họ tên chủ thuê bao</th>
                <th className="px-6 py-3.5">Số Giấy tờ CCCD</th>
                <th className="px-6 py-3.5">Đơn vị tiếp nhận</th>
                <th className="px-6 py-3.5">Ngày đồng bộ</th>
                <th className="px-6 py-3.5 text-center">Tùy chọn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedData.length > 0 ? (
                paginatedData.map((record, index) => (
                  <tr key={record.id} className="hover:bg-[#005BAA]/2 transition-colors text-slate-700 text-xs font-sans even:bg-slate-50/20">
                    <td className="px-6 py-4 font-bold text-slate-400 font-mono text-[11px]">
                      {String(startIndex + index + 1).padStart(2, '0')}
                    </td>
                    <td className="px-6 py-4 font-bold text-[#005BAA] font-mono text-sm tracking-wide">
                      {record.phoneNumber}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800 font-sans tracking-tight">
                      {record.fullName}
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-500 text-[11px]">
                      {record.idNumber}
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-sans">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-450" />
                        <span className="font-medium truncate max-w-[180px]">{record.unitName || 'VNPT Quảng Ninh'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-400 font-mono text-[11px]">
                      {formatDate(record.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => setSelectedRecord(record)}
                        className="px-3 py-1.5 rounded-lg bg-[#005BAA]/5 text-[#005BAA] border border-blue-100 hover:bg-[#005BAA] hover:text-white hover:border-[#005BAA] transition-all text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Xem chi tiết
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-slate-400 font-sans font-medium text-xs">
                    Không tìm thấy dữ liệu hồ sơ thuê bao phù hợp với từ khóa tìm kiếm.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">
              Trang <strong>{currentPage}</strong> / <strong>{totalPages}</strong>
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
                className="px-2.5 py-1 rounded bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Trước
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  className={`px-2.5 py-1 rounded border cursor-pointer font-medium ${
                    pageNum === currentPage
                      ? 'bg-[#005BAA] text-white border-[#005BAA]'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {pageNum}
                </button>
              ))}
              <button
                disabled={currentPage === totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
                className="px-2.5 py-1 rounded bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Drawer Overlay Modal viewing Document Image with complete information metadata */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-slate-200/90 shadow-2xl flex flex-col md:flex-row animate-in fade-in zoom-in-95 duration-200">
            {/* Visual preview with technical grid background */}
            <div className="md:w-3/5 bg-slate-950/90 border-r border-slate-100 flex flex-col items-center justify-center p-6 min-h-[300px] relative">
              <div className="absolute top-4 left-4 bg-slate-900 border border-slate-800 text-[9px] text-[#005BAA] font-mono px-2 py-0.5 rounded uppercase">
                Image CDN Viewport
              </div>
              <img
                src={selectedRecord.imageUrl}
                alt="Bản scan phiêu yêu cầu TTTB"
                className="max-h-[65vh] max-w-full rounded-lg object-contain shadow-2xl border border-slate-800/60"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.src = "https://images.unsplash.com/photo-1586281380349-632531db7ed4?q=80&w=600&auto=format&fit=crop";
                }}
              />
            </div>

            {/* Content Metadata panel */}
            <div className="md:w-2/5 p-6 flex flex-col justify-between bg-white">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                  <div>
                    <span className="text-[9px] font-bold px-2 py-0.5 bg-[#005BAA]/5 text-[#005BAA] border border-blue-100/50 rounded-md font-sans uppercase tracking-wider">
                      HỒ SƠ CHÍNH CHỦ
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 font-sans mt-1.5 uppercase tracking-wide">Thuê bao: {selectedRecord.phoneNumber}</h3>
                  </div>
                  <button
                    onClick={() => setSelectedRecord(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 font-sans tracking-wider block">Khách hàng yêu cầu</span>
                    <p className="font-sans text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-[#005BAA]" />
                      {selectedRecord.fullName}
                    </p>
                  </div>

                  <div className="space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 font-sans tracking-wider block">Số CCCD / Hộ chiếu</span>
                    <p className="font-mono text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Clipboard className="w-3.5 h-3.5 text-[#005BAA]" />
                      {selectedRecord.idNumber}
                    </p>
                  </div>

                  <div className="space-y-2 pt-2 text-xs text-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[10px] uppercase font-bold">Điểm giao dịch</span>
                      <span className="font-medium text-slate-800">{selectedRecord.unitName || 'VNPT Quảng Ninh'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[10px] uppercase font-bold">Ngày giờ đồng bộ</span>
                      <span className="font-mono text-slate-800">{formatDate(selectedRecord.createdAt)}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-100 pt-2 mt-1">
                      <span className="text-slate-400 text-[10px] uppercase font-bold">Nhân viên tải lên</span>
                      <span className="font-medium text-slate-700 truncate max-w-[150px]" title={selectedRecord.creatorName}>
                        {selectedRecord.creatorName} ({selectedRecord.createdBy})
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 mt-6 flex gap-2">
                <a
                  href={selectedRecord.imageUrl}
                  target="_blank"
                  download={`vinaphone_tttb_${selectedRecord.phoneNumber}.jpg`}
                  className="w-1/2 text-center px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Tải ảnh gốc
                </a>

                <button
                  onClick={() => setSelectedRecord(null)}
                  className="w-1/2 px-3 py-2 bg-[#005BAA] hover:bg-blue-600 text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer hover:shadow-sm"
                >
                  Đóng lại
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
