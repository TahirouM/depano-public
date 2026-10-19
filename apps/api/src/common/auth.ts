import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Role } from '@depano/schemas';

export interface AuthUser {
  id: string;
  sessionId: string;
  roles: Role[];
  activeRole: Role;
  phone: string | null;
}

export interface ArtisanContext {
  id: string;
  userId: string;
  status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'suspended';
}

export const IS_PUBLIC = 'auth:public';
export const IS_OPTIONAL = 'auth:optional';
export const ROLES_KEY = 'auth:roles';
export const ARTISAN_KEY = 'auth:artisan';

/** Route accessible sans authentification. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
/** Authentification facultative (visiteurs) : request.user est renseigné si un jeton valide est fourni. */
export const OptionalAuth = () => SetMetadata(IS_OPTIONAL, true);
/** Restreint aux rôles indiqués (au moins un). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
/** Exige un profil artisan ; `approved` exige en plus un artisan validé. */
export const ArtisanOnly = (opts: { approved?: boolean } = {}) => SetMetadata(ARTISAN_KEY, { approved: !!opts.approved });

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().user as AuthUser);
export const OptionalUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => (ctx.switchToHttp().getRequest().user as AuthUser | undefined) ?? null,
);
export const CurrentArtisan = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().artisan as ArtisanContext);
export const ClientIp = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  return (req.ip as string | undefined) ?? 'unknown';
});
