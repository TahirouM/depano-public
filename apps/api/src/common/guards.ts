import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@depano/schemas';
import { ARTISAN_KEY, IS_OPTIONAL, IS_PUBLIC, ROLES_KEY, type AuthUser } from './auth';
import { forbidden, unauthorized } from './errors';
import { TokenService } from '../modules/auth/token.service';
import { DbConnection } from '../infra/db';
import { artisanProfiles, eq } from '@depano/db';

function meta<T>(reflector: Reflector, key: string, ctx: ExecutionContext) {
  return reflector.getAllAndOverride<T>(key, [ctx.getHandler(), ctx.getClass()]);
}

/** Vérifie le JWT d'accès (Bearer) et charge l'utilisateur (non supprimé, session non révoquée). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(TokenService) private readonly tokens: TokenService,
  ) {}

  async canActivate(ctx: ExecutionContext) {
    if (ctx.getType() !== 'http') return true;
    const req = ctx.switchToHttp().getRequest();
    const isPublic = meta<boolean>(this.reflector, IS_PUBLIC, ctx);
    const isOptional = meta<boolean>(this.reflector, IS_OPTIONAL, ctx);
    const header = req.headers?.authorization as string | undefined;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      if (isPublic || isOptional) return true;
      throw unauthorized();
    }
    const user = await this.tokens.authenticate(token);
    if (!user) {
      if (isPublic) return true;
      throw unauthorized('invalid_token', 'Session expirée, reconnectez-vous.');
    }
    req.user = user;
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}
  canActivate(ctx: ExecutionContext) {
    const roles = meta<Role[]>(this.reflector, ROLES_KEY, ctx);
    if (!roles?.length) return true;
    const user = ctx.switchToHttp().getRequest().user as AuthUser | undefined;
    if (!user) throw unauthorized();
    if (!roles.some((r) => user.roles.includes(r))) throw forbidden();
    return true;
  }
}

/** Exige un profil artisan (et éventuellement validé) ; place request.artisan. */
@Injectable()
export class ArtisanGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(DbConnection) private readonly conn: DbConnection,
  ) {}
  async canActivate(ctx: ExecutionContext) {
    const opts = meta<{ approved: boolean }>(this.reflector, ARTISAN_KEY, ctx);
    if (!opts) return true;
    const req = ctx.switchToHttp().getRequest();
    const user = req.user as AuthUser | undefined;
    if (!user) throw unauthorized();
    const [p] = await this.conn.db
      .select({ id: artisanProfiles.id, userId: artisanProfiles.userId, status: artisanProfiles.status })
      .from(artisanProfiles)
      .where(eq(artisanProfiles.userId, user.id));
    if (!p) throw forbidden('artisan_profile_required', 'Un profil artisan est requis.');
    if (opts.approved && p.status !== 'approved') {
      throw forbidden('artisan_not_approved', p.status === 'suspended' ? 'Votre compte artisan est suspendu.' : "Votre profil artisan n'est pas encore validé.");
    }
    req.artisan = p;
    return true;
  }
}
