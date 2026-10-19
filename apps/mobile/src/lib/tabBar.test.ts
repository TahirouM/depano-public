import { describe, expect, it } from 'vitest';
import { isTabBarHiddenOn, tabAccessibilityLabel, tabBadgeText } from './tabBar';

describe('tab bar', () => {
  it('masquée uniquement sur un fil de discussion', () => {
    expect(isTabBarHiddenOn(['(client)', '(tabs)', 'messages', '[id]'])).toBe(true);
    expect(isTabBarHiddenOn(['pro', '(tabs)', 'messages', '[id]'])).toBe(true);
    expect(isTabBarHiddenOn(['(client)', '(tabs)', 'messages'])).toBe(false);
    expect(isTabBarHiddenOn(['(client)', '(tabs)', 'activite', '[id]'])).toBe(false);
  });
  it('badges : texte borné et libellé accessible', () => {
    expect(tabBadgeText(3)).toBe('3');
    expect(tabBadgeText(120)).toBe('99+');
    expect(tabAccessibilityLabel('Messages', 0)).toBe('Messages');
    expect(tabAccessibilityLabel('Messages', 1)).toBe('Messages, 1 non lu');
    expect(tabAccessibilityLabel('Activité', 4)).toBe('Activité, 4 non lus');
  });
});
