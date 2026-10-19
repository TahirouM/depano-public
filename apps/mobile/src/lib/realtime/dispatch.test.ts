import { describe, expect, it } from 'vitest';
import { mergeDispatch } from './dispatch';

describe('mergeDispatch', () => {
  const w1 = { wave: 1, contacted: 3, radiusKm: 5 };
  const w2 = { wave: 2, contacted: 6, radiusKm: 10 };
  it('garde la progression la plus avancée quel que soit l’ordre', () => {
    expect(mergeDispatch(w1, w2)).toBe(w2);
    expect(mergeDispatch(w2, w1)).toBe(w2);
    expect(mergeDispatch({ wave: 1, contacted: 2, radiusKm: 5 }, w1)).toBe(w1);
  });
  it('un refetch sans dispatch n’efface pas le compteur reçu en direct', () => {
    expect(mergeDispatch(null, w1)).toBe(w1);
    expect(mergeDispatch(w1, undefined)).toBe(w1);
    expect(mergeDispatch(null, null)).toBeNull();
  });
});
