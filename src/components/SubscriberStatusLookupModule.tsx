/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Search, CheckCircle2, AlertTriangle, HelpCircle, Phone, User, Hash, Share2, Calendar, FileText } from 'lucide-react';
import { TargetSubscriber, NormalizedSubscriber } from '../types';

interface Props {
  targetSubscribers: TargetSubscriber[];
  normalizedSubscribers: NormalizedSubscriber[];
}

export default function SubscriberStatusLookupModule({ targetSubscribers, normalizedSubscribers }: Props) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [searchResult, setSearchResult] = useState<{
    searchedNum: string;
    status: 'normalized' | 'target_pending' | 'not_found';
    details?: NormalizedSubscriber;
    targetDetails?: TargetSubscriber;
  } | null>(null);

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNum = phoneNumber.trim().replace(/\s+/g, '');
    if (!cleanNum) {
      alert('Vui lòng nhập số thuê bao để tra cứu.');
      return;
    }

    // Step 1: Check normalized list
    const normalized = normalizedSubscribers.find(s => s.phoneNumber === cleanNum);
    if (normalized) {
      setSearchResult({
        searchedNum: cleanNum,
        status: 'normalized',
        details: normalized
      });
      return;
    }

    // Step 2: Check target list
    const target = targetSubscribers.find(s => s.phoneNumber === cleanNum);
    if (target) {
      setSearchResult({
        searchedNum: cleanNum,
        status: 'target_pending',
        targetDetails: target
      });
      return;
    }

    // Step 3: Not found
    setSearchResult({
      searchedNum: cleanNum,
      status: 'not_found'
    });
  };

  const handleQuickLookup = (num: string) => {
    setPhoneNumber(num);
    // Directly run search logic
    const normalized = normalizedSubscribers.find(s => s.phoneNumber === num);
    if (normalized) {
      setSearchResult({
        searchedNum: num,
        status: 'normalized',
        details: normalized
      });
      return;
    }
    const target = targetSubscribers.find(s => s.phoneNumber === num);
    if (target) {
      setSearchResult({
        searchedNum: num,
        status: 'target_pending',
        targetDetails: target
      });
      return;
    }
    setSearchResult({
      searchedNum: num,
      status: 'not_found'
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-200">
      {/* Upper search card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="bg-[#005BAA]/4 border-b border-slate-200/50 p-5">
          <h2 className="text-sm font-bold text-slate-800 uppercase font-sans tracking-wide">
            Tra cứu Tình trạng chuẩn hóa thông tin thuê bao
          </h2>
          <p className="text-slate-500 text-[11px] font-sans mt-1">
            Nhập số thuê bao VinaPhone để đối chiếu trực tiếp với Cơ sở dữ liệu Khách hàng mục tiêu và Danh sách Thuê bao đã chuẩn hóa.
          </p>
        </div>

        <div className="p-6">
          <form onSubmit={handleLookup} className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                maxLength={11}
                placeholder="Nhập số điện thoại VinaPhone (VD: 0888999888)..."
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 focus:bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#005BAA] font-mono tracking-wider transition-all"
              />
              <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            </div>
            <button
              type="submit"
              className="bg-[#005BAA] hover:bg-blue-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl cursor-pointer transition-all hover:shadow-md flex items-center gap-1.5 active:scale-98"
            >
              <Search className="w-4 h-4" />
              Tra cứu
            </button>
          </form>

          {/* Quick-test helper */}
          <div className="mt-4 flex items-center gap-2 flex-wrap text-[10px] text-slate-500 font-sans">
            <span className="font-semibold text-slate-400">Gợi ý kiểm tra:</span>
            {targetSubscribers.slice(0, 2).map(s => (
              <button
                key={s.phoneNumber}
                type="button"
                onClick={() => handleQuickLookup(s.phoneNumber)}
                className="bg-slate-100 hover:bg-slate-200 font-mono text-[10px] px-2 py-1 rounded-md text-slate-600 transition-colors border border-slate-200/50 cursor-pointer"
              >
                {s.phoneNumber} (Mặt đất)
              </button>
            ))}
            {normalizedSubscribers.slice(0, 2).map(s => (
              <button
                key={s.phoneNumber}
                type="button"
                onClick={() => handleQuickLookup(s.phoneNumber)}
                className="bg-green-55/10 hover:bg-green-55/20 font-mono text-[10px] px-2 py-1 rounded-md text-green-750 transition-colors border border-green-200/40 cursor-pointer"
              >
                {s.phoneNumber} (Đã chuẩn hóa)
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleQuickLookup('0911000222')}
              className="bg-slate-100 hover:bg-slate-200 font-mono text-[10px] px-2 py-1 rounded-md text-slate-600 transition-colors border border-slate-200/50 cursor-pointer"
            >
              0911000222 (Số Lạ)
            </button>
          </div>
        </div>
      </div>

      {/* Tra cứu Result Panel */}
      {searchResult && (
        <div className="bg-white border border-slate-200/95 rounded-2xl shadow-xs overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Status color-coded badge strip */}
          {searchResult.status === 'normalized' && (
            <div className="bg-green-50 border-b border-green-100 px-6 py-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center text-green-600">
                <CheckCircle2 className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="text-xs font-bold text-green-800 uppercase font-sans">
                  THUÊ BAO ĐÃ CHUẨN HÓA THÔNG TIN
                </div>
                <div className="text-[10px] text-green-600 font-sans font-medium mt-0.5">
                  Số thuê bao {searchResult.searchedNum} đã hoàn tất chuẩn hóa dữ liệu, sẵn sàng khai thác nghiệp vụ.
                </div>
              </div>
            </div>
          )}

          {searchResult.status === 'target_pending' && (
            <div className="bg-amber-50 border-b border-amber-100 px-6 py-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-amber-800 uppercase font-sans">
                  KHÁCH HÀNG MỤC TIÊU - CHƯA CHUẨN HÓA
                </div>
                <div className="text-[10px] text-amber-600 font-sans font-medium mt-0.5">
                  Số thuê bao {searchResult.searchedNum} nằm trong Danh mục KH mục tiêu nhưng chưa ghi nhận giao dịch chuẩn hóa dữ liệu.
                </div>
              </div>
            </div>
          )}

          {searchResult.status === 'not_found' && (
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-500/10 flex items-center justify-center text-slate-500">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-700 uppercase font-sans">
                  CHƯA GHI NHẬN THÔNG TIN CHIẾN DỊCH
                </div>
                <div className="text-[10px] text-slate-500 font-sans font-medium mt-0.5">
                  Số thuê bao {searchResult.searchedNum} không nằm trong danh sách khách hàng mục tiêu và chưa có lịch sử chuẩn hóa.
                </div>
              </div>
            </div>
          )}

          {/* Details Body */}
          <div className="p-6">
            <h3 className="text-[10px] uppercase font-bold text-slate-400 font-sans tracking-wider-sm tracking-widest-sm mb-4">
              Chi tiết thông tin cập nhật hệ thống
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column Fields */}
              <div className="space-y-3">
                <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100/80 flex items-start gap-3">
                  <div className="p-2 bg-white rounded-lg border border-slate-200 text-slate-400">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">Số thuê bao tra cứu</span>
                    <span className="text-sm font-bold text-slate-800 font-mono tracking-wide">{searchResult.searchedNum}</span>
                  </div>
                </div>

                <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100/80 flex items-start gap-3">
                  <div className="p-2 bg-white rounded-lg border border-slate-200 text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">User cập nhật</span>
                    <span className="text-xs font-bold text-slate-800 font-sans">
                      {searchResult.status === 'normalized' && searchResult.details ? (
                        searchResult.details.updatedByUser
                      ) : (
                        <span className="text-slate-400 font-normal">Chưa có thông tin (N/A)</span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100/80 flex items-start gap-3">
                  <div className="p-2 bg-white rounded-lg border border-slate-200 text-slate-400">
                    <Hash className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">Mã HRM Giao dịch viên</span>
                    <span className="text-xs font-bold text-slate-800 font-mono">
                      {searchResult.status === 'normalized' && searchResult.details ? (
                        searchResult.details.hrmCode
                      ) : (
                        <span className="text-slate-400 font-normal">Chưa có thông tin (N/A)</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column Fields */}
              <div className="space-y-3">
                <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100/80 flex items-start gap-3">
                  <div className="p-2 bg-white rounded-lg border border-slate-200 text-slate-400">
                    <Share2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">Kênh cập nhật</span>
                    <span className="text-xs font-bold text-slate-800 font-sans">
                      {searchResult.status === 'normalized' && searchResult.details ? (
                        searchResult.details.channel
                      ) : (
                        <span className="text-slate-400 font-normal">Không xác định (N/A)</span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100/80 flex items-start gap-3">
                  <div className="p-2 bg-white rounded-lg border border-slate-200 text-slate-400">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">Ngày ghi nhận kết quả</span>
                    <span className="text-xs font-bold text-slate-800 font-mono">
                      {searchResult.status === 'normalized' && searchResult.details ? (
                        searchResult.details.updatedAt
                      ) : (
                        <span className="text-slate-400 font-normal">Chưa hoàn tất chuẩn hóa</span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100/80 flex items-start gap-3">
                  <div className="p-2 bg-white rounded-lg border border-slate-200 text-slate-400">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">Phân loại / Tập thuê bao</span>
                    <span className="text-xs font-bold text-slate-800 font-sans">
                      {searchResult.status === 'target_pending' && searchResult.targetDetails ? (
                        <span className="bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full border border-amber-200/50 text-[10px]">
                          {searchResult.targetDetails.segment}
                        </span>
                      ) : searchResult.status === 'normalized' ? (
                        <span className="bg-[#005BAA]/10 text-[#005BAA] px-2.5 py-0.5 rounded-full border border-blue-200/50 text-[10px]">
                          Đã đồng bộ thành công
                        </span>
                      ) : (
                        <span className="text-slate-400 font-normal">Khách hàng phát sinh vãng lai</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
