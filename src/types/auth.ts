/**
 * @file Tipos do sistema de autenticação
 * @module auth
 * @project SGA Pratic 2.0
 * @description Interfaces e tipos para autenticação e controle de acesso
 * @see ARQUITETURA_SGA.md - Seção "Modelo de Dados - CORE"
 * 
 * IMPORTANTE: Este sistema usa as seguintes equivalências:
 * - profiles === usuarios (nomenclatura do PRD)
 * - user_roles === perfis_acesso (nomenclatura do PRD)
 * - user_id === auth_id (referência ao auth.users)
 */

import type { User, Session } from '@supabase/supabase-js';

// ============================================================
// TIPOS BASE
// ============================================================

/**
 * Tipos de usuário do sistema
 * @description Corresponde ao ENUM `tipo_usuario` e campo `tipo` da tabela `profiles`
 * 
 * @example
 * const tipo: TipoUsuario = 'funcionario';
 * 
 * - 'funcionario': Colaboradores internos da PRATIC
 * - 'associado': Associados que possuem veículos protegidos
 * - 'prestador': Parceiros externos (guincheiros, oficinas)
 */
export type TipoUsuario = 'funcionario' | 'associado' | 'prestador';

/**
 * Perfis de acesso disponíveis (roles)
 * @description Corresponde ao ENUM `app_role` usado na tabela `user_roles`
 * 
 * @example
 * const perfil: PerfilAcesso = 'diretor';
 * const roles: PerfilAcesso[] = ['diretor', 'gerente_comercial'];
 * 
 * Hierarquia de acesso:
 * - 'diretor': Acesso total ao sistema
 * - 'gerente_comercial': Gestão da equipe de vendas
 * - 'supervisor_vendas': Supervisiona vendedores
 * - 'vendedor_clt': Vendedor interno CLT
 * - 'vendedor_externo': Vendedor comissionado externo
 * - 'analista_cadastro': Análise de documentos e aprovações
 * - 'coordenador_monitoramento': Coordena instalações e rastreadores
 * - 'analista_plataforma': Opera plataformas de rastreamento
 * - 'instalador_vistoriador': Instala rastreadores e faz vistorias
 * - 'associado': Cliente no app do associado
 * - 'analista_marketing': Gestão de campanhas e leads
 * - 'analista_juridico': Processos e contratos jurídicos
 */
export type PerfilAcesso = 
  | 'diretor'
  | 'gerente_comercial'
  | 'supervisor_vendas'
  | 'vendedor_clt'
  | 'vendedor_externo'
  | 'analista_cadastro'
  | 'coordenador_monitoramento'
  | 'analista_plataforma'
  | 'instalador_vistoriador'
  | 'vistoriador_base'
  | 'associado'
  | 'analista_marketing'
  | 'analista_juridico';

/**
 * Alias para PerfilAcesso
 * @description Usado no AuthContext e código existente
 */
export type AppRole = PerfilAcesso;

// ============================================================
// INTERFACE PROFILE
// ============================================================

/**
 * Perfil do usuário logado
 * @description Representa um registro da tabela `profiles` (equivalente a `usuarios` do PRD)
 * @see ARQUITETURA_SGA.md - Tabela usuarios/profiles
 * 
 * @example
 * const profile: Profile = {
 *   id: 'uuid-do-profile',
 *   user_id: 'uuid-do-auth-user',
 *   nome: 'João Silva',
 *   email: 'joao@pratic.com.br',
 *   tipo: 'funcionario',
 *   ativo: true,
 *   // ...
 * };
 */
export interface Profile {
  /** UUID único do registro (PK) */
  id: string;
  
  /** 
   * UUID de referência ao auth.users do Supabase 
   * @description Equivalente a `auth_id` na nomenclatura do PRD
   */
  user_id: string;
  
  /** Nome completo do usuário */
  nome: string;
  
  /** 
   * Email único 
   * @description Usado para login de funcionários e prestadores
   */
  email: string;
  
  /** 
   * Telefone com DDD 
   * @example "(11) 99999-9999"
   */
  telefone: string | null;
  
  /** 
   * CPF formatado 
   * @description Usado para login de associados
   * @example "123.456.789-00"
   */
  cpf: string | null;
  
  /** Tipo do usuário: funcionario, associado ou prestador */
  tipo: TipoUsuario;
  
  /** Se o usuário está ativo no sistema */
  ativo: boolean;
  
  /** 
   * Se o usuário está bloqueado 
   * @description Quando true, impede o login
   */
  bloqueado: boolean | null;
  
