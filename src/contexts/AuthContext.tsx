import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { encerrarSessao, SESSION_TOKEN_KEY } from '@/hooks/useAuthSession';
import {
  Profile,
  PerfilAcesso,
  TipoUsuario,
  AuthState,
  AuthFlags,
  AuthContextType,
  AuthResult,
  EmailCredentials,
  CPFCredentials,
  MagicLinkCredentials,
  SignUpData,
  computeAuthFlags,
  translateAuthError,
} from '@/types/auth';

// ============================================
// CONTEXT
// ============================================
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================
// PROVIDER PROPS
// ============================================
interface AuthProviderProps {
  children: ReactNode;
}

// ============================================
// EXTENDED CONTEXT TYPE (com aliases de compatibilidade)
// ============================================
type ExtendedAuthContextType = Omit<AuthContextType, 'isFuncionario' | 'isAssociado' | 'isVendedor' | 'isInstalador'> & {
  // Aliases para compatibilidade com código existente
  roles: PerfilAcesso[];
  hasRole: (role: PerfilAcesso) => boolean;
  getRedirectUrl: () => string;
  // Funções legadas (mantidas para compatibilidade - sobrescrevem as flags boolean)
  isGerencia: () => boolean;
  isVendedor: () => boolean;
  isFuncionario: () => boolean;
  isAssociado: () => boolean;
  isInstalador: () => boolean;
};

