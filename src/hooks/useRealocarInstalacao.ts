import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface RealocarParaRotaParams {
  instalacaoId: string;
  rotaId: string;
  instaladorId?: string | null;
  dataAgendada: string; // yyyy-MM-dd
  horaAgendada?: string | null;
  motivo: string;
  notificarWhatsApp: boolean;
}

interface RealocarParaBaseParams {
  instalacaoId: string;
  oficinaId: string;
  oficinaNome: string;
  dataAgendada: string;
  horario: string; // HH:mm
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
    queryClient.invalidateQueries({ queryKey: ['instalacoes'] });
    queryClient.invalidateQueries({ queryKey: ['instalacao'] });
    queryClient.invalidateQueries({ queryKey: ['rotas'] });
    queryClient.invalidateQueries({ queryKey: ['rota'] });
    queryClient.invalidateQueries({ queryKey: ['agendamentos-base'] });
    queryClient.invalidateQueries({ queryKey: ['mapa-vistorias'] });
  };

  const realocarParaRota = useMutation({
    mutationFn: async (params: RealocarParaRotaParams) => {
      // Buscar dados atuais para histórico + WhatsApp
      const { data: inst, error: fetchErr } = await supabase
        .from('instalacoes')
        .select('id, status, associado_id, associados(nome, telefone), veiculos(placa, marca, modelo)')
        .eq('id', params.instalacaoId)
        .single();
      if (fetchErr) throw fetchErr;

      const update: Record<string, unknown> = {
        rota_id: params.rotaId,
        data_agendada: params.dataAgendada,
        status: 'agendada',
        local_vistoria: 'cliente',
      };
      if (params.instaladorId) update.instalador_responsavel_id = params.instaladorId;
      if (params.horaAgendada) update.hora_agendada = params.horaAgendada;

      const { error: updErr } = await supabase
        .from('instalacoes')
        .update(update as any)
        .eq('id', params.instalacaoId);
      if (updErr) throw updErr;

      await registrarHistorico({
        instalacaoId: params.instalacaoId,
        associadoId: (inst as any).associado_id,
        motivo: params.motivo,
        destino: 'rota',
        statusAnterior: (inst as any).status,
        dadosNovos: {
          rota_id: params.rotaId,
          instalador_id: params.instaladorId,
          data_agendada: params.dataAgendada,
          hora_agendada: params.horaAgendada,
        },
      });

      if (params.notificarWhatsApp && (inst as any).associados?.telefone) {
        const dataFmt = format(new Date(params.dataAgendada + 'T00:00:00'), 'dd/MM/yyyy');
        const horaFmt = params.horaAgendada ? ` às ${params.horaAgendada.slice(0, 5)}` : '';
        const placa = (inst as any).veiculos?.placa || '';
        const msg = `Olá ${(inst as any).associados?.nome || ''}! Sua instalação${placa ? ` do veículo ${placa}` : ''} foi reagendada para ${dataFmt}${horaFmt}. Em breve nosso instalador entrará em contato. Equipe Pratic.`;
        await notificarAssociado((inst as any).associados.telefone, msg);
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
      const { data: inst, error: fetchErr } = await supabase
        .from('instalacoes')
        .select('id, status, associado_id, associados(nome, telefone), veiculos(placa, marca, modelo, ano_modelo)')
        .eq('id', params.instalacaoId)
        .single();
      if (fetchErr) throw fetchErr;

      const veiculo = (inst as any).veiculos;
      const veiculoDescricao = veiculo
        ? `${veiculo.marca || ''} ${veiculo.modelo || ''} ${veiculo.ano_modelo || ''}`.trim()
        : null;

      // 1) Insert agendamentos_base
      const { error: agErr } = await (supabase as any)
        .from('agendamentos_base')
        .insert({
          instalacao_id: params.instalacaoId,
          oficina_id: params.oficinaId,
          data_agendada: params.dataAgendada,
          horario: params.horario,
          cliente_nome: (inst as any).associados?.nome || 'Cliente',
          cliente_telefone: (inst as any).associados?.telefone || null,
          veiculo_placa: veiculo?.placa || null,
          veiculo_descricao: veiculoDescricao,
          status: 'confirmado',
          observacoes: `Realocada do limbo. Motivo: ${params.motivo}`,
        });
      if (agErr) throw agErr;

      // 2) Update instalações: agendada + local=base + sem rota
      const { error: updErr } = await supabase
        .from('instalacoes')
        .update({
          status: 'agendada',
          local_vistoria: 'base',
          rota_id: null,
          data_agendada: params.dataAgendada,
          hora_agendada: params.horario,
        } as any)
        .eq('id', params.instalacaoId);
      if (updErr) throw updErr;

      await registrarHistorico({
        instalacaoId: params.instalacaoId,
        associadoId: (inst as any).associado_id,
        motivo: params.motivo,
        destino: 'base',
        statusAnterior: (inst as any).status,
        dadosNovos: {
          oficina_id: params.oficinaId,
          oficina_nome: params.oficinaNome,
          data_agendada: params.dataAgendada,
          horario: params.horario,
          local_vistoria: 'base',
        },
      });

      if (params.notificarWhatsApp && (inst as any).associados?.telefone) {
        const dataFmt = format(new Date(params.dataAgendada + 'T00:00:00'), 'dd/MM/yyyy');
        const msg = `Olá ${(inst as any).associados?.nome || ''}! Sua instalação foi remarcada para ser realizada na base *${params.oficinaNome}* em ${dataFmt} às ${params.horario.slice(0, 5)}. Por favor, compareça com o veículo. Equipe Pratic.`;
        await notificarAssociado((inst as any).associados.telefone, msg);
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