  /** 
   * Motivo do bloqueio 
   * @description Preenchido quando bloqueado = true
   */
  motivo_bloqueio: string | null;
  
  /** 
   * URL da foto de perfil 
   * @description Armazenada no Supabase Storage
   */
  avatar_url: string | null;
  
  /** 
   * Data/hora do último acesso 
   * @description Atualizado pelo log_auth_event()
   */
  data_ultimo_acesso: string | null;
  
  /** Data de criação do registro (ISO 8601) */
  created_at: string;
  
  /** Data da última atualização (ISO 8601) */
  updated_at: string;
  
  /** UUID do usuário que criou o registro */
  created_by: string | null;
  
  /** UUID do usuário que fez a última atualização */
  updated_by: string | null;
  
  // --- Preferências de notificação ---
  
  /** Receber notificação de novos leads */
  notif_novos_leads: boolean | null;
  
  /** Receber notificação de documentos pendentes */
  notif_documentos_pendentes: boolean | null;
  
  /** Receber resumo diário por email */
  notif_resumo_diario: boolean | null;
  
  /** 
   * Se é o primeiro acesso do usuário
   * @description Quando true, usuário deve definir nova senha
   */
  primeiro_acesso: boolean;
}

// ============================================================
// INTERFACE USER ROLE RECORD
// ============================================================

/**
 * Registro de role de usuário
 * @description Representa um registro da tabela `user_roles` (equivalente a `perfis_acesso` do PRD)
 * 
 * @example
 * const roleRecord: UserRoleRecord = {
 *   id: 'uuid-do-registro',
 *   user_id: 'uuid-do-auth-user',
 *   role: 'diretor',
 *   created_at: '2024-01-15T10:30:00Z'
 * };
 */
export interface UserRoleRecord {
  /** UUID único do registro */
  id: string;
  
  /** 
   * UUID do auth.users 
   * @description FK para auth.users(id)
   */
  user_id: string;
  
  /** Nome do role/perfil atribuído */
  role: PerfilAcesso;
  
  /** Data de atribuição do role (ISO 8601) */
  created_at: string;
}

/**
 * Alias para compatibilidade com nomenclatura do PRD
 * @deprecated Preferir usar UserRoleRecord diretamente
 */
export type PerfilAcessoRecord = UserRoleRecord;

// ============================================================
// TIPOS COMPOSTOS
// ============================================================

/**
 * Profile completo com array de roles/perfis
 * @description Usado quando carregamos o usuário com seus perfis de acesso
 * 
 * @example
 * const userWithPerfis: ProfileWithPerfis = {
 *   ...profile,
 *   perfis: ['diretor', 'gerente_comercial']
 * };
 */
export interface ProfileWithPerfis extends Profile {
  /** Lista de roles/perfis ativos do usuário */
  perfis: PerfilAcesso[];
}

/**
 * Alias com nomenclatura alternativa (roles)
 * @description Mesmo que ProfileWithPerfis, usando terminologia "roles"
 * 
 * @example
 * const userWithRoles: ProfileWithRoles = {
 *   ...profile,
 *   roles: ['diretor', 'gerente_comercial']
 * };
 */
export interface ProfileWithRoles extends Profile {
  /** Lista de roles ativos do usuário */
  roles: AppRole[];
}

// ============================================================
// ALIASES PARA COMPATIBILIDADE COM PRD
// Permite usar a nomenclatura do documento de arquitetura
// ============================================================

/** 
 * Alias: profiles === usuarios 
 * @description Permite usar nomenclatura do PRD
 * @deprecated Preferir usar Profile diretamente
 */
export type Usuario = Profile;

/**
 * Constantes de labels para exibição na UI
 * @description Mapeamento de tipos e roles para textos legíveis
 */
export const TIPO_USUARIO_LABELS: Record<TipoUsuario, string> = {
  funcionario: 'Funcionário',
  associado: 'Associado',
  prestador: 'Prestador',
};

export const PERFIL_ACESSO_LABELS: Record<PerfilAcesso, string> = {
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
};

// ============================================================
// ESTADO DO CONTEXTO DE AUTENTICAÇÃO
// ============================================================

// ============================================================
// ESTADO DO CONTEXTO DE AUTENTICAÇÃO
// ============================================================

/**
 * Estado interno do contexto de autenticação
 * @description Mantém os dados da sessão, usuário e perfis
 * @see AuthContext.tsx
 */
export interface AuthState {
  /**
   * Usuário do Supabase Auth (tabela auth.users)
   * @description Contém id, email, metadata do provider
   */
  user: User | null;
  
  /**
   * Sessão ativa do Supabase
   * @description Contém access_token, refresh_token, expires_at
   */
  session: Session | null;
  
