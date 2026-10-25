import { existsSync } from "node:fs";
import path from "node:path";
import express from "express";
import type { Express } from "express";
import type { Server } from "node:http";

export async function attachClient(app: Express, httpServer: Server) {
  if (process.env.NODE_ENV === "production") {
    const clientDir = path.join(process.cwd(), "dist", "client");
    const indexFile = path.join(clientDir, "index.html");
    if (!existsSync(indexFile)) {
      console.error("Build do front-end não encontrado. Rode npm start ou npm run build.");
      process.exit(1);
    }
    app.use(express.static(clientDir, { index: false }));
    app.use((req, res, next) => {
      if ((req.method !== "GET" && req.method !== "HEAD") || req.path.startsWith("/api") || req.path.startsWith("/assets/")) {
        next();
        return;
      }
      res.sendFile(indexFile);
    });
    return;
  }

  const { createServer } = await import("vite");
  const vite = await createServer({
    root: process.cwd(),
    appType: "spa",
    server: {
      middlewareMode: true,
      hmr: { server: httpServer },
      allowedHosts: true,
      host: "0.0.0.0",
    },
  });
  app.use(vite.middlewares);
}
