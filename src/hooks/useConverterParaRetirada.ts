import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Converte um serviço (instalacao / vistoria_entrada / vistoria_manutencao)
 * em `retirada_rastreador` + cria irmão de vistoria acompanhante.
 *
 * Caminho canônico do botão "Tratar como Retirada" no Monitoramento e em
 * Serviços de Campo. Mantém os invariantes:
 *  - 1 serviço vivo por origem (encerra o antigo no mesmo commit)
 *  - cadastro_aprovado / instalacao_origem_id / vistoria_origem_id preservados
 *  - mesma data/local/agendamento do serviço de origem
 *
 * Tipo de vistoria acompanhante sinaliza intenção:
 *  - 'retirada'  → veículo SAI da base (vistoria_retirada)
 *  - 'enxuta'    → veículo PERMANECE sem rastreador (vistoria_entrada + modalidade=enxuta_pos_retirada)
 *  - 'completa'  → veículo PERMANECE sem rastreador (vistoria_entrada + modalidade=completa_pos_retirada)
 */
export type TipoVistoriaRetirada = 'retirada' | 'enxuta' | 'completa';

export interface ConverterParaRetiradaParams {
  servicoId: string;
  tipoVistoria: TipoVistoriaRetirada;
  justificativa: string;
  /** id do rastreador instalado no veículo (obrigatório para a retirada). */
  rastreadorId: string;
}

function vistoriaDaEscolha(t: TipoVistoriaRetirada) {
  if (t === 'retirada') return { tipo: 'vistoria_retirada' as const, modalidade: null as string | null };
  if (t === 'enxuta') return { tipo: 'vistoria_entrada' as const, modalidade: 'enxuta_pos_retirada' };
  return { tipo: 'vistoria_entrada' as const, modalidade: 'completa_pos_retirada' };
}

export function useConverterParaRetirada() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ConverterParaRetiradaParams) => {
      const { servicoId, tipoVistoria, justificativa, rastreadorId } = params;
      if (!justificativa || justificativa.trim().length < 10) {
        throw new Error('Justificativa obrigatória (mín. 10 caracteres).');
      }
      if (!rastreadorId) {
        throw new Error('Rastreador é obrigatório para a retirada.');
      }

      const { data: orig, error: origErr } = await (supabase as any)
        .from('servicos')
        .select(`
          id, tipo, status, modalidade, origem,
          associado_id, veiculo_id, contrato_id, cotacao_id,
          instalacao_origem_id, vistoria_origem_id,
          observacoes, data_agendada, periodo, local_vistoria, permite_encaixe,
          cep, logradouro, numero, complemento, bairro, cidade, uf, latitude, longitude
        `)
        .eq('id', servicoId)
        .maybeSingle();
      if (origErr) throw origErr;
      if (!orig) throw new Error('Serviço de origem não encontrado.');

      const { data: userData } = await supabase.auth.getUser();
      const operadorId = userData?.user?.id ?? null;
      const operadorEmail = userData?.user?.email ?? null;
      const carimboHumano = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

      const baseServico = {
        status: 'agendada' as const,
        origem: orig.origem ?? 'servicos_campo_manual',
        associado_id: orig.associado_id,
        veiculo_id: orig.veiculo_id,
        contrato_id: orig.contrato_id,
        cotacao_id: orig.cotacao_id,
        instalacao_origem_id: orig.instalacao_origem_id,
        vistoria_origem_id: orig.vistoria_origem_id,
        data_agendada: orig.data_agendada ?? new Date().toISOString().slice(0, 10),
        periodo: orig.periodo ?? 'manha',
        local_vistoria: orig.local_vistoria ?? 'cliente',
        permite_encaixe: orig.permite_encaixe ?? true,
        cep: orig.cep,
        logradouro: orig.logradouro,
        numero: orig.numero,
        complemento: orig.complemento,
        bairro: orig.bairro,
        cidade: orig.cidade,
        uf: orig.uf,
        latitude: orig.latitude,
        longitude: orig.longitude,
      };

      // 1) Serviço de retirada
      const { data: novoRetirada, error: retErr } = await (supabase as any)
        .from('servicos')
        .insert({
          ...baseServico,
          tipo: 'retirada_rastreador',
          rastreador_id: rastreadorId,
          observacoes: `[monitoramento_retirada] ${justificativa}`.trim(),
        })
        .select('id')
        .single();
      if (retErr) throw retErr;

      // 2) Serviço de vistoria acompanhante
      const v = vistoriaDaEscolha(tipoVistoria);
      const { data: novoVistoria, error: visErr } = await (supabase as any)
        .from('servicos')
        .insert({
          ...baseServico,
          tipo: v.tipo,
          modalidade: v.modalidade,
          observacoes: `[monitoramento_retirada] Vistoria acompanhante (${tipoVistoria}). ${justificativa}`.trim(),
        })
        .select('id')
        .single();
      if (visErr) {
        await (supabase as any).from('servicos').delete().eq('id', novoRetirada.id);
        throw visErr;
      }

      // 3) Encerra serviço de origem (1 vivo por origem)
      const motivoFechamento = `Convertido para Retirada + Vistoria (${tipoVistoria}) pelo Monitoramento em ${carimboHumano}${operadorEmail ? ` (${operadorEmail})` : ''}. Novos serviços: ${novoRetirada.id} + ${novoVistoria.id}.`;
      const { error: closeErr } = await (supabase as any)
        .from('servicos')
        .update({
          status: 'cancelada',
          motivo_reprovacao: motivoFechamento,
          observacoes: [orig.observacoes, motivoFechamento].filter(Boolean).join('\n\n'),
          analisado_por: operadorId,
          analisado_em: new Date().toISOString(),
        })
        .eq('id', orig.id);
      if (closeErr) {
        await (supabase as any).from('servicos').delete().eq('id', novoRetirada.id);
        await (supabase as any).from('servicos').delete().eq('id', novoVistoria.id);
        throw closeErr;
      }

      return {
        servicoRetiradaId: novoRetirada.id,
        servicoVistoriaId: novoVistoria.id,
        servicoOrigemId: orig.id,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instalacoes-aguardando-aprovacao-monitoramento'] });
      queryClient.invalidateQueries({ queryKey: ['aprovacao-monitoramento-stats'] });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      queryClient.invalidateQueries({ queryKey: ['servico-detalhe-aprovacao'] });
      toast.success('Serviço convertido em Retirada + Vistoria.');
    },
    onError: (err: any) => {
      console.error('[useConverterParaRetirada] erro', err);
      toast.error(err?.message || 'Falha ao converter para retirada.');
    },
  });
}
