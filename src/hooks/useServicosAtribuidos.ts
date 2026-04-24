import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, startOfDay } from 'date-fns';
import { formatLocalizacaoComZona, getZonaAtendimento } from '@/lib/localizacao-zonas';

export type PeriodoFiltro = 'hoje' | '7dias' | '30dias' | 'todos';
export type StatusFiltroServico =
  | 'todos'
  | 'agendada'
  | 'em_rota'
  | 'em_andamento'
  | 'concluida'
  | 'nao_compareceu'
  | 'reagendada';

export interface ServicoAtribuido {
  id: string;
  data_agendada: string;
  hora_agendada: string | null;
  periodo: string | null;
  tipo: string;
  status: string;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  zona: string | null;
  localizacao_formatada: string;
  profissional_id: string | null;
  profissional_nome: string;
  associado_id: string | null;
  associado_nome: string | null;
  veiculo_placa: string | null;
  veiculo_descricao: string | null;
}

interface UseServicosAtribuidosOpts {
  /** profissional específico (modo instalador) */
  profissionalId?: string | null;
  /** modo administrativo: lista todos os serviços de qualquer instalador ativo */
  modo: 'profissional' | 'todos_instaladores';
  periodo: PeriodoFiltro;
  status: StatusFiltroServico;
  search: string;
  enabled?: boolean;
}

const STATUS_VALIDOS = ['agendada', 'em_rota', 'em_andamento', 'concluida', 'nao_compareceu', 'reagendada'];

