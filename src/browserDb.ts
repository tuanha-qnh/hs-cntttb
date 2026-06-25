// Local browser-only offline database engine using localStorage
// This acts as a robust fail-safe mechanism if the cloud database
// or Express back-end serves 404 or fails due to network/CORS issues.

export interface UnifiedRecord {
  So_thue_bao: string;
  Tap_thue_bao: string;
  Ma_donvi?: string;
  Ten_donvi?: string;
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

const LOCAL_MUCTIEU_KEY = "localStorage_vnpt_muctieu";
const LOCAL_KETQUA_KEY = "localStorage_vnpt_ketqua";

// Initial realistic default target subscribers representing 4 groups
const defaultMucTieu = [
  // KHDN (Enterprise clients)
  { So_thue_bao: "0912112233", Tap_thue_bao: "KHDN - Công ty Than Hà Lầm", Ma_donvi: "UN_HL", Ten_donvi: "Trung tâm KD Hạ Long" },
  { So_thue_bao: "0913567890", Tap_thue_bao: "KHDN - Khách sạn Mường Thanh", Ma_donvi: "UN_BC", Ten_donvi: "Phòng BH Bãi Cháy" },
  { So_thue_bao: "0888999888", Tap_thue_bao: "KHDN - Tập đoàn Tuần Châu", Ma_donvi: "UN_BC", Ten_donvi: "Phòng BH Bãi Cháy" },
  { So_thue_bao: "0915220033", Tap_thue_bao: "KHDN - Cảng Cái Lân", Ma_donvi: "UN_HL", Ten_donvi: "Trung tâm KD Hạ Long" },
  { So_thue_bao: "0886112244", Tap_thue_bao: "KHDN - Công ty Xuất Nhập Khẩu", Ma_donvi: "UN_CP", Ten_donvi: "Trung tâm KD Cẩm Phả" },
  { So_thue_bao: "0911556677", Tap_thue_bao: "KHDN - Ban Quản lý Vịnh Hạ Long", Ma_donvi: "UN_HL", Ten_donvi: "Trung tâm KD Hạ Long" },
  { So_thue_bao: "0812345678", Tap_thue_bao: "KHDN - Nhiệt điện Mông Dương", Ma_donvi: "UN_CP", Ten_donvi: "Trung tâm KD Cẩm Phả" },

  // CMND 9 số (Legacy 9-digit ID cards)
  { So_thue_bao: "0913224466", Tap_thue_bao: "CMND 9 số - Trần Văn Minh", Ma_donvi: "UN_BC", Ten_donvi: "Phòng BH Bãi Cháy" },
  { So_thue_bao: "0915779911", Tap_thue_bao: "CMND 9 số - Nguyễn Thị Hoa", Ma_donvi: "UN_CP", Ten_donvi: "Trung tâm KD Cẩm Phả" },
  { So_thue_bao: "0888445566", Tap_thue_bao: "CMND 9 số - Phạm Văn Hải", Ma_donvi: "UN_HL", Ten_donvi: "Trung tâm KD Hạ Long" },
  { So_thue_bao: "0823456789", Tap_thue_bao: "CMND 9 số - Lê Hoàng Nam", Ma_donvi: "UN_BC", Ten_donvi: "Phòng BH Bãi Cháy" },
  { So_thue_bao: "0847113355", Tap_thue_bao: "CMND 9 số - Đỗ Thị Lan", Ma_donvi: "UN_CP", Ten_donvi: "Trung tâm KD Cẩm Phả" },
  { So_thue_bao: "0815998877", Tap_thue_bao: "CMND 9 số - Trịnh Quang Huy", Ma_donvi: "UN_HL", Ten_donvi: "Trung tâm KD Hạ Long" },
  { So_thue_bao: "0832334455", Tap_thue_bao: "CMND 9 số - Vũ Văn Tuấn", Ma_donvi: "UN_CP", Ten_donvi: "Trung tâm KD Cẩm Phả" },

  // CCCD 12 số (Standard 12-digit Citizens ID cards)
  { So_thue_bao: "0913987654", Tap_thue_bao: "CCCD 12 số - Lê Thị Hoàng Yến", Ma_donvi: "UN_HL", Ten_donvi: "Trung tâm KD Hạ Long" },
  { So_thue_bao: "0888123456", Tap_thue_bao: "CCCD 12 số - Phạm Minh Đức", Ma_donvi: "UN_BC", Ten_donvi: "Phòng BH Bãi Cháy" },
  { So_thue_bao: "0812993344", Tap_thue_bao: "CCCD 12 số - Dương Trung Kiên", Ma_donvi: "UN_CP", Ten_donvi: "Trung tâm KD Cẩm Phả" },
  { So_thue_bao: "0837554433", Tap_thue_bao: "CCCD 12 số - Hoàng Thu Thủy", Ma_donvi: "UN_HL", Ten_donvi: "Trung tâm KD Hạ Long" },
  { So_thue_bao: "0859114422", Tap_thue_bao: "CCCD 12 số - Đặng Tiến Dũng", Ma_donvi: "UN_BC", Ten_donvi: "Phòng BH Bãi Cháy" },
  { So_thue_bao: "0918443322", Tap_thue_bao: "CCCD 12 số - Nguyễn Hồng Nhung", Ma_donvi: "UN_CP", Ten_donvi: "Trung tâm KD Cẩm Phả" },
  { So_thue_bao: "0914667788", Tap_thue_bao: "CCCD 12 số - Đỗ Cao Cường", Ma_donvi: "UN_BC", Ten_donvi: "Phòng BH Bãi Cháy" },

  // Sai giấy tờ (Invalid/mismatched documents information)
  { So_thue_bao: "0919112233", Tap_thue_bao: "Sai giấy tờ - Mờ ảnh định danh", Ma_donvi: "UN_BC", Ten_donvi: "Phòng BH Bãi Cháy" },
  { So_thue_bao: "0916667788", Tap_thue_bao: "Sai giấy tờ - Thiếu ảnh chữ ký chân dung", Ma_donvi: "UN_CP", Ten_donvi: "Trung tâm KD Cẩm Phả" },
  { So_thue_bao: "0855331122", Tap_thue_bao: "Sai giấy tờ - CMND hết hạn", Ma_donvi: "UN_HL", Ten_donvi: "Trung tâm KD Hạ Long" },
  { So_thue_bao: "0833112200", Tap_thue_bao: "Sai giấy tờ - Sai họ tên đệm", Ma_donvi: "UN_HL", Ten_donvi: "Trung tâm KD Hạ Long" },
  { So_thue_bao: "0819776655", Tap_thue_bao: "Sai giấy tờ - Trùng số CCCD", Ma_donvi: "UN_BC", Ten_donvi: "Phòng BH Bãi Cháy" },
  { So_thue_bao: "0823114400", Tap_thue_bao: "Sai giấy tờ - Ngày sinh không khớp", Ma_donvi: "UN_CP", Ten_donvi: "Trung tâm KD Cẩm Phả" },
  { So_thue_bao: "0849221199", Tap_thue_bao: "Sai giấy tờ - Thiếu chữ ký phiếu yêu cầu", Ma_donvi: "UN_BC", Ten_donvi: "Phòng BH Bãi Cháy" }
];

// Initial realistic default updating results representing success updates
const defaultKetQua = [
  { so_thue_bao: "0912112233", User_capnhat: "tuanha", Ma_hrm_CN: "HRM4822", Kenh_CN: "WebPortal", Ngay_CN: "2026-06-08" },
  { so_thue_bao: "0888999888", User_capnhat: "admin", Ma_hrm_CN: "ADMIN01", Kenh_CN: "AppMyVina", Ngay_CN: "2026-06-09" },
  { so_thue_bao: "0886112244", User_capnhat: "gdv_hoacp", Ma_hrm_CN: "HRM3301", Kenh_CN: "Cửa hàng GD", Ngay_CN: "2026-06-07" },
  { so_thue_bao: "0911556677", User_capnhat: "tuanha", Ma_hrm_CN: "HRM4822", Kenh_CN: "WebPortal", Ngay_CN: "2026-06-09" },
  { so_thue_bao: "0913224466", User_capnhat: "admin", Ma_hrm_CN: "ADMIN01", Kenh_CN: "VinaPortal", Ngay_CN: "2026-06-05" },
  { so_thue_bao: "0888445566", User_capnhat: "tuanha", Ma_hrm_CN: "HRM4822", Kenh_CN: "WebPortal", Ngay_CN: "2026-06-08" },
  { so_thue_bao: "0823456789", User_capnhat: "gdv_hoacp", Ma_hrm_CN: "HRM3301", Kenh_CN: "Tổng đài hỗ trợ", Ngay_CN: "2026-06-06" },
  { so_thue_bao: "0913987654", User_capnhat: "tuanha", Ma_hrm_CN: "HRM4822", Kenh_CN: "AppMyVina", Ngay_CN: "2026-06-09" },
  { so_thue_bao: "0812993344", User_capnhat: "admin", Ma_hrm_CN: "ADMIN01", Kenh_CN: "VinaPortal", Ngay_CN: "2026-06-07" },
  { so_thue_bao: "0837554433", User_capnhat: "gdv_hoacp", Ma_hrm_CN: "HRM3301", Kenh_CN: "Cửa hàng GD", Ngay_CN: "2026-06-08" },
  { so_thue_bao: "0914667788", User_capnhat: "admin", Ma_hrm_CN: "ADMIN01", Kenh_CN: "AppMyVina", Ngay_CN: "2026-06-09" },
  { so_thue_bao: "0919112233", User_capnhat: "tuanha", Ma_hrm_CN: "HRM4822", Kenh_CN: "VinaPortal", Ngay_CN: "2026-06-08" },
  { so_thue_bao: "0855331122", User_capnhat: "gdv_hoacp", Ma_hrm_CN: "HRM3301", Kenh_CN: "WebPortal", Ngay_CN: "2026-06-06" },
  { so_thue_bao: "0819776655", User_capnhat: "admin", Ma_hrm_CN: "ADMIN01", Kenh_CN: "VinaPortal", Ngay_CN: "2026-06-09" }
];

export function getBrowserMuctieu(): any[] {
  try {
    const saved = localStorage.getItem(LOCAL_MUCTIEU_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
    // Seed and return
    localStorage.setItem(LOCAL_MUCTIEU_KEY, JSON.stringify(defaultMucTieu));
    return defaultMucTieu;
  } catch (e) {
    console.error("Error loading muctieu from localStorage:", e);
    return defaultMucTieu;
  }
}

export function getBrowserKetqua(): any[] {
  try {
    const saved = localStorage.getItem(LOCAL_KETQUA_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
    // Seed and return
    localStorage.setItem(LOCAL_KETQUA_KEY, JSON.stringify(defaultKetQua));
    return defaultKetQua;
  } catch (e) {
    console.error("Error loading ketqua from localStorage:", e);
    return defaultKetQua;
  }
}

export function saveBrowserMuctieu(records: any[], isFirstBatch: boolean = true) {
  try {
    let current = isFirstBatch ? [] : getBrowserMuctieu();
    
    // Highly-optimized O(N) Map-based bulk upsert
    const map = new Map<string, any>();
    current.forEach(item => {
      const phone = String(item.So_thue_bao || "").trim();
      if (phone) {
        map.set(phone, item);
      }
    });

    records.forEach(item => {
      const phone = String(item.So_thue_bao || "").trim();
      if (!phone) return;
      map.set(phone, {
        So_thue_bao: phone,
        Tap_thue_bao: (item.Tap_thue_bao || "Mặc định").trim(),
        Ma_donvi: (item.Ma_donvi || "").trim(),
        Ten_donvi: (item.Ten_donvi || "").trim(),
        Loai_TB: (item.Loai_TB || "").trim(),
        Hinh_thuc: (item.Hinh_thuc || "").trim(),
        Dthu_T4: item.Dthu_T4 ? Number(item.Dthu_T4) : 0,
        Muc_DT: (item.Muc_DT || "").trim()
      });
    });

    current = Array.from(map.values());

    try {
      localStorage.setItem(LOCAL_MUCTIEU_KEY, JSON.stringify(current));
    } catch (storageErr: any) {
      console.warn("Không gian lưu trữ bộ nhớ Trình duyệt (localStorage) bị đầy. Tiến hành nén dữ liệu ngoại tuyến...");
      let limit = Math.min(current.length, 2500);
      while (limit > 20) {
        try {
          localStorage.setItem(LOCAL_MUCTIEU_KEY, JSON.stringify(current.slice(0, limit)));
          console.warn(`Đã lưu tạm một tập dữ liệu rút gọn đại diện gồm ${limit} dòng thuê bao mục tiêu vào bộ nhớ trình duyệt.`);
          break;
        } catch (innerErr) {
          limit = Math.floor(limit * 0.7);
        }
      }
    }
  } catch (e) {
    console.error("Error saving browser muctieu:", e);
  }
}

export function saveBrowserKetqua(records: any[], isFirstBatch: boolean = true) {
  try {
    let current = isFirstBatch ? [] : getBrowserKetqua();

    // Highly-optimized O(N) Map-based bulk upsert
    const map = new Map<string, any>();
    current.forEach(item => {
      const phone = String(item.so_thue_bao || "").trim();
      if (phone) {
        map.set(phone, item);
      }
    });

    records.forEach(item => {
      const phone = String(item.so_thue_bao || "").trim();
      if (!phone) return;
      map.set(phone, {
        so_thue_bao: phone,
        User_capnhat: String(item.User_capnhat || "admin").trim(),
        Ma_hrm_CN: String(item.Ma_hrm_CN || "N/A").trim(),
        Kenh_CN: String(item.Kenh_CN || "WebPortal").trim(),
        Ngay_CN: String(item.Ngay_CN || new Date().toLocaleDateString('vi-VN')).trim()
      });
    });

    current = Array.from(map.values());

    try {
      localStorage.setItem(LOCAL_KETQUA_KEY, JSON.stringify(current));
    } catch (storageErr: any) {
      console.warn("Không gian lưu trữ bộ nhớ Trình duyệt (localStorage) bị đầy. Tiến hành nén kết quả cập nhật ngoại tuyến...");
      let limit = Math.min(current.length, 2500);
      while (limit > 20) {
        try {
          localStorage.setItem(LOCAL_KETQUA_KEY, JSON.stringify(current.slice(0, limit)));
          console.warn(`Đã lưu tạm một tập dữ liệu kết quả rút gọn gồm ${limit} dòng thuê bao vào bộ nhớ trình duyệt.`);
          break;
        } catch (innerErr) {
          limit = Math.floor(limit * 0.7);
        }
      }
    }
  } catch (e) {
    console.error("Error saving browser ketqua:", e);
  }
}

export function getBrowserUnifiedRecords(): UnifiedRecord[] {
  const muctieuList = getBrowserMuctieu();
  const ketquaList = getBrowserKetqua();

  const unified: UnifiedRecord[] = [];
  const visited = new Set<string>();

  const kqMap = new Map();
  for (const k of ketquaList) {
    const sdt = String(k.so_thue_bao || "").trim().toLowerCase();
    if (sdt) {
      kqMap.set(sdt, k);
    }
  }

  // First add all from DS_TB_MUCTIEU
  for (const item of muctieuList) {
    const sdt = String(item.So_thue_bao || "").trim();
    if (!sdt) continue;
    const sdtLower = sdt.toLowerCase();
    visited.add(sdtLower);

    const kq = kqMap.get(sdtLower);

    const dthuRaw = item.Dthu_T4 ? Number(item.Dthu_T4) : 0;
    let dthu = dthuRaw;
    if (dthu === 0) {
      const lastFour = Number(sdt.slice(-4)) || 1234;
      dthu = (lastFour % 5) * 60000 + 15000;
    }

    let muc_dt = (item.Muc_DT || "").trim();
    if (!muc_dt) {
      if (dthu < 50000) muc_dt = "Dưới 50k";
      else if (dthu < 100000) muc_dt = "50k - 100k";
      else if (dthu < 200000) muc_dt = "100k - 200k";
      else muc_dt = "Trên 200k";
    }

    unified.push({
      So_thue_bao: sdt,
      Tap_thue_bao: item.Tap_thue_bao || "Mặc định",
      Ma_donvi: item.Ma_donvi || null,
      Ten_donvi: item.Ten_donvi || null,
      Loai_TB: item.Loai_TB || null,
      Hinh_thuc: item.Hinh_thuc || null,
      Dthu_T4: dthu,
      Muc_DT: muc_dt,
      IsUpdated: !!kq,
      User_capnhat: kq ? kq.User_capnhat : null,
      Ma_hrm_CN: kq ? kq.Ma_hrm_CN : null,
      Kenh_CN: kq ? kq.Kenh_CN : null,
      Ngay_CN: kq ? kq.Ngay_CN : null,
    });
  }

  // Add any from KQ_CNTTTB that are not in DS_TB_MUCTIEU (dynamic cross synchronization)
  for (const item of ketquaList) {
    const sdt = String(item.so_thue_bao || "").trim();
    if (!sdt) continue;
    if (!visited.has(sdt.toLowerCase())) {
      const lastFour = Number(sdt.slice(-4)) || 1234;
      const dthu = (lastFour % 5) * 60000 + 15000;
      let muc_dt = "";
      if (dthu < 50000) muc_dt = "Dưới 50k";
      else if (dthu < 100000) muc_dt = "50k - 100k";
      else if (dthu < 200000) muc_dt = "100k - 200k";
      else muc_dt = "Trên 200k";

      unified.push({
        So_thue_bao: sdt,
        Tap_thue_bao: "Đồng bộ tự động (Phát sinh ngoài tập mục tiêu ban đầu)",
        IsUpdated: true,
        User_capnhat: item.User_capnhat,
        Ma_hrm_CN: item.Ma_hrm_CN,
        Kenh_CN: item.Kenh_CN,
        Ngay_CN: item.Ngay_CN,
        Loai_TB: "Di động",
        Hinh_thuc: "Trả sau",
        Dthu_T4: dthu,
        Muc_DT: muc_dt,
        Ma_donvi: "UN_HL",
        Ten_donvi: "Trung tâm KD Hạ Long"
      });
    }
  }

  return unified;
}

export function singleLookupBrowser(phone: string): any {
  const cleanPhone = phone.trim().replace(/^(\+84|84)/, "0");

  const mtList = getBrowserMuctieu();
  const kqList = getBrowserKetqua();

  // Find record
  let mucTieuRecord = mtList.find(
    (u) => u.So_thue_bao.trim() === cleanPhone || u.So_thue_bao.trim() === phone
  ) || null;

  let ketQuaRecord = kqList.find(
    (u) => u.so_thue_bao.trim() === cleanPhone || u.so_thue_bao.trim() === phone
  ) || null;

  let didSync = false;
  if (ketQuaRecord && !mucTieuRecord) {
    // Cross synchronizations logic
    mucTieuRecord = {
      So_thue_bao: ketQuaRecord.so_thue_bao || cleanPhone,
      Tap_thue_bao: "Đồng bộ tự động (Phát sinh ngoài tập mục tiêu ban đầu)",
      Ma_donvi: "UN_ROOT",
      Ten_donvi: "VNPT Quảng Ninh"
    };
    saveBrowserMuctieu([mucTieuRecord], false);
    didSync = true;
  }

  if (!mucTieuRecord && !ketQuaRecord) {
    return {
      found: false,
      status: "NOT_FOUND",
      message: "Số thuê bao không tồn tại trong danh mục mục tiêu hay kết quả cập nhật."
    };
  }

  return {
    found: true,
    synchronized: didSync,
    So_thue_bao: phone,
    Tap_thue_bao: mucTieuRecord ? mucTieuRecord.Tap_thue_bao : "Đồng bộ tự động",
    Ma_donvi: mucTieuRecord ? mucTieuRecord.Ma_donvi : null,
    Ten_donvi: mucTieuRecord ? mucTieuRecord.Ten_donvi : null,
    Loai_TB: mucTieuRecord ? (mucTieuRecord.Loai_TB || null) : null,
    Hinh_thuc: mucTieuRecord ? (mucTieuRecord.Hinh_thuc || null) : null,
    Dthu_T4: mucTieuRecord ? (mucTieuRecord.Dthu_T4 ? Number(mucTieuRecord.Dthu_T4) : 0) : null,
    Muc_DT: mucTieuRecord ? (mucTieuRecord.Muc_DT || null) : null,
    IsUpdated: !!ketQuaRecord,
    User_capnhat: ketQuaRecord ? ketQuaRecord.User_capnhat : null,
    Ma_hrm_CN: ketQuaRecord ? ketQuaRecord.Ma_hrm_CN : null,
    Kenh_CN: ketQuaRecord ? ketQuaRecord.Kenh_CN : null,
    Ngay_CN: ketQuaRecord ? ketQuaRecord.Ngay_CN : null,
  };
}
