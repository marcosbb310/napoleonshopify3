// Auth hook for managing authentication
'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser, LoginCredentials, RegisterData } from '../types';

interface AuthStore {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  updateUser: (user: Partial<AuthUser>) => void;
}

export const useAuth = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (credentials: LoginCredentials) => {
        set({ isLoading: true });
        try {
          // Mock login - replace with actual API call
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const mockUser: AuthUser = {
            id: '1',
            email: credentials.email,
            name: 'Demo User',
            shopifyStoreUrl: 'your-store.myshopify.com',
          };

          set({ user: mockUser, isAuthenticated: true, isLoading: false });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      register: async (data: RegisterData) => {
        set({ isLoading: true });
        try {
          // Mock registration - replace with actual API call
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const mockUser: AuthUser = {
            id: '1',
            email: data.email,
            name: data.name,
            shopifyStoreUrl: data.shopifyStoreUrl,
          };

          set({ user: mockUser, isAuthenticated: true, isLoading: false });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: () => {
        set({ user: null, isAuthenticated: false });
      },

      updateUser: (userData: Partial<AuthUser>) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null,
        }));
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
