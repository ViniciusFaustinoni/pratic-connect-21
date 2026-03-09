/**
 * @file Tipos do sistema de autenticação
 * @module auth
 * @project SGA Pratic 2.0
 * @description Interfaces e tipos para autenticação e controle de acesso
 * 
 * IMPORTANTE: PerfilAcesso agora é `string` — roles são dinâmicos via app_roles_config.
 * Labels são obtidos via useAppRoles().getRoleLabel(role).
 */

import type { User, Session } from '@supabase/supabase-js';

// ============================================================
// TIPOS BASE
// ============================================================

export type TipoUsuario = 'funcionario' | 'associado' | 'prestador';

/**
 * Perfis de acesso — agora dinâmico (string).
 * Roles são gerenciados na tabela app_roles_config.
 * Use useAppRoles() para labels, cores e agrupamentos.
 */
export type PerfilAcesso = string;

/** Alias para PerfilAcesso */
export type AppRole = PerfilAcesso;

// ============================================================
// INTERFACE PROFILE
// ============================================================

export interface Profile {
  id: string;
  user_id: string;
  nome: string;
  email: string;
  telefone: string | null;
  cpf: string | null;
  tipo: TipoUsuario;
  ativo: boolean;
  bloqueado: boolean | null;
  motivo_bloqueio: string | null;
  avatar_url: string | null;
  data_ultimo_acesso: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  notif_novos_leads: boolean | null;
  notif_documentos_pendentes: boolean | null;
  notif_resumo_diario: boolean | null;
  primeiro_acesso: boolean;
}

// ============================================================
// INTERFACE USER ROLE RECORD
// ============================================================

export interface UserRoleRecord {
  id: string;
  user_id: string;
  role: PerfilAcesso;
  created_at: string;
}

/** @deprecated Preferir usar UserRoleRecord diretamente */
export type PerfilAcessoRecord = UserRoleRecord;

// ============================================================
// TIPOS COMPOSTOS
// ============================================================

export interface ProfileWithPerfis extends Profile {
  perfis: PerfilAcesso[];
}

export interface ProfileWithRoles extends Profile {
  roles: AppRole[];
}

/** @deprecated Preferir usar Profile diretamente */
export type Usuario = Profile;

export const TIPO_USUARIO_LABELS: Record<TipoUsuario, string> = {
  funcionario: 'Funcionário',
  associado: 'Associado',
  prestador: 'Prestador',
};

/**
 * @deprecated Use useAppRoles().getRoleLabel(role) em vez disso.
 * Mantido temporariamente para compatibilidade. Será removido em breve.
 */
export const PERFIL_ACESSO_LABELS: Record<string, string> = {
  diretor: 'Diretor',
  gerente_comercial: 'Gerente Comercial',
  supervisor_vendas: 'Supervisor de Vendas',
  vendedor_clt: 'Vendedor CLT',
  vendedor_externo: 'Vendedor Externo',
  analista_cadastro: 'Analista de Cadastro',
  coordenador_monitoramento: 'Coordenador de Monitoramento',
  analista_plataforma: 'Analista de Plataforma',
  instalador_vistoriador: 'Instalador/Vistoriador',
  vistoriador_base: 'Vistoriador Base',
  associado: 'Associado',
  analista_marketing: 'Analista de Marketing',
  analista_juridico: 'Analista Jurídico',
  regulador: 'Regulador',
  analista_eventos: 'Analista de Eventos',
  sindicante: 'Sindicante',
};

// ============================================================
// ESTADO DO CONTEXTO DE AUTENTICAÇÃO
// ============================================================

export interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  perfis: PerfilAcesso[];
  loading: boolean;
  initialized: boolean;
  error: string | null;
}

// ============================================================
// FLAGS DE CONVENIÊNCIA
// ============================================================

export interface AuthFlags {
  isAuthenticated: boolean;
  isFuncionario: boolean;
  isAssociado: boolean;
  isPrestador: boolean;
  isAtivo: boolean;
  isBloqueado: boolean;
  isDiretor: boolean;
  isGerente: boolean;
  isSupervisor: boolean;
  isVendedor: boolean;
  isAnalistaCadastro: boolean;
  isCoordenadorMonitoramento: boolean;
  isAnalistaPlataforma: boolean;
  isInstalador: boolean;
  isRegulador: boolean;
  isAnalistaEventos: boolean;
  isSindicante: boolean;
  isAnalistaMarketing: boolean;
  isAnalistaJuridico: boolean;
  /** Verifica dinamicamente se possui um role */
  hasRole: (role: string) => boolean;
}

// ============================================================
// VALORES INICIAIS
// ============================================================

export const initialAuthState: AuthState = {
  user: null,
  session: null,
  profile: null,
  perfis: [],
  loading: true,
  initialized: false,
  error: null,
};

export const initialAuthFlags: AuthFlags = {
  isAuthenticated: false,
  isFuncionario: false,
  isAssociado: false,
  isPrestador: false,
  isAtivo: false,
  isBloqueado: false,
  isDiretor: false,
  isGerente: false,
  isSupervisor: false,
  isVendedor: false,
  isAnalistaCadastro: false,
  isCoordenadorMonitoramento: false,
  isAnalistaPlataforma: false,
  isInstalador: false,
  isRegulador: false,
  isAnalistaEventos: false,
  isSindicante: false,
  isAnalistaMarketing: false,
  isAnalistaJuridico: false,
  hasRole: () => false,
};

// ============================================================
// HELPER PARA CALCULAR FLAGS
// ============================================================

