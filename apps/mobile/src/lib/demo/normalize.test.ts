import type { DomainDto } from '@depano/schemas';
import { describe, expect, it } from 'vitest';
import { normalizeRecording } from './normalize';

const catalog = [{ code: 'plomberie', services: [{ id: 's1', kind: 'repair' }] }] as unknown as DomainDto[];

describe('normalizeRecording', () => {
  it('complète les prestations et le compte rendu des interventions terminées', () => {
    const out = normalizeRecording(
      {
        '/artisan/profile': { services: [{ serviceId: 's1' }, { serviceId: 'x' }] },
        '/artisans/a1': { services: [{ serviceId: 's1' }] },
        '/bookings/b1': { status: 'closed', report: null, scheduledAt: '2026-10-20T08:00:00.000Z', createdAt: '2026-10-19T08:00:00.000Z' },
        '/bookings/b2': { status: 'accepted', report: null },
      },
      catalog,
    ) as Record<string, any>;
    expect(out['/artisan/profile'].services).toEqual([
      { serviceId: 's1', kind: 'repair', custom: false, active: true },
      { serviceId: 'x', kind: 'both', custom: false, active: true },
    ]);
    expect(out['/artisans/a1'].services[0]).toEqual({ serviceId: 's1', kind: 'repair', custom: false });
    expect(out['/bookings/b1'].report.createdAt).toBe('2026-10-20T08:00:00.000Z');
    expect(out['/bookings/b2'].report).toBeNull();
  });
});
