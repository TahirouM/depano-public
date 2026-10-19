import { describe, expect, it } from 'vitest';
import { contrastPairs, contrastRatio } from './contrast';
import { RAW } from './colors';

describe('contrastRatio', () => {
  it('noir / blanc = 21', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
  });
  it('les CTA du plan passent avec du texte blanc', () => {
    expect(contrastRatio('#FFFFFF', RAW.brandPrimary)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#FFFFFF', RAW.urgent)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#FFFFFF', RAW.success)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#FFFFFF', RAW.info)).toBeGreaterThanOrEqual(4.5);
  });
});

describe.each([
  ['light', 'client'],
  ['dark', 'client'],
  ['light', 'artisan'],
  ['dark', 'artisan'],
] as const)('thème %s / %s', (scheme, accent) => {
  const pairs = contrastPairs(scheme, accent);
  it.each(pairs.map((p) => [p.name, p] as const))('%s', (_name, p) => {
    expect(contrastRatio(p.fg, p.bg), `${p.fg} sur ${p.bg}`).toBeGreaterThanOrEqual(p.min);
  });
});