export function computeAuthFlags(state: AuthState): AuthFlags {
  const { session, profile, perfis } = state;
  
  return {
    isAuthenticated: session !== null,
    isFuncionario: profile?.tipo === 'funcionario',
    isAssociado: profile?.tipo === 'associado',
    isPrestador: profile?.tipo === 'prestador',
    isAtivo: profile?.ativo === true,
    isBloqueado: profile?.bloqueado === true,
    isDiretor: perfis.includes('diretor'),
    isGerente: perfis.includes('gerente_comercial'),
    isSupervisor: perfis.includes('supervisor_vendas'),
    isVendedor: perfis.includes('vendedor_clt') || perfis.includes('vendedor_externo'),
    isAnalistaCadastro: perfis.includes('analista_cadastro'),
    isCoordenadorMonitoramento: perfis.includes('coordenador_monitoramento'),
    isAnalistaPlataforma: perfis.includes('analista_plataforma'),
    isInstalador: perfis.includes('instalador_vistoriador'),
    isRegulador: perfis.includes('regulador'),
    isAnalistaEventos: perfis.includes('analista_eventos'),
    isSindicante: perfis.includes('sindicante'),
    isAnalistaMarketing: perfis.includes('analista_marketing'),
    isAnalistaJuridico: perfis.includes('analista_juridico'),
    /** Verifica dinamicamente se possui qualquer role */
    hasRole: (role: string) => perfis.includes(role),
  };
}

// ═══════════════════════════════════════════════════════════════
// TIPOS DE RESULTADO E CREDENCIAIS
// ═══════════════════════════════════════════════════════════════

export interface AuthResult {
  success: boolean;
  error?: string;
  errorCode?: string;
  redirectTo?: string;
}

export interface EmailCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface CPFCredentials {
  cpf: string;
  password: string;
}

export interface MagicLinkCredentials {
  email: string;
  redirectTo?: string;
}

export interface SignUpData {
  email: string;
  password: string;
  nome: string;
  cpf?: string;
  telefone?: string;
  tipo: TipoUsuario;
  perfis?: PerfilAcesso[];
}

// ═══════════════════════════════════════════════════════════════
// MÉTODOS DE AUTENTICAÇÃO
// ═══════════════════════════════════════════════════════════════

export interface AuthMethods {
  signIn: (credentials: EmailCredentials) => Promise<AuthResult>;
  signInWithCPF: (credentials: CPFCredentials) => Promise<AuthResult>;
  signInWithMagicLink: (credentials: MagicLinkCredentials) => Promise<AuthResult>;
  signUp: (data: SignUpData) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<AuthResult>;
  updatePassword: (newPassword: string) => Promise<AuthResult>;
  refreshSession: () => Promise<void>;
  updateProfile: (data: Partial<Pick<Profile, 'nome' | 'telefone' | 'avatar_url'>>) => Promise<AuthResult>;
}

// ═══════════════════════════════════════════════════════════════
// MÉTODOS DE VERIFICAÇÃO DE PERFIS
// ═══════════════════════════════════════════════════════════════

export interface AuthVerification {
  hasPerfil: (perfil: PerfilAcesso) => boolean;
  hasAnyPerfil: (perfis: PerfilAcesso[]) => boolean;
  hasAllPerfis: (perfis: PerfilAcesso[]) => boolean;
  canAccess: (requiredPerfis: PerfilAcesso[], requireAll?: boolean) => boolean;
}

// ═══════════════════════════════════════════════════════════════
// INTERFACE COMPLETA DO CONTEXTO
// ═══════════════════════════════════════════════════════════════

export interface AuthContextType extends AuthState, AuthFlags, AuthMethods, AuthVerification {}

// ═══════════════════════════════════════════════════════════════
// MAPEAMENTO DE ERROS
// ═══════════════════════════════════════════════════════════════

export const AUTH_ERROR_CODES = {
  'invalid_credentials': 'Email ou senha incorretos',
  'email_not_confirmed': 'Email não confirmado. Verifique sua caixa de entrada.',
  'user_not_found': 'Usuário não encontrado',
  'invalid_email': 'Email inválido',
  'weak_password': 'Senha muito fraca. Use pelo menos 6 caracteres.',
  'email_taken': 'Este email já está cadastrado',
  'too_many_requests': 'Muitas tentativas. Aguarde alguns minutos.',
  'session_expired': 'Sessão expirada. Faça login novamente.',
  'network_error': 'Erro de conexão. Verifique sua internet.',
  'cpf_not_found': 'CPF não encontrado no sistema',
  'user_blocked': 'Usuário bloqueado. Entre em contato com o suporte.',
  'user_inactive': 'Usuário inativo. Entre em contato com o suporte.',
  'unknown': 'Erro desconhecido. Tente novamente.',
} as const;

export type AuthErrorCode = keyof typeof AUTH_ERROR_CODES;

export function translateAuthError(error: { message?: string; code?: string } | null): string {
  if (!error) return AUTH_ERROR_CODES.unknown;
  
  const code = error.code as AuthErrorCode;
  if (code && AUTH_ERROR_CODES[code]) {
    return AUTH_ERROR_CODES[code];
  }
  
  const message = error.message?.toLowerCase() || '';
  
  if (message.includes('invalid login credentials')) return AUTH_ERROR_CODES.invalid_credentials;
  if (message.includes('email not confirmed')) return AUTH_ERROR_CODES.email_not_confirmed;
  if (message.includes('user not found')) return AUTH_ERROR_CODES.user_not_found;
  if (message.includes('password')) return AUTH_ERROR_CODES.weak_password;
  if (message.includes('already registered') || message.includes('already exists')) return AUTH_ERROR_CODES.email_taken;
  if (message.includes('rate limit') || message.includes('too many')) return AUTH_ERROR_CODES.too_many_requests;
  if (message.includes('network') || message.includes('fetch')) return AUTH_ERROR_CODES.network_error;
  
  return error.message || AUTH_ERROR_CODES.unknown;
}
