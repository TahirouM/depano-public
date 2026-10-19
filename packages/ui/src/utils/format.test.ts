import { describe, expect, it } from 'vitest';
import { formatVoiceDuration } from './format';

describe('formatVoiceDuration', () => {
  it('formate en m:ss', () => {
    expect(formatVoiceDuration(7_200)).toBe('0:07');
    expect(formatVoiceDuration(102_000)).toBe('1:42');
    expect(formatVoiceDuration(200)).toBe('0:01');
  });
  it('renvoie null si la durée est inconnue', () => {
    expect(formatVoiceDuration(null)).toBeNull();
    expect(formatVoiceDuration(undefined)).toBeNull();
    expect(formatVoiceDuration(-1)).toBeNull();
  });
});
