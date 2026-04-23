// Tipos para Atribuição de Grades + Hierarquia (Fase 2)

export type RoleVendas =
  | 'vendedor_clt'
  | 'vendedor_externo'
  | 'agencia'
  | 'supervisor_vendas'
  | 'gerente_comercial';

export interface UsuarioVendas {
  id: string; // user_id (= profile.id)
  nome: string;
  email: string;
  avatar_url: string | null;
  roles: string[];
}

export interface HierarquiaVendas {
  id: string;
  vendedor_id: string;
  supervisor_id: string | null;
  gerente_id: string | null;
  agencia_id: string | null;
  vigente_desde: string;
  vigente_ate: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface UsuarioGradeAtual {
  id: string;
  user_id: string;
  grade_id: string;
  data_inicio: string;
  data_fim: string | null;
  papel_no_nivel: string | null;
  grade?: { id: string; nome: string; ativo: boolean };
}

export interface AtribuicaoLinha {
  usuario: UsuarioVendas;
  gradeAtual: UsuarioGradeAtual | null;
  hierarquia: HierarquiaVendas | null;
}
