import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfDay } from 'date-fns';

export type StatusProfissional = 'disponivel' | 'indisponivel' | 'ferias' | 'afastado';
export type StatusOperacional = 'em_contato' | 'em_andamento' | 'em_rota' | 'disponivel_operacional' | 'offline';

export interface ProfissionalEquipe {
  id: string;
  user_id: string;
  nome: string;
  email: string;
  telefone: string | null;
  whatsapp?: string | null;
  cpf?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  regioes_atendimento: string[];
  capacidade_diaria: number;
  status: StatusProfissional;
  status_operacional: StatusOperacional;
  ativo: boolean;
  tarefas_hoje: number;
  ultima_atividade: string | null;
  rastreadores_atribuidos: number;
  inicio_turno: string | null;
  latitude: number | null;
  longitude: number | null;
  localizacao_updated_at: string | null;
  tarefa_atual?: {
    id: string;
    tipo: 'vistoria' | 'instalacao';
    status: string;
  };
}

// Buscar profissionais da equipe (instaladores/vistoriadores)
export function useProfissionaisEquipe() {
  return useQuery({
    queryKey: ['profissionais-equipe'],
    queryFn: async () => {
      // 1. Buscar user_ids com role instalador_vistoriador
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'instalador_vistoriador');

      if (rolesError) throw rolesError;
      if (!roles?.length) return [];

      const userIds = roles.map(r => r.user_id);

      // 2. Buscar profiles completos
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', userIds)
        .order('nome');

      if (profilesError) throw profilesError;
      if (!profiles?.length) return [];

      const profileIds = profiles.map(p => p.id);

      // 3. Buscar contagem de tarefas hoje para cada profissional
      const hoje = format(new Date(), 'yyyy-MM-dd');
      const { data: instalacoes } = await supabase
        .from('instalacoes')
        .select('instalador_id, instalador_responsavel_id, status')
        .eq('data_agendada', hoje)
        .in('status', ['agendada', 'em_rota', 'em_andamento', 'concluida']);

      // Contar tarefas por profissional
      const tarefasPorProfissional: Record<string, number> = {};
      instalacoes?.forEach(inst => {
        const id = inst.instalador_responsavel_id || inst.instalador_id;
        if (id) {
          tarefasPorProfissional[id] = (tarefasPorProfissional[id] || 0) + 1;
        }
      });

      // 4. Buscar última atividade (última instalação concluída)
      const { data: ultimasAtividades } = await supabase
        .from('instalacoes')
        .select('instalador_responsavel_id, updated_at')
        .in('instalador_responsavel_id', profileIds)
        .eq('status', 'concluida')
        .order('updated_at', { ascending: false })
        .limit(100);

      const ultimaAtividadePorProfissional: Record<string, string> = {};
      ultimasAtividades?.forEach(inst => {
        if (inst.instalador_responsavel_id && inst.updated_at && !ultimaAtividadePorProfissional[inst.instalador_responsavel_id]) {
          ultimaAtividadePorProfissional[inst.instalador_responsavel_id] = inst.updated_at;
        }
      });

      // 5. Buscar localização em tempo real (últimos 60 minutos)
      const cutoffTime = subMinutes(new Date(), 60).toISOString();
      const { data: localizacoes } = await supabase
        .from('vistoriadores_localizacao')
        .select('vistoriador_id, em_servico, updated_at')
        .in('vistoriador_id', profileIds)
        .gte('updated_at', cutoffTime);

      const localizacaoPorProfissional: Record<string, { em_servico: boolean; updated_at: string }> = {};
      localizacoes?.forEach(loc => {
        localizacaoPorProfissional[loc.vistoriador_id] = {
          em_servico: loc.em_servico,
          updated_at: loc.updated_at,
        };
      });

      // 6. Buscar tarefas ativas (em_rota, em_andamento ou agendada com contato) da tabela servicos
      const { data: tarefasAtivas } = await supabase
        .from('servicos')
        .select('id, profissional_id, status, contato_realizado_em')
        .in('profissional_id', profileIds)
        .in('status', ['em_rota', 'em_andamento', 'agendada']);

      const tarefaAtivaPorProfissional: Record<string, { id: string; tipo: 'instalacao'; status: string; contato_realizado_em: string | null }> = {};
      tarefasAtivas?.forEach(tarefa => {
        if (tarefa.profissional_id) {
          const existente = tarefaAtivaPorProfissional[tarefa.profissional_id];
          // Priorizar: em_andamento > em_rota > agendada
          const prioridade = (s: string) => s === 'em_andamento' ? 1 : s === 'em_rota' ? 2 : 3;
          if (!existente || prioridade(tarefa.status) < prioridade(existente.status)) {
            tarefaAtivaPorProfissional[tarefa.profissional_id] = {
              id: tarefa.id,
              tipo: 'instalacao',
              status: tarefa.status,
              contato_realizado_em: tarefa.contato_realizado_em,
            };
          }
        }
      });

      // 7. Buscar contagem de rastreadores atribuídos a cada profissional (status = estoque)
      const { data: rastreadoresPortador } = await supabase
        .from('rastreadores')
        .select('portador_id')
        .in('portador_id', profileIds)
        .eq('status', 'estoque');

      const rastreadoresPorProfissional: Record<string, number> = {};
      rastreadoresPortador?.forEach(r => {
        if (r.portador_id) {
          rastreadoresPorProfissional[r.portador_id] = (rastreadoresPorProfissional[r.portador_id] || 0) + 1;
        }
      });

      // 8. Mapear para o formato esperado
      return profiles.map(profile => {
        const localizacao = localizacaoPorProfissional[profile.id];
        const tarefaAtiva = tarefaAtivaPorProfissional[profile.id];
        
        // Determinar status operacional
        let status_operacional: StatusOperacional = 'offline';
        if (localizacao?.em_servico) {
          if (tarefaAtiva?.status === 'em_andamento') {
            status_operacional = 'em_andamento';
          } else if (tarefaAtiva?.status === 'em_rota') {
            status_operacional = 'em_rota';
          } else if (tarefaAtiva?.status === 'agendada' && tarefaAtiva?.contato_realizado_em) {
            status_operacional = 'em_contato';
          } else {
            status_operacional = 'disponivel_operacional';
          }
        }

        return {
          id: profile.id,
          user_id: profile.user_id,
          nome: profile.nome || 'Sem nome',
          email: profile.email || '',
          telefone: profile.telefone,
          whatsapp: null,
          cpf: profile.cpf,
          cep: null,
          logradouro: null,
          numero: null,
          bairro: null,
          cidade: null,
          uf: null,
          regioes_atendimento: (profile as any).regioes_atendimento || [],
          capacidade_diaria: (profile as any).capacidade_diaria || 10,
          status: (profile.ativo ? 'disponivel' : 'indisponivel') as StatusProfissional,
          status_operacional,
          ativo: profile.ativo ?? true,
          tarefas_hoje: tarefasPorProfissional[profile.id] || 0,
          ultima_atividade: ultimaAtividadePorProfissional[profile.id] || null,
          rastreadores_atribuidos: rastreadoresPorProfissional[profile.id] || 0,
          tarefa_atual: tarefaAtiva,
        };
      }) as ProfissionalEquipe[];
    },
    refetchInterval: 30000, // Atualizar a cada 30 segundos
  });
}

