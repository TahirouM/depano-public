import { HttpException } from '@nestjs/common';

/** Erreur métier : sérialisée en ApiErrorBody { statusCode, code, message, details? }. */
export class AppError extends HttpException {
  constructor(
    status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super({ statusCode: status, code, message, ...(details !== undefined ? { details } : {}) }, status);
  }
}

export const badRequest = (code: string, message: string, details?: unknown) => new AppError(400, code, message, details);
export const unauthorized = (code = 'unauthorized', message = 'Authentification requise.') => new AppError(401, code, message);
export const paymentRequired = (code: string, message: string, details?: unknown) => new AppError(402, code, message, details);
export const forbidden = (code = 'forbidden', message = "Vous n'avez pas les droits pour cette action.") =>
  new AppError(403, code, message);
export const notFound = (code = 'not_found', message = 'Ressource introuvable.') => new AppError(404, code, message);
export const conflict = (code: string, message: string, details?: unknown) => new AppError(409, code, message, details);
export const gone = (code: string, message: string) => new AppError(410, code, message);
export const locked = (code: string, message: string, details?: unknown) => new AppError(423, code, message, details);
export const tooMany = (code: string, message: string, details?: unknown) => new AppError(429, code, message, details);
export const unavailable = (code: string, message: string) => new AppError(503, code, message);
