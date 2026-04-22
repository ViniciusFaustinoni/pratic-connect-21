import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { periodoToTime } from '@/lib/periodo-utils';

export interface AlterarEnderecoTipoInput {
  // Identificação da origem
  origem: 'rota' | 'base';
  servicoId?: string | null;          // PK em servicos (origem=rota)
  agendamentoBaseId?: string | null;  // PK em agendamentos_base (origem=base)

  // Novo tipo (pode ser igual à origem)
  tipoNovo: 'rota' | 'base';

  // Endereço (obrigatório quando tipoNovo='rota')
  endereco?: {
    cep?: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    latitude?: number | null;
    longitude?: number | null;
  };

  // Técnico (null = remover atribuição)
  profissionalId?: string | null;

  // Base
  oficinaId?: string | null;
  horario?: string | null;
}

async function getProfileId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

async function geocode(endereco: AlterarEnderecoTipoInput['endereco']) {
  if (!endereco) return { latitude: null as number | null, longitude: null as number | null };
  if (typeof endereco.latitude === 'number' && typeof endereco.longitude === 'number') {
    return { latitude: endereco.latitude, longitude: endereco.longitude };
  }
  try {
    const { data } = await supabase.functions.invoke('geocode-endereco', {
      body: {
        cep: endereco.cep,
        logradouro: endereco.logradouro,
        numero: endereco.numero,
        bairro: endereco.bairro,
        cidade: endereco.cidade,
        uf: endereco.uf,
      },
    });
    if (data?.success && data?.latitude && data?.longitude) {
      return { latitude: data.latitude as number, longitude: data.longitude as number };
    }
  } catch (e) {
    console.error('[useAlterarEnderecoTipo] geocode falhou:', e);
  }
  return { latitude: null, longitude: null };
}

async function logAtribuicao(servicoId: string | null, agendamentoBaseId: string | null, profissionalId: string) {
  const profileId = await getProfileId();
  const payload: any = {
    profissional_id: profissionalId,
    tipo_atribuicao: 'manual',
    atribuido_por: profileId,
    observacoes: 'Alteração manual via Coordenador',
  };
  if (servicoId) payload.servico_id = servicoId;
  if (agendamentoBaseId) payload.agendamento_base_id = agendamentoBaseId;
  const { error } = await supabase.from('servicos_atribuicoes_log').insert(payload);
  if (error) console.error('[useAlterarEnderecoTipo] log error:', error);
}

