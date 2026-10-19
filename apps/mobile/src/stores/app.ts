import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { asyncJSONStorage } from './storage';

export type ActiveRole = 'client' | 'artisan';
export type SchemePreference = 'system' | 'light' | 'dark';

export interface AppState {
  onboardingSeen: boolean;
  activeRole: ActiveRole;
  scheme: SchemePreference;
  /** Explications de permission déjà montrées (on ne harcèle pas). */
  permissionAsked: { location: boolean; notifications: boolean };
  /** Dernier jeton push enregistré côté API, par utilisateur. */
  pushToken: { token: string; userId: string } | null;
  setOnboardingSeen: () => void;
  setActiveRole: (r: ActiveRole) => void;
  setScheme: (s: SchemePreference) => void;
  markPermissionAsked: (k: 'location' | 'notifications') => void;
  setPushToken: (v: AppState['pushToken']) => void;
  resetForSignOut: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      onboardingSeen: false,
      activeRole: 'client',
      scheme: 'system',
      permissionAsked: { location: false, notifications: false },
      pushToken: null,
      setOnboardingSeen: () => set({ onboardingSeen: true }),
      setActiveRole: (activeRole) => set({ activeRole }),
      setScheme: (scheme) => set({ scheme }),
      markPermissionAsked: (k) => set((s) => ({ permissionAsked: { ...s.permissionAsked, [k]: true } })),
      setPushToken: (pushToken) => set({ pushToken }),
      resetForSignOut: () => set({ activeRole: 'client', pushToken: null }),
    }),
    { name: 'depano.app', storage: asyncJSONStorage, version: 1 },
  ),
);
