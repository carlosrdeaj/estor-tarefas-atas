import type { NextFunction, Request, Response } from "express";

/**
 * Ponto de extensão para login.
 * Hoje o app é pessoal e local: toda requisição segue em frente.
 * Quando houver autenticação, valide a sessão aqui e responda 401 se faltar.
 */
export function authenticate(_req: Request, _res: Response, next: NextFunction) {
  next();
}
