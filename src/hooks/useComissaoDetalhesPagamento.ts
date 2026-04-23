import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type Profile = { id: string; nome?: string | null; full_name?: string | null; email?: string | null; avatar_url?: string | null };
type Named = { id: string; nome?: string | null; versao?: number | null; snapshot?: unknown };

export interface ComissaoDetalhesPagamento {
  comissao: any;
  destinatario: Profile | null;
  vendedorOrigem: Profile | null;
  cadeia: {
    vendedor: Profile | null;
    supervisor: Profile | null;
    gerente: Profile | null;
    agencia: Profile | null;
    destinatario: Profile | null;
  };
  contrato: any | null;
  cobranca: any | null;
  plano: Named | null;
  grade: Named | null;
  gradeVersao: Named | null;
  regra: any | null;
  comissoesIrmas: any[];
  snapshot: any | null;
  possuiSnapshotCalculo: boolean;
  possuiSnapshotGrade: boolean;
  possuiVinculosAuditoria: boolean;
}

const byId = (profiles: Profile[]) => new Map(profiles.map((profile) => [profile.id, profile]));

const safeSingle = async (builder: any) => {
  const { data, error } = await builder.maybeSingle();
  if (error) throw error;
  return data;
};

export function useComissaoDetalhesPagamento(comissaoId?: string | null) {
  return useQuery({
    queryKey: ['comissao-detalhes-pagamento', comissaoId],
    enabled: Boolean(comissaoId),
    queryFn: async (): Promise<ComissaoDetalhesPagamento> => {
      const comissao = await safeSingle(
        (supabase as any)
          .from('comissoes')
          .select('*')
          .eq('id', comissaoId)
      );

      if (!comissao) throw new Error('Comissão não encontrada');

      const [contrato, cobranca, plano, grade, gradeVersao, regra] = await Promise.all([
        comissao.contrato_id
          ? safeSingle((supabase as any).from('contratos').select('id, numero, vendedor_id, plano_id, associado_id, veiculo_id').eq('id', comissao.contrato_id))
          : Promise.resolve(null),
        comissao.cobranca_id
          ? safeSingle((supabase as any).from('cobrancas').select('id, status, valor, valor_final, valor_pago, data_pagamento, data_vencimento').eq('id', comissao.cobranca_id))
          : Promise.resolve(null),
        comissao.plano_id
          ? safeSingle((supabase as any).from('planos').select('id, nome').eq('id', comissao.plano_id))
          : Promise.resolve(null),
        comissao.grade_id
          ? safeSingle((supabase as any).from('grades_comissao').select('id, nome').eq('id', comissao.grade_id))
          : Promise.resolve(null),
        comissao.grade_versao_id
          ? safeSingle((supabase as any).from('grades_comissao_versoes').select('id, versao, snapshot').eq('id', comissao.grade_versao_id))
          : Promise.resolve(null),
        comissao.plano_regra_id
          ? safeSingle((supabase as any).from('grade_comissao_plano_regras').select('*').eq('id', comissao.plano_regra_id))
          : Promise.resolve(null),
      ]);

      const vendedorOrigemId = contrato?.vendedor_id || comissao.calculo_snapshot?.cadeia?.vendedor_id || null;

      const [{ data: comissoesIrmas = [], error: irmasError }, hierarquia] = await Promise.all([
        comissao.cobranca_id
          ? (supabase as any)
              .from('comissoes')
              .select('id, vendedor_id, role_destinatario, nivel_nome, valor_total, valor_base, percentual_aplicado, valor_comissao, tipo_calculo, status')
              .eq('cobranca_id', comissao.cobranca_id)
          : Promise.resolve({ data: [], error: null }),
        vendedorOrigemId
          ? safeSingle(
              (supabase as any)
                .from('hierarquia_vendas')
                .select('id, vendedor_id, supervisor_id, gerente_id, agencia_id')
                .eq('vendedor_id', vendedorOrigemId)
                .order('created_at', { ascending: false })
                .limit(1)
            ).catch(() => null)
          : Promise.resolve(null),
      ]);
      if (irmasError) throw irmasError;

      const snapshotCadeia = comissao.calculo_snapshot?.cadeia || {};
      const ids = Array.from(new Set([
        comissao.vendedor_id,
        vendedorOrigemId,
        snapshotCadeia.vendedor_id,
        snapshotCadeia.supervisor_id,
        snapshotCadeia.gerente_id,
        snapshotCadeia.agencia_id,
        snapshotCadeia.destinatario_id,
        hierarquia?.vendedor_id,
        hierarquia?.supervisor_id,
        hierarquia?.gerente_id,
        hierarquia?.agencia_id,
        ...(comissoesIrmas || []).map((item: any) => item.vendedor_id),
      ].filter(Boolean)));

      let profiles = new Map<string, Profile>();
      if (ids.length > 0) {
        const { data, error } = await (supabase as any)
          .from('profiles')
          .select('id, nome, full_name, email, avatar_url')
          .in('id', ids);
        if (error) throw error;
        profiles = byId(data || []);
      }

      const siblingByRole = new Map((comissoesIrmas || []).map((item: any) => [item.role_destinatario, item.vendedor_id]));
      const vendedorId = vendedorOrigemId || snapshotCadeia.vendedor_id || hierarquia?.vendedor_id || siblingByRole.get('vendedor_clt') || siblingByRole.get('vendedor_externo');
      const supervisorId = snapshotCadeia.supervisor_id || siblingByRole.get('supervisor_vendas') || hierarquia?.supervisor_id;
      const gerenteId = snapshotCadeia.gerente_id || siblingByRole.get('gerente_comercial') || hierarquia?.gerente_id;
      const agenciaId = snapshotCadeia.agencia_id || siblingByRole.get('agencia') || hierarquia?.agencia_id;

      const snapshot = comissao.calculo_snapshot || gradeVersao?.snapshot || null;

      return {
        comissao,
        destinatario: comissao.vendedor_id ? profiles.get(comissao.vendedor_id) || null : null,
        vendedorOrigem: vendedorId ? profiles.get(vendedorId) || null : null,
        cadeia: {
          vendedor: vendedorId ? profiles.get(vendedorId) || null : null,
          supervisor: supervisorId ? profiles.get(supervisorId) || null : null,
          gerente: gerenteId ? profiles.get(gerenteId) || null : null,
          agencia: agenciaId ? profiles.get(agenciaId) || null : null,
          destinatario: comissao.vendedor_id ? profiles.get(comissao.vendedor_id) || null : null,
        },
        contrato,
        cobranca,
        plano,
        grade,
        gradeVersao,
        regra,
        comissoesIrmas: comissoesIrmas || [],
        snapshot,
        possuiSnapshotCalculo: Boolean(comissao.calculo_snapshot),
        possuiSnapshotGrade: Boolean(gradeVersao?.snapshot || comissao.calculo_snapshot?.snapshot_grade),
        possuiVinculosAuditoria: Boolean(comissao.grade_id && comissao.plano_id && comissao.plano_regra_id),
      };
    },
  });
}