// Criar ou atualizar profissional
export function useSaveProfissional() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id?: string;
      nome: string;
      email: string;
      telefone: string;
      whatsapp?: string;
      cpf?: string;
      cep?: string;
      logradouro?: string;
      numero?: string;
      bairro?: string;
      cidade?: string;
      uf?: string;
      regioes_atendimento?: string[];
      capacidade_diaria?: number;
      ativo?: boolean;
      tipoVistoriador?: 'instalador_vistoriador';
      senhaProvisoria?: string;
    }) => {
      if (data.id) {
        // ATUALIZAR profile existente
        const { error } = await supabase
          .from('profiles')
          .update({
            nome: data.nome,
            telefone: data.telefone,
            cpf: data.cpf,
            regioes_atendimento: data.regioes_atendimento,
            capacidade_diaria: data.capacidade_diaria,
            ativo: data.ativo,
          })
          .eq('id', data.id);

        if (error) throw error;
        return { success: true, updated: true };
      } else {
        // CRIAR novo usuário via Edge Function
        const { data: result, error } = await supabase.functions.invoke('create-user', {
          body: {
            nome: data.nome,
            email: data.email,
            telefone: data.telefone,
            cpf: data.cpf,
            senha: data.senhaProvisoria,
            tipo: 'prestador',  // Prestador = profissional externo
            perfis: [data.tipoVistoriador || 'instalador_vistoriador'],
            regioes_atendimento: data.regioes_atendimento,
            capacidade_diaria: data.capacidade_diaria,
          }
        });

        if (error) throw error;
        if (result?.error) throw new Error(result.error);
        
        return { success: true, created: true };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profissionais-equipe'] });
      queryClient.invalidateQueries({ queryKey: ['instaladores'] });
    },
  });
}

// Alternar status ativo/inativo
export function useToggleProfissionalStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ ativo })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profissionais-equipe'] });
      queryClient.invalidateQueries({ queryKey: ['instaladores'] });
    },
  });
}
