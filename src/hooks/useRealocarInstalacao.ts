// =============================================================================
// useRealocarInstalacao — hook ÚNICO de realocação de serviços.
//
// Tudo passa pela RPC `realocar_servico` (server-side, atômica, com auditoria).
// Suporta 4 destinos:
//   - 'fila'         → devolver à fila de atribuição manual (sem profissional)
//   - 'profissional' → reatribuir direto a outro técnico
//   - 'rota'         → mover para uma rota existente (instalador opcional)
//   - 'base'         → realocar para uma oficina/base (cria agendamentos_base)
//
// O WhatsApp ao associado é opcional e é disparado pelo client com os dados
// retornados pela RPC.
// =============================================================================
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { PERIODO_LABEL } from '@/lib/periodo-utils';

export type DestinoRealocacao = 'fila' | 'profissional' | 'rota' | 'base';
export type CategoriaRealocacao =
  | 'nao_compareceu'
  | 'tecnico_indisponivel'
  | 'reagendamento_operacional'
  | 'outro';

export interface RealocarParaFilaParams {
  instalacaoId: string;       // = servico_id (mantém nome legado)
  dataAgendada: string;       // yyyy-MM-dd
  periodo: 'manha' | 'tarde';
  motivo: string;
  categoria?: CategoriaRealocacao;
  notificarWhatsApp?: boolean;
}

export interface RealocarParaProfissionalParams extends RealocarParaFilaParams {
  profissionalId: string;
}

export interface RealocarParaRotaParams {
  instalacaoId: string;
  rotaId: string | null;       // null → cai em 'fila'
  instaladorId?: string | null;
  dataAgendada: string;
  periodo: 'manha' | 'tarde';
  motivo: string;
  categoria?: CategoriaRealocacao;
  notificarWhatsApp?: boolean;
}

export interface RealocarParaBaseParams {
  instalacaoId: string;
  oficinaId: string;
  oficinaNome?: string;        // só para mensagem WhatsApp; RPC busca pelo id
  dataAgendada: string;
  periodo: 'manha' | 'tarde';
  motivo: string;
  categoria?: CategoriaRealocacao;
  notificarWhatsApp?: boolean;
}

interface RpcResult {
  ok: boolean;
  servico_id: string;
  destino: DestinoRealocacao;
  nova_data: string;
  novo_periodo: 'manha' | 'tarde';
  associado_nome: string | null;
  associado_telefone: string | null;
  veiculo_placa: string | null;
  oficina_nome: string | null;
}

async function chamarRPC(args: {
  servicoId: string;
  destino: DestinoRealocacao;
  motivo: string;
  categoria: CategoriaRealocacao;
  dataAgendada: string;
  periodo: 'manha' | 'tarde';
  profissionalId?: string | null;
  rotaId?: string | null;
  oficinaId?: string | null;
}): Promise<RpcResult> {
  const { data, error } = await supabase.rpc('realocar_servico' as any, {
    _servico_id: args.servicoId,
    _motivo: args.motivo,
    _destino: args.destino,
    _categoria: args.categoria,
    _nova_data: args.dataAgendada,
    _novo_periodo: args.periodo,
    _profissional_id: args.profissionalId ?? null,
    _rota_id: args.rotaId ?? null,
    _oficina_id: args.oficinaId ?? null,
  });
  if (error) throw error;
  return data as unknown as RpcResult;
}

async function notificarAssociado(telefone: string | null | undefined, mensagem: string) {
  if (!telefone) return;
  try {
    await supabase.functions.invoke('whatsapp-send-text', {
      body: { telefone, mensagem, allow_text: true },
    });
  } catch (e) {
    console.warn('Falha ao enviar WhatsApp de realocação:', e);
  }
}