export function useAlterarEnderecoTipo() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: AlterarEnderecoTipoInput) => {
      const { origem, tipoNovo } = input;

      // Validação básica
      if (tipoNovo === 'rota' && !input.endereco?.logradouro && !input.endereco?.cidade) {
        throw new Error('Informe ao menos logradouro e cidade do endereço.');
      }
      if (tipoNovo === 'base' && !input.oficinaId) {
        throw new Error('Selecione a oficina/base.');
      }
      if (tipoNovo === 'base' && !input.horario) {
        throw new Error('Informe o período do atendimento na base.');
      }
      // Normaliza período (input.horario pode vir como 'manha'/'tarde' ou HH:MM legado)
      const periodoCanonico = (() => {
        const v = String(input.horario || '').toLowerCase();
        if (v === 'manha' || v === 'tarde' || v === 'noite') return v as 'manha' | 'tarde' | 'noite';
        const m = /^(\d{1,2}):/.exec(v);
        if (m) {
          const h = parseInt(m[1], 10);
          if (h < 12) return 'manha';
          if (h < 18) return 'tarde';
          return 'noite';
        }
        return 'manha';
      })();

      // ── Caso 1: mantém o tipo ──
      if (tipoNovo === origem) {
        if (origem === 'rota') {
          if (!input.servicoId) throw new Error('servicoId obrigatório.');
          const { latitude, longitude } = await geocode(input.endereco);
          const update: any = {
            cep: input.endereco?.cep || null,
            logradouro: input.endereco?.logradouro || null,
            numero: input.endereco?.numero || null,
            complemento: input.endereco?.complemento || null,
            bairro: input.endereco?.bairro || null,
            cidade: input.endereco?.cidade || null,
            uf: input.endereco?.uf || null,
            latitude,
            longitude,
            profissional_id: input.profissionalId ?? null,
          };
          const { error } = await supabase.from('servicos').update(update).eq('id', input.servicoId);
          if (error) throw error;
          if (input.profissionalId) await logAtribuicao(input.servicoId, null, input.profissionalId);
          return { id: input.servicoId, kind: 'rota' as const };
        } else {
          if (!input.agendamentoBaseId) throw new Error('agendamentoBaseId obrigatório.');
          const { error } = await supabase
            .from('agendamentos_base')
            .update({
              oficina_id: input.oficinaId!,
              horario: periodoToTime(periodoCanonico),
              atendido_por: input.profissionalId ?? null,
            })
            .eq('id', input.agendamentoBaseId);
          if (error) throw error;
          if (input.profissionalId) await logAtribuicao(null, input.agendamentoBaseId, input.profissionalId);
          return { id: input.agendamentoBaseId, kind: 'base' as const };
        }
      }

      // ── Caso 2: Rota → Base ──
      if (origem === 'rota' && tipoNovo === 'base') {
        if (!input.servicoId) throw new Error('servicoId obrigatório.');
        const { data: srv, error: errSrv } = await supabase
          .from('servicos')
          .select('id, data_agendada, cotacao_id, instalacao_origem_id, vistoria_origem_id, observacoes, associado_id')
          .eq('id', input.servicoId)
          .maybeSingle();
        if (errSrv || !srv) throw errSrv || new Error('Serviço não encontrado.');

        // Buscar dados do cliente/veículo
        let cliente_nome = 'Cliente';
        let cliente_telefone: string | null = null;
        let veiculo_placa: string | null = null;
        let veiculo_descricao: string | null = null;
        if (srv.associado_id) {
          const { data: assoc } = await supabase
            .from('associados')
            .select('nome, telefone')
            .eq('id', srv.associado_id)
            .maybeSingle();
          if (assoc) {
            cliente_nome = assoc.nome || 'Cliente';
            cliente_telefone = assoc.telefone || null;
          }
        }

        const { error: errIns } = await supabase.from('agendamentos_base').insert({
          cotacao_id: srv.cotacao_id,
          instalacao_id: srv.instalacao_origem_id,
          vistoria_id: srv.vistoria_origem_id,
          cliente_nome,
          cliente_telefone,
          veiculo_placa,
          veiculo_descricao,
          data_agendada: srv.data_agendada,
          horario: periodoToTime(periodoCanonico),
          oficina_id: input.oficinaId!,
          atendido_por: input.profissionalId ?? null,
          status: input.profissionalId ? 'confirmado' : 'agendado',
          observacoes: 'Convertido de rota',
        });
        if (errIns) throw errIns;

        const { error: errUpd } = await supabase
          .from('servicos')
          .update({
            status: 'cancelada',
            profissional_id: null,
            observacoes: `${srv.observacoes ? srv.observacoes + ' | ' : ''}[Convertido para Base em ${new Date().toLocaleString('pt-BR')}]`,
          })
          .eq('id', input.servicoId);
        if (errUpd) throw errUpd;

        if (input.profissionalId) await logAtribuicao(null, input.servicoId, input.profissionalId);
        return { id: input.servicoId, kind: 'base' as const };
      }

      // ── Caso 3: Base → Rota ──
      if (origem === 'base' && tipoNovo === 'rota') {
        if (!input.agendamentoBaseId) throw new Error('agendamentoBaseId obrigatório.');
        const { data: ab, error: errAb } = await supabase
          .from('agendamentos_base')
          .select('*')
          .eq('id', input.agendamentoBaseId)
          .maybeSingle();
        if (errAb || !ab) throw errAb || new Error('Agendamento de base não encontrado.');

        const { latitude, longitude } = await geocode(input.endereco);

        // tipo: deduzir do contexto (vistoria por padrão)
        const tipo = ab.instalacao_id ? 'instalacao' : 'vistoria';

        // associado_id pode ser resolvido via instalação/vistoria de origem
        let associado_id: string | null = null;
        if (ab.instalacao_id) {
          const { data: inst } = await supabase
            .from('instalacoes')
            .select('associado_id')
            .eq('id', ab.instalacao_id)
            .maybeSingle();
          associado_id = (inst as any)?.associado_id ?? null;
        }
        if (!associado_id && ab.vistoria_id) {
          const { data: vis } = await supabase
            .from('vistorias')
            .select('associado_id')
            .eq('id', ab.vistoria_id)
            .maybeSingle();
          associado_id = (vis as any)?.associado_id ?? null;
        }

        const { data: novoSrv, error: errIns } = await supabase
          .from('servicos')
          .insert({
            tipo,
            status: input.profissionalId ? 'agendada' : 'pendente',
            data_agendada: ab.data_agendada,
            hora_agendada: null,
            periodo: periodoCanonico,
            cep: input.endereco?.cep || null,
            logradouro: input.endereco?.logradouro || null,
            numero: input.endereco?.numero || null,
            complemento: input.endereco?.complemento || null,
            bairro: input.endereco?.bairro || null,
            cidade: input.endereco?.cidade || null,
            uf: input.endereco?.uf || null,
            latitude,
            longitude,
            associado_id,
            cotacao_id: ab.cotacao_id,
            instalacao_origem_id: ab.instalacao_id,
            vistoria_origem_id: ab.vistoria_id,
            profissional_id: input.profissionalId ?? null,
            origem: 'conversao_base',
            observacoes: `Convertido de Base (${input.agendamentoBaseId}) em ${new Date().toLocaleString('pt-BR')}`,
          } as any)
          .select('id')
          .single();
        if (errIns) throw errIns;

        const { error: errUpd } = await supabase
          .from('agendamentos_base')
          .update({
            status: 'cancelado',
            atendido_por: null,
            observacoes: `${ab.observacoes ? ab.observacoes + ' | ' : ''}[Convertido para Rota em ${new Date().toLocaleString('pt-BR')}]`,
          })
          .eq('id', input.agendamentoBaseId);
        if (errUpd) throw errUpd;

        if (input.profissionalId && novoSrv?.id) {
          await logAtribuicao(novoSrv.id, null, input.profissionalId);
        }
        return { id: novoSrv?.id, kind: 'rota' as const };
      }

      throw new Error('Combinação de origem/tipo inválida.');
    },
    onSuccess: () => {
      toast.success('Alteração realizada com sucesso');
      qc.invalidateQueries({ queryKey: ['vistorias-mapa'] });
      qc.invalidateQueries({ queryKey: ['servicos-para-atribuir-manual'] });
      qc.invalidateQueries({ queryKey: ['vistoriadores-ativos-manual'] });
      qc.invalidateQueries({ queryKey: ['tarefa-atual'] });
      qc.invalidateQueries({ queryKey: ['tarefa-atual-servico'] });
      qc.invalidateQueries({ queryKey: ['vistoriadores-localizacao-realtime'] });
      qc.invalidateQueries({ queryKey: ['calendario-dia-base'] });
      qc.invalidateQueries({ queryKey: ['servicos'] });
      qc.invalidateQueries({ queryKey: ['instalacoes'] });
      qc.invalidateQueries({ queryKey: ['vistorias'] });
      qc.invalidateQueries({ queryKey: ['mapa-base-pendentes'] });
    },
    onError: (err: any) => {
      toast.error('Erro ao alterar: ' + (err?.message || 'erro desconhecido'));
    },
  });
}
