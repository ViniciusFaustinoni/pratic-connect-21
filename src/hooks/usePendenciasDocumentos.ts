import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { TIPO_DOCUMENTO_LABELS } from '@/hooks/useDocumentosSolicitados';

const APP_BASE_URL = 'https://app.praticcar.org';

export interface PendenciaPropostaAgrupada {
  contratoId: string;
  associadoId: string;
  associadoNome: string;
  associadoTelefone: string | null;
  numeroContrato: string | null;
  placa: string | null;
  linkPublico: string | null;
  vendedorId: string | null;
  pendencias: Array<{ id: string; tipo: string; label: string; descricao: string | null }>;
}

interface RawRow {
  id: string;
  tipo_documento: string;
  descricao: string | null;
  associado_id: string;
  contrato_id: string | null;
  associados: { nome: string | null; telefone: string | null } | null;
  contratos: {
    id: string;
    numero: string | null;
    veiculo_placa: string | null;
    vendedor_id: string | null;
    link_token: string | null;
    cotacao_token_publico: string | null;
  } | null;
}

function buildLink(token: string | null, cotacaoToken: string | null): string | null {
  if (token) return `${APP_BASE_URL}/acompanhar/${token}`;
  if (cotacaoToken) return `${APP_BASE_URL}/cotacao/${cotacaoToken}`;
  return null;
}

function labelTipo(tipo: string, descricao: string | null): string {
  if (descricao) return descricao;
  return TIPO_DOCUMENTO_LABELS[tipo] || tipo;
}

export function usePendenciasDocumentos() {
  const { profile } = useAuth();
  const perms = usePermissions();
  const queryClient = useQueryClient();

  // Quem vê tudo: gestores comerciais, diretor, super admins, analista cadastro
  const veTudo = Boolean(
    perms.isDiretor ||
      perms.isAdminMaster ||
      perms.isDesenvolvedor ||
      perms.isGerente ||
      perms.isSupervisor ||
      perms.isAnalistaCadastro,
  );

  // Vendedor (consultor) vê só as próprias
  const ehVendedor = Boolean(perms.isVendedorClt || perms.isVendedorExterno);
  const podeVer = veTudo || ehVendedor;

  const enabled = Boolean(profile?.id) && podeVer;

  const query = useQuery({
    queryKey: ['pendencias-documentos', profile?.id, veTudo],
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<PendenciaPropostaAgrupada[]> => {
      let q = supabase
        .from('documentos_solicitados')
        .select(
          `id, tipo_documento, descricao, associado_id, contrato_id,
           associados:associado_id ( nome, telefone ),
           contratos:contrato_id ( id, numero, veiculo_placa, vendedor_id, link_token, cotacao_token_publico )`,
        )
        .eq('status', 'pendente')
        .limit(500);

      const { data, error } = await q;
      if (error) throw error;

      const rows = (data || []) as unknown as RawRow[];

      // Filtra por vendedor quando não é gestor/cadastro
      const filtered = veTudo
        ? rows
        : rows.filter((r) => r.contratos?.vendedor_id && r.contratos.vendedor_id === profile?.id);

      // Agrupa por contrato (proposta)
      const map = new Map<string, PendenciaPropostaAgrupada>();
      for (const r of filtered) {
        const chave = r.contrato_id || r.associado_id;
        if (!chave) continue;
        const existente = map.get(chave);
        const item = {
          id: r.id,
          tipo: r.tipo_documento,
          label: labelTipo(r.tipo_documento, r.descricao),
          descricao: r.descricao,
        };
        if (existente) {
          existente.pendencias.push(item);
        } else {
          map.set(chave, {
            contratoId: r.contrato_id || '',
            associadoId: r.associado_id,
            associadoNome: r.associados?.nome || 'Associado',
            associadoTelefone: r.associados?.telefone || null,
            numeroContrato: r.contratos?.numero || null,
            placa: r.contratos?.veiculo_placa || null,
            linkPublico: buildLink(r.contratos?.link_token || null, r.contratos?.cotacao_token_publico || null),
            vendedorId: r.contratos?.vendedor_id || null,
            pendencias: [item],
          });
        }
      }

      return Array.from(map.values()).sort((a, b) =>
        (a.associadoNome || '').localeCompare(b.associadoNome || ''),
      );
    },
  });

  // Realtime: invalida ao inserir/atualizar/deletar pendências
  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel('pendencias-documentos-rt')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'documentos_solicitados' },
        () => queryClient.invalidateQueries({ queryKey: ['pendencias-documentos'] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);

  const total = useMemo(() => query.data?.length ?? 0, [query.data]);

  return { ...query, total, podeVer };
}
