// Cliente Supabase PÚBLICO - sem sessão de autenticação
// Usado para páginas públicas (ex: link de cotação) que devem funcionar
// independentemente de o usuário estar logado ou não no painel.
// Isso garante que as queries usem a role "anon" e passem nas políticas RLS públicas.

import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

type LooseDatabase = Database & {
  public: Database['public'] & {
    Tables: {
      [K in keyof Database['public']['Tables']]: Database['public']['Tables'][K] extends {
        Row: infer Row;
        Insert: infer Insert;
        Update: infer Update;
        Relationships: infer Relationships;
      }
        ? {
            Row: Row;
            Insert: Insert & Record<string, unknown>;
            Update: Update & Record<string, unknown>;
            Relationships: Relationships;
          }
        : Database['public']['Tables'][K];
    };
  };
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Cliente público SEM persistência de sessão
// Isso força o uso da role "anon" mesmo quando o usuário está logado em outra aba
export const publicSupabase = createClient<LooseDatabase>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    storage: undefined,
  }
});
