import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfDay } from 'date-fns';

export type StatusProfissional = 'disponivel' | 'indisponivel' | 'ferias' | 'afastado';
export type StatusOperacional = 'em_contato' | 'em_andamento' | 'em_rota' | 'disponivel_operacional' | 'offline';
export type RoleEquipe = 'instalador_vistoriador' | 'analista_monitoramento' | 'vistoriador_base' | string;
export type CategoriaEquipe = 'instalador' | 'administrativo';

export interface ProfissionalEquipe {
  id: string;
  user_id: string;
  role: RoleEquipe;
  role_permanente: RoleEquipe;
  role_operacional: RoleEquipe;
  em_cobertura: boolean;
  tipo_cobertura: 'base' | 'rota' | null;
  categoria: CategoriaEquipe;
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
  tarefas_hoje_concluidas: number;
  tarefas_hoje_pendentes: number;
  tarefas_hoje_falhas: number;
  tarefas_hoje_total: number;
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
      // 1. Buscar user_ids com role instalador_vistoriador ou analista_monitoramento
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['instalador_vistoriador', 'analista_monitoramento', 'vistoriador_base'] as any[]);

      if (rolesError) throw rolesError;
      if (!roles?.length) return [];

      const userIds = Array.from(new Set(roles.map(r => r.user_id)));
      // Mapa user_id -> Set de roles
      const rolesByUserId: Record<string, Set<string>> = {};
      roles.forEach(r => {
        if (!rolesByUserId[r.user_id]) rolesByUserId[r.user_id] = new Set();
        rolesByUserId[r.user_id].add(r.role as string);
      });

      // Role permanente: prioriza técnico de rota > base > administrativo.
      const principalRole = (set: Set<string>): string => {
        if (set.has('instalador_vistoriador')) return 'instalador_vistoriador';
        if (set.has('vistoriador_base')) return 'vistoriador_base';
        if (set.has('analista_monitoramento')) return 'analista_monitoramento';
        return Array.from(set)[0] || 'analista_monitoramento';
      };

      // 2. Buscar profiles completos
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', userIds)
        .order('nome');

      if (profilesError) throw profilesError;
      if (!profiles?.length) return [];

      const profileIds = profiles.map(p => p.id);

      // 2b. Buscar coberturas operacionais ativas (não altera perfil permanente)
      const { data: coberturasAtivas } = await (supabase as any)
        .from('tecnico_perfil_operacional')
        .select('profissional_id, role_permanente, role_operacional, ativo')
        .in('profissional_id', profileIds)
        .eq('ativo', true);

      const coberturaPorProfissional: Record<string, { role_permanente: string; role_operacional: string }> = {};
      (coberturasAtivas || []).forEach((c: any) => {
        coberturaPorProfissional[c.profissional_id] = {
          role_permanente: c.role_permanente,
          role_operacional: c.role_operacional,
        };
      });

      // 3. Buscar contagem de tarefas hoje para cada profissional (tabela `servicos`)
      const hoje = format(new Date(), 'yyyy-MM-dd');
      const { data: servicosHoje } = await supabase
        .from('servicos')
        .select('profissional_id, status')
        .in('profissional_id', profileIds)
        .eq('data_agendada', hoje)
        .in('status', ['agendada', 'em_rota', 'em_andamento', 'concluida', 'nao_compareceu', 'reagendada']);

      // Contar tarefas por profissional, separando concluídas/pendentes/falhas
      const STATUS_CONCLUIDA = new Set(['concluida']);
      const STATUS_PENDENTE = new Set(['agendada', 'em_rota', 'em_andamento']);
      const STATUS_FALHA = new Set(['nao_compareceu', 'reagendada']);
      const contagemPorProfissional: Record<string, { concluidas: number; pendentes: number; falhas: number; total: number }> = {};
      servicosHoje?.forEach(svc => {
        if (!svc.profissional_id) return;
        const c = contagemPorProfissional[svc.profissional_id] ||= { concluidas: 0, pendentes: 0, falhas: 0, total: 0 };
        c.total += 1;
        if (STATUS_CONCLUIDA.has(svc.status)) c.concluidas += 1;
        else if (STATUS_PENDENTE.has(svc.status)) c.pendentes += 1;
        else if (STATUS_FALHA.has(svc.status)) c.falhas += 1;
      });

      // 4. Buscar última atividade (último serviço concluído)
      const { data: ultimasAtividades } = await supabase
        .from('servicos')
        .select('profissional_id, concluida_em, updated_at')
        .in('profissional_id', profileIds)
        .eq('status', 'concluida')
        .order('updated_at', { ascending: false })
        .limit(100);

      const ultimaAtividadePorProfissional: Record<string, string> = {};
      ultimasAtividades?.forEach(svc => {
        const ts = svc.concluida_em || svc.updated_at;
        if (svc.profissional_id && ts && !ultimaAtividadePorProfissional[svc.profissional_id]) {
          ultimaAtividadePorProfissional[svc.profissional_id] = ts;
        }
      });

      // 5. Buscar localização (sem filtro de tempo — sempre mostra última conhecida)
      const { data: localizacoes } = await supabase
        .from('vistoriadores_localizacao')
        .select('vistoriador_id, em_servico, updated_at, latitude, longitude')
        .in('vistoriador_id', profileIds);

      const localizacaoPorProfissional: Record<string, { em_servico: boolean; updated_at: string; latitude: number; longitude: number }> = {};
      localizacoes?.forEach(loc => {
        localizacaoPorProfissional[loc.vistoriador_id] = {
          em_servico: loc.em_servico,
          updated_at: loc.updated_at,
          latitude: loc.latitude,
          longitude: loc.longitude,
        };
      });

      // 5b. Buscar turno do dia para saber hora de login
      const hojeISO = startOfDay(new Date()).toISOString();
      const { data: turnos } = await supabase
        .from('turnos_profissionais')
        .select('profissional_id, inicio_turno')
        .in('profissional_id', profileIds)
        .gte('inicio_turno', hojeISO);

      const turnoPorProfissional: Record<string, string> = {};
      turnos?.forEach(t => {
        if (t.profissional_id && t.inicio_turno) {
          turnoPorProfissional[t.profissional_id] = t.inicio_turno;
        }
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
        // Determinar status operacional com verificação de freshness
        const LIMITE_INATIVIDADE_MS = 25 * 60 * 1000; // 25 minutos
        let status_operacional: StatusOperacional = 'offline';
        if (localizacao?.em_servico) {
          const updatedAt = new Date(localizacao.updated_at).getTime();
          const agoraMs = Date.now();
          const estaInativo = agoraMs - updatedAt > LIMITE_INATIVIDADE_MS;

          if (estaInativo) {
            status_operacional = 'offline'; // App provavelmente fechado
          } else if (tarefaAtiva?.status === 'em_andamento') {
            status_operacional = 'em_andamento';
          } else if (tarefaAtiva?.status === 'em_rota') {
            status_operacional = 'em_rota';
          } else if (tarefaAtiva?.status === 'agendada' && tarefaAtiva?.contato_realizado_em) {
            status_operacional = 'em_contato';
          } else {
            status_operacional = 'disponivel_operacional';
          }
        }

        const userRoles = rolesByUserId[profile.user_id] || new Set<string>();
        const rolePermanente = principalRole(userRoles);
        const cobertura = coberturaPorProfissional[profile.id];
        const roleOperacional = cobertura?.role_operacional || rolePermanente;
        const emCobertura = Boolean(cobertura && cobertura.role_operacional !== rolePermanente);
        const categoria: CategoriaEquipe =
          roleOperacional === 'instalador_vistoriador' || roleOperacional === 'vistoriador_base'
            ? 'instalador'
            : 'administrativo';

        return {
          id: profile.id,
          user_id: profile.user_id,
          role: roleOperacional,
          role_permanente: rolePermanente,
          role_operacional: roleOperacional,
          em_cobertura: emCobertura,
          tipo_cobertura: emCobertura ? (roleOperacional === 'vistoriador_base' ? 'base' : 'rota') : null,
          categoria,
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
          tarefas_hoje: (contagemPorProfissional[profile.id]?.concluidas || 0) + (contagemPorProfissional[profile.id]?.pendentes || 0),
          tarefas_hoje_concluidas: contagemPorProfissional[profile.id]?.concluidas || 0,
          tarefas_hoje_pendentes: contagemPorProfissional[profile.id]?.pendentes || 0,
          tarefas_hoje_falhas: contagemPorProfissional[profile.id]?.falhas || 0,
          tarefas_hoje_total: contagemPorProfissional[profile.id]?.total || 0,
          ultima_atividade: ultimaAtividadePorProfissional[profile.id] || null,
          rastreadores_atribuidos: rastreadoresPorProfissional[profile.id] || 0,
          inicio_turno: turnoPorProfissional[profile.id] || null,
          latitude: localizacao?.latitude ?? null,
          longitude: localizacao?.longitude ?? null,
          localizacao_updated_at: localizacao?.updated_at ?? null,
          tarefa_atual: tarefaAtiva,
        };
      }) as ProfissionalEquipe[];
    },
    // Reduzido: monitoramento de equipe não precisa de 30s.
    // 90s + realtime cobre o caso de uso operacional sem gargalo.
    refetchInterval: 90000,
    refetchIntervalInBackground: false,
    staleTime: 60000,
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
      tipoVistoriador?: 'instalador_vistoriador' | 'analista_monitoramento';
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
            tipo: data.tipoVistoriador === 'analista_monitoramento' ? 'funcionario' : 'prestador',
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

// Alternar perfil operacional temporário (rota ↔ base) sem alterar user_roles permanente
export function useAlternarPerfilOperacional() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ profissionalId }: { profissionalId: string }) => {
      const { data, error } = await (supabase as any).rpc('alternar_perfil_operacional_tecnico', {
        _profissional_id: profissionalId,
      });

      if (error) throw error;
      return Array.isArray(data) ? data[0] : data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profissionais-equipe'] });
      queryClient.invalidateQueries({ queryKey: ['instaladores'] });
      queryClient.invalidateQueries({ queryKey: ['vistoriadores-localizacao-realtime'] });
      queryClient.invalidateQueries({ queryKey: ['servicos-atribuidos'] });
      queryClient.invalidateQueries({ queryKey: ['alocacoes-dia'] });
    },
  });
}
