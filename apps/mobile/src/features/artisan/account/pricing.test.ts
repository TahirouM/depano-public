import { describe, expect, it } from 'vitest';
import { customServiceErrors, durationLabel } from './pricing';

const ok = {
  name: 'Remplacement de siphon',
  kind: 'repair' as const,
  price: '89,90',
  duration: '45',
};

describe('motif personnel (Tarifs)', () => {
  it('accepte un motif complet', () => {
    expect(customServiceErrors(ok)).toEqual({});
  });
  it('valide le nom (longueur, doublon insensible à la casse et aux accents)', () => {
    expect(customServiceErrors({ ...ok, name: ' ' }).name).toBe('Indiquez le nom du motif.');
    expect(customServiceErrors({ ...ok, name: 'ab' }).name).toMatch(/au moins 3/);
    expect(customServiceErrors({ ...ok, name: 'x'.repeat(121) }).name).toMatch(/120/);
    expect(
      customServiceErrors({ ...ok, name: 'remplacement de SIPHON' }, ['Remplacement de siphon'])
        .name,
    ).toMatch(/existe déjà/);
    expect(customServiceErrors({ ...ok, name: 'Débouchage' }, ['debouchage']).name).toMatch(
      /existe déjà/,
    );
  });
  it('valide le prix (1 € à 10 000 €)', () => {
    expect(customServiceErrors({ ...ok, price: '' }).price).toBe('Indiquez un prix.');
    expect(customServiceErrors({ ...ok, price: 'abc' }).price).toMatch(/invalide/);
    expect(customServiceErrors({ ...ok, price: '0,50' }).price).toMatch(/1 €/);
    expect(customServiceErrors({ ...ok, price: '10001' }).price).toMatch(/10 000/);
    expect(customServiceErrors({ ...ok, price: '10000' }).price).toBeUndefined();
  });
  it('valide la durée (15 à 600 minutes)', () => {
    expect(customServiceErrors({ ...ok, duration: '' }).duration).toMatch(/durée/);
    expect(customServiceErrors({ ...ok, duration: '10' }).duration).toBe(
      'Entre 15 et 600 minutes.',
    );
    expect(customServiceErrors({ ...ok, duration: '601' }).duration).toBe(
      'Entre 15 et 600 minutes.',
    );
    expect(customServiceErrors({ ...ok, duration: '1.5' }).duration).toMatch(/durée/);
  });
  it('durationLabel', () => {
    expect(durationLabel(45)).toBe('45 min');
    expect(durationLabel(60)).toBe('1 h');
    expect(durationLabel(90)).toBe('1 h 30');
  });
});
