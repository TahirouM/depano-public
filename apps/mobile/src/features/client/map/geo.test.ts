import { describe, expect, it } from 'vitest';
import { haversineKm } from './geo';

describe('haversineKm', () => {
  it('mesure ~1 km entre le Vieux-Port et la gare Saint-Charles', () => {
    const d = haversineKm({ lat: 43.2951, lng: 5.3744 }, { lat: 43.3026, lng: 5.3806 });
    expect(d).toBeGreaterThan(0.8);
    expect(d).toBeLessThan(1.2);
  });
  it('vaut 0 pour un même point', () => {
    expect(haversineKm({ lat: 43.3, lng: 5.4 }, { lat: 43.3, lng: 5.4 })).toBe(0);
  });
});