export function useServicosAtribuidos(opts: UseServicosAtribuidosOpts) {
  const { profissionalId, modo, periodo, status, search, enabled = true } = opts;

  return useQuery({
    queryKey: ['servicos-atribuidos', modo, profissionalId, periodo, status, search],
    enabled: enabled && (modo === 'todos_instaladores' || !!profissionalId),
    queryFn: async (): Promise<ServicoAtribuido[]> => {
      // 1. Determinar IDs de profissionais alvo
      let profissionaisIds: string[] = [];
      const profMap: Record<string, string> = {};

      if (modo === 'profissional' && profissionalId) {
        profissionaisIds = [profissionalId];
      } else {
        // Todos com perfil operacional efetivo de rota (perfil fixo ou cobertura temporária)
        const { data: tecnicosRoles } = await supabase
          .from('user_roles')
          .select('user_id')
          .in('role', ['instalador_vistoriador', 'vistoriador_base'] as any[]);
        const userIds = Array.from(new Set((tecnicosRoles || []).map(r => r.user_id)));
        if (userIds.length === 0) return [];
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, nome, user_id')
          .in('user_id', userIds);
        const profIds = (profs || []).map(p => p.id);
        const { data: coberturas } = profIds.length
          ? await (supabase as any)
              .from('tecnico_perfil_operacional')
              .select('profissional_id, role_operacional')
              .in('profissional_id', profIds)
              .eq('ativo', true)
          : { data: [] };
        const roleFixoPorUser = new Map((tecnicosRoles || []).map((r: any) => [r.user_id, r.role]));
        const roleOperacionalPorProf = new Map((coberturas || []).map((c: any) => [c.profissional_id, c.role_operacional]));

        (profs || []).forEach(p => {
          const roleEfetivo = roleOperacionalPorProf.get(p.id) || roleFixoPorUser.get(p.user_id);
          if (roleEfetivo !== 'instalador_vistoriador') return;
          profissionaisIds.push(p.id);
          profMap[p.id] = p.nome || 'Sem nome';
        });
      }

      if (profissionaisIds.length === 0) return [];

      // 2. Filtro de período
      let dataMin: string | null = null;
      const hoje = startOfDay(new Date());
      if (periodo === 'hoje') {
        dataMin = format(hoje, 'yyyy-MM-dd');
      } else if (periodo === '7dias') {
        dataMin = format(subDays(hoje, 7), 'yyyy-MM-dd');
      } else if (periodo === '30dias') {
        dataMin = format(subDays(hoje, 30), 'yyyy-MM-dd');
      }

      // 3. Buscar serviços
      let query = supabase
        .from('servicos')
        .select('id, data_agendada, hora_agendada, periodo, tipo, status, bairro, cidade, uf, profissional_id, associado_id, veiculo_id')
        .in('profissional_id', profissionaisIds)
        .in('status', STATUS_VALIDOS as any)
        .order('data_agendada', { ascending: false })
        .order('hora_agendada', { ascending: true })
        .limit(500);

      if (periodo === 'hoje') {
        query = query.eq('data_agendada', dataMin!);
      } else if (dataMin) {
        query = query.gte('data_agendada', dataMin);
      }

      if (status !== 'todos') {
        query = query.eq('status', status as any);
      }

      const { data: servicos, error } = await query;
      if (error) throw error;
      if (!servicos?.length) return [];

      // 4. Buscar dados de associados e veículos
      const associadoIds = Array.from(new Set(servicos.map(s => s.associado_id).filter(Boolean))) as string[];
      const veiculoIds = Array.from(new Set(servicos.map(s => s.veiculo_id).filter(Boolean))) as string[];

      const [{ data: associados }, { data: veiculos }] = await Promise.all([
        associadoIds.length
          ? supabase.from('associados').select('id, nome').in('id', associadoIds)
          : Promise.resolve({ data: [] as any[] }),
        veiculoIds.length
          ? supabase.from('veiculos').select('id, placa, marca, modelo').in('id', veiculoIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const assMap: Record<string, string> = {};
      (associados || []).forEach((a: any) => { assMap[a.id] = a.nome; });
      const veicMap: Record<string, { placa: string; descricao: string }> = {};
      (veiculos || []).forEach((v: any) => {
        veicMap[v.id] = {
          placa: v.placa || '',
          descricao: [v.marca, v.modelo].filter(Boolean).join(' '),
        };
      });

      // Se profMap está vazio (modo profissional), buscar nome
      if (Object.keys(profMap).length === 0 && profissionalId) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('id, nome')
          .eq('id', profissionalId)
          .maybeSingle();
        if (prof) profMap[prof.id] = prof.nome || 'Sem nome';
      }

      // 5. Mapear
      const lista: ServicoAtribuido[] = servicos.map(s => ({
        id: s.id,
        data_agendada: s.data_agendada,
        hora_agendada: s.hora_agendada,
        periodo: s.periodo,
        tipo: s.tipo,
        status: s.status,
        bairro: s.bairro,
        cidade: s.cidade,
        uf: s.uf,
        zona: getZonaAtendimento(s.bairro, s.cidade, s.uf),
        localizacao_formatada: formatLocalizacaoComZona(s.bairro, s.cidade, s.uf),
        profissional_id: s.profissional_id,
        profissional_nome: (s.profissional_id && profMap[s.profissional_id]) || '—',
        associado_id: s.associado_id,
        associado_nome: s.associado_id ? assMap[s.associado_id] || null : null,
        veiculo_placa: s.veiculo_id ? veicMap[s.veiculo_id]?.placa || null : null,
        veiculo_descricao: s.veiculo_id ? veicMap[s.veiculo_id]?.descricao || null : null,
      }));

      // 6. Filtro de busca (client-side)
      const q = search.trim().toLowerCase();
      if (!q) return lista;
      return lista.filter(s =>
        (s.associado_nome || '').toLowerCase().includes(q) ||
        (s.veiculo_placa || '').toLowerCase().includes(q) ||
        (s.profissional_nome || '').toLowerCase().includes(q) ||
        (s.bairro || '').toLowerCase().includes(q) ||
        (s.cidade || '').toLowerCase().includes(q) ||
        (s.zona || '').toLowerCase().includes(q)
      );
    },
    staleTime: 30 * 1000,
  });
}