// ============================================
// PROVIDER
// ============================================
export function AuthProvider({ children }: AuthProviderProps) {
  // Estado principal
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [perfis, setPerfis] = useState<PerfilAcesso[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============================================
  // FUNÇÕES DE BUSCA
  // ============================================

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (fetchError) {
        console.error('Erro ao buscar perfil:', fetchError);
        return null;
      }

      // Verificar se usuário está bloqueado
      if (data?.bloqueado) {
        await supabase.auth.signOut();
        throw new Error(`Usuário bloqueado: ${data.motivo_bloqueio || 'Contate o administrador'}`);
      }

      return data as Profile | null;
    } catch (err) {
      console.error('Erro ao buscar perfil:', err);
      return null;
    }
  }, []);

  const fetchPerfis = useCallback(async (userId: string): Promise<PerfilAcesso[]> => {
    try {
      const { data, error: fetchError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (fetchError) {
        console.error('Erro ao buscar perfis:', fetchError);
        return [];
      }

      return (data || []).map((r: { role: PerfilAcesso }) => r.role);
    } catch (err) {
      console.error('Erro ao buscar perfis:', err);
      return [];
    }
  }, []);

  // ============================================
  // USEEFFECT: INICIALIZAÇÃO E LISTENER
  // ============================================

  useEffect(() => {
    let mounted = true;
    let hasLoadedData = false; // Flag para evitar duplicação

    const loadUserData = async (currentSession: Session | null) => {
      // Evitar chamadas duplicadas
      if (hasLoadedData) return;
      
      if (!currentSession?.user) {
        if (mounted) {
          setUser(null);
          setSession(null);
          setProfile(null);
          setPerfis([]);
          setLoading(false);
          setInitialized(true);
        }
        return;
      }

      hasLoadedData = true; // Marcar que já carregou

      try {
        if (mounted) {
          setUser(currentSession.user);
          setSession(currentSession);
        }

        const [userProfile, userPerfis] = await Promise.all([
          fetchProfile(currentSession.user.id),
          fetchPerfis(currentSession.user.id),
        ]);

        if (mounted) {
          setProfile(userProfile);
          setPerfis(userPerfis);
        }
      } catch (err) {
        console.error('Erro ao carregar dados do usuário:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar dados do usuário');
        }
      } finally {
        if (mounted) {
          setLoading(false);
          setInitialized(true);
        }
      }
    };

    // Armazenar ID do usuário atual para detectar trocas indevidas
    let currentUserId: string | null = null;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        const newUserId = currentSession?.user?.id ?? null;
        
        // Log detalhado para debug
        console.log('[AuthContext] Auth state changed:', {
          event,
          newUserId: newUserId?.substring(0, 8),
          newEmail: currentSession?.user?.email,
          currentUserId: currentUserId?.substring(0, 8),
          expiresAt: currentSession?.expires_at
        });

        // PROTEÇÃO: Se já temos um usuário e a sessão mudou para OUTRO usuário
        // (não apenas refresh do mesmo), ignorar e logar warning
        if (currentUserId && newUserId && currentUserId !== newUserId) {
          console.warn('[AuthContext] ⚠️ BLOQUEADO: Tentativa de troca de usuário detectada!');
          console.warn(`[AuthContext] Usuário atual: ${currentUserId.substring(0, 8)}, Novo: ${newUserId.substring(0, 8)}`);
          console.warn('[AuthContext] Ignorando evento. Faça logout explícito para trocar de usuário.');
          return; // BLOQUEAR a troca silenciosa
        }

        // Atualizar ID do usuário atual
        currentUserId = newUserId;

        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        // Defer Supabase calls with setTimeout to prevent deadlock
        if (currentSession?.user) {
          setTimeout(async () => {
            if (!mounted) return;
            await loadUserData(currentSession);
          }, 0);
        } else {
          hasLoadedData = false; // Reset flag ao deslogar
          currentUserId = null; // Reset ao deslogar
          setProfile(null);
          setPerfis([]);
          setLoading(false);
          setInitialized(true);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      // Só carregar se ainda não foi feito via onAuthStateChange
      if (!hasLoadedData) {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          loadUserData(currentSession);
        } else {
          setLoading(false);
          setInitialized(true);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, fetchPerfis]);

  // ============================================
  // MÉTODOS DE AUTENTICAÇÃO
  // ============================================

  const signIn = useCallback(async (credentials: EmailCredentials): Promise<AuthResult> => {
    setLoading(true);
    setError(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (signInError) {
        const errorMessage = translateAuthError(signInError);
        setError(errorMessage);
        setLoading(false); // Apenas em erro
        return { success: false, error: errorMessage };
      }

      // Sucesso: NÃO fazer setLoading(false) aqui
      // O loading será desligado pelo loadUserData() no onAuthStateChange
      return { success: true, redirectTo: '/dashboard' };
    } catch (err) {
      const errorMessage = 'Erro ao fazer login';
      setError(errorMessage);
      setLoading(false); // Apenas em erro
      return { success: false, error: errorMessage };
    }
    // SEM finally { setLoading(false) } - mantém loading até profile carregar
  }, []);

  const signInWithCPF = useCallback(async (credentials: CPFCredentials): Promise<AuthResult> => {
    try {
      setLoading(true);
      setError(null);

      // Limpar CPF (remover pontos/traços)
      const cpfLimpo = credentials.cpf.replace(/\D/g, '');

      // Buscar email do associado pelo CPF na tabela profiles
      const { data: profileData, error: searchError } = await supabase
        .from('profiles')
        .select('email')
        .eq('cpf', cpfLimpo)
        .eq('tipo', 'associado')
        .maybeSingle();

      if (searchError || !profileData?.email) {
        return { success: false, error: 'CPF não encontrado' };
      }

      // Login com email encontrado
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profileData.email,
        password: credentials.password,
      });

      if (signInError) {
        return { success: false, error: translateAuthError(signInError) };
      }

      return { success: true, redirectTo: '/app/home' };
    } catch (err) {
      return { success: false, error: 'Erro ao fazer login' };
    } finally {
      setLoading(false);
    }
  }, []);


  const signInWithMagicLink = useCallback(async (credentials: MagicLinkCredentials): Promise<AuthResult> => {
    try {
      setLoading(true);
      setError(null);

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: credentials.email,
        options: {
          emailRedirectTo: credentials.redirectTo || `${window.location.origin}/auth/callback`,
        },
      });

      if (otpError) {
        return { success: false, error: translateAuthError(otpError) };
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: 'Erro ao enviar link de acesso' };
    } finally {
      setLoading(false);
    }
  }, []);

  const signUp = useCallback(async (data: SignUpData): Promise<AuthResult> => {
    try {
      setLoading(true);
      setError(null);

      const { error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            nome: data.nome,
            tipo: data.tipo || 'funcionario',
            telefone: data.telefone,
            cpf: data.cpf,
          },
        },
      });

      if (signUpError) {
        return { success: false, error: translateAuthError(signUpError) };
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: 'Erro ao criar conta' };
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      
      // Encerrar sessão customizada se existir
      const sessionToken = localStorage.getItem(SESSION_TOKEN_KEY);
      if (sessionToken) {
        try {
          await encerrarSessao(sessionToken);
        } catch (e) {
          console.warn('Erro ao encerrar sessão customizada:', e);
        }
        localStorage.removeItem(SESSION_TOKEN_KEY);
      }
      
      // Tentar logout no Supabase Auth (ignorar erros de sessão não encontrada)
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch (e) {
        console.warn('Erro ao fazer signOut no Supabase:', e);
      }
      
    } finally {
      // SEMPRE limpar estado local, independente de erros
      setUser(null);
      setSession(null);
      setProfile(null);
      setPerfis([]);
      setLoading(false);
    }
  }, []);

  const resetPassword = useCallback(async (email: string): Promise<AuthResult> => {
    try {
      setLoading(true);
      setError(null);

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (resetError) {
        return { success: false, error: translateAuthError(resetError) };
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: 'Erro ao enviar email de recuperação' };
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePassword = useCallback(async (newPassword: string): Promise<AuthResult> => {
    try {
      setLoading(true);
      setError(null);

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        return { success: false, error: translateAuthError(updateError) };
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: 'Erro ao atualizar senha' };
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshSession = useCallback(async (): Promise<void> => {
    try {
      await supabase.auth.refreshSession();
    } catch (err) {
      console.error('Erro ao atualizar sessão:', err);
    }
  }, []);

  const updateProfile = useCallback(async (
    data: Partial<Pick<Profile, 'nome' | 'telefone' | 'avatar_url'>>
  ): Promise<AuthResult> => {
    try {
      if (!profile?.id) {
        return { success: false, error: 'Usuário não encontrado' };
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (updateError) {
        return { success: false, error: 'Erro ao atualizar perfil' };
      }

      // Atualizar estado local
      setProfile(prev => prev ? { ...prev, ...data } : null);

      return { success: true };
    } catch (err) {
      return { success: false, error: 'Erro ao atualizar perfil' };
    }
  }, [profile?.id]);

  // ============================================
  // MÉTODOS DE VERIFICAÇÃO
  // ============================================

  const hasPerfil = useCallback((perfil: PerfilAcesso): boolean => {
    return perfis.includes(perfil);
  }, [perfis]);

  const hasAnyPerfil = useCallback((checkPerfis: PerfilAcesso[]): boolean => {
    return checkPerfis.some(p => perfis.includes(p));
  }, [perfis]);

  const hasAllPerfis = useCallback((checkPerfis: PerfilAcesso[]): boolean => {
    return checkPerfis.every(p => perfis.includes(p));
  }, [perfis]);

  const canAccess = useCallback((allowedPerfis: PerfilAcesso[], requireAll = false): boolean => {
    // Diretor e admin_master sempre podem acessar tudo
    if (perfis.includes('diretor') || perfis.includes('admin_master') || perfis.includes('desenvolvedor')) return true;
    return requireAll ? hasAllPerfis(allowedPerfis) : hasAnyPerfil(allowedPerfis);
  }, [perfis, hasAllPerfis, hasAnyPerfil]);

  // ============================================
  // HELPER: getRedirectUrl (compatibilidade)
  // ============================================

  const getRedirectUrl = useCallback((): string => {
    if (profile?.tipo === 'associado') {
      return '/app/home';
    }
    // Para prestadores/operacionais, verificar se tem redirect no perfil
    if (profile?.tipo === 'prestador') {
      if (hasPerfil('sindicante')) return '/sindicante';
      if (hasPerfil('regulador')) return '/regulador';
      return '/instalador';
    }
    if (hasPerfil('instalador_vistoriador')) {
      return '/instalador';
    }
    return '/dashboard';
  }, [profile?.tipo, hasPerfil]);

  // ============================================
  // COMPUTAR FLAGS
  // ============================================

  const authState: AuthState = {
    user,
    session,
    profile,
    perfis,
    loading,
    initialized,
    error,
  };

  const flags: AuthFlags = computeAuthFlags(authState);

  // ============================================
  // FUNÇÕES LEGADAS (compatibilidade)
  // ============================================

  const isGerenciaFn = useCallback((): boolean => {
    return perfis.includes('diretor') || perfis.includes('gerente_comercial');
  }, [perfis]);

  const isVendedorFn = useCallback((): boolean => {
    return perfis.includes('vendedor_clt') || perfis.includes('vendedor_externo') || perfis.includes('supervisor_vendas');
  }, [perfis]);

  const isFuncionarioFn = useCallback((): boolean => {
    return profile?.tipo === 'funcionario';
  }, [profile?.tipo]);

  const isAssociadoFn = useCallback((): boolean => {
    return profile?.tipo === 'associado';
  }, [profile?.tipo]);

  const isInstaladorFn = useCallback((): boolean => {
    return perfis.includes('instalador_vistoriador');
  }, [perfis]);

  // ============================================
  // VALOR DO CONTEXT
  // ============================================

  const value: ExtendedAuthContextType = {
    // Estado
    ...authState,
    // Flags computadas
    ...flags,
    // Métodos de autenticação
    signIn,
    signInWithCPF,
    signInWithMagicLink,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    refreshSession,
    updateProfile,
    // Métodos de verificação
    hasPerfil,
    hasAnyPerfil,
    hasAllPerfis,
    canAccess,
    // Aliases para compatibilidade
    roles: perfis,
    hasRole: hasPerfil,
    getRedirectUrl,
    // Funções legadas
    isGerencia: isGerenciaFn,
    isVendedor: isVendedorFn,
    isFuncionario: isFuncionarioFn,
    isAssociado: isAssociadoFn,
    isInstalador: isInstaladorFn,
  };

  return (
    <AuthContext.Provider value={value as unknown as AuthContextType}>
      {children}
    </AuthContext.Provider>
  );
}

// ============================================
// HOOK useAuth
// ============================================

export function useAuth(): ExtendedAuthContextType {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }

  return context as unknown as ExtendedAuthContextType;
}

// ============================================
// EXPORTS
// ============================================
export { AuthContext };
