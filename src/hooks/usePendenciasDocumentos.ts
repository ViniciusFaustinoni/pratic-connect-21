import { useEffect, useMemo, useRef } from 'react';
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
  aguardandoDesde: string;
  horasParado: number;
  pendencias: Array<{ id: string; tipo: string; label: string; descricao: string | null; createdAt: string }>;
}

interface RawRow {
  id: string;
  tipo_documento: string;
  descricao: string | null;
  created_at: string;
  associado_id: string;
  contrato_id: string | null;
  associados: { nome: string | null; telefone: string | null } | null;
  contratos: {
    id: string;
    numero: string | null;
    status: string | null;
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
    refetchInterval: enabled ? 60_000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<PendenciaPropostaAgrupada[]> => {
      let q = supabase
        .from('documentos_solicitados')
        .select(
          `id, tipo_documento, descricao, created_at, associado_id, contrato_id,
           associados:associado_id ( nome, telefone ),
           contratos:contrato_id ( id, numero, status, veiculo_placa, vendedor_id, link_token, cotacao_token_publico )`,
        )
        .eq('status', 'pendente')
        .limit(500);

      const { data, error } = await q;
      if (error) throw error;

      const rows = (data || []) as unknown as RawRow[];

      // Descarta pendências de contratos cancelados (veículo/processo encerrado).
      const semCancelados = rows.filter(
        (r) => !r.contratos || String(r.contratos.status || '').toLowerCase() !== 'cancelado',
      );

      // Filtra por vendedor quando não é gestor/cadastro
      const filtered = veTudo
        ? semCancelados
        : semCancelados.filter((r) => r.contratos?.vendedor_id && r.contratos.vendedor_id === profile?.id);

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
          createdAt: r.created_at,
        };
        if (existente) {
          existente.pendencias.push(item);
          if (new Date(r.created_at).getTime() < new Date(existente.aguardandoDesde).getTime()) {
            existente.aguardandoDesde = r.created_at;
          }
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
            aguardandoDesde: r.created_at,
            horasParado: 0,
            pendencias: [item],
          });
        }
      }

      const agora = Date.now();
      const lista = Array.from(map.values()).map((item) => ({
        ...item,
        horasParado: Math.max(0, (agora - new Date(item.aguardandoDesde).getTime()) / 3_600_000),
      }));

      // Mais antigos primeiro — o que está parado há mais tempo vira prioridade.
      return lista.sort(
        (a, b) => new Date(a.aguardandoDesde).getTime() - new Date(b.aguardandoDesde).getTime(),
      );
    },
  });

  // Sufixo único e estável por mount para evitar colisão de canal (HMR/StrictMode/múltiplas abas)
  const channelSuffixRef = useRef<string>(Math.random().toString(36).slice(2, 10));

  // Realtime: invalida ao inserir/atualizar/deletar pendências
  useEffect(() => {
    if (!enabled) return;
    const channelName = `pendencias-documentos-rt-${profile?.id ?? 'anon'}-${channelSuffixRef.current}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'documentos_solicitados' },
        (payload) => {
          console.log('[pendencias-documentos-rt] event', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['pendencias-documentos'] });
        },
      )
      .subscribe((status) => {
        console.log('[pendencias-documentos-rt]', status, channelName);
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, profile?.id, queryClient]);

  const total = useMemo(() => query.data?.length ?? 0, [query.data]);

  return { ...query, total, podeVer };
}
