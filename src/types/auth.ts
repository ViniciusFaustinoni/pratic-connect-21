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
