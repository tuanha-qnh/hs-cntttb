/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BookOpen, Database, HardDrive, Cpu, Key, CheckCircle, Copy, Terminal } from 'lucide-react';

export default function InteractiveGuide() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [workerTab, setWorkerTab] = useState<'js' | 'ts'>('js');

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const schemaSql = `-- 1 TẠO BẢNG ĐƠN VỊ & CHI NHÁNH
CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY,
  unit_id TEXT UNIQUE DEFAULT NULL,
  name TEXT NOT NULL,
  parentId TEXT
);

-- Chèn dữ liệu mẫu cho danh mục Đơn vị gốc
INSERT OR IGNORE INTO units (id, unit_id, name, parentId) VALUES ('UN_ROOT', 'UN_ROOT', 'VNPT Quảng Ninh', NULL);
INSERT OR IGNORE INTO units (id, unit_id, name, parentId) VALUES ('UN_HL', 'UN_HL', 'Trung tâm KD Hạ Long', 'UN_ROOT');
INSERT OR IGNORE INTO units (id, unit_id, name, parentId) VALUES ('UN_BC', 'UN_BC', 'Phòng BH Bãi Cháy', 'UN_HL');
INSERT OR IGNORE INTO units (id, unit_id, name, parentId) VALUES ('UN_CP', 'UN_CP', 'Trung tâm KD Cẩm Phả', 'UN_ROOT');

-- 2. TẠO BẢNG NHÂN SỰ & TÀI KHOẢN GIAO DỊCH VIÊN
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  fullName TEXT NOT NULL,
  role TEXT NOT NULL,
  unitId TEXT NOT NULL,
  isFirstLogin INTEGER NOT NULL,
  status TEXT NOT NULL,
  password TEXT NOT NULL DEFAULT 'Vnpt@2026'
);

-- Chèn dữ liệu tài khoản quản trị và giao dịch viên mẫu
INSERT OR IGNORE INTO users (id, username, fullName, role, unitId, isFirstLogin, status, password) VALUES ('admin', 'admin', 'Quản trị viên VNPT', 'Admin', 'UN_ROOT', 0, 'active', 'admin');
INSERT OR IGNORE INTO users (id, username, fullName, role, unitId, isFirstLogin, status, password) VALUES ('tuanha', 'tuanha', 'Trần Tuấn Anh', 'User', 'UN_BC', 1, 'active', 'Vnpt@2026');

-- 3. TẠO BẢNG HỒ SƠ THUÊ BAO
CREATE TABLE IF NOT EXISTS subscribers (
  id TEXT PRIMARY KEY,
  phoneNumber TEXT NOT NULL,
  fullName TEXT NOT NULL,
  idNumber TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  createdBy TEXT NOT NULL,
  creatorName TEXT NOT NULL,
  unitId TEXT NOT NULL,
  unitName TEXT NOT NULL,
  imageUrl TEXT NOT NULL
);

-- Index tìm kiếm tối ưu hóa cho tra cứu nhanh
CREATE INDEX IF NOT EXISTS idx_subscribers_phone ON subscribers(phoneNumber);
CREATE INDEX IF NOT EXISTS idx_subscribers_idNumber ON subscribers(idNumber);
CREATE INDEX IF NOT EXISTS idx_subscribers_name ON subscribers(fullName);

-- 4. TẠO BẢNG TẬP THUÊ BAO MỤC TIÊU CSDL D1
CREATE TABLE IF NOT EXISTS DS_TB_MUCTIEU (
  So_thue_bao TEXT PRIMARY KEY,
  Tap_thue_bao TEXT NOT NULL
);

-- 5. TẠO BẢNG KẾT QUẢ CẬP NHẬT TTTB CSDL D1
CREATE TABLE IF NOT EXISTS KQ_CNTTTB (
  so_thue_bao TEXT PRIMARY KEY,
  User_capnhat TEXT,
  Ma_hrm_CN TEXT,
  Kenh_CN TEXT,
  Ngay_CN TEXT
);`;

  const corsPolicyJson = `[
  {
    "AllowedOrigins": [
      "https://*.github.io",
      "https://hs-cntttb.vercel.app",
      "https://*.vercel.app",
      "https://ais-dev-enzd6l3kafvzqm77vnbpgr-84365574229.asia-southeast1.run.app",
      "https://ais-pre-enzd6l3kafvzqm77vnbpgr-84365574229.asia-southeast1.run.app",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD", "OPTIONS"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Length"],
    "MaxAgeSeconds": 86450
  }
]`;

  const workerCodeJs = `/**
 * Cloudflare Worker Backend cho Hệ thống lưu trữ VinaPhone TTTB (Mã JavaScript thuần)
 * Sao chép mã này dán trực tiếp vào trình soạn thảo Web của Cloudflare (worker.js)
 */

export default {
  async fetch(request, env) {
    // Xử lý CORS kích hoạt cho phép Frontend upload từ mọi nguồn
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-secret, *",
      "Access-Control-Max-Age": "86400",
    };

    // 1. Thao tác trước nhất: Trả về CORS ngay lập tức cho OPTIONS preflight request
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const rawPath = url.pathname;
    
    // Chuẩn hóa path: Xóa ký tự gạch chéo cuối cùng để so khớp tin cậy
    const path = rawPath.endsWith("/") && rawPath !== "/" ? rawPath.slice(0, -1) : rawPath;

    // Định nghĩa các biến logic định tuyến linh hoạt hỗ trợ cả có /api/ hoặc không có
    const isSubscribersPath = path === "/api/subscribers" || path === "/subscribers";
    const isUnitsPath = path === "/api/units" || path === "/units";
    const isUsersPath = path === "/api/users" || path === "/users";
    const isFilesPath = path.startsWith("/api/files/") || path.startsWith("/files/");
    const isTestPath = path === "/api/test" || path === "/test";

    // Khai báo định tuyến bổ sung cho Module quản lý CSDL D1 cập nhật TTTB
    const isSubMuctieuUploadPath = path === "/api/subscriber-status/upload-muctieu" || path === "/subscriber-status/upload-muctieu";
    const isSubKetquaUploadPath = path === "/api/subscriber-status/upload-ketqua" || path === "/subscriber-status/upload-ketqua";
    const isSubListPath = path === "/api/subscriber-status/list" || path === "/subscriber-status/list";
    const isSubLookupPath = path === "/api/subscriber-status/lookup" || path === "/subscriber-status/lookup";

    // Khởi tạo phản hồi mặc định bọc trong try-catch để gán CORS trong mọi trạng thái lỗi hoặc ngoại lệ
    try {
      // Xác thực API Key bảo mật nâng cao (Bỏ qua xác thực cho các yêu cầu xem/tải ảnh công khai qua GET để thẻ <img> hiển thị được)
      const isFileGet = isFilesPath && request.method === "GET";
      const clientSecret = request.headers.get("x-api-secret") || url.searchParams.get("secret");
      if (!isFileGet && env.API_SECRET && clientSecret !== env.API_SECRET) {
        return new Response(JSON.stringify({ error: "Xác thực không hợp lệ. Vui lòng kiểm tra API Secret trong cấu hình hệ thống máy bạn." }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Kiểm tra cấu hình ràng buộc tài nguyên Cloudflare bảo vệ chống Crash ngoài ý muốn
      if (!env.DB) {
        return new Response(JSON.stringify({ error: "Lỗi cấu hình Worker: Chưa liên kết Cơ sở dữ liệu D1 (Tên biến đặt trong Cloudflare Dashboard bắt buộc là: DB)." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      if (!env.R2_BUCKET) {
        return new Response(JSON.stringify({ error: "Lỗi cấu hình Worker: Chưa liên kết Object Storage R2 (Tên biến đặt trong Cloudflare Dashboard bắt buộc là: R2_BUCKET)." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 1. Endpoint: Lấy danh sách thuê bao (TRA CỨU)
      if (isSubscribersPath && request.method === "GET") {
        const query = url.searchParams.get("query") || "";
        let result;
        
        if (query) {
          result = await env.DB.prepare(
            "SELECT * FROM subscribers WHERE phoneNumber LIKE ?1 OR idNumber LIKE ?1 OR fullName LIKE ?1 ORDER BY createdAt DESC"
          ).bind(\`%\${query}%\`).all();
        } else {
          result = await env.DB.prepare("SELECT * FROM subscribers ORDER BY createdAt DESC LIMIT 100").all();
        }

        return new Response(JSON.stringify(result.results), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 2. Endpoint: Thêm mới thuê bao và upload ảnh lên R2
      if (isSubscribersPath && request.method === "POST") {
        const data = await request.json();
        const { id, phoneNumber, fullName, idNumber, createdAt, createdBy, creatorName, unitId, unitName, imageBase64 } = data;

        if (!phoneNumber || !fullName || !idNumber || !imageBase64) {
          return new Response(JSON.stringify({ error: "Dữ liệu bắt buộc bị thiếu." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        // Tải cấu dữ liệu Base64 an toàn hỗ trợ mọi định dạng ảnh chụp
        let base64Data = imageBase64;
        let mimeType = "image/jpeg";
        if (imageBase64.includes(";base64,")) {
          const parts = imageBase64.split(";base64,");
          mimeType = parts[0].split(":")[1] || "image/jpeg";
          base64Data = parts[1];
        }

        // Chuyển Base64 thành Uint8Array
        const binaryString = atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Upload trực tiếp lên Cloudflare R2
        const r2FileName = \`tttb/\${id}_\${phoneNumber}.jpg\`;
        await env.R2_BUCKET.put(r2FileName, bytes, {
          httpMetadata: { contentType: mimeType }
        });

        // Tạo public URL thông qua Worker proxy
        const imageUrl = \`\${url.origin}/api/files/\${r2FileName}\`;

        // Ghi nhận thông tin vào cơ sở dữ liệu Cloudflare D1
        await env.DB.prepare(
          "INSERT OR REPLACE INTO subscribers (id, phoneNumber, fullName, idNumber, createdAt, createdBy, creatorName, unitId, unitName, imageUrl) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)"
        ).bind(id, phoneNumber, fullName, idNumber, createdAt, createdBy, creatorName, unitId, unitName, imageUrl).run();

        return new Response(JSON.stringify({ success: true, id, imageUrl }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 3. Endpoint: Xem và tải ảnh từ Cloudflare R2
      if (isFilesPath && request.method === "GET") {
        const fileKey = path.startsWith("/api/files/") 
          ? path.replace("/api/files/", "") 
          : path.replace("/files/", "");

        const object = await env.R2_BUCKET.get(fileKey);

        if (object === null) {
          return new Response("Không tìm thấy tệp ảnh trong bộ lưu trữ Cloudflare R2.", { 
            status: 404,
            headers: corsHeaders
          });
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("Access-Control-Allow-Origin", "*");
        headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
        headers.set("etag", object.httpEtag);

        return new Response(object.body, { headers });
      }

      // 4. Endpoint: Lấy danh sách Đơn vị (GET UNITS)
      if (isUnitsPath && request.method === "GET") {
        const result = await env.DB.prepare("SELECT * FROM units ORDER BY id ASC").all();
        return new Response(JSON.stringify(result.results), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 5. Endpoint: Đồng bộ hóa Đơn vị (POST UNITS)
      if (isUnitsPath && request.method === "POST") {
        const { action, unit } = await request.json();
        if (!unit || !unit.id) {
          return new Response(JSON.stringify({ error: "Tham số đơn vị không hợp lệ." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        if (action === "delete") {
          await env.DB.prepare("DELETE FROM units WHERE id = ?1").bind(unit.id).run();
        } else {
          // "create" hoặc "update"
          await env.DB.prepare(
            "INSERT OR REPLACE INTO units (id, unit_id, name, parentId) VALUES (?1, ?2, ?3, ?4)"
          ).bind(unit.id, unit.unit_id || unit.id, unit.name, unit.parentId).run();
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 6. Endpoint: Lấy danh sách Nhân sự (GET USERS)
      if (isUsersPath && request.method === "GET") {
        const result = await env.DB.prepare("SELECT * FROM users ORDER BY id ASC").all();
        return new Response(JSON.stringify(result.results), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 7. Endpoint: Đồng bộ hóa Nhân sự (POST USERS)
      if (isUsersPath && request.method === "POST") {
        const { action, user = {} } = await request.json();
        if (!user || !user.id || !user.username) {
          return new Response(JSON.stringify({ error: "Tham số tài khoản không hợp lệ." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        if (action === "delete") {
          await env.DB.prepare("DELETE FROM users WHERE id = ?1").bind(user.id).run();
        } else {
          // "create" hoặc "update"
          const dbIsFirstLogin = user.isFirstLogin ? 1 : 0;
          const userPassword = user.password || "Vnpt@2026";
          await env.DB.prepare(
            "INSERT OR REPLACE INTO users (id, username, fullName, role, unitId, isFirstLogin, status, password) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"
          ).bind(user.id, user.username, user.fullName, user.role, user.unitId, dbIsFirstLogin, user.status, userPassword).run();
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 7.1. Cloud D1: Upload danh sách dải số thuê bao mục tiêu (Chế độ ghi đè dữ liệu cũ)
      if (isSubMuctieuUploadPath && request.method === "POST") {
        const { records } = await request.json();
        if (!Array.isArray(records)) {
          return new Response(JSON.stringify({ error: "Định dạng danh sách thuê bao không thích hợp." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const statements = [];
        // Xóa sạch toàn bộ dữ liệu cũ trước khi nạp mới để thực hiện chế độ Ghi đè
        statements.push(env.DB.prepare("DELETE FROM DS_TB_MUCTIEU"));

        for (const item of records) {
          const sdt = String(item.So_thue_bao || "").trim();
          if (!sdt) continue;
          const tap = String(item.Tap_thue_bao || "Mặc định").trim();
          statements.push(
            env.DB.prepare(
              "INSERT INTO DS_TB_MUCTIEU (So_thue_bao, Tap_thue_bao) VALUES (?1, ?2)"
            ).bind(sdt, tap)
          );
        }

        if (statements.length > 0) {
          await env.DB.batch(statements);
        }

        return new Response(JSON.stringify({ success: true, total: records.length }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 7.2. Cloud D1: Upload danh sách kết quả thực hiện cập nhật TTTB (Chế độ ghi đè dữ liệu cũ)
      if (isSubKetquaUploadPath && request.method === "POST") {
        const { records } = await request.json();
        if (!Array.isArray(records)) {
          return new Response(JSON.stringify({ error: "Định dạng danh sách kết quả không thích hợp." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const statements = [];
        // Xóa sạch toàn bộ dữ liệu cũ trước khi nạp mới để thực hiện chế độ Ghi đè
        statements.push(env.DB.prepare("DELETE FROM KQ_CNTTTB"));

        for (const item of records) {
          const sdt = String(item.so_thue_bao || "").trim();
          if (!sdt) continue;
          const user = String(item.User_capnhat || "").trim();
          const hrm = String(item.Ma_hrm_CN || "").trim();
          const kenh = String(item.Kenh_CN || "").trim();
          const ngay = String(item.Ngay_CN || "").trim();

          statements.push(
            env.DB.prepare(
              "INSERT INTO KQ_CNTTTB (so_thue_bao, User_capnhat, Ma_hrm_CN, Kenh_CN, Ngay_CN) VALUES (?1, ?2, ?3, ?4, ?5)"
            ).bind(sdt, user, hrm, kenh, ngay)
          );
        }

        if (statements.length > 0) {
          await env.DB.batch(statements);
        }

        return new Response(JSON.stringify({ success: true, total: records.length }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 7.3. Cloud D1: Danh sách tổng hợp trạng thái chuẩn hóa của tất cả dải máy
      if (isSubListPath && request.method === "GET") {
        const muctieuRes = await env.DB.prepare("SELECT * FROM DS_TB_MUCTIEU").all();
        const ketquaRes = await env.DB.prepare("SELECT * FROM KQ_CNTTTB").all();
        
        const muctieuList = muctieuRes.results || [];
        const ketquaList = ketquaRes.results || [];
        
        const unified = [];
        const visited = new Set();
        
        for (const item of muctieuList) {
          const sdt = String(item.So_thue_bao || "").trim();
          if (!sdt) continue;
          visited.add(sdt.toLowerCase());
          
          const kq = ketquaList.find(k => String(k.so_thue_bao || "").trim().toLowerCase() === sdt.toLowerCase());
          unified.push({
            So_thue_bao: sdt,
            Tap_thue_bao: item.Tap_thue_bao || "Mặc định",
            IsUpdated: !!kq,
            User_capnhat: kq ? kq.User_capnhat : null,
            Ma_hrm_CN: kq ? kq.Ma_hrm_CN : null,
            Kenh_CN: kq ? kq.Kenh_CN : null,
            Ngay_CN: kq ? kq.Ngay_CN : null,
          });
        }
        
        for (const item of ketquaList) {
          const sdt = String(item.so_thue_bao || "").trim();
          if (!sdt) continue;
          if (!visited.has(sdt.toLowerCase())) {
            unified.push({
              So_thue_bao: sdt,
              Tap_thue_bao: "Đồng bộ tự động (Phát sinh ngoài tập mục tiêu ban đầu)",
              IsUpdated: true,
              User_capnhat: item.User_capnhat,
              Ma_hrm_CN: item.Ma_hrm_CN,
              Kenh_CN: item.Kenh_CN,
              Ngay_CN: item.Ngay_CN,
            });
          }
        }
        
        return new Response(JSON.stringify({ success: true, records: unified }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 7.4. Cloud D1: Tra cứu đơn lẻ một thuê bao có đồng bộ chéo gia tăng dải số mục tiêu
      if (isSubLookupPath && request.method === "GET") {
        const phone = String(url.searchParams.get("phone") || "").trim();
        if (!phone) {
          return new Response(JSON.stringify({ error: "Thiếu số thuê bao tra cứu" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const cleanPhone = phone.replace(/^(\\+84|84)/, "0");

        const mtRes = await env.DB.prepare("SELECT * FROM DS_TB_MUCTIEU WHERE So_thue_bao = ?1 OR So_thue_bao = ?2").bind(cleanPhone, phone).first();
        const kqRes = await env.DB.prepare("SELECT * FROM KQ_CNTTTB WHERE so_thue_bao = ?1 OR so_thue_bao = ?2").bind(cleanPhone, phone).first();

        let mucTieuRecord = mtRes || null;
        let ketQuaRecord = kqRes || null;

        let didSync = false;
        if (ketQuaRecord && !mucTieuRecord) {
          mucTieuRecord = {
            So_thue_bao: ketQuaRecord.so_thue_bao || cleanPhone,
            Tap_thue_bao: "Đồng bộ tự động (Phát sinh ngoài tập mục tiêu ban đầu)"
          };
          await env.DB.prepare("INSERT OR REPLACE INTO DS_TB_MUCTIEU (So_thue_bao, Tap_thue_bao) VALUES (?1, ?2)").bind(mucTieuRecord.So_thue_bao, mucTieuRecord.Tap_thue_bao).run();
          didSync = true;
        }

        if (!mucTieuRecord && !ketQuaRecord) {
          return new Response(JSON.stringify({
            found: false,
            status: "NOT_FOUND",
            message: "Số thuê bao không tồn tại trong danh mục mục tiêu hay kết quả cập nhật."
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        return new Response(JSON.stringify({
          found: true,
          synchronized: didSync,
          So_thue_bao: phone,
          Tap_thue_bao: mucTieuRecord ? mucTieuRecord.Tap_thue_bao : "Đồng bộ tự động",
          IsUpdated: !!ketQuaRecord,
          User_capnhat: ketQuaRecord ? ketQuaRecord.User_capnhat : null,
          Ma_hrm_CN: ketQuaRecord ? ketQuaRecord.Ma_hrm_CN : null,
          Kenh_CN: ketQuaRecord ? ketQuaRecord.Kenh_CN : null,
          Ngay_CN: ketQuaRecord ? ketQuaRecord.Ngay_CN : null
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 8. Endpoint: Kiểm tra kết nối kiểm thử hệ thống
      if (isTestPath && request.method === "GET") {
        return new Response(JSON.stringify({ status: "connected", db: "D1", storage: "R2", time: new Date().toISOString() }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ error: "Endpoint hoặc phương thức HTTP không tồn tại trên Cloudflare Worker của bạn." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: "Lỗi thực thi Worker: " + err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }
};`;

  const workerCodeTs = `/**
 * Cloudflare Worker Backend cho Hệ thống lưu trữ VinaPhone TTTB (Mã nguồn TypeScript)
 * Hỗ trợ lưu trữ Metadata vào Cloudflare D1 (Subscribers, Units, Users) và Ảnh lên Cloudflare R2
 */

export interface Env {
  // Binding với cơ sở dữ liệu D1
  DB: D1Database;
  // Binding với Object Storage R2
  R2_BUCKET: R2Bucket;
  // Khóa bí mật bảo mật kết nối API giữa Frontend và Worker
  API_SECRET: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Xử lý CORS kích hoạt cho phép Frontend upload từ mọi nguồn (bao gồm Github Pages, Vercel)
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-secret, *",
      "Access-Control-Max-Age": "86400",
    };

    // 1. Thao tác trước nhất: Trả về CORS ngay lập tức cho OPTIONS preflight request
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const rawPath = url.pathname;
    
    // Chuẩn hóa path: Xóa ký tự gạch chéo cuối cùng để so khớp tin cậy
    const path = rawPath.endsWith("/") && rawPath !== "/" ? rawPath.slice(0, -1) : rawPath;

    // Định nghĩa các biến logic định tuyến linh hoạt hỗ trợ cả có /api/ hoặc không có
    const isSubscribersPath = path === "/api/subscribers" || path === "/subscribers";
    const isUnitsPath = path === "/api/units" || path === "/units";
    const isUsersPath = path === "/api/users" || path === "/users";
    const isFilesPath = path.startsWith("/api/files/") || path.startsWith("/files/");
    const isTestPath = path === "/api/test" || path === "/test";

    // Khai báo định tuyến bổ sung cho Module quản lý CSDL D1 cập nhật TTTB (TS Worker)
    const isSubMuctieuUploadPath = path === "/api/subscriber-status/upload-muctieu" || path === "/subscriber-status/upload-muctieu";
    const isSubKetquaUploadPath = path === "/api/subscriber-status/upload-ketqua" || path === "/subscriber-status/upload-ketqua";
    const isSubListPath = path === "/api/subscriber-status/list" || path === "/subscriber-status/list";
    const isSubLookupPath = path === "/api/subscriber-status/lookup" || path === "/subscriber-status/lookup";

    // Khởi tạo phản hồi mặc định bọc trong try-catch để gán CORS trong mọi trạng thái lỗi hoặc ngoại lệ
    try {
      // Xác thực API Key bảo mật nâng cao (Bỏ qua xác thực cho các yêu cầu xem/tải ảnh công khai qua GET để thẻ <img> hiển thị được)
      const isFileGet = isFilesPath && request.method === "GET";
      const clientSecret = request.headers.get("x-api-secret") || url.searchParams.get("secret");
      if (!isFileGet && env.API_SECRET && clientSecret !== env.API_SECRET) {
        return new Response(JSON.stringify({ error: "Xác thực không hợp lệ. Vui lòng kiểm tra API Secret trong cấu hình." }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Kiểm tra cấu hình ràng buộc tài nguyên Cloudflare bảo vệ chống Crash ngoài ý muốn
      if (!env.DB) {
        return new Response(JSON.stringify({ error: "Lỗi cấu hình Worker: Chưa liên kết Cơ sở dữ liệu D1 (Tên biến đặt trong Cloudflare Dashboard bắt buộc là: DB)." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      if (!env.R2_BUCKET) {
        return new Response(JSON.stringify({ error: "Lỗi cấu hình Worker: Chưa liên kết Object Storage R2 (Tên biến đặt trong Cloudflare Dashboard bắt buộc là: R2_BUCKET)." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 1. Endpoint: Lấy danh sách thuê bao (TRA CỨU)
      if (isSubscribersPath && request.method === "GET") {
        const query = url.searchParams.get("query") || "";
        let result;
        
        if (query) {
          result = await env.DB.prepare(
            "SELECT * FROM subscribers WHERE phoneNumber LIKE ?1 OR idNumber LIKE ?1 OR fullName LIKE ?1 ORDER BY createdAt DESC"
          ).bind(\`%\${query}%\`).all();
        } else {
          result = await env.DB.prepare("SELECT * FROM subscribers ORDER BY createdAt DESC LIMIT 100").all();
        }

        return new Response(JSON.stringify(result.results), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 2. Endpoint: Thêm mới thuê bao và upload ảnh lên R2
      if (isSubscribersPath && request.method === "POST") {
        const data = await request.json() as any;
        const { id, phoneNumber, fullName, idNumber, createdAt, createdBy, creatorName, unitId, unitName, imageBase64 } = data;

        if (!phoneNumber || !fullName || !idNumber || !imageBase64) {
          return new Response(JSON.stringify({ error: "Dữ liệu bắt buộc bị thiếu." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        // Tải cấu dữ liệu Base64 an toàn hỗ trợ mọi định dạng ảnh chụp
        let base64Data = imageBase64;
        let mimeType = "image/jpeg";
        if (imageBase64.includes(";base64,")) {
          const parts = imageBase64.split(";base64,");
          mimeType = parts[0].split(":")[1] || "image/jpeg";
          base64Data = parts[1];
        }

        // Chuyển Base64 thành Binary Buffer một cách an toàn và chống quá tải CPU
        const binaryString = atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Tạo định danh tệp và upload trực tiếp lên Cloudflare R2
        const r2FileName = \`tttb/\${id}_\${phoneNumber}.jpg\`;
        await env.R2_BUCKET.put(r2FileName, bytes, {
          httpMetadata: { contentType: mimeType }
        });

        // Tạo public URL thông qua Worker proxy
        const imageUrl = \`\${url.origin}/api/files/\${r2FileName}\`;

        // Ghi nhận thông tin vào cơ sở dữ liệu Cloudflare D1
        await env.DB.prepare(
          "INSERT OR REPLACE INTO subscribers (id, phoneNumber, fullName, idNumber, createdAt, createdBy, creatorName, unitId, unitName, imageUrl) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)"
        ).bind(id, phoneNumber, fullName, idNumber, createdAt, createdBy, creatorName, unitId, unitName, imageUrl).run();

        return new Response(JSON.stringify({ success: true, id, imageUrl }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 3. Endpoint: Xem và tải ảnh từ Cloudflare R2
      if (isFilesPath && request.method === "GET") {
        const fileKey = path.startsWith("/api/files/") 
          ? path.replace("/api/files/", "") 
          : path.replace("/files/", "");

        const object = await env.R2_BUCKET.get(fileKey);

        if (object === null) {
          return new Response("Không tìm thấy tệp ảnh trong bộ lưu trữ Cloudflare R2.", { 
            status: 404,
            headers: corsHeaders
          });
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("Access-Control-Allow-Origin", "*");
        headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
        headers.set("etag", object.httpEtag);

        return new Response(object.body, { headers });
      }

      // 4. Endpoint: Lấy danh sách Đơn vị (GET UNITS)
      if (isUnitsPath && request.method === "GET") {
        const result = await env.DB.prepare("SELECT * FROM units ORDER BY id ASC").all();
        return new Response(JSON.stringify(result.results), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 5. Endpoint: Đồng bộ hóa Đơn vị (POST UNITS)
      if (isUnitsPath && request.method === "POST") {
        const { action, unit } = await request.json() as any;
        if (!unit || !unit.id) {
          return new Response(JSON.stringify({ error: "Tham số đơn vị không hợp lệ." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        if (action === "delete") {
          await env.DB.prepare("DELETE FROM units WHERE id = ?1").bind(unit.id).run();
        } else {
          // "create" hoặc "update"
          await env.DB.prepare(
            "INSERT OR REPLACE INTO units (id, unit_id, name, parentId) VALUES (?1, ?2, ?3, ?4)"
          ).bind(unit.id, unit.unit_id || unit.id, unit.name, unit.parentId).run();
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 6. Endpoint: Lấy danh sách Nhân sự (GET USERS)
      if (isUsersPath && request.method === "GET") {
        const result = await env.DB.prepare("SELECT * FROM users ORDER BY id ASC").all();
        return new Response(JSON.stringify(result.results), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 7. Endpoint: Đồng bộ hóa Nhân sự (POST USERS)
      if (isUsersPath && request.method === "POST") {
        const { action, user } = await request.json() as any;
        if (!user || !user.id || !user.username) {
          return new Response(JSON.stringify({ error: "Tham số tài khoản không hợp lệ." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        if (action === "delete") {
          await env.DB.prepare("DELETE FROM users WHERE id = ?1").bind(user.id).run();
        } else {
          // "create" hoặc "update"
          const dbIsFirstLogin = user.isFirstLogin ? 1 : 0;
          const userPassword = user.password || "Vnpt@2026";
          await env.DB.prepare(
            "INSERT OR REPLACE INTO users (id, username, fullName, role, unitId, isFirstLogin, status, password) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"
          ).bind(user.id, user.username, user.fullName, user.role, user.unitId, dbIsFirstLogin, user.status, userPassword).run();
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 7.1. Cloud D1: Upload danh sách dải số thuê bao mục tiêu (Chế độ ghi đè dữ liệu cũ)
      if (isSubMuctieuUploadPath && request.method === "POST") {
        const { records } = await request.json() as any;
        if (!Array.isArray(records)) {
          return new Response(JSON.stringify({ error: "Định dạng danh sách thuê bao không thích hợp." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const statements = [];
        // Xóa sạch toàn bộ dữ liệu cũ trước khi nạp mới để thực hiện chế độ Ghi đè
        statements.push(env.DB.prepare("DELETE FROM DS_TB_MUCTIEU"));

        for (const item of records) {
          const sdt = String(item.So_thue_bao || "").trim();
          if (!sdt) continue;
          const tap = String(item.Tap_thue_bao || "Mặc định").trim();
          statements.push(
            env.DB.prepare(
              "INSERT INTO DS_TB_MUCTIEU (So_thue_bao, Tap_thue_bao) VALUES (?1, ?2)"
            ).bind(sdt, tap)
          );
        }

        if (statements.length > 0) {
          await env.DB.batch(statements);
        }

        return new Response(JSON.stringify({ success: true, total: records.length }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 7.2. Cloud D1: Upload danh sách kết quả thực hiện cập nhật TTTB (Chế độ ghi đè dữ liệu cũ)
      if (isSubKetquaUploadPath && request.method === "POST") {
        const { records } = await request.json() as any;
        if (!Array.isArray(records)) {
          return new Response(JSON.stringify({ error: "Định dạng danh sách kết quả không thích hợp." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const statements = [];
        // Xóa sạch toàn bộ dữ liệu cũ trước khi nạp mới để thực hiện chế độ Ghi đè
        statements.push(env.DB.prepare("DELETE FROM KQ_CNTTTB"));

        for (const item of records) {
          const sdt = String(item.so_thue_bao || "").trim();
          if (!sdt) continue;
          const user = String(item.User_capnhat || "").trim();
          const hrm = String(item.Ma_hrm_CN || "").trim();
          const kenh = String(item.Kenh_CN || "").trim();
          const ngay = String(item.Ngay_CN || "").trim();

          statements.push(
            env.DB.prepare(
              "INSERT INTO KQ_CNTTTB (so_thue_bao, User_capnhat, Ma_hrm_CN, Kenh_CN, Ngay_CN) VALUES (?1, ?2, ?3, ?4, ?5)"
            ).bind(sdt, user, hrm, kenh, ngay)
          );
        }

        if (statements.length > 0) {
          await env.DB.batch(statements);
        }

        return new Response(JSON.stringify({ success: true, total: records.length }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 7.3. Cloud D1: Danh sách tổng hợp trạng thái chuẩn hóa của tất cả dải máy
      if (isSubListPath && request.method === "GET") {
        const muctieuRes = await env.DB.prepare("SELECT * FROM DS_TB_MUCTIEU").all();
        const ketquaRes = await env.DB.prepare("SELECT * FROM KQ_CNTTTB").all();
        
        const muctieuList = (muctieuRes.results || []) as any[];
        const ketquaList = (ketquaRes.results || []) as any[];
        
        const unified = [];
        const visited = new Set();
        
        for (const item of muctieuList) {
          const sdt = String(item.So_thue_bao || "").trim();
          if (!sdt) continue;
          visited.add(sdt.toLowerCase());
          
          const kq = ketquaList.find(k => String(k.so_thue_bao || "").trim().toLowerCase() === sdt.toLowerCase());
          unified.push({
            So_thue_bao: sdt,
            Tap_thue_bao: item.Tap_thue_bao || "Mặc định",
            IsUpdated: !!kq,
            User_capnhat: kq ? kq.User_capnhat : null,
            Ma_hrm_CN: kq ? kq.Ma_hrm_CN : null,
            Kenh_CN: kq ? kq.Kenh_CN : null,
            Ngay_CN: kq ? kq.Ngay_CN : null,
          });
        }
        
        for (const item of ketquaList) {
          const sdt = String(item.so_thue_bao || "").trim();
          if (!sdt) continue;
          if (!visited.has(sdt.toLowerCase())) {
            unified.push({
              So_thue_bao: sdt,
              Tap_thue_bao: "Đồng bộ tự động (Phát sinh ngoài tập mục tiêu ban đầu)",
              IsUpdated: true,
              User_capnhat: item.User_capnhat,
              Ma_hrm_CN: item.Ma_hrm_CN,
              Kenh_CN: item.Kenh_CN,
              Ngay_CN: item.Ngay_CN,
            });
          }
        }
        
        return new Response(JSON.stringify({ success: true, records: unified }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 7.4. Cloud D1: Tra cứu đơn lẻ một thuê bao có đồng bộ chéo gia tăng dải số mục tiêu
      if (isSubLookupPath && request.method === "GET") {
        const phone = String(url.searchParams.get("phone") || "").trim();
        if (!phone) {
          return new Response(JSON.stringify({ error: "Thiếu số thuê bao tra cứu" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const cleanPhone = phone.replace(/^(\\+84|84)/, "0");

        const mtRes = await env.DB.prepare("SELECT * FROM DS_TB_MUCTIEU WHERE So_thue_bao = ?1 OR So_thue_bao = ?2").bind(cleanPhone, phone).first() as any;
        const kqRes = await env.DB.prepare("SELECT * FROM KQ_CNTTTB WHERE so_thue_bao = ?1 OR so_thue_bao = ?2").bind(cleanPhone, phone).first() as any;

        let mucTieuRecord = mtRes || null;
        let ketQuaRecord = kqRes || null;

        let didSync = false;
        if (ketQuaRecord && !mucTieuRecord) {
          mucTieuRecord = {
            So_thue_bao: ketQuaRecord.so_thue_bao || cleanPhone,
            Tap_thue_bao: "Đồng bộ tự động (Phát sinh ngoài tập mục tiêu ban đầu)"
          };
          await env.DB.prepare("INSERT OR REPLACE INTO DS_TB_MUCTIEU (So_thue_bao, Tap_thue_bao) VALUES (?1, ?2)").bind(mucTieuRecord.So_thue_bao, mucTieuRecord.Tap_thue_bao).run();
          didSync = true;
        }

        if (!mucTieuRecord && !ketQuaRecord) {
          return new Response(JSON.stringify({
            found: false,
            status: "NOT_FOUND",
            message: "Số thuê bao không tồn tại trong danh mục mục tiêu hay kết quả cập nhật."
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        return new Response(JSON.stringify({
          found: true,
          synchronized: didSync,
          So_thue_bao: phone,
          Tap_thue_bao: mucTieuRecord ? mucTieuRecord.Tap_thue_bao : "Đồng bộ tự động",
          IsUpdated: !!ketQuaRecord,
          User_capnhat: ketQuaRecord ? ketQuaRecord.User_capnhat : null,
          Ma_hrm_CN: ketQuaRecord ? ketQuaRecord.Ma_hrm_CN : null,
          Kenh_CN: ketQuaRecord ? ketQuaRecord.Kenh_CN : null,
          Ngay_CN: ketQuaRecord ? ketQuaRecord.Ngay_CN : null
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 8. Endpoint: Kiểm tra kết nối kiểm thử hệ thống
      if (isTestPath && request.method === "GET") {
        return new Response(JSON.stringify({ status: "connected", db: "D1", storage: "R2", time: new Date().toISOString() }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ error: "Endpoint hoặc phương thức HTTP không tồn tại trên Cloudflare Worker của bạn." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch (err: any) {
      return new Response(JSON.stringify({ error: "Lỗi thực thi Worker: " + err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }
};`;

  const wranglerConfig = `name = "vinaphone-tttb-worker"
main = "src/index.ts"
compatibility_date = "2026-05-26"

# 1. Liên kết Cơ sở dữ liệu Cloudflare D1
[[d1_databases]]
binding = "DB"
database_name = "vinaphone-tttb-db"
database_id = "MÃ_GIÁ_TRỊ_DATABASE_ID_CỦA_BẠN_SAU_KHI_TẠO_D1"

# 2. Liên kết Bộ lưu trữ Cloudflare R2 Storage
[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "vinaphone-tttb-bucket"

# 3. Biến môi trường bảo mật
[vars]
API_SECRET = "Mật_Khẩu_Tự_Chọn_Bảo_Mật_Cao_Cho_Hệ_Thống"`;

  return (
    <div className="space-y-8 bg-slate-50 p-6 rounded-2xl border border-slate-200">
      <div>
        <div className="flex items-center gap-3">
          <BookOpen className="w-8 h-8 text-[#005BAA]" />
          <div>
            <h2 className="text-xl font-bold text-slate-900 font-sans">
              CẨM TAY CHỈ VIỆC: Cấu Hình Cloudflare D1 & R2 Storage
            </h2>
            <p className="text-sm text-slate-500 font-sans mt-0.5">
              Hướng dẫn triển khai chi tiết từng bước tạo Database và Bộ lưu trữ đám mây Cloudflare chạy trực tuyến 100%.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Step 1 */}
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold px-2.5 py-1 bg-[#005BAA]/10 text-[#005BAA] rounded-full font-mono">
                BƯỚC 1
              </span>
              <Database className="w-5 h-5 text-slate-400" />
            </div>
            <h3 className="font-semibold text-slate-800 text-sm">Cơ cấu dữ liệu Cloudflare D1</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Truy cập Cloudflare Dashboard → <strong>D1 Databases</strong> → Tạo Cơ sở dữ liệu mới với tên 
              <code className="bg-slate-100 text-[#005BAA] px-1 py-0.5 rounded font-mono mx-1">vinaphone-tttb-db</code>.
              Sau đó chạy đoạn mã SQL khởi tạo bảng lưu trữ ở bên dưới.
            </p>
          </div>
        </div>

        {/* Step 2 */}
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold px-2.5 py-1 bg-[#005BAA]/10 text-[#005BAA] rounded-full font-mono">
                BƯỚC 2
              </span>
              <HardDrive className="w-5 h-5 text-slate-400" />
            </div>
            <h3 className="font-semibold text-slate-800 text-sm">Bộ lưu trữ Cloudflare R2 Upload</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Vào mục <strong>R2 Object Storage</strong> → Tạo Bucket với tên tệp 
              <code className="bg-slate-100 text-[#005BAA] px-1 py-0.5 rounded font-mono mx-1">vinaphone-tttb-bucket</code>.
              Trong thẻ <i>CORS Policy</i> của R2, thiết lập các quyền cho phép truy cập từ mọi nguồn gốc HTTP để phục vụ tải trực tiếp.
            </p>
          </div>
        </div>

        {/* Step 3 */}
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold px-2.5 py-1 bg-[#005BAA]/10 text-[#005BAA] rounded-full font-mono">
                BƯỚC 3
              </span>
              <Cpu className="w-5 h-5 text-slate-400" />
            </div>
            <h3 className="font-semibold text-slate-800 text-sm">Triển khai Cloudflare Worker API</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Tạo một dự án hoặc dán mã nguồn Cloudflare Worker được viết sẵn bên dưới vào khu vực quản trị Script để thực hiện cầu nối API chuyển dữ liệu về CSDL.
            </p>
          </div>
        </div>
      </div>

      {/* SQL Setup Block */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 text-xs text-amber-800 leading-relaxed font-sans">
          <div className="flex items-center gap-2 font-bold text-amber-900 mb-1">
            <span>⚠ LƯU Ý QUAN TRỌNG VỀ ĐỒNG BỘ MẬT KHẨU (PASSWORD)</span>
          </div>
          <p>
            Nếu bạn đã tạo cơ sở dữ liệu D1 từ các phiên bản hướng dẫn trước đó, bảng <code className="bg-amber-100 font-mono px-1 py-0.5 rounded text-amber-950">users</code> của bạn có thể <strong>thiếu cột password</strong>. 
            Điều này làm cho quá trình đồng bộ tài khoản từ các giao diện/trình duyệt khác bị lỗi và giao dịch viên mới thêm <strong>không thể đăng nhập được ở thiết bị khác</strong>.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button
              onClick={() => copyToClipboard("ALTER TABLE users ADD COLUMN password TEXT NOT NULL DEFAULT 'Vnpt@2026';", 'alter_sql')}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold cursor-pointer transition text-[10px] flex items-center gap-1 active:scale-95"
            >
              <Copy className="w-3 h-3" />
              {copiedId === 'alter_sql' ? 'Đã copy câu lệnh nâng cấp!' : 'Copy lệnh SQL nâng cấp (Giữ lại User cũ)'}
            </button>
            <button
              onClick={() => copyToClipboard(`DROP TABLE IF EXISTS users;
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  fullName TEXT NOT NULL,
  role TEXT NOT NULL,
  unitId TEXT NOT NULL,
  isFirstLogin INTEGER NOT NULL,
  status TEXT NOT NULL,
  password TEXT NOT NULL DEFAULT 'Vnpt@2026'
);
INSERT OR IGNORE INTO users (id, username, fullName, role, unitId, isFirstLogin, status, password) VALUES ('admin', 'admin', 'Quản trị viên VNPT', 'Admin', 'UN_ROOT', 0, 'active', 'admin');
INSERT OR IGNORE INTO users (id, username, fullName, role, unitId, isFirstLogin, status, password) VALUES ('tuanha', 'tuanha', 'Trần Tuấn Anh', 'User', 'UN_BC', 1, 'active', 'Vnpt@2026');`, 'recreate_sql')}
              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold cursor-pointer transition text-[10px] flex items-center gap-1 active:scale-95"
            >
              <Copy className="w-3 h-3" />
              {copiedId === 'recreate_sql' ? 'Đã copy câu lệnh tạo lại!' : 'Copy lệnh SQL Cài đặt lại từ đầu'}
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-amber-700">
            * Sau khi bổ sung cột <code className="font-mono">password</code> trên Cloudflare D1 Console, bạn chỉ cần bấm nút <strong>"Đồng bộ Offline → Cloud"</strong> trong Bảng quản trị để đẩy toàn bộ dữ liệu người dùng và mật khẩu hiện tại từ máy của bạn lên Cloud trực tuyến.
          </p>
        </div>

        {/* Warning block for Foreign Key constraints */}
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-3.5 text-xs text-rose-800 leading-relaxed font-sans">
          <div className="flex items-center gap-2 font-bold text-rose-950 mb-1">
            <span>🛠 CÁCH KHẮC PHỤC LỖI KHÓA NGOẠI (FOREIGN KEY CONSTRAINT FAILED)</span>
          </div>
          <p className="mb-2">
            Nếu bạn gặp thông báo lỗi <strong className="text-rose-950">"D1_ERROR: FOREIGN KEY constraint failed"</strong> khi thực hiện Tải dữ liệu từ tệp Excel lên Cơ sở dữ liệu D1 Cloud, lý do là do cơ sở dữ liệu cũ của bạn có chứa các ràng buộc khóa ngoại cứng nhắc (Foreign Key constraints) không đồng bộ giữa bảng Mục Tiêu / Kết Quả / Nhân Sự.
          </p>
          <p className="mb-2.5">
            Hãy sao chép và thực thi câu lệnh SQL bên dưới tại Cloudflare D1 Console để <strong>xóa bỏ các ràng buộc khóa ngoại cứng</strong> và khởi tạo lại cấu trúc lưu trữ chuẩn hóa, mềm dẻo cho phép đồng bộ tự do:
          </p>
          <button
            onClick={() => copyToClipboard(`DROP TABLE IF EXISTS KQ_CNTTTB;
CREATE TABLE KQ_CNTTTB (
  so_thue_bao TEXT PRIMARY KEY,
  User_capnhat TEXT,
  Ma_hrm_CN TEXT,
  Kenh_CN TEXT,
  Ngay_CN TEXT
);

DROP TABLE IF EXISTS DS_TB_MUCTIEU;
CREATE TABLE DS_TB_MUCTIEU (
  So_thue_bao TEXT PRIMARY KEY,
  Tap_thue_bao TEXT NOT NULL
);

DROP TABLE IF EXISTS subscribers;
CREATE TABLE subscribers (
  id TEXT PRIMARY KEY,
  phoneNumber TEXT NOT NULL,
  fullName TEXT NOT NULL,
  idNumber TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  createdBy TEXT NOT NULL,
  creatorName TEXT NOT NULL,
  unitId TEXT NOT NULL,
  unitName TEXT NOT NULL,
  imageUrl TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subscribers_phone ON subscribers(phoneNumber);
CREATE INDEX IF NOT EXISTS idx_subscribers_idNumber ON subscribers(idNumber);
CREATE INDEX IF NOT EXISTS idx_subscribers_name ON subscribers(fullName);`, 'fix_fk_sql')}
            className="px-2.5 py-1 bg-rose-750 hover:bg-rose-800 text-white rounded font-bold cursor-pointer transition text-[10px] flex items-center gap-1 active:scale-95 text-xs inline-flex mb-1"
          >
            <Copy className="w-3 h-3" />
            {copiedId === 'fix_fk_sql' ? 'Đã copy câu lệnh sửa lỗi!' : 'Copy lệnh SQL Xóa & Tạo lại bảng chuẩn (Sửa lỗi FOREIGN KEY)'}
          </button>
          <p className="mt-1.5 text-[10px] text-rose-700">
            * Sau khi thực thi đoạn mã trên, cơ sở dữ liệu D1 trực tuyến sẽ sẵn sàng đón nhận dữ liệu từ mọi nguồn cập nhật mà không bị xung đột khóa ngoại nữa. Bạn có thể bấm <strong>"Tiến hành tải lên"</strong> lại trên giao diện.
          </p>
        </div>

        <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-400"></span>
            <span className="w-3 h-3 rounded-full bg-yellow-400"></span>
            <span className="w-3 h-3 rounded-full bg-green-400"></span>
            <span className="text-xs font-mono font-medium text-slate-600 ml-2">D1_SQL_SCHEMA.sql</span>
          </div>
          <button
            onClick={() => copyToClipboard(schemaSql, 'sql')}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#005BAA] transition-colors cursor-pointer"
          >
            {copiedId === 'sql' ? (
              <>
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-500 font-medium">Đã sao chép!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Sao chép SQL</span>
              </>
            )}
          </button>
        </div>
        <div className="p-4 bg-slate-950 font-mono text-xs text-[#00FFCC] overflow-x-auto max-h-56">
          <pre>{schemaSql}</pre>
        </div>
      </div>

      {/* CORS Setup Block */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mt-6">
        <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-cyan-400"></span>
            <span className="w-3 h-3 rounded-full bg-blue-400"></span>
            <span className="w-3 h-3 rounded-full bg-slate-450"></span>
            <span className="text-xs font-mono font-medium text-slate-700 ml-2">R2_BUCKET_CORS_POLICY.json</span>
          </div>
          <button
            onClick={() => copyToClipboard(corsPolicyJson, 'cors')}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#005BAA] transition-colors cursor-pointer"
          >
            {copiedId === 'cors' ? (
              <>
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-500 font-medium">Đã sao chép!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Sao chép CORS</span>
              </>
            )}
          </button>
        </div>
        <div className="p-4 bg-slate-950 font-mono text-xs text-cyan-300 overflow-x-auto max-h-56">
          <pre>{corsPolicyJson}</pre>
        </div>
        <div className="bg-slate-50 border-t border-slate-100 px-4.5 py-3 text-xs text-slate-500 leading-relaxed font-sans">
          💡 <strong>Cách nhập:</strong> Vào Cloudflare &rarr; <strong>R2 Object Storage</strong> &rarr; Chọn Bucket <code className="bg-slate-200/60 px-1 py-0.5 rounded font-mono text-[10px]">vinaphone-tttb-bucket</code> &rarr; thẻ <strong>Settings</strong> &rarr; Cuộn xuống phần <strong>CORS Policy</strong> &rarr; bấm <strong>Edit CORS Policy</strong> &rarr; Dán nội dung trên &rarr; <strong>Save</strong>.
        </div>
      </div>

      {/* Wrangler CLI instruction */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mt-6">
        <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-slate-600" />
            <span className="text-xs font-mono font-medium text-slate-600">wrangler.toml</span>
          </div>
          <button
            onClick={() => copyToClipboard(wranglerConfig, 'wrangler')}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#005BAA] transition-colors cursor-pointer"
          >
            {copiedId === 'wrangler' ? (
              <>
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-500 font-medium">Đã sao chép!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Sao chép Wrangler</span>
              </>
            )}
          </button>
        </div>
        <div className="p-4 bg-slate-950 font-mono text-xs text-slate-300 overflow-x-auto max-h-56">
          <pre>{wranglerConfig}</pre>
        </div>
      </div>

      {/* Cloudflare Worker Source Code Block */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mt-6">
        <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 bg-yellow-100 text-yellow-800 rounded-full font-mono">
              WORKER API
            </span>
            <div className="flex bg-slate-200/80 p-0.5 rounded-lg border border-slate-300">
              <button
                type="button"
                onClick={() => setWorkerTab('js')}
                className={`text-[11px] px-2.5 py-1 rounded-md font-medium transition cursor-pointer select-none ${workerTab === 'js' ? 'bg-white text-[#005BAA] shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Mã JavaScript (Khuyên dùng - Dán Web)
              </button>
              <button
                type="button"
                onClick={() => setWorkerTab('ts')}
                className={`text-[11px] px-2.5 py-1 rounded-md font-medium transition cursor-pointer select-none ${workerTab === 'ts' ? 'bg-white text-[#005BAA] shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Mã TypeScript CLI
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => copyToClipboard(workerTab === 'js' ? workerCodeJs : workerCodeTs, 'worker')}
            className="flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-[#005BAA] transition-colors cursor-pointer self-end sm:self-auto bg-white sm:bg-transparent px-3 py-1.5 sm:p-0 rounded border sm:border-0 border-slate-200"
          >
            {copiedId === 'worker' ? (
              <>
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-500 font-medium">Đã sao chép!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Sao chép Mã nguồn ({workerTab === 'js' ? 'JS' : 'TS'})</span>
              </>
            )}
          </button>
        </div>
        <div className="p-4 bg-slate-950 font-mono text-xs text-slate-200 overflow-x-auto max-h-[500px]">
          <pre>{workerTab === 'js' ? workerCodeJs : workerCodeTs}</pre>
        </div>
      </div>

      {/* Guide Steps Manual */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
        <h3 className="text-base font-bold text-slate-900 border-b pb-2 flex items-center gap-2">
          <Key className="w-4 h-4 text-[#005BAA]" />
          Hướng dẫn tích hợp đầu cuối (Cầm tay chỉ việc cho Admin)
        </h3>
        <ol className="list-decimal list-inside space-y-3.5 text-sm text-slate-600 leading-relaxed font-sans">
          <li>
            <strong>Khởi động Worker:</strong> Tạo một thư mục trống, chạy lệnh <code className="bg-slate-100 text-[#005BAA] px-1 py-0.5 rounded font-mono text-xs">npm init -y</code> và <code className="bg-slate-100 text-[#005BAA] px-1 py-0.5 rounded font-mono text-xs">npm install wrangler --save-dev</code>.
          </li>
          <li>
            <strong>Cấu hình Wrangler:</strong> Tạo tệp <code className="bg-slate-100 text-[#005BAA] px-1 py-0.5 rounded font-mono text-xs">wrangler.toml</code> ở thư mục gốc và dán mẫu khai báo bindings cho D1, R2 ở trên. Thay đổi các mã định danh tương ứng từ tài khoản Cloudflare của bạn.
          </li>
          <li>
            <strong>Dán mã lệnh:</strong> Tạo tệp tin <code className="bg-slate-100 text-[#005BAA] px-1 py-0.5 rounded font-mono text-xs">src/index.ts</code>, copy toàn bộ nội dung mã xử lý của <strong>Worker API</strong> ở ô xanh lá trên dán vào.
          </li>
          <li>
            <strong>Đẩy dự án trực tuyến:</strong> Chạy lệnh <code className="bg-slate-100 text-[#005BAA] px-1 py-0.5 rounded font-mono text-xs">npx wrangler deploy</code> trên terminal của bạn để đẩy Worker lên mây. Cloudflare sẽ cấp cho bạn một đường dẫn URL công khai có dạng như: <code className="bg-slate-100 text-slate-700 px-1 py-0.5 rounded font-mono text-xs">https://vinaphone-tttb-worker.names.workers.dev</code>.
          </li>
          <li>
            <strong>Thay kết nối của bạn trong Admin Portal:</strong> Vào mục <strong>Cấu hình hệ thống</strong> bên dưới tab Quản trị của cổng này, điền URL liên kết của Worker đã deploy, khóa API bí mật <code className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono text-xs">x-api-secret</code> của riêng bạn đã định nghĩa. Hệ thống sẽ tự kiểm thử đường truyền trực tuyến của bạn, lưu vào bộ nhớ, và tự động đồng bộ hóa dữ liệu từ lúc này thay vì cơ chế Giả lập Offline.
          </li>
        </ol>
      </div>
    </div>
  );
}
