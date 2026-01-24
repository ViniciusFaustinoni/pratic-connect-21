import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subMinutes } from 'date-fns';

export type StatusProfissional = 'disponivel' | 'indisponivel' | 'ferias' | 'afastado';
export type StatusOperacional = 'em_andamento' | 'em_rota' | 'disponivel_operacional' | 'offline';
export type FuncaoProfissional = 'vistoriador' | 'instalador';

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
  funcoes: FuncaoProfissional[];
  capacidade_diaria: number;
  status: StatusProfissional;
  status_operacional: StatusOperacional;
  ativo: boolean;
  tarefas_hoje: number;
  ultima_atividade: string | null;
  rastreadores_atribuidos: number;
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

      // 6. Buscar tarefas ativas (em_rota ou em_andamento) para determinar status operacional
      const { data: tarefasAtivas } = await supabase
        .from('instalacoes')
        .select('id, instalador_responsavel_id, status')
        .in('instalador_responsavel_id', profileIds)
        .in('status', ['em_rota', 'em_andamento']);

      const tarefaAtivaPorProfissional: Record<string, { id: string; tipo: 'instalacao'; status: string }> = {};
      tarefasAtivas?.forEach(tarefa => {
        if (tarefa.instalador_responsavel_id) {
          // Priorizar em_andamento sobre em_rota
          const existente = tarefaAtivaPorProfissional[tarefa.instalador_responsavel_id];
          if (!existente || (tarefa.status === 'em_andamento' && existente.status === 'em_rota')) {
            tarefaAtivaPorProfissional[tarefa.instalador_responsavel_id] = {
              id: tarefa.id,
              tipo: 'instalacao',
              status: tarefa.status,
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
          funcoes: ['vistoriador', 'instalador'] as FuncaoProfissional[],
          capacidade_diaria: (profile as any).capacidade_diaria || 5,
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
    }) => {
      if (data.id) {
        // Atualizar profile existente (apenas campos que existem)
        const { error } = await supabase
          .from('profiles')
          .update({
            nome: data.nome,
            telefone: data.telefone,
            cpf: data.cpf,
            ativo: data.ativo,
          })
          .eq('id', data.id);

        if (error) throw error;
        return { success: true, updated: true };
      } else {
        // Para criar novo, precisaria criar usuário via auth.users primeiro
        throw new Error('Para criar novos profissionais, utilize o cadastro de usuários.');
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
