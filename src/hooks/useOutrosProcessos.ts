import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Visão unificada para o consultor acompanhar processos que NÃO são cotação nova:
 *  - troca_titularidade
 *  - substituicao_placa
 *  - inclusao_veiculo
 *  - migracao
 *
 * Lê de `cotacoes` (filtrando por `dados_extras->>tipo_entrada`) e une com
 * `solicitacoes_troca_titularidade` para enriquecer status do termo e novo titular.
 */

export type TipoOutroProcesso =
  | 'troca_titularidade'
  | 'substituicao_placa'
  | 'inclusao_veiculo'
  | 'migracao';

export const TIPOS_OUTROS_PROCESSOS: TipoOutroProcesso[] = [
  'troca_titularidade',
  'substituicao_placa',
  'inclusao_veiculo',
  'migracao',
];

export interface OutroProcessoItem {
  id: string;                          // id da cotação (chave primária da linha)
  tipo: TipoOutroProcesso;
  cotacao_id: string;
  cotacao_numero: string | null;
  cotacao_token: string | null;
  cotacao_status: string;
  created_at: string;
  updated_at: string;
  vendedor_id: string | null;
  vendedor_nome: string | null;

  titular_origem_nome: string | null;
  titular_origem_cpf: string | null;
  titular_destino_nome: string | null;
  titular_destino_cpf: string | null;

  veiculo_placa: string | null;
  veiculo_marca: string | null;
  veiculo_modelo: string | null;
  veiculo_ano: number | null;

  // Específicos de troca
  solicitacao_troca_id: string | null;
  troca_status: string | null;            // STATUS_TROCA
  termo_status: 'nao_aplicavel' | 'pendente' | 'enviado' | 'assinado' | 'recusado';
  termo_filiacao_status: 'nao_aplicavel' | 'pendente' | 'enviado' | 'assinado';
  termo_url: string | null;
  termo_enviado_em: string | null;
  termo_assinado_em: string | null;
  termo_whatsapp_status: 'enviado' | 'falhou' | 'sem_telefone' | null;
  termo_reenvios_count: number;
  termo_ultimo_reenvio_em: string | null;
  associado_antigo_email: string | null;
  associado_antigo_telefone: string | null;
  // Datas das etapas (timeline)
  aprovado_cadastro_em: string | null;
  aprovado_monitoramento_em: string | null;
  efetivada_em: string | null;
  reprovado_em: string | null;
  motivo_reprovacao: string | null;
  // Pendência financeira (relacionamento_debitos_pendentes)
  pendencia_qtd: number;
  pendencia_total: number;

  etapa_label: string;
  etapa_tone: 'info' | 'warn' | 'ok' | 'danger';

  // Edição da cotação (consultor)
  pode_editar: boolean;            // troca: true até o contrato ser gerado/enviado ao novo titular
}

interface UseOutrosProcessosOptions {
  vendedorId?: string;
  viewScope?: 'own' | 'team' | 'all';
  tipos?: TipoOutroProcesso[];
  searchTerm?: string;
  consultorId?: string | null;
}

const TROCA_STATUS_LABELS: Record<string, { label: string; tone: 'info' | 'warn' | 'ok' | 'danger' }> = {
  cotacao_em_andamento: { label: 'Termo pendente', tone: 'warn' },
  aguardando_cadastro: { label: 'Aguardando cadastro', tone: 'info' },
  aguardando_monitoramento: { label: 'Aguardando monitoramento', tone: 'info' },
  aguardando_vistoria: { label: 'Aguardando vistoria', tone: 'info' },
  liberada_para_assinatura: { label: 'Liberada p/ assinatura', tone: 'ok' },
  efetivada: { label: 'Efetivada', tone: 'ok' },
  reprovada_cadastro: { label: 'Reprovada (cadastro)', tone: 'danger' },
  reprovada_monitoramento: { label: 'Reprovada (monitoramento)', tone: 'danger' },
  cancelada: { label: 'Cancelada', tone: 'danger' },
};

