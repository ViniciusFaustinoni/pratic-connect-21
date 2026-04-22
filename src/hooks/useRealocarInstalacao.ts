import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { PERIODO_LABEL } from '@/lib/periodo-utils';

interface RealocarParaRotaParams {
  instalacaoId: string;
  rotaId: string;
  instaladorId?: string | null;
  dataAgendada: string; // yyyy-MM-dd
  periodo: 'manha' | 'tarde';
  motivo: string;
  notificarWhatsApp: boolean;
}

interface RealocarParaBaseParams {
  instalacaoId: string;
  oficinaId: string;
  oficinaNome: string;
  dataAgendada: string;
  periodo: 'manha' | 'tarde';
  motivo: string;
  notificarWhatsApp: boolean;
}

async function registrarHistorico(opts: {
  instalacaoId: string;
  associadoId: string;
  motivo: string;
  destino: 'rota' | 'base';
  dadosNovos: Record<string, unknown>;
  statusAnterior?: string | null;
}) {
  const { data: userData } = await supabase.auth.getUser();
  await (supabase as any).from('associados_historico').insert({
    associado_id: opts.associadoId,
    instalacao_id: opts.instalacaoId,
    tipo: 'instalacao',
    acao: 'realocada',
    descricao: `Instalação realocada para ${opts.destino === 'rota' ? 'nova rota' : 'base'}. Motivo: ${opts.motivo}`,
    motivo: opts.motivo,
    status_anterior: opts.statusAnterior ?? null,
    status_novo: 'agendada',
    dados_novos: opts.dadosNovos as any,
    usuario_id: userData?.user?.id ?? null,
    executado_por: userData?.user?.id ?? null,
  });
}

async function notificarAssociado(telefone: string | null | undefined, mensagem: string) {
  if (!telefone) return;
  try {
    await supabase.functions.invoke('whatsapp-send-text', {
      body: { telefone, mensagem },
    });
  } catch (e) {
    console.warn('Falha ao enviar WhatsApp de realocação:', e);
  }
}

