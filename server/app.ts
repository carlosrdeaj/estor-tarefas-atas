import express from "express";
import { calendarDate } from "../shared/dates";
import type { AppDatabase } from "./db";
import { authenticate } from "./extensions/auth";
import { errorHandler } from "./http";
import { apiRouter } from "./routes";
import type { Ctx } from "./repository";

export type AppOptions = {
  now?: () => Date;
  timeZone?: string;
};

export function createApp(db: AppDatabase, options: AppOptions = {}) {
  const timeZone = options.timeZone || process.env.APP_TIMEZONE || "America/Sao_Paulo";
  const now = options.now ?? (() => new Date());
  const ctx: Ctx = {
    db,
    today: () => calendarDate(now(), timeZone),
    nowIso: () => now().toISOString(),
  };

  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.use(authenticate);
  app.use("/api", apiRouter(ctx));
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Não encontrado." });
  });
  app.use(errorHandler);
  return app;
}
