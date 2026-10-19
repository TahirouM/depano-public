import { describe, expect, it } from 'vitest';
import { haversineKm, projectInRadius } from './geo';

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

describe('projectInRadius', () => {
  const c = { lat: 43.3, lng: 5.4 };
  it('place le centre au milieu', () => {
    expect(projectInRadius(c, 10, c)).toEqual({ x: 0.5, y: 0.5 });
  });
  it('place un point au nord-est en haut à droite, borné au cadre', () => {
    const p = projectInRadius(c, 10, { lat: 43.35, lng: 5.45 });
    expect(p.x).toBeGreaterThan(0.5);
    expect(p.y).toBeLessThan(0.5);
    expect(projectInRadius(c, 1, { lat: 44, lng: 4 })).toEqual({ x: 0, y: 0 });
  });
});
