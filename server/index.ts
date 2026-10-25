import path from "node:path";
import { createServer } from "node:http";
import { createApp } from "./app";
import { attachClient } from "./client";
import { createDatabase } from "./db";
import { resolveListen } from "./listen";

const { host, port } = resolveListen();
const databasePath = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "nexo.sqlite");
const db = createDatabase(databasePath);
const app = createApp(db);
const httpServer = createServer(app);

await attachClient(app, httpServer);

httpServer.listen(port, host, () => {
  const mode = process.env.NODE_ENV === "production" ? "produção" : "desenvolvimento";
  console.log(`Nexo (${mode}) em http://${host}:${port}`);
});
