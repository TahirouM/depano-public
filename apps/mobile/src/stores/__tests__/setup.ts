import { vi } from 'vitest';

// Stockages natifs remplacés par une Map en mémoire.
const mem = new Map<string, string>();
const storage = {
  getItem: async (k: string) => mem.get(k) ?? null,
  setItem: async (k: string, v: string) => void mem.set(k, v),
  removeItem: async (k: string) => void mem.delete(k),
};
vi.mock('@react-native-async-storage/async-storage', () => ({ default: storage }));
vi.mock('expo-secure-store', () => ({
  getItemAsync: storage.getItem,
  setItemAsync: storage.setItem,
  deleteItemAsync: storage.removeItem,
}));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

export { mem };
