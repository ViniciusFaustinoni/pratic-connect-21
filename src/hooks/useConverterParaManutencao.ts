import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Converte um serviço de `instalacao` / `vistoria_entrada` em `vistoria_manutencao`.
 *
 * Caminho canônico do botão "Tratar como Manutenção" no Monitoramento.
 * Mantém os invariantes:
 *  - 1 serviço vivo por origem (encerra o antigo no mesmo commit)
 *  - cadastro_aprovado / instalacao_origem_id / vistoria_origem_id preservados
 *  - badge canônico `vistoria_manutencao` (indigo + Settings) já existente
 *
 * Opcionalmente já vincula o rastreador local quando o operador encontrou
 * o IMEI na busca tri-fonte (a vinculação real chama `useUpdateRastreadorStatus`
 * indiretamente via UI — aqui só registramos a intenção).
 */
export interface ConverterParaManutencaoParams {
  servicoId: string;
  imei: string;
  rastreadorId?: string | null;
  observacaoOperador?: string;
}

export function useConverterParaManutencao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ConverterParaManutencaoParams) => {
      const { servicoId, imei, rastreadorId, observacaoOperador } = params;
      const imeiLimpo = (imei || '').replace(/\D/g, '');
      if (!imeiLimpo || imeiLimpo.length < 14) {
        throw new Error('IMEI inválido. Esperado entre 14 e 16 dígitos.');
      }

      // 1) Carrega serviço atual (origem)
      const { data: orig, error: origErr } = await (supabase as any)
        .from('servicos')
        .select(`
          id, tipo, status, modalidade, origem,
          associado_id, veiculo_id, contrato_id, cotacao_id,
          instalacao_origem_id, vistoria_origem_id,
          observacoes, motivo_manutencao,
          data_agendada, periodo,
          cep, logradouro, numero, complemento, bairro, cidade, uf
        `)
        .eq('id', servicoId)
        .maybeSingle();
      if (origErr) throw origErr;
      if (!orig) throw new Error('Serviço de origem não encontrado.');
      if (!['instalacao', 'vistoria_entrada'].includes(orig.tipo)) {
        throw new Error('Apenas instalação ou vistoria de entrada podem ser convertidas em manutenção.');
      }

      const { data: userData } = await supabase.auth.getUser();
      const operadorId = userData?.user?.id ?? null;
      const operadorEmail = userData?.user?.email ?? null;
      const carimboHumano = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

      const motivo = `Manutenção via Monitoramento — IMEI ${imeiLimpo}${observacaoOperador ? ` — ${observacaoOperador}` : ''}`;

      // 2) Cria novo serviço vistoria_manutencao (mesma data/local do antigo)
      const novoServicoPayload: any = {
        tipo: 'vistoria_manutencao',
        status: 'agendada',
        origem: 'servicos_campo_manual',
        modalidade: orig.modalidade ?? null,
        associado_id: orig.associado_id,
        veiculo_id: orig.veiculo_id,
        contrato_id: orig.contrato_id,
        cotacao_id: orig.cotacao_id,
        instalacao_origem_id: orig.instalacao_origem_id,
        vistoria_origem_id: orig.vistoria_origem_id,
        data_agendada: orig.data_agendada ?? new Date().toISOString().slice(0, 10),
        periodo: orig.periodo ?? 'manha',
        cep: orig.cep,
        logradouro: orig.logradouro,
        numero: orig.numero,
        complemento: orig.complemento,
        bairro: orig.bairro,
        cidade: orig.cidade,
        uf: orig.uf,
        motivo_manutencao: motivo,
        intencao_rastreador_imei: imeiLimpo,
        intencao_rastreador_rastreador_id: rastreadorId ?? null,
        rastreador_id: rastreadorId ?? null,
        imei_rastreador: imeiLimpo,
        observacoes: `Criado pelo Monitoramento a partir do serviço ${orig.id} (${orig.tipo}). ${observacaoOperador ?? ''}`.trim(),
      };

      const { data: novo, error: novoErr } = await (supabase as any)
        .from('servicos')
        .insert(novoServicoPayload)
        .select('id')
        .single();
      if (novoErr) throw novoErr;

      // 3) Encerra serviço antigo (cancelada com motivo) — mantém regra 1 serviço vivo/origem
      const motivoFechamento = `Convertido para manutenção pelo Monitoramento em ${carimboHumano}${operadorEmail ? ` (${operadorEmail})` : ''}. Novo serviço: ${novo.id}.`;
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
        // rollback do novo serviço para evitar duplicidade
        await (supabase as any).from('servicos').delete().eq('id', novo.id);
        throw closeErr;
      }

      return { novoServicoId: novo.id, servicoOrigemId: orig.id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instalacoes-aguardando-aprovacao-monitoramento'] });
      queryClient.invalidateQueries({ queryKey: ['aprovacao-monitoramento-stats'] });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      queryClient.invalidateQueries({ queryKey: ['servico-detalhe-aprovacao'] });
      toast.success('Serviço convertido para manutenção.');
    },
    onError: (err: any) => {
      console.error('[useConverterParaManutencao] erro', err);
      toast.error(err?.message || 'Falha ao converter para manutenção.');
    },
  });
}