export function useRealocarInstalacao() {
  const queryClient = useQueryClient();

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['servicos'] });
    queryClient.invalidateQueries({ queryKey: ['instalacoes'] });
    queryClient.invalidateQueries({ queryKey: ['instalacao'] });
    queryClient.invalidateQueries({ queryKey: ['rotas'] });
    queryClient.invalidateQueries({ queryKey: ['rota'] });
    queryClient.invalidateQueries({ queryKey: ['agendamentos-base'] });
    queryClient.invalidateQueries({ queryKey: ['mapa-vistorias'] });
    queryClient.invalidateQueries({ queryKey: ['equipe'] });
  };

  const realocarParaRota = useMutation({
    mutationFn: async (params: RealocarParaRotaParams) => {
      // Fase 3: fonte única é `servicos` (tipo = vistoria_instalacao)
      const { data: serv, error: fetchErr } = await supabase
        .from('servicos')
        .select(`
          id, status, associado_id,
          associados:associados!servicos_associado_id_fkey(nome, telefone),
          veiculos:veiculos!servicos_veiculo_id_fkey(placa, marca, modelo)
        `)
        .eq('id', params.instalacaoId)
        .eq('tipo', 'vistoria_instalacao' as any)
        .single();
      if (fetchErr) throw fetchErr;

      const update: Record<string, unknown> = {
        rota_id: params.rotaId,
        data_agendada: params.dataAgendada,
        status: 'agendada',
        local_vistoria: 'cliente',
        periodo: params.periodo,
        hora_agendada: null,
      };
      if (params.instaladorId) update.profissional_id = params.instaladorId;

      const { error: updErr } = await supabase
        .from('servicos')
        .update(update as any)
        .eq('id', params.instalacaoId);
      if (updErr) throw updErr;

      await registrarHistorico({
        instalacaoId: params.instalacaoId,
        associadoId: (serv as any).associado_id,
        motivo: params.motivo,
        destino: 'rota',
        statusAnterior: (serv as any).status,
        dadosNovos: {
          rota_id: params.rotaId,
          profissional_id: params.instaladorId,
          data_agendada: params.dataAgendada,
          periodo: params.periodo,
        },
      });

      if (params.notificarWhatsApp && (serv as any).associados?.telefone) {
        const dataFmt = format(new Date(params.dataAgendada + 'T00:00:00'), 'dd/MM/yyyy');
        const placa = (serv as any).veiculos?.placa || '';
        const msg = `Olá ${(serv as any).associados?.nome || ''}! Sua instalação${placa ? ` do veículo ${placa}` : ''} foi reagendada para ${dataFmt} — ${PERIODO_LABEL[params.periodo]}. Em breve nosso instalador entrará em contato. Equipe Pratic.`;
        await notificarAssociado((serv as any).associados.telefone, msg);
      }
    },
    onSuccess: () => {
      invalidar();
      toast.success('Instalação realocada para a rota!');
    },
    onError: (e: Error) => toast.error(`Erro ao realocar: ${e.message}`),
  });

  const realocarParaBase = useMutation({
    mutationFn: async (params: RealocarParaBaseParams) => {
      // Fase 3: fonte única é `servicos` (tipo = vistoria_instalacao)
      const { data: serv, error: fetchErr } = await supabase
        .from('servicos')
        .select(`
          id, status, associado_id,
          associados:associados!servicos_associado_id_fkey(nome, telefone),
          veiculos:veiculos!servicos_veiculo_id_fkey(placa, marca, modelo, ano_modelo)
        `)
        .eq('id', params.instalacaoId)
        .eq('tipo', 'vistoria_instalacao' as any)
        .single();
      if (fetchErr) throw fetchErr;

      const veiculo = (serv as any).veiculos;
      const veiculoDescricao = veiculo
        ? `${veiculo.marca || ''} ${veiculo.modelo || ''} ${veiculo.ano_modelo || ''}`.trim()
        : null;

      // 1) Insert agendamentos_base com horario = canônico do período
      const { error: agErr } = await (supabase as any)
        .from('agendamentos_base')
        .insert({
          instalacao_id: params.instalacaoId,
          oficina_id: params.oficinaId,
          data_agendada: params.dataAgendada,
          horario: params.periodo,
          cliente_nome: (serv as any).associados?.nome || 'Cliente',
          cliente_telefone: (serv as any).associados?.telefone || null,
          veiculo_placa: veiculo?.placa || null,
          veiculo_descricao: veiculoDescricao,
          status: 'confirmado',
          observacoes: `Realocada do limbo. Motivo: ${params.motivo}`,
        });
      if (agErr) throw agErr;

      // 2) Update servicos
      const { error: updErr } = await supabase
        .from('servicos')
        .update({
          status: 'agendada',
          local_vistoria: 'base',
          rota_id: null,
          data_agendada: params.dataAgendada,
          periodo: params.periodo,
          hora_agendada: null,
        } as any)
        .eq('id', params.instalacaoId);
      if (updErr) throw updErr;

      await registrarHistorico({
        instalacaoId: params.instalacaoId,
        associadoId: (serv as any).associado_id,
        motivo: params.motivo,
        destino: 'base',
        statusAnterior: (serv as any).status,
        dadosNovos: {
          oficina_id: params.oficinaId,
          oficina_nome: params.oficinaNome,
          data_agendada: params.dataAgendada,
          periodo: params.periodo,
          local_vistoria: 'base',
        },
      });

      if (params.notificarWhatsApp && (serv as any).associados?.telefone) {
        const dataFmt = format(new Date(params.dataAgendada + 'T00:00:00'), 'dd/MM/yyyy');
        const msg = `Olá ${(serv as any).associados?.nome || ''}! Sua instalação foi remarcada para ser realizada na base *${params.oficinaNome}* em ${dataFmt} — ${PERIODO_LABEL[params.periodo]}. Por favor, compareça com o veículo. Equipe Pratic.`;
        await notificarAssociado((serv as any).associados.telefone, msg);
      }
    },
    onSuccess: () => {
      invalidar();
      toast.success('Instalação realocada para a base!');
    },
    onError: (e: Error) => toast.error(`Erro ao realocar: ${e.message}`),
  });

  return { realocarParaRota, realocarParaBase };
}
