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

  app.use(express.json());

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
