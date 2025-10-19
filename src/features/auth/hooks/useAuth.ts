// Auth hook for managing authentication
'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useEffect } from 'react';
import { supabase } from '@/shared/lib/supabase';
import type { AuthUser, LoginCredentials, RegisterData, Store } from '../types';

interface AuthStore {
  user: AuthUser | null;
  currentStore: Store | null;
  availableStores: Store[];
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  updateUser: (user: Partial<AuthUser>) => void;
  setCurrentStore: (store: Store) => void;
  loadUserData: () => Promise<void>;
  initialize: () => void;
}

export const useAuth = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      currentStore: null,
      availableStores: [],
      isAuthenticated: false,
      isLoading: false,
      isInitialized: false, // Start as not initialized to handle rehydration properly

      login: async (credentials: LoginCredentials) => {
        set({ isLoading: true });
        try {
          // Call the login API endpoint
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include', // Include cookies in the request
            body: JSON.stringify(credentials),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Login failed');
          }

          const { user } = await response.json();
          
          set({ 
            user, 
            isAuthenticated: true, 
            isLoading: false,
            isInitialized: true
          });
          
          // Load user's stores after successful login
          await get().loadUserData();
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
        set({ 
          user: null, 
          currentStore: null,
          availableStores: [],
          isAuthenticated: false 
        });
        // Clear session cookies
        document.cookie = 'user_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        document.cookie = 'store_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      },

      updateUser: (userData: Partial<AuthUser>) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null,
        }));
      },

      setCurrentStore: (store: Store) => {
        set({ currentStore: store });
        // Persist selected store in localStorage
        localStorage.setItem('selected-store-id', store.id);
      },

      loadUserData: async () => {
        const state = get();
        if (!state.isAuthenticated || !state.user) return;

        try {
          // Load user's stores
          const { data: stores, error } = await supabase
            .from('stores')
            .select('*')
            .eq('user_id', state.user.id)
            .eq('is_active', true)
            .order('installed_at', { ascending: false });

          if (error) {
            console.error('Failed to load stores:', error);
            return;
          }

          set({ availableStores: stores || [] });

          // Set current store if none selected or if selected store is not in available stores
          let currentStore = state.currentStore;
          const storedStoreId = localStorage.getItem('selected-store-id');
          
          if (storedStoreId && stores?.find(s => s.id === storedStoreId)) {
            currentStore = stores.find(s => s.id === storedStoreId) || null;
          } else if (stores && stores.length > 0 && !currentStore) {
            currentStore = stores[0];
            localStorage.setItem('selected-store-id', currentStore.id);
          }

          set({ currentStore });
        } catch (error) {
          console.error('Failed to load user data:', error);
        }
      },

      initialize: async () => {
        try {
          // Check session via API endpoint (can read httpOnly cookies)
          const response = await fetch('/api/auth/session', {
            method: 'GET',
            credentials: 'include', // Include cookies in the request
          });

          if (!response.ok) {
            throw new Error('Failed to check session');
          }

          const { isAuthenticated, user } = await response.json();

          if (!isAuthenticated || !user) {
            // Clear any invalid auth state from localStorage
            set({ 
              user: null, 
              currentStore: null, 
              availableStores: [],
              isAuthenticated: false, 
              isInitialized: true 
            });
            return;
          }

          set({ 
            user, 
            isAuthenticated: true, 
            isInitialized: true,
            isLoading: false
          });

          // Load stores and set current store
          await get().loadUserData();
        } catch (error) {
          console.error('Auth initialization error:', error);
          set({ 
            user: null, 
            currentStore: null, 
            availableStores: [],
            isAuthenticated: false, 
            isInitialized: true 
          });
        }
      },
    }),
    {
      name: 'auth-storage',
      // Skip hydration on server to prevent mismatch
      skipHydration: true,
      partialize: (state) => ({
        user: state.user,
        currentStore: state.currentStore,
        availableStores: state.availableStores,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        // Don't immediately set isInitialized - let the initialize() method handle it
        // This prevents auth state from being restored without proper validation
        if (state) {
          // Only keep user data, reset auth flags to force re-validation
          state.isInitialized = false;
          state.isLoading = false;
        }
      },
    }
  )
);

// Custom hook to handle hydration and initialization
export const useAuthHydration = () => {
  const { initialize } = useAuth();
  
  useEffect(() => {
    // Manually trigger hydration on client side
    useAuth.persist.rehydrate();
    // Initialize auth state from cookies
    initialize();
  }, [initialize]);
};
