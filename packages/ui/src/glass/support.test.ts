import { describe, expect, it, vi } from 'vitest';
import { canUseLiquidGlass, createReduceTransparencyStore, hexWithAlpha, probe, type GlassEnvironment } from './support';

const ios26: GlassEnvironment = { platform: 'ios', liquidGlassAvailable: true, glassEffectApiAvailable: true, reduceTransparency: false };

describe('canUseLiquidGlass', () => {
  it('verre sur iOS 26 avec API disponible et transparence autorisée', () => {
    expect(canUseLiquidGlass(ios26)).toBe(true);
  });
  it('surface opaque sur Android et web', () => {
    expect(canUseLiquidGlass({ ...ios26, platform: 'android' })).toBe(false);
    expect(canUseLiquidGlass({ ...ios26, platform: 'web' })).toBe(false);
  });
  it('surface opaque si iOS < 26, build Xcode < 26 ou mode compatibilité', () => {
    expect(canUseLiquidGlass({ ...ios26, liquidGlassAvailable: false })).toBe(false);
  });
  it("surface opaque si l'API Glass manque (bêtas d'iOS 26)", () => {
    expect(canUseLiquidGlass({ ...ios26, glassEffectApiAvailable: false })).toBe(false);
  });
  it('surface opaque si « Réduire la transparence » est activé', () => {
    expect(canUseLiquidGlass({ ...ios26, reduceTransparency: true })).toBe(false);
  });
  it('surface opaque tant que le réglage est inconnu', () => {
    expect(canUseLiquidGlass({ ...ios26, reduceTransparency: null })).toBe(false);
  });
});

describe('probe', () => {
  it('renvoie la valeur de la sonde', () => {
    expect(probe(() => true)).toBe(true);
    expect(probe(() => false)).toBe(false);
  });
  it('renvoie false si la sonde lève une erreur ou est absente', () => {
    expect(
      probe(() => {
        throw new Error('Cannot find native module ExpoGlassEffect');
      }),
    ).toBe(false);
    expect(probe(undefined)).toBe(false);
  });
});

describe('hexWithAlpha', () => {
  it('convertit #RRGGBB et #RGB', () => {
    expect(hexWithAlpha('#FFFFFF', 0.5)).toBe('rgba(255, 255, 255, 0.5)');
    expect(hexWithAlpha('#1F1A15', 0.72)).toBe('rgba(31, 26, 21, 0.72)');
    expect(hexWithAlpha('#fff', 1)).toBe('rgba(255, 255, 255, 1)');
  });
  it('borne alpha et laisse passer les couleurs non hexadécimales', () => {
    expect(hexWithAlpha('#000000', 3)).toBe('rgba(0, 0, 0, 1)');
    expect(hexWithAlpha('rgba(0,0,0,0.6)', 0.5)).toBe('rgba(0,0,0,0.6)');
  });
});

describe('createReduceTransparencyStore', () => {
  it('sans source : false immédiatement', () => {
    const store = createReduceTransparencyStore(null);
    expect(store.get()).toBe(false);
  });

  it('inconnu (null) puis valeur lue, puis suit les changements', async () => {
    let emit: (v: boolean) => void = () => undefined;
    const store = createReduceTransparencyStore({
      read: () => Promise.resolve(true),
      listen: (cb) => {
        emit = cb;
        return () => undefined;
      },
    });
    const onChange = vi.fn();
    store.subscribe(onChange);
    expect(store.get()).toBeNull();
    await Promise.resolve();
    expect(store.get()).toBe(true);
    emit(false);
    expect(store.get()).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("un seul écouteur natif, quel que soit le nombre d'abonnés", () => {
    const listen = vi.fn(() => () => undefined);
    const store = createReduceTransparencyStore({ read: () => Promise.resolve(false), listen });
    store.subscribe(() => undefined);
    store.subscribe(() => undefined);
    store.get();
    expect(listen).toHaveBeenCalledTimes(1);
  });

  it('lecture en échec : retombe sur false (pas de blocage en surface opaque à vie)', async () => {
    const store = createReduceTransparencyStore({ read: () => Promise.reject(new Error('x')), listen: () => () => undefined });
    store.get();
    await Promise.resolve();
    await Promise.resolve();
    expect(store.get()).toBe(false);
  });
});