const COTACAO_STATUS_LABELS: Record<string, { label: string; tone: 'info' | 'warn' | 'ok' | 'danger' }> = {
  rascunho: { label: 'Rascunho', tone: 'warn' },
  enviada: { label: 'Enviada ao cliente', tone: 'info' },
  aceita: { label: 'Aceita', tone: 'ok' },
  recusada: { label: 'Recusada', tone: 'danger' },
  expirada: { label: 'Expirada', tone: 'danger' },
};

function deriveEtapa(
  tipo: TipoOutroProcesso,
  cotacaoStatus: string,
  trocaStatus: string | null,
): { label: string; tone: 'info' | 'warn' | 'ok' | 'danger' } {
  if (tipo === 'troca_titularidade' && trocaStatus) {
    return TROCA_STATUS_LABELS[trocaStatus] ?? { label: trocaStatus, tone: 'info' };
  }
  return COTACAO_STATUS_LABELS[cotacaoStatus] ?? { label: cotacaoStatus, tone: 'info' };
}

function deriveTermoStatus(troca: any | null): OutroProcessoItem['termo_status'] {
  if (!troca) return 'nao_aplicavel';
  if (troca.termo_cancelamento_assinado_em) return 'assinado';
  if (troca.status === 'reprovada_cadastro' || troca.status === 'reprovada_monitoramento' || troca.status === 'cancelada') {
    return 'recusado';
  }
  if (troca.termo_cancelamento_enviado_em) return 'enviado';
  return 'pendente';
}

