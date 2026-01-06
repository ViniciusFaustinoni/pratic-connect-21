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
 * - 'associado': Clientes que possuem veículos protegidos
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
  associado: 'Associado',
  analista_marketing: 'Analista de Marketing',
  analista_juridico: 'Analista Jurídico',
};

// ============================================================
// IMPORTS DO SUPABASE PARA ESTADO DO CONTEXTO
// ============================================================

import type { User, Session } from '@supabase/supabase-js';

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
