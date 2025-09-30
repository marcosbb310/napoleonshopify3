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

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  shopifyStoreUrl?: string;
}

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
