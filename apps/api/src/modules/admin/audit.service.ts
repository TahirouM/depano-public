import { Inject, Injectable } from '@nestjs/common';
import { auditLogs } from '@depano/db';
import { DbConnection } from '../../infra/db';

/** Journal d'audit des actions support / admin (et alertes de sécurité). */
@Injectable()
export class AuditService {
  constructor(@Inject(DbConnection) private readonly conn: DbConnection) {}

  async log(actorUserId: string | null, action: string, entity: string, entityId: string | null, data: Record<string, unknown> = {}) {
    await this.conn.db.insert(auditLogs).values({ actorUserId, action, entity, entityId, data });
  }
}
