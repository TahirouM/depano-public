import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { createJSONStorage, type StateStorage } from 'zustand/middleware';

/** Stockage chiffré (Keychain / Keystore) pour les jetons. Repli AsyncStorage sur le web. */
const secureState: StateStorage = {
  getItem: (k) => (Platform.OS === 'web' ? AsyncStorage.getItem(k) : SecureStore.getItemAsync(k)),
  setItem: (k, v) => (Platform.OS === 'web' ? AsyncStorage.setItem(k, v) : SecureStore.setItemAsync(k, v)),
  removeItem: (k) => (Platform.OS === 'web' ? AsyncStorage.removeItem(k) : SecureStore.deleteItemAsync(k)),
};

export const secureJSONStorage = createJSONStorage(() => secureState);
export const asyncJSONStorage = createJSONStorage(() => AsyncStorage);
