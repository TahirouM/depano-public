import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { ApiErrorBody } from '@depano/schemas';
import type { FastifyReply } from 'fastify';

const DEFAULT_MESSAGES: Record<number, [string, string]> = {
  400: ['bad_request', 'Requête invalide.'],
  401: ['unauthorized', 'Authentification requise.'],
  403: ['forbidden', "Vous n'avez pas les droits pour cette action."],
  404: ['not_found', 'Ressource introuvable.'],
  405: ['method_not_allowed', 'Méthode non autorisée.'],
  409: ['conflict', 'Conflit avec l’état actuel de la ressource.'],
  413: ['payload_too_large', 'Requête trop volumineuse.'],
  415: ['unsupported_media_type', 'Type de contenu non pris en charge.'],
  429: ['too_many_requests', 'Trop de tentatives, réessayez plus tard.'],
  500: ['internal_error', 'Une erreur interne est survenue. Réessayez dans un instant.'],
  503: ['unavailable', 'Service momentanément indisponible.'],
};

/** Convertit toute erreur en ApiErrorBody (messages en français). */
export function toApiError(exception: unknown): ApiErrorBody {
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const res = exception.getResponse() as Record<string, unknown> | string;
    if (typeof res === 'object' && typeof res.code === 'string' && typeof res.message === 'string') {
      return { statusCode: status, code: res.code, message: res.message, ...(res.details !== undefined ? { details: res.details } : {}) };
    }
    const [code, message] = DEFAULT_MESSAGES[status] ?? [`http_${status}`, 'Une erreur est survenue.'];
    return { statusCode: status, code, message };
  }
  const e = exception as { statusCode?: number; code?: string; message?: string; constraint?: string };
  // Erreurs Fastify (JSON invalide, corps trop gros…)
  if (typeof e?.statusCode === 'number' && e.statusCode >= 400 && e.statusCode < 500) {
    if (e.code === 'FST_ERR_CTP_INVALID_JSON_BODY' || e.code === 'FST_ERR_CTP_EMPTY_JSON_BODY') {
      return { statusCode: 400, code: 'invalid_json', message: 'Le corps de la requête n’est pas un JSON valide.' };
    }
    const [code, message] = DEFAULT_MESSAGES[e.statusCode] ?? ['bad_request', 'Requête invalide.'];
    return { statusCode: e.statusCode, code, message };
  }
  // Erreurs Postgres connues
  const pg = (exception as { cause?: { code?: string } })?.cause ?? exception;
  const pgCode = (pg as { code?: string })?.code;
  if (pgCode === '23P01') return { statusCode: 409, code: 'slot_unavailable', message: 'Ce créneau n’est plus disponible.' };
  if (pgCode === '23505') return { statusCode: 409, code: 'conflict', message: 'Cette ressource existe déjà.' };
  if (pgCode === '22P02') return { statusCode: 400, code: 'invalid_id', message: 'Identifiant invalide.' };
  return { statusCode: 500, code: 'internal_error', message: DEFAULT_MESSAGES[500]![1] };
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors');

  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() !== 'http') throw exception;
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    const body = toApiError(exception);
    if (body.statusCode >= 500) this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    void reply.status(body.statusCode).header('content-type', 'application/json; charset=utf-8').send(body);
  }
}
