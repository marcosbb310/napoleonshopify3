// Auth hook for managing authentication
'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useEffect } from 'react';
import type { AuthUser, LoginCredentials, RegisterData } from '../types';

interface AuthStore {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  updateUser: (user: Partial<AuthUser>) => void;
  initialize: () => void;
}

export const useAuth = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isInitialized: false, // Start as not initialized to handle rehydration properly

      login: async (credentials: LoginCredentials) => {
        set({ isLoading: true });
        try {
          // TODO: Implement actual login API call
          // For now, simulate a successful login with mock data
          await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
          
          const mockUser: AuthUser = {
            id: '1',
            name: 'Demo User',
            email: credentials.email,
            avatar: null,
          };
          
          set({ 
            user: mockUser, 
            isAuthenticated: true, 
            isLoading: false 
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      register: async (data: RegisterData) => {
        set({ isLoading: true });
        try {
          // TODO: Implement actual registration API call
          // For now, simulate a successful registration
          await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
          
          const mockUser: AuthUser = {
            id: '1',
            name: data.name,
            email: data.email,
            avatar: null,
          };
          
          set({ 
            user: mockUser, 
            isAuthenticated: true, 
            isLoading: false 
          });
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

      initialize: () => {
        // No-op since we start initialized
        // This is kept for API compatibility
      },
    }),
    {
      name: 'auth-storage',
      // Skip hydration on server to prevent mismatch
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        // Ensure state is immediately available after rehydration
        if (state) {
          state.isInitialized = true;
          // If we have a user in storage, they're authenticated
          if (state.user) {
            state.isAuthenticated = true;
          }
        }
      },
    }
  )
);

// Custom hook to handle hydration
export const useAuthHydration = () => {
  useEffect(() => {
    // Manually trigger hydration on client side
    useAuth.persist.rehydrate();
  }, []);
};
