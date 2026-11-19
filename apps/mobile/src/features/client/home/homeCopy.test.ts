import { describe, expect, it } from 'vitest';
import { resultsLabel, shouldSuggestLocation } from './homeCopy';

describe('accueil', () => {
  it('compte les résultats', () => {
    expect(resultsLabel(0, false)).toBe('0 résultat');
    expect(resultsLabel(1, false)).toBe('1 résultat');
    expect(resultsLabel(7, false)).toBe('7 résultats');
    expect(resultsLabel(10, true)).toBe('10+ résultats');
  });
  it("propose la position seulement en mode dégradé, une fois", () => {
    expect(shouldSuggestLocation({ source: 'fallback' }, false)).toBe(true);
    expect(shouldSuggestLocation({ source: 'fallback' }, true)).toBe(false);
    expect(shouldSuggestLocation({ source: 'gps' }, false)).toBe(false);
    expect(shouldSuggestLocation({ source: 'place' }, false)).toBe(false);
  });
});
