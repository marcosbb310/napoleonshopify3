// Global shared types used across multiple features

export interface User {
  id: string;
  email: string;
  name: string;
  shopifyStoreUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  success: boolean;
}

export type ViewMode = 'grid' | 'list';

export type SortDirection = 'asc' | 'desc';
