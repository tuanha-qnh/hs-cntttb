/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Database, CalendarRange, Landmark, TrendingUp, HelpCircle, CheckCircle, BarChart3 } from 'lucide-react';
import { SubscriberRecord, Unit } from '../types';

interface Props {
  records: SubscriberRecord[];
  units: Record<string, string>; // Maps unit ID to unit Name
}

export default function DashboardStatsModule({ records, units }: Props) {
  const [hoveredDataPoint, setHoveredDataPoint] = useState<any | null>(null);

  // Calculates records counted by days (last 7 days trend)
  const getTrendData = () => {
    const dates: Record<string, number> = {};
    const today = new Date();
    
    // Auto populate last 7 days keys with starting zero
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
      dates[dateStr] = 0;
    }

    // Assign data records
    records.forEach((record) => {
      try {
        const d = new Date(record.createdAt);
        const dateStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
        if (dateStr in dates) {
          dates[dateStr] += 1;
        }
      } catch (e) {
        // Safe check skip
      }
    });

    return Object.entries(dates).map(([date, count]) => ({ date, count }));
  };

  const trendData = getTrendData();
  const maxCount = Math.max(...trendData.map((d) => d.count), 5); // Minimum cap to avoid divisor by zero

  // Calculating total statistics
  const totalRecordsCount = records.length;

  const getRecordsTodayCount = () => {
    const todayStr = new Date().toDateString();
    return records.filter((r) => {
      try {
        return new Date(r.createdAt).toDateString() === todayStr;
      } catch {
        return false;
      }
    }).length;
  };

  const todayCount = getRecordsTodayCount();

  // Aggregate by business unit
  const getUnitDistributionStats = () => {
    const distribution: Record<string, number> = {};
    records.forEach((record) => {
      const uName = record.unitName || 'Đơn vị vãng lai';
      distribution[uName] = (distribution[uName] || 0) + 1;
    });

    return Object.entries(distribution).sort((a, b) => b[1] - a[1]);
  };

  const unitDistribution = getUnitDistributionStats();

  // SVG Chart Geometry Specs
  const chartWidth = 600;
  const chartHeight = 220;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 40;

  const dataWidth = chartWidth - paddingLeft - paddingRight;
  const dataHeight = chartHeight - paddingTop - paddingBottom;

  return (
    <div className="space-y-6">
      {/* KPI Cards section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Total records */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between transition-all hover:shadow-sm hover:border-slate-300">
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-slate-400 font-sans uppercase tracking-widest block">Hồ sơ hệ thống</span>
            <p className="text-3xl font-black text-[#005BAA] font-mono leading-none">{totalRecordsCount}</p>
            <p className="text-[11px] text-slate-400 font-sans font-medium">Tổng bản khai lưu trữ trực tuyến</p>
          </div>
          <div className="bg-blue-50/50 border border-blue-100 p-3.5 rounded-xl text-[#005BAA]">
            <Database className="w-5 h-5 animate-pulse" />
          </div>
        </div>

        {/* Card 2: Records today */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between transition-all hover:shadow-sm hover:border-slate-300">
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-slate-400 font-sans uppercase tracking-widest block">Tiếp nhận Hôm nay</span>
            <p className="text-3xl font-black text-cyan-600 font-mono leading-none">{todayCount}</p>
            <p className="text-[11px] text-slate-400 font-sans font-medium">Đồng bộ liên tục trong ngày</p>
          </div>
          <div className="bg-cyan-50/50 border border-cyan-100 p-3.5 rounded-xl text-cyan-600">
            <CalendarRange className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Enterprise units with data */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between transition-all hover:shadow-sm hover:border-slate-300">
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-slate-400 font-sans uppercase tracking-widest block">Đơn vị cập nhật</span>
            <p className="text-3xl font-black text-slate-800 font-mono leading-none">
              {Object.keys(units || {}).length || 3}
            </p>
            <p className="text-[11px] text-slate-400 font-sans font-medium">Chi nhánh đồng bộ dữ liệu</p>
          </div>
          <div className="bg-slate-50/80 border border-slate-200/60 p-3.5 rounded-xl text-slate-500">
            <Landmark className="w-5 h-5" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Trend Graph using high performance embedded SVG rendering */}
        <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#005BAA]" />
                <h3 className="font-bold text-slate-800 text-xs font-sans uppercase tracking-wider">
                  Biểu đồ Xu Hướng Đồng Bộ (7 ngày qua)
                </h3>
              </div>
              <span className="text-[10px] bg-[#005BAA]/5 text-[#005BAA] border border-blue-100 font-bold px-2.5 py-0.5 rounded-md font-mono">
                Sản lượng / Ngày
              </span>
            </div>

            {/* Render SVG chart dynamically */}
            <div className="relative w-full h-[230px] flex items-center justify-center">
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full overflow-visible">
                <defs>
                  {/* Fill Area Gradient */}
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#005BAA" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#005BAA" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Draw Horizontal Grid Lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
                  const y = paddingTop + dataHeight * ratio;
                  const labelValue = Math.round(maxCount * (1 - ratio));
                  return (
                    <g key={index}>
                      <line
                        x1={paddingLeft}
                        y1={y}
                        x2={chartWidth - paddingRight}
                        y2={y}
                        className="stroke-slate-100"
                        strokeDasharray="4 4"
                      />
                      <text
                        x={paddingLeft - 8}
                        y={y + 4}
                        textAnchor="end"
                        className="fill-slate-400 font-mono text-[10px]"
                      >
                        {labelValue}
                      </text>
                    </g>
                  );
                })}

                {/* Plot Area Area/Line */}
                {(() => {
                  const points = trendData.map((d, index) => {
                    const x = paddingLeft + (dataWidth / (trendData.length - 1)) * index;
                    const y = paddingTop + dataHeight * (1 - d.count / maxCount);
                    return { x, y, ...d };
                  });

                  if (points.length === 0) return null;

                  // Create path d string
                  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                  const closedPathD = `${pathD} L ${points[points.length - 1].x} ${paddingTop + dataHeight} L ${points[0].x} ${paddingTop + dataHeight} Z`;

                  return (
                    <g>
                      {/* Gradient Fill under line */}
                      <path d={closedPathD} fill="url(#chartGradient)" />

                      {/* Main Stroke Line */}
                      <path d={pathD} fill="none" stroke="#005BAA" strokeWidth="3" strokeLinecap="round" />

                      {/* Interactive Data Nodes */}
                      {points.map((p, index) => {
                        const isHovered = hoveredDataPoint?.date === p.date;
                        return (
                          <g
                            key={index}
                            className="cursor-pointer"
                            onMouseEnter={() => setHoveredDataPoint(p)}
                            onMouseLeave={() => setHoveredDataPoint(null)}
                          >
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r={isHovered ? '7' : '4'}
                              className="fill-white stroke-[#005BAA] transition-all"
                              strokeWidth={isHovered ? '4' : '2'}
                            />
                            {/* Hover label guideline */}
                            {isHovered && (
                              <g>
                                <line
                                  x1={p.x}
                                  y1={paddingTop}
                                  x2={p.x}
                                  y2={paddingTop + dataHeight}
                                  className="stroke-cyan-500/50"
                                  strokeWidth="1"
                                  strokeDasharray="2 2"
                                />
                              </g>
                            )}
                          </g>
                        );
                      })}
                    </g>
                  );
                })()}

                {/* X Axis Labels */}
                {trendData.map((d, index) => {
                  const x = paddingLeft + (dataWidth / (trendData.length - 1)) * index;
                  const y = chartHeight - paddingBottom + 18;
                  return (
                    <text
                      key={index}
                      x={x}
                      y={y}
                      textAnchor="middle"
                      className="fill-slate-500 font-sans text-[10px]"
                    >
                      {d.date}
                    </text>
                  );
                })}
              </svg>

              {/* Dynamic Interactive Tooltip Display overlay */}
              {hoveredDataPoint && (
                <div
                  className="absolute bg-slate-900 border border-slate-800 text-white rounded-lg px-2.5 py-1.5 shadow-md flex flex-col text-left pointer-events-none"
                  style={{
                    left: `${(hoveredDataPoint.count / maxCount) * 40 + 30}%`,
                    top: '20px',
                  }}
                >
                  <span className="text-[9px] text-slate-400 font-sans font-medium uppercase">
                    Ngày {hoveredDataPoint.date}
                  </span>
                  <span className="text-xs font-bold text-yellow-300 font-mono">
                    {hoveredDataPoint.count} hồ sơ đồng bộ
                  </span>
                </div>
              )}
            </div>
          </div>

          <p className="text-[11px] text-slate-400 text-center font-sans">
            * Di chuột vào các điểm tròn xanh trên đồ thị để xem chi tiết dữ liệu thống kê hằng ngày.
          </p>
        </div>

        {/* Breakdown distribution list of business divisions */}
        <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between transition-all hover:shadow-sm">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-100 pb-4 mb-4">
              <BarChart3 className="w-4 h-4 text-[#005BAA]" />
              <h3 className="font-bold text-slate-800 text-xs font-sans uppercase tracking-wider">
                Tỉ Lệ Bản Khai Theo Đơn Vị
              </h3>
            </div>

            <div className="space-y-4">
              {unitDistribution.length > 0 ? (
                unitDistribution.slice(0, 5).map(([uName, count], idx) => {
                  const percentage = totalRecordsCount ? Math.round((count / totalRecordsCount) * 100) : 0;
                  return (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-sans text-slate-700">
                        <span className="font-semibold text-slate-700 truncate max-w-[200px]">{uName}</span>
                        <span className="font-mono font-bold text-[#005BAA] text-xs">
                          {count} <span className="text-slate-400 font-normal">({percentage}%)</span>
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100/80 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#005BAA] to-cyan-500 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12 text-slate-450 font-sans text-xs">
                  Chưa ghi nhận dữ liệu đơn vị tiếp nhận cập nhật.
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
            <span>Danh sách giới hạn Top 5 đơn vị dẫn đầu</span>
            <span className="font-mono text-[10px] text-slate-400">Real-time</span>
          </div>
        </div>
      </div>
    </div>
  );
}