function mensagemRota(r: RpcResult, oficinaNome?: string) {
  const dataFmt = format(new Date(r.nova_data + 'T00:00:00'), 'dd/MM/yyyy');
  const placa = r.veiculo_placa ? ` do veículo ${r.veiculo_placa}` : '';
  return `Olá ${r.associado_nome || ''}! Sua instalação${placa} foi reagendada para ${dataFmt} — ${PERIODO_LABEL[r.novo_periodo]}. Em breve nosso instalador entrará em contato. Equipe Pratic.`;
}
function mensagemBase(r: RpcResult, oficinaNomeFallback?: string) {
  const dataFmt = format(new Date(r.nova_data + 'T00:00:00'), 'dd/MM/yyyy');
  const nome = r.oficina_nome || oficinaNomeFallback || 'nossa base';
  return `Olá ${r.associado_nome || ''}! Sua instalação foi remarcada para ser realizada na base *${nome}* em ${dataFmt} — ${PERIODO_LABEL[r.novo_periodo]}. Por favor, compareça com o veículo. Equipe Pratic.`;
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
    queryClient.invalidateQueries({ queryKey: ['servicos-para-atribuir-manual'] });
    queryClient.invalidateQueries({ queryKey: ['vistoriadores-ativos-manual'] });
    queryClient.invalidateQueries({ queryKey: ['servicos-travados'] });
    queryClient.invalidateQueries({ queryKey: ['servicos-campo-unificado'] });
    queryClient.invalidateQueries({ queryKey: ['tarefa-atual'] });
  };

  // ---------- FILA ----------
  const realocarParaFila = useMutation({
    mutationFn: async (params: RealocarParaFilaParams) => {
      const r = await chamarRPC({
        servicoId: params.instalacaoId,
        destino: 'fila',
        motivo: params.motivo,
        categoria: params.categoria || 'reagendamento_operacional',
        dataAgendada: params.dataAgendada,
        periodo: params.periodo,
      });
      if (params.notificarWhatsApp && r.associado_telefone) {
        await notificarAssociado(r.associado_telefone, mensagemRota(r));
      }
      return r;
    },
    onSuccess: () => { invalidar(); toast.success('Serviço enviado para a fila de atribuição manual'); },
    onError: (e: Error) => toast.error(`Erro ao devolver à fila: ${e.message}`),
  });

  // ---------- PROFISSIONAL (reatribuição direta) ----------
  const reatribuirProfissional = useMutation({
    mutationFn: async (params: RealocarParaProfissionalParams) => {
      const r = await chamarRPC({
        servicoId: params.instalacaoId,
        destino: 'profissional',
        motivo: params.motivo,
        categoria: params.categoria || 'tecnico_indisponivel',
        dataAgendada: params.dataAgendada,
        periodo: params.periodo,
        profissionalId: params.profissionalId,
      });
      if (params.notificarWhatsApp && r.associado_telefone) {
        await notificarAssociado(r.associado_telefone, mensagemRota(r));
      }
      return r;
    },
    onSuccess: () => { invalidar(); toast.success('Serviço reatribuído'); },
    onError: (e: Error) => toast.error(`Erro ao reatribuir: ${e.message}`),
  });

  // ---------- ROTA ----------
  const realocarParaRota = useMutation({
    mutationFn: async (params: RealocarParaRotaParams) => {
      // rotaId null → fila manual
      const destino: DestinoRealocacao = params.rotaId === null ? 'fila' : 'rota';
      const r = await chamarRPC({
        servicoId: params.instalacaoId,
        destino,
        motivo: params.motivo,
        categoria: params.categoria || 'reagendamento_operacional',
        dataAgendada: params.dataAgendada,
        periodo: params.periodo,
        rotaId: params.rotaId,
        profissionalId: destino === 'rota' ? (params.instaladorId ?? null) : null,
      });
      if (params.notificarWhatsApp && r.associado_telefone) {
        await notificarAssociado(r.associado_telefone, mensagemRota(r));
      }
      return r;
    },
    onSuccess: (_d, vars) => {
      invalidar();
      toast.success(
        vars.rotaId === null
          ? 'Serviço reagendado e enviado para a fila de atribuição!'
          : 'Instalação realocada para a rota!'
      );
    },
    onError: (e: Error) => toast.error(`Erro ao realocar: ${e.message}`),
  });

  // ---------- BASE ----------
  const realocarParaBase = useMutation({
    mutationFn: async (params: RealocarParaBaseParams) => {
      const r = await chamarRPC({
        servicoId: params.instalacaoId,
        destino: 'base',
        motivo: params.motivo,
        categoria: params.categoria || 'reagendamento_operacional',
        dataAgendada: params.dataAgendada,
        periodo: params.periodo,
        oficinaId: params.oficinaId,
      });
      if (params.notificarWhatsApp && r.associado_telefone) {
        await notificarAssociado(r.associado_telefone, mensagemBase(r, params.oficinaNome));
      }
      return r;
    },
    onSuccess: () => { invalidar(); toast.success('Instalação realocada para a base!'); },
    onError: (e: Error) => toast.error(`Erro ao realocar: ${e.message}`),
  });

  return {
    realocarParaFila,
    reatribuirProfissional,
    realocarParaRota,
    realocarParaBase,
  };
}