  /**
   * Perfil do usuário (tabela public.profiles)
   * @description Dados customizados: nome, cpf, tipo, etc.
   */
  profile: Profile | null;
  
  /**
   * Lista de perfis de acesso ativos
   * @description Array de strings com os perfis (ex: ['diretor', 'gerente_comercial'])
   */
  perfis: PerfilAcesso[];
  
  /**
   * Indica se está carregando dados de autenticação
   * @description true durante fetchProfile, fetchPerfis, signIn, etc.
   */
  loading: boolean;
  
  /**
   * Indica se o contexto foi inicializado
   * @description true após a primeira verificação de sessão
   */
  initialized: boolean;
  
  /**
   * Mensagem de erro da última operação
   * @description null se não houver erro
   */
  error: string | null;
}

// ============================================================
// FLAGS DE CONVENIÊNCIA
// ============================================================

/**
 * Flags booleanas derivadas do estado
 * @description Facilita verificações de permissão nos componentes
 * 
 * @example
 * const { isAuthenticated, isDiretor, isVendedor } = useAuth();
 * if (isDiretor) {
 *   // Acesso total
 * }
 */
export interface AuthFlags {
  /**
   * Se há uma sessão ativa
   * @derived session !== null
   */
  isAuthenticated: boolean;
  
  /**
   * Se o usuário é funcionário da PRATIC
   * @derived profile?.tipo === 'funcionario'
   */
  isFuncionario: boolean;
  
  /**
   * Se o usuário é associado (cliente)
   * @derived profile?.tipo === 'associado'
   */
  isAssociado: boolean;
  
  /**
   * Se o usuário é prestador de serviço
   * @derived profile?.tipo === 'prestador'
   */
  isPrestador: boolean;
  
  /**
   * Se o usuário está ativo no sistema
   * @derived profile?.ativo === true
   */
  isAtivo: boolean;
  
  /**
   * Se o usuário está bloqueado
   * @derived profile?.bloqueado === true
   */
  isBloqueado: boolean;
  
  /**
   * Se tem perfil de diretor (acesso total)
   * @derived perfis.includes('diretor')
   */
  isDiretor: boolean;
  
  /**
   * Se tem perfil de gerente comercial
   * @derived perfis.includes('gerente_comercial')
   */
  isGerente: boolean;
  
  /**
   * Se tem perfil de supervisor de vendas
   * @derived perfis.includes('supervisor_vendas')
   */
  isSupervisor: boolean;
  
  /**
   * Se é vendedor (CLT ou externo)
   * @derived perfis.includes('vendedor_clt') || perfis.includes('vendedor_externo')
   */
  isVendedor: boolean;
  
  /**
   * Se é analista de cadastro
   * @derived perfis.includes('analista_cadastro')
   */
  isAnalistaCadastro: boolean;
  
  /**
   * Se é coordenador de monitoramento
   * @derived perfis.includes('coordenador_monitoramento')
   */
  isCoordenadorMonitoramento: boolean;
  
  /**
   * Se é analista de plataforma
   * @derived perfis.includes('analista_plataforma')
   */
  isAnalistaPlataforma: boolean;
  
  /**
   * Se é instalador/vistoriador
   * @derived perfis.includes('instalador_vistoriador')
   */
  isInstalador: boolean;
  
  /**
   * Se é analista de marketing
   * @derived perfis.includes('analista_marketing')
   */
  isAnalistaMarketing: boolean;
  
  /**
   * Se é analista jurídico
   * @derived perfis.includes('analista_juridico')
   */
  isAnalistaJuridico: boolean;
}

// ============================================================
// VALORES INICIAIS
// ============================================================

/**
 * Estado inicial do contexto
 * @description Usado no createContext e reset
 */
export const initialAuthState: AuthState = {
  user: null,
  session: null,
  profile: null,
  perfis: [],
  loading: true,
  initialized: false,
  error: null,
};

/**
 * Flags iniciais (tudo false)
 * @description Usado quando não há usuário logado
 */
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
  isAnalistaMarketing: false,
  isAnalistaJuridico: false,
};

// ============================================================
// HELPER PARA CALCULAR FLAGS
// ============================================================

/**
 * Calcula as flags baseado no estado
 * @param state Estado atual do auth
 * @returns Objeto com todas as flags calculadas
 * 
 * @example
 * const flags = computeAuthFlags(authState);
 * console.log(flags.isDiretor); // true ou false
 */
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
    isAnalistaMarketing: perfis.includes('analista_marketing'),
    isAnalistaJuridico: perfis.includes('analista_juridico'),
  };
}

