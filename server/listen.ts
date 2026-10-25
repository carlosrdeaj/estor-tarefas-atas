export function resolveListen(env: NodeJS.ProcessEnv = process.env) {
  const raw = env.PORT;
  const port = raw === undefined || raw === "" ? 5000 : Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT inválida: ${raw}`);
  }
  return { host: env.HOST || "0.0.0.0", port };
}
