import type { NextFunction, Request, Response } from "express";
import { z, type ZodTypeAny } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function readBody<S extends ZodTypeAny>(schema: S, body: unknown, res: Response): z.output<S> | null {
  const result = schema.safeParse(body);
  if (result.success) return result.data;
  const message = result.error.issues[0]?.message || "Dados inválidos.";
  res.status(400).json({ error: message });
  return null;
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ error: "JSON inválido." });
    return;
  }
  console.error(err);
  if (!res.headersSent) res.status(500).json({ error: "Erro interno do servidor." });
}
