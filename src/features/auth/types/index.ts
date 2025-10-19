// Auth feature types

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  shopifyStoreUrl?: string;
}

export interface Store {
  id: string;
  user_id: string;
  shop_domain: string;
  access_token: string;
  scope: string;
  installed_at: string;
  last_synced_at?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  shopifyStoreUrl?: string;
}

export interface AuthState {
  user: AuthUser | null;
  currentStore: Store | null;
  availableStores: Store[];
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
}
