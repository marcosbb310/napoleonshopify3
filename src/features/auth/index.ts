// Public API for auth feature

// Types
export * from './types';

// Hooks (React Query + Supabase Auth)
export { useAuth } from './hooks/useAuth';
export { 
  useSignup, 
  useLogin, 
  useLogout, 
  useMagicLink, 
  usePasswordReset 
} from './hooks/useAuthMutations';
export { useStores } from './hooks/useStores';
export { useCurrentStore } from './hooks/useCurrentStore';

// Components
export { AuthModal } from './components/AuthModal';
export { MFAModal } from './components/MFAModal';