export function useOutrosProcessos(options?: UseOutrosProcessosOptions) {
  const search = (options?.searchTerm || '').trim();
  const effectiveScope: 'own' | 'team' | 'all' =
    options?.viewScope === 'all' || options?.viewScope === 'team' ? options.viewScope : 'own';
  const effectiveVendedorId = effectiveScope === 'own' ? options?.vendedorId : undefined;
  const consultorId = effectiveScope !== 'own' ? (options?.consultorId || null) : null;
  const tipos = options?.tipos && options.tipos.length > 0 ? options.tipos : TIPOS_OUTROS_PROCESSOS;

  return useQuery({
    queryKey: [
      'outros-processos',
      effectiveScope,
      effectiveVendedorId,
      consultorId,
      tipos.join(','),
      search,
    ],
    queryFn: async (): Promise<OutroProcessoItem[]> => {
      // 1) Cotações com tipo_entrada nos tipos requisitados
      let q = supabase
        .from('cotacoes')
        .select(`
          id, numero, status, created_at, updated_at,
          vendedor_id, token_publico,
          nome_solicitante, cliente_cpf,
          veiculo_placa, veiculo_marca, veiculo_modelo, veiculo_ano,
          tipo_entrada, dados_extras
        `)
        .in('tipo_entrada', tipos as any)
        .order('created_at', { ascending: false })
        .limit(500);

      if (effectiveScope === 'own' && effectiveVendedorId) {
        q = q.eq('vendedor_id', effectiveVendedorId);
      } else if (consultorId) {
        q = q.eq('vendedor_id', consultorId);
      }

      if (search) {
        const safe = search.replace(/[,()]/g, '');
        const like = `%${safe}%`;
        q = q.or([
          `numero.ilike.${like}`,
          `veiculo_placa.ilike.${like}`,
          `veiculo_marca.ilike.${like}`,
          `veiculo_modelo.ilike.${like}`,
          `nome_solicitante.ilike.${like}`,
          `cliente_cpf.ilike.${like}`,
        ].join(','));
      }

      const { data: cotacoes, error } = await q;
      if (error) throw error;
      const cotList = (cotacoes || []) as any[];
      if (cotList.length === 0) return [];

      // 2) Trocas vinculadas
      const cotacaoIds = cotList.map((c) => c.id);
      const { data: trocas } = await (supabase as any)
        .from('solicitacoes_troca_titularidade')
        .select('id, cotacao_id, status, termo_cancelamento_url, termo_cancelamento_enviado_em, termo_cancelamento_assinado_em, termo_whatsapp_status, termo_reenvios_count, termo_ultimo_reenvio_em, novo_titular_dados, associado_antigo_id, aprovado_cadastro_em, aprovado_monitoramento_em, efetivada_em, reprovado_em, motivo_reprovacao')
        .in('cotacao_id', cotacaoIds);
      const trocasMap = new Map<string, any>();
      (trocas || []).forEach((t: any) => trocasMap.set(t.cotacao_id, t));

      // 2b) Nome/contato do titular antigo via associados
      const associadoAntigoIds = Array.from(
        new Set((trocas || []).map((t: any) => t.associado_antigo_id).filter(Boolean)),
      );
      const associadosMap = new Map<string, any>();
      if (associadoAntigoIds.length > 0) {
        const { data: assocs } = await supabase
          .from('associados')
          .select('id, nome, cpf, email, telefone')
          .in('id', associadoAntigoIds as string[]);
        (assocs || []).forEach((a: any) => associadosMap.set(a.id, a));
      }

      // 3) Pendências financeiras (relacionamento_debitos_pendentes)
      const trocaIds = (trocas || []).map((t: any) => t.id);
      const debitosPorTroca = new Map<string, { qtd: number; total: number }>();
      if (trocaIds.length > 0) {
        const { data: debitos } = await (supabase as any)
          .from('relacionamento_debitos_pendentes')
          .select('id, status, valor_total, solicitacao_troca_id')
          .in('solicitacao_troca_id', trocaIds)
          .eq('status', 'aberto');
        (debitos || []).forEach((d: any) => {
          const cur = debitosPorTroca.get(d.solicitacao_troca_id) || { qtd: 0, total: 0 };
          cur.qtd += 1;
          cur.total += Number(d.valor_total || 0);
          debitosPorTroca.set(d.solicitacao_troca_id, cur);
        });
      }

      // 3b) Contratos vinculados às solicitações de troca (gating de edição)
      const contratoPorTroca = new Map<string, any>();
      if (trocaIds.length > 0) {
        const { data: contratos } = await (supabase as any)
          .from('contratos')
          .select('id, status, assinatura_url, origem_troca_titularidade_id')
          .in('origem_troca_titularidade_id', trocaIds);
        (contratos || []).forEach((ct: any) => {
          // Mantém o contrato "mais avançado" caso haja múltiplos
          const cur = contratoPorTroca.get(ct.origem_troca_titularidade_id);
          if (!cur || ct.assinatura_url || ct.status !== 'rascunho') {
            contratoPorTroca.set(ct.origem_troca_titularidade_id, ct);
          }
        });
      }

      // 4) Vendedores
      const vendedorIds = Array.from(
        new Set(cotList.map((c) => c.vendedor_id).filter(Boolean)),
      );
      const vendedoresMap = new Map<string, any>();
      if (vendedorIds.length > 0) {
        const { data: vs } = await supabase
          .from('profiles')
          .select('user_id, nome, full_name')
          .in('user_id', vendedorIds);
        (vs || []).forEach((v: any) => vendedoresMap.set(v.user_id, v));
      }

      // 5) Compor
      return cotList.map<OutroProcessoItem>((c) => {
        const tipo = c.tipo_entrada as TipoOutroProcesso;
        const troca = trocasMap.get(c.id) || null;
        const associadoAntigo = troca ? associadosMap.get(troca.associado_antigo_id) : null;
        const novoTitular = troca?.novo_titular_dados || null;
        const v = c.vendedor_id ? vendedoresMap.get(c.vendedor_id) : null;
        const debito = troca ? debitosPorTroca.get(troca.id) || { qtd: 0, total: 0 } : { qtd: 0, total: 0 };

        // Origem / destino dependem do tipo
        let origemNome: string | null = null;
        let origemCpf: string | null = null;
        let destinoNome: string | null = null;
        let destinoCpf: string | null = null;

        if (tipo === 'troca_titularidade') {
          origemNome = associadoAntigo?.nome ?? null;
          origemCpf = associadoAntigo?.cpf ?? null;
          destinoNome = novoTitular?.nome ?? c.nome_solicitante ?? null;
          destinoCpf = novoTitular?.cpf ?? c.cliente_cpf ?? null;
        } else {
          // substituição/inclusão/migração: titular é o solicitante da cotação
          origemNome = c.nome_solicitante ?? null;
          origemCpf = c.cliente_cpf ?? null;
        }

        const etapa = deriveEtapa(tipo, c.status, troca?.status ?? null);

        return {
          id: c.id,
          tipo,
          cotacao_id: c.id,
          cotacao_numero: c.numero ?? null,
          cotacao_token: c.token_publico ?? null,
          cotacao_status: c.status,
          created_at: c.created_at,
          updated_at: c.updated_at,
          vendedor_id: c.vendedor_id ?? null,
          vendedor_nome: v?.full_name || v?.nome || null,
          titular_origem_nome: origemNome,
          titular_origem_cpf: origemCpf,
          titular_destino_nome: destinoNome,
          titular_destino_cpf: destinoCpf,
          veiculo_placa: c.veiculo_placa ?? null,
          veiculo_marca: c.veiculo_marca ?? null,
          veiculo_modelo: c.veiculo_modelo ?? null,
          veiculo_ano: c.veiculo_ano ?? null,
          solicitacao_troca_id: troca?.id ?? null,
          troca_status: troca?.status ?? null,
          termo_status: deriveTermoStatus(troca),
          termo_url: troca?.termo_cancelamento_url ?? null,
          termo_enviado_em: troca?.termo_cancelamento_enviado_em ?? null,
          termo_assinado_em: troca?.termo_cancelamento_assinado_em ?? null,
          termo_whatsapp_status: troca?.termo_whatsapp_status ?? null,
          termo_reenvios_count: troca?.termo_reenvios_count ?? 0,
          termo_ultimo_reenvio_em: troca?.termo_ultimo_reenvio_em ?? null,
          associado_antigo_email: associadoAntigo?.email ?? null,
          associado_antigo_telefone: associadoAntigo?.telefone ?? null,
          aprovado_cadastro_em: troca?.aprovado_cadastro_em ?? null,
          aprovado_monitoramento_em: troca?.aprovado_monitoramento_em ?? null,
          efetivada_em: troca?.efetivada_em ?? null,
          reprovado_em: troca?.reprovado_em ?? null,
          motivo_reprovacao: troca?.motivo_reprovacao ?? null,
          pendencia_qtd: debito.qtd,
          pendencia_total: debito.total,
          etapa_label: etapa.label,
          etapa_tone: etapa.tone,
          pode_editar: (() => {
            if (tipo !== 'troca_titularidade' || !troca) return false;
            // Bloqueia se solicitação já está em status terminal
            if (['efetivada','reprovada_cadastro','reprovada_monitoramento','cancelada'].includes(troca.status)) return false;
            // Bloqueia se contrato (termo de filiação) já foi gerado/enviado ao novo titular
            const ct = contratoPorTroca.get(troca.id);
            if (ct && (ct.assinatura_url || (ct.status && ct.status !== 'rascunho' && ct.status !== 'cancelado'))) return false;
            return true;
          })(),
        };
      });
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

export const TIPO_LABELS: Record<TipoOutroProcesso, { label: string; chip: string }> = {
  troca_titularidade: { label: 'Troca de Titularidade', chip: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  substituicao_placa: { label: 'Substituição de Placa', chip: 'bg-blue-500/15 text-blue-700 dark:text-blue-300' },
  inclusao_veiculo: { label: 'Inclusão de Veículo', chip: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  migracao: { label: 'Migração', chip: 'bg-violet-500/15 text-violet-700 dark:text-violet-300' },
};

export const TONE_CLASS: Record<string, string> = {
  info: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  warn: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  ok: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  danger: 'bg-red-500/15 text-red-700 dark:text-red-300',
};