// ═══════════════════════════════════════════════════════════════
// TIPOS DE RESULTADO E CREDENCIAIS (1.F.03)
// ═══════════════════════════════════════════════════════════════

/**
 * Resultado de operações de autenticação
 * @description Padrão de retorno para signIn, signUp, resetPassword, etc.
 */
export interface AuthResult {
  /** Se a operação foi bem sucedida */
  success: boolean;
  
  /** Mensagem de erro (se success = false) */
  error?: string;
  
  /** Código do erro para tratamento específico */
  errorCode?: string;
  
  /** URL para redirect após sucesso (ex: /dashboard, /app) */
  redirectTo?: string;
}

/**
 * Credenciais para login por email
 * @description Usado por funcionários no sistema interno
 */
export interface EmailCredentials {
  /** Email do funcionário */
  email: string;
  
  /** Senha */
  password: string;
  
  /** Manter sessão ativa (remember me) */
  rememberMe?: boolean;
}

/**
 * Credenciais para login por CPF
 * @description Usado por associados no app
 */
export interface CPFCredentials {
  /** CPF do associado (com ou sem formatação) */
  cpf: string;
  
  /** Senha */
  password: string;
}

/**
 * Credenciais para magic link
 * @description Login sem senha via email
 */
export interface MagicLinkCredentials {
  /** Email para enviar o link */
  email: string;
  
  /** URL de redirect após login */
  redirectTo?: string;
}

/**
 * Dados para criar novo usuário
 * @description Usado em signUp e primeiro acesso
 */
export interface SignUpData {
  /** Email do usuário */
  email: string;
  
  /** Senha (mínimo 6 caracteres) */
  password: string;
  
  /** Nome completo */
  nome: string;
  
  /** CPF (obrigatório para associados) */
  cpf?: string;
  
  /** Telefone com DDD */
  telefone?: string;
  
  /** Tipo do usuário */
  tipo: TipoUsuario;
  
  /** Perfis a atribuir (default: baseado no tipo) */
  perfis?: PerfilAcesso[];
}

// ═══════════════════════════════════════════════════════════════
// MÉTODOS DE AUTENTICAÇÃO (1.F.03)
// ═══════════════════════════════════════════════════════════════

/**
 * Métodos de autenticação do contexto
 * @description Todas as operações de login, logout, senha
 */
export interface AuthMethods {
  /**
   * Login por email/senha
   * @description Usado por funcionários no sistema interno
   * @param credentials Email e senha
   * @returns Resultado com success e possível redirect
   * @example
   * const result = await signIn({ email: 'user@pratic.com', password: '123456' });
   * if (result.success) navigate(result.redirectTo || '/dashboard');
   */
  signIn: (credentials: EmailCredentials) => Promise<AuthResult>;
  
  /**
   * Login por CPF/senha
   * @description Usado por associados no app
   * @param credentials CPF e senha
   * @returns Resultado com success e possível redirect
   * @example
   * const result = await signInWithCPF({ cpf: '123.456.789-00', password: '123456' });
   * if (result.success) navigate('/app');
   */
  signInWithCPF: (credentials: CPFCredentials) => Promise<AuthResult>;
  
  
  /**
   * Login sem senha via magic link
   * @description Envia link de acesso por email
   * @param credentials Email do usuário
   * @returns Resultado indicando se email foi enviado
   */
  signInWithMagicLink: (credentials: MagicLinkCredentials) => Promise<AuthResult>;
  
  /**
   * Criar novo usuário
   * @description Cadastro de funcionário ou associado
   * @param data Dados do novo usuário
   * @returns Resultado com success
   */
  signUp: (data: SignUpData) => Promise<AuthResult>;
  
  /**
   * Encerrar sessão
   * @description Logout + limpeza de estado + redirect
   */
  signOut: () => Promise<void>;
  
  /**
   * Solicitar recuperação de senha
   * @description Envia email com link de reset
   * @param email Email do usuário
   * @returns Resultado indicando se email foi enviado
   */
  resetPassword: (email: string) => Promise<AuthResult>;
  
  /**
   * Alterar senha do usuário logado
   * @description Requer estar autenticado
   * @param newPassword Nova senha (mínimo 6 caracteres)
   * @returns Resultado da operação
   */
  updatePassword: (newPassword: string) => Promise<AuthResult>;
  
  /**
   * Forçar refresh da sessão
   * @description Atualiza token e recarrega profile/perfis
   */
  refreshSession: () => Promise<void>;
  
