import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  AtribuicaoLinha,
  HierarquiaVendas,
  UsuarioGradeAtual,
  UsuarioVendas,
} from '@/types/atribuicaoComissao';

const ROLES_VENDAS = [
  'vendedor_clt',
  'vendedor_externo',
  'agencia',
  'supervisor_vendas',
  'gerente_comercial',
];

/**
 * Roles que ORIGINAM vendas e portanto recebem grade própria.
 * Supervisor e gerente NÃO entram aqui — eles comissionam pela grade
 * do vendedor que originou a venda (ver fn_gerar_comissoes_por_pagamento).
 */
const ROLES_ORIGEM_VENDA = ['vendedor_clt', 'vendedor_externo', 'agencia'];

export function podeReceberGrade(roles: string[] | undefined | null): boolean {
  if (!roles || roles.length === 0) return false;
  return roles.some((r) => ROLES_ORIGEM_VENDA.includes(r));
}

export function useUsuariosVendas() {
  return useQuery({
    queryKey: ['atribuicao-comissoes', 'usuarios-vendas'],
    queryFn: async (): Promise<UsuarioVendas[]> => {
      // 1) Buscar user_roles com perfis de vendas (user_id = auth.users.id)
      const { data: roles, error: rolesErr } = await (supabase as any)
        .from('user_roles')
        .select('user_id, role')
        .in('role', ROLES_VENDAS);
      if (rolesErr) throw rolesErr;

      const authUserIds = Array.from(new Set((roles || []).map((r: any) => r.user_id)));
      if (authUserIds.length === 0) return [];

      // 2) Buscar profiles por profiles.user_id (NÃO por profiles.id).
      //    O schema de comissões usa profile.id como chave canônica em
      //    hierarquia_vendas e usuario_grade_comissao.
      const { data: profiles, error: profErr } = await (supabase as any)
        .from('profiles')
        .select('id, user_id, nome, email, avatar_url, tipo')
        .in('user_id', authUserIds)
        .neq('tipo', 'associado'); // segurança: associados nunca entram na esteira de comissão
      if (profErr) throw profErr;

      // 3) Agrupar roles por auth.user_id e mapear para o profile correto
      const rolesByAuthUser = new Map<string, string[]>();
      (roles || []).forEach((r: any) => {
        const arr = rolesByAuthUser.get(r.user_id) || [];
        arr.push(r.role);
        rolesByAuthUser.set(r.user_id, arr);
      });

      return (profiles || [])
        .map((p: any) => ({
          id: p.id, // profile.id é a chave usada em hierarquia_vendas/usuario_grade_comissao
          nome: p.nome || '(sem nome)',
          email: p.email || '',
          avatar_url: p.avatar_url,
          roles: rolesByAuthUser.get(p.user_id) || [],
        }))
        .filter((u: UsuarioVendas) => u.roles.length > 0)
        .sort((a: UsuarioVendas, b: UsuarioVendas) => a.nome.localeCompare(b.nome));
    },
  });
}

export function useGradesAtivas() {
  return useQuery({
    queryKey: ['grades-comissao-ativas-min'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('grades_comissao')
        .select('id, nome, ativo, versao')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data as { id: string; nome: string; ativo: boolean; versao: number }[];
    },
  });
}

export function useAtribuicoesComissao() {
  const usuariosQ = useUsuariosVendas();

  const atribuicoesQ = useQuery({
    queryKey: ['atribuicao-comissoes', 'completo', usuariosQ.data?.length],
    enabled: !!usuariosQ.data,
    queryFn: async (): Promise<AtribuicaoLinha[]> => {
      const usuarios = usuariosQ.data || [];
      const ids = usuarios.map((u) => u.id);
      if (ids.length === 0) return [];

      const [{ data: grades, error: gradesErr }, { data: hier, error: hierErr }] =
        await Promise.all([
          (supabase as any)
            .from('usuario_grade_comissao')
            .select('id, user_id, grade_id, data_inicio, data_fim, papel_no_nivel, grade:grades_comissao(id,nome,ativo)')
            .is('data_fim', null)
            .in('user_id', ids),
          (supabase as any)
            .from('hierarquia_vendas')
            .select('*')
            .is('vigente_ate', null)
            .in('vendedor_id', ids),
        ]);

      if (gradesErr) throw gradesErr;
      if (hierErr) throw hierErr;

      const gradeByUser = new Map<string, UsuarioGradeAtual>();
      (grades || []).forEach((g: any) => gradeByUser.set(g.user_id, g));

      const hierByUser = new Map<string, HierarquiaVendas>();
      (hier || []).forEach((h: any) => hierByUser.set(h.vendedor_id, h));

      return usuarios.map((u) => ({
        usuario: u,
        gradeAtual: gradeByUser.get(u.id) || null,
        hierarquia: hierByUser.get(u.id) || null,
      }));
    },
  });

  return atribuicoesQ;
}

export function useAtribuirGrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { user_id: string; grade_id: string; papel_no_nivel?: string | null }) => {
      const { data, error } = await (supabase as any).rpc('fn_atribuir_grade_usuario', {
        p_user_id: input.user_id,
        p_grade_id: input.grade_id,
        p_papel_no_nivel: input.papel_no_nivel ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['atribuicao-comissoes'] });
    },
  });
}

export function useUpsertHierarquia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      vendedor_id: string;
      supervisor_id?: string | null;
      gerente_id?: string | null;
      agencia_id?: string | null;
      observacoes?: string | null;
    }) => {
      const { data, error } = await (supabase as any).rpc('fn_upsert_hierarquia_vendedor', {
        p_vendedor_id: input.vendedor_id,
        p_supervisor_id: input.supervisor_id ?? null,
        p_gerente_id: input.gerente_id ?? null,
        p_agencia_id: input.agencia_id ?? null,
        p_observacoes: input.observacoes ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['atribuicao-comissoes'] });
    },
  });
}
