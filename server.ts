import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

const CONFIG_FILE = path.join(process.cwd(), "system_config.json");

// Default initial config
const initialConfig = {
  enabled: false,
  workerUrl: "",
  apiSecret: "",
  status: "disconnected",
  lastTested: null,
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // --- DATABASE HELPER FUNCTIONS FOR SUBSCRIBER STATUS ---
  const DATABASE_FILE = path.join(process.cwd(), "d1_database.json");

  interface D1Database {
    DS_TB_MUCTIEU: Array<{ So_thue_bao: string; Tap_thue_bao: string }>;
    KQ_CNTTTB: Array<{
      so_thue_bao: string;
      User_capnhat: string;
      Ma_hrm_CN: string;
      Kenh_CN: string;
      Ngay_CN: string;
    }>;
  }

  function getDatabase(): D1Database {
    try {
      if (fs.existsSync(DATABASE_FILE)) {
        const data = fs.readFileSync(DATABASE_FILE, "utf-8");
        return JSON.parse(data);
      }
    } catch (err) {
      console.error("Error reading D1 database JSON:", err);
    }
    return { DS_TB_MUCTIEU: [], KQ_CNTTTB: [] };
  }

  function saveDatabase(db: D1Database) {
    try {
      fs.writeFileSync(DATABASE_FILE, JSON.stringify(db, null, 2), "utf-8");
    } catch (err) {
      console.error("Error writing D1 database JSON:", err);
    }
  }

  // API endpoints for checking subscriber status from DS_TB_MUCTIEU and KQ_CNTTTB
  app.get("/api/subscriber-status/lookup", (req, res) => {
    try {
      const phone = String(req.query.phone || "").trim();
      if (!phone) {
        return res.status(400).json({ error: "Thiếu số thuê bao tra cứu" });
      }

      const database = getDatabase();
      const cleanPhone = phone.replace(/^(\+84|84)/, "0"); // Normalize common Vietnamese phone prefix

      // Find in both tables
      let mucTieuIndex = database.DS_TB_MUCTIEU.findIndex(
        (u) => u.So_thue_bao.trim() === cleanPhone || u.So_thue_bao.trim() === phone
      );
      
      let ketQuaIndex = database.KQ_CNTTTB.findIndex(
        (u) => u.so_thue_bao.trim() === cleanPhone || u.so_thue_bao.trim() === phone
      );

      let mucTieuRecord = mucTieuIndex !== -1 ? database.DS_TB_MUCTIEU[mucTieuIndex] : null;
      let ketQuaRecord = ketQuaIndex !== -1 ? database.KQ_CNTTTB[ketQuaIndex] : null;

      // ĐỒNG BỘ 2 BẢNG:
      // "Từ 2 bảng danh sách này, bạn hãy viết code để hệ thống có thể đồng bộ 2 bảng này với nhau khi thực hiện thao tác tra cứu nhé!"
      // Nếu thuê bao đã có kết quả cập nhật (trong KQ_CNTTTB) nhưng chưa nằm trong danh sách thuê bao mục tiêu (DS_TB_MUCTIEU),
      // thì ta thực hiện đồng bộ: tự động thêm thuê bao này vào bảng thuê bao mục tiêu để đảm bảo tính nhất quán của cơ sở dữ liệu.
      let didSync = false;
      if (ketQuaRecord && !mucTieuRecord) {
        mucTieuRecord = {
          So_thue_bao: ketQuaRecord.so_thue_bao || cleanPhone,
          Tap_thue_bao: "Đồng bộ tự động (Phát sinh ngoài tập mục tiêu ban đầu)",
        };
        database.DS_TB_MUCTIEU.push(mucTieuRecord);
        saveDatabase(database);
        didSync = true;
      }

      if (!mucTieuRecord && !ketQuaRecord) {
        return res.json({
          found: false,
          status: "NOT_FOUND",
          message: "Số thuê bao không tồn tại trong danh mục mục tiêu hay kết quả cập nhật.",
        });
      }

      return res.json({
        found: true,
        synchronized: didSync,
        So_thue_bao: phone,
        Tap_thue_bao: mucTieuRecord ? mucTieuRecord.Tap_thue_bao : "Đồng bộ tự động",
        IsUpdated: !!ketQuaRecord,
        User_capnhat: ketQuaRecord ? ketQuaRecord.User_capnhat : null,
        Ma_hrm_CN: ketQuaRecord ? ketQuaRecord.Ma_hrm_CN : null,
        Kenh_CN: ketQuaRecord ? ketQuaRecord.Kenh_CN : null,
        Ngay_CN: ketQuaRecord ? ketQuaRecord.Ngay_CN : null,
      });
    } catch (err: any) {
      console.error("Error looking up subscriber status:", err);
      return res.status(500).json({ error: err.message || "Failed to query subscriber" });
    }
  });

  // API chunk or bulk insert/overwrite DS_TB_MUCTIEU (subscriber targets)
  app.post("/api/subscriber-status/upload-muctieu", (req, res) => {
    try {
      const recordsToUpload = req.body.records;
      if (!Array.isArray(recordsToUpload)) {
        return res.status(400).json({ error: "Định dạng dữ liệu không hợp lệ. Phải gửi một danh sách bản ghi." });
      }

      const database = getDatabase();
      let updatedCount = 0;
      let insertedCount = 0;

      for (const item of recordsToUpload) {
        const rawPhone = String(item.So_thue_bao || "").trim();
        if (!rawPhone) continue;

        const cleanPhone = rawPhone;

        const existingIndex = database.DS_TB_MUCTIEU.findIndex((u) => u.So_thue_bao.trim() === cleanPhone);

        if (existingIndex !== -1) {
          // Overwrite existing record
          database.DS_TB_MUCTIEU[existingIndex].Tap_thue_bao = (item.Tap_thue_bao || "Mặc định").trim();
          updatedCount++;
        } else {
          // Create new
          database.DS_TB_MUCTIEU.push({
            So_thue_bao: cleanPhone,
            Tap_thue_bao: (item.Tap_thue_bao || "Mặc định").trim()
          });
          insertedCount++;
        }
      }

      saveDatabase(database);
      return res.json({ success: true, updatedCount, insertedCount, total: database.DS_TB_MUCTIEU.length });
    } catch (err: any) {
      console.error("Error uploading DS_TB_MUCTIEU:", err);
      return res.status(500).json({ error: err.message || "Failed to upload target list" });
    }
  });

  // API chunk or bulk insert/overwrite KQ_CNTTTB (subscriber updated result logs)
  app.post("/api/subscriber-status/upload-ketqua", (req, res) => {
    try {
      const recordsToUpload = req.body.records;
      if (!Array.isArray(recordsToUpload)) {
        return res.status(400).json({ error: "Định dạng dữ liệu không hợp lệ. Phải gửi một danh sách bản ghi." });
      }

      const database = getDatabase();
      let updatedCount = 0;
      let insertedCount = 0;

      for (const item of recordsToUpload) {
        const rawPhone = String(item.so_thue_bao || "").trim();
        if (!rawPhone) continue;

        const cleanPhone = rawPhone;

        const existingIndex = database.KQ_CNTTTB.findIndex((u) => u.so_thue_bao.trim() === cleanPhone);

        const newRecord = {
          so_thue_bao: cleanPhone,
          User_capnhat: String(item.User_capnhat || "").trim(),
          Ma_hrm_CN: String(item.Ma_hrm_CN || "").trim(),
          Kenh_CN: String(item.Kenh_CN || "").trim(),
          Ngay_CN: String(item.Ngay_CN || "").trim(),
        };

        if (existingIndex !== -1) {
          // Overwrite existing record
          database.KQ_CNTTTB[existingIndex] = newRecord;
          updatedCount++;
        } else {
          // Create new
          database.KQ_CNTTTB.push(newRecord);
          insertedCount++;
        }
      }

      saveDatabase(database);
      return res.json({ success: true, updatedCount, insertedCount, total: database.KQ_CNTTTB.length });
    } catch (err: any) {
      console.error("Error uploading KQ_CNTTTB:", err);
      return res.status(500).json({ error: err.message || "Failed to upload updated list" });
    }
  });

  // API to retrieve stored configurations
  app.get("/api/system-config", (req, res) => {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const fileContent = fs.readFileSync(CONFIG_FILE, "utf-8");
        const config = JSON.parse(fileContent);
        return res.json(config);
      }
      return res.json(initialConfig);
    } catch (err) {
      console.error("Error reading system config:", err);
      return res.json(initialConfig);
    }
  });

  // API to update system-wide configurations
  app.post("/api/system-config", (req, res) => {
    try {
      const config = req.body;
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
      return res.json({ success: true, config });
    } catch (err: any) {
      console.error("Error writing system config:", err);
      return res.status(500).json({ error: err.message || "Failed to write config" });
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