  /**
   * Atualizar dados do profile
   * @description Atualiza nome, telefone, etc.
   * @param data Dados parciais a atualizar
   * @returns Resultado da operação
   */
  updateProfile: (data: Partial<Pick<Profile, 'nome' | 'telefone' | 'avatar_url'>>) => Promise<AuthResult>;
}

// ═══════════════════════════════════════════════════════════════
// MÉTODOS DE VERIFICAÇÃO DE PERFIS (1.F.03)
// ═══════════════════════════════════════════════════════════════

/**
 * Métodos para verificar permissões
 * @description Usados em Guards e condicionais de UI
 */
export interface AuthVerification {
  /**
   * Verifica se o usuário tem um perfil específico
   * @param perfil Perfil a verificar
   * @returns true se o usuário tem o perfil ativo
   * @example
   * if (hasPerfil('diretor')) { // mostrar opção admin }
   */
  hasPerfil: (perfil: PerfilAcesso) => boolean;
  
  /**
   * Verifica se o usuário tem qualquer um dos perfis
   * @param perfis Array de perfis (OR)
   * @returns true se o usuário tem pelo menos um dos perfis
   * @example
   * if (hasAnyPerfil(['diretor', 'gerente_comercial'])) { // acesso a relatórios }
   */
  hasAnyPerfil: (perfis: PerfilAcesso[]) => boolean;
  
  /**
   * Verifica se o usuário tem todos os perfis
   * @param perfis Array de perfis (AND)
   * @returns true se o usuário tem todos os perfis
   * @example
   * if (hasAllPerfis(['supervisor_vendas', 'analista_cadastro'])) { // acesso especial }
   */
  hasAllPerfis: (perfis: PerfilAcesso[]) => boolean;
  
  /**
   * Verifica acesso combinando regras
   * @param requiredPerfis Perfis necessários
   * @param requireAll Se true, exige todos; se false (default), exige qualquer um
   * @returns true se as condições são atendidas
   * @example
   * if (canAccess(['vendedor_clt', 'vendedor_externo'])) { // acesso a vendas }
   */
  canAccess: (requiredPerfis: PerfilAcesso[], requireAll?: boolean) => boolean;
}

// ═══════════════════════════════════════════════════════════════
// INTERFACE COMPLETA DO CONTEXTO (1.F.03)
// ═══════════════════════════════════════════════════════════════

/**
 * Interface completa do AuthContext
 * @description Combina estado, flags, métodos e verificações
 * @see AuthState - Estado interno (user, session, profile, perfis)
 * @see AuthFlags - Flags de conveniência (isFuncionario, isDiretor, etc.)
 * @see AuthMethods - Métodos de autenticação (signIn, signOut, etc.)
 * @see AuthVerification - Métodos de verificação (hasPerfil, canAccess)
 */
export interface AuthContextType extends AuthState, AuthFlags, AuthMethods, AuthVerification {}

// ═══════════════════════════════════════════════════════════════
// MAPEAMENTO DE ERROS (1.F.03)
// ═══════════════════════════════════════════════════════════════

/**
 * Códigos de erro do Supabase Auth
 * @description Usados para traduzir erros para português
 */
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

/**
 * Tipo para códigos de erro
 */
export type AuthErrorCode = keyof typeof AUTH_ERROR_CODES;

/**
 * Função para traduzir erro do Supabase
 * @param error Erro retornado pelo Supabase
 * @returns Mensagem traduzida para português
 */
export function translateAuthError(error: { message?: string; code?: string } | null): string {
  if (!error) return AUTH_ERROR_CODES.unknown;
  
  const code = error.code as AuthErrorCode;
  if (code && AUTH_ERROR_CODES[code]) {
    return AUTH_ERROR_CODES[code];
  }
  
  // Fallback: tentar identificar pelo message
  const message = error.message?.toLowerCase() || '';
  
  if (message.includes('invalid login credentials')) {
    return AUTH_ERROR_CODES.invalid_credentials;
  }
  if (message.includes('email not confirmed')) {
    return AUTH_ERROR_CODES.email_not_confirmed;
  }
  if (message.includes('user not found')) {
    return AUTH_ERROR_CODES.user_not_found;
  }
  if (message.includes('password')) {
    return AUTH_ERROR_CODES.weak_password;
  }
  if (message.includes('already registered') || message.includes('already exists')) {
    return AUTH_ERROR_CODES.email_taken;
  }
  if (message.includes('rate limit') || message.includes('too many')) {
    return AUTH_ERROR_CODES.too_many_requests;
  }
  if (message.includes('network') || message.includes('fetch')) {
    return AUTH_ERROR_CODES.network_error;
  }
  
  return error.message || AUTH_ERROR_CODES.unknown;
}
