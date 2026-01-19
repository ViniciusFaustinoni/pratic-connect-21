import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export type StatusProfissional = 'disponivel' | 'indisponivel' | 'ferias' | 'afastado';
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
  ativo: boolean;
  tarefas_hoje: number;
  ultima_atividade: string | null;
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

      // 3. Buscar contagem de tarefas hoje para cada profissional
      const hoje = format(new Date(), 'yyyy-MM-dd');
      const { data: instalacoes } = await supabase
        .from('instalacoes')
        .select('instalador_id, instalador_responsavel_id')
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
      const profileIds = profiles.map(p => p.id);
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

      // 5. Mapear para o formato esperado
      return profiles.map(profile => ({
        id: profile.id,
        user_id: profile.user_id,
        nome: profile.nome || 'Sem nome',
        email: profile.email || '',
        telefone: profile.telefone,
        whatsapp: null, // Campo não existe em profiles
        cpf: profile.cpf,
        cep: null, // Campo não existe em profiles
        logradouro: null,
        numero: null,
        bairro: null,
        cidade: null,
        uf: null,
        regioes_atendimento: (profile as any).regioes_atendimento || [],
        funcoes: ['vistoriador', 'instalador'] as FuncaoProfissional[], // Role única para ambas funções
        capacidade_diaria: (profile as any).capacidade_diaria || 5,
        status: (profile.ativo ? 'disponivel' : 'indisponivel') as StatusProfissional,
        ativo: profile.ativo ?? true,
        tarefas_hoje: tarefasPorProfissional[profile.id] || 0,
        ultima_atividade: ultimaAtividadePorProfissional[profile.id] || null,
      })) as ProfissionalEquipe[];
    },
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
