import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatLocalizacaoComZona, getZonaAtendimento } from '@/lib/localizacao-zonas';

const PRODUCTION_BASE_URL = 'https://app.praticcar.org';

export function useConfigAtribuicaoManual() {
  return useQuery({
    queryKey: ['config-atribuicao-manual'],
    queryFn: async () => {
      const { data } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'atribuicao_manual_rotas')
        .maybeSingle();
      return data?.valor === 'true';
    },
    staleTime: 1000 * 60 * 2,
  });
}

export function useServicosParaAtribuir() {
  return useQuery({
    queryKey: ['servicos-para-atribuir-manual'],
    queryFn: async () => {
      const hoje = new Date().toISOString().split('T')[0];

      // Fetch regular services — apenas serviços cujo contrato foi APROVADO pelo Cadastro.
      // Defesa em profundidade: o trigger de criação já bloqueia, mas filtramos
      // aqui também para que regressões silenciosas no banco não exponham itens
      // não aprovados na fila de atribuição.
      const { data: servicos, error } = await supabase
        .from('servicos')
        .select(`
          id, tipo, data_agendada, hora_agendada, periodo, bairro, cidade, uf, logradouro, numero,
          permite_encaixe, status, contrato_id,
          associado:associados!servicos_associado_id_fkey(id, nome, telefone, whatsapp),
          veiculo:veiculos!servicos_veiculo_id_fkey(placa, marca, modelo),
          contrato:contratos!servicos_contrato_id_fkey(aprovado_em)
        `)
        .is('profissional_id', null)
        .in('status', ['pendente', 'agendada'])
        .gte('data_agendada', hoje)
        .order('data_agendada', { ascending: true })
        .order('hora_agendada', { ascending: true });

      if (error) throw error;

      // Filtra serviços sem contrato aprovado (defesa em profundidade contra
      // regressões no trigger). Serviços sem contrato vinculado são tolerados
      // (ex.: vistorias avulsas criadas manualmente).
      const servicosFiltrados = (servicos || []).filter((s: any) => {
        if (!s.contrato_id) return true;
        return !!s.contrato?.aprovado_em;
      });

      // Fetch base inspections without technician assigned
      const { data: baseItems, error: baseError } = await supabase
        .from('agendamentos_base')
        .select('id, cliente_nome, cliente_telefone, veiculo_placa, veiculo_descricao, data_agendada, horario, status, observacoes, oficina_id')
        .is('atendido_por', null)
        .in('status', ['agendado', 'pendente'])
        .gte('data_agendada', hoje)
        .order('data_agendada', { ascending: true })
        .order('horario', { ascending: true });

      if (baseError) console.error('Erro ao buscar agendamentos_base:', baseError);

      // Normalize base items to match service format
      const baseNormalized = (baseItems || []).map(b => ({
        id: b.id,
        tipo: 'vistoria_base',
        data_agendada: b.data_agendada,
        hora_agendada: b.horario,
        periodo: null,
        bairro: null,
        cidade: null,
        uf: null,
        logradouro: null,
        numero: null,
        permite_encaixe: false,
        status: b.status,
        associado: { id: null, nome: b.cliente_nome, telefone: b.cliente_telefone, whatsapp: null },
        veiculo: { placa: b.veiculo_placa, marca: null, modelo: null },
        isBase: true,
      }));

      // Merge and sort by date
      const merged = [...servicosFiltrados, ...baseNormalized].sort((a, b) => {
        const dateCompare = (a.data_agendada || '').localeCompare(b.data_agendada || '');
        if (dateCompare !== 0) return dateCompare;
        return (a.hora_agendada || '').localeCompare(b.hora_agendada || '');
      });

      return merged.map(s => ({
        ...s,
        zona: getZonaAtendimento(s.bairro, s.cidade, (s as any).uf),
        localizacaoFormatada: formatLocalizacaoComZona(s.bairro, s.cidade, (s as any).uf),
      }));
    },
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });
}

export interface TecnicoAtribuicaoManual {
  id: string;
  nome: string | null;
  avatar_url: string | null;
  telefone: string | null;
  role_permanente: string;
  role_operacional: string;
  perfilAtualLabel: 'Rota' | 'Base';
  fonteDisponibilidade: 'Online' | 'Na base' | 'Na base • App ativo';
  disponibilidadeTipo: 'rota_online' | 'base';
  appAtivo: boolean;
  latitude: number | null;
  longitude: number | null;
  ultimaAtualizacao: string | null;
  bairroAtual: string | null;
  tarefas: any[];
}

async function reverseGeocodeBairro(lat: number, lng: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=pt-BR`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'PraticConnect/1.0', 'Accept-Language': 'pt-BR' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data.address || {};
    const bairro = addr.suburb || addr.neighbourhood || addr.city_district || '';
    const cidade = addr.city || addr.town || addr.municipality || '';
    return [bairro, cidade].filter(Boolean).join(', ') || null;
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function useVistoriadoresAtivos() {
  return useQuery({
    queryKey: ['vistoriadores-ativos-manual'],
    queryFn: async () => {
      // 1) Buscar técnicos elegíveis pelo perfil cadastrado
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['instalador_vistoriador', 'vistoriador_base'] as any[]);

      if (rolesError) throw rolesError;
      if (!roles?.length) return [];

      const rolesByUserId: Record<string, Set<string>> = {};
      roles.forEach((r: any) => {
        if (!rolesByUserId[r.user_id]) rolesByUserId[r.user_id] = new Set();
        rolesByUserId[r.user_id].add(r.role as string);
      });

      const userIds = Object.keys(rolesByUserId);
      const { data: profiles, error: profErr } = await supabase
        .from('profiles')
        .select('id, user_id, nome, avatar_url, telefone, ativo')
        .in('user_id', userIds)
        .neq('ativo', false)
        .order('nome');

      if (profErr) throw profErr;
      if (!profiles?.length) return [];

      const profileIds = profiles.map(p => p.id);

      const principalRole = (set: Set<string>): string => {
        if (set.has('instalador_vistoriador')) return 'instalador_vistoriador';
        if (set.has('vistoriador_base')) return 'vistoriador_base';
        return Array.from(set)[0] || 'instalador_vistoriador';
      };

      const { data: coberturas } = await (supabase as any)
        .from('tecnico_perfil_operacional')
        .select('profissional_id, role_operacional')
        .in('profissional_id', profileIds)
        .eq('ativo', true);

      const roleOperacionalPorProf = new Map(
        (coberturas || []).map((c: any) => [c.profissional_id, c.role_operacional as string])
      );

      // 2) Buscar profissionais com turno aberto hoje
      const hojeStr = new Date().toISOString().split('T')[0];
      const { data: turnosAbertos } = await supabase
        .from('turnos_profissionais')
        .select('profissional_id')
        .eq('data', hojeStr)
        .is('fim_turno', null);

      const idsComTurnoAberto = new Set((turnosAbertos || []).map(t => t.profissional_id));

      // 3) Buscar localizações recentes (até 30 min) — rota depende do app ativo; base não depende
      const cutoff30min = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data: localizacoesRaw, error: locErr } = await supabase
        .from('vistoriadores_localizacao')
        .select('vistoriador_id, latitude, longitude, em_servico, updated_at')
        .in('vistoriador_id', profileIds)
        .gte('updated_at', cutoff30min);

      if (locErr) throw locErr;

      const localizacoesAtivas = (localizacoesRaw || []).filter(l =>
        l.em_servico || idsComTurnoAberto.has(l.vistoriador_id)
      );
      const localizacaoPorProfissional = new Map(localizacoesAtivas.map(l => [l.vistoriador_id, l]));

      const tecnicosDisponiveis = profiles
        .map(profile => {
          const rolePermanente = principalRole(rolesByUserId[profile.user_id] || new Set<string>());
          const roleOperacional = roleOperacionalPorProf.get(profile.id) || rolePermanente;
          const loc = localizacaoPorProfissional.get(profile.id);
          const appAtivo = Boolean(loc);
          const ehBase = roleOperacional === 'vistoriador_base';
          const ehRota = roleOperacional === 'instalador_vistoriador';

          if (!ehBase && !(ehRota && appAtivo)) return null;

          return {
            profile,
            loc,
            rolePermanente,
            roleOperacional,
            appAtivo,
            disponibilidadeTipo: ehBase ? 'base' : 'rota_online',
          };
        })
        .filter(Boolean) as Array<{
          profile: typeof profiles[number];
          loc: typeof localizacoesRaw[number] | undefined;
          rolePermanente: string;
          roleOperacional: string;
          appAtivo: boolean;
          disponibilidadeTipo: 'rota_online' | 'base';
        }>;

      if (!tecnicosDisponiveis.length) return [];

      const idsDisponiveis = tecnicosDisponiveis.map(t => t.profile.id);

      const hoje = new Date().toISOString().split('T')[0];
      const { data: servicosAtribuidos } = await supabase
        .from('servicos')
        .select('id, tipo, data_agendada, bairro, cidade, uf, profissional_id, status, veiculo:veiculos!servicos_veiculo_id_fkey(placa, marca, modelo)')
        .in('profissional_id', idsDisponiveis)
        .gte('data_agendada', hoje)
        .in('status', ['agendada', 'em_andamento', 'em_rota']);

      // Reverse geocode sequencialmente (1/s Nominatim policy)
      const bairroMap: Record<string, string | null> = {};
      for (const loc of localizacoesAtivas) {
        if (loc.latitude && loc.longitude) {
          bairroMap[loc.vistoriador_id] = await reverseGeocodeBairro(loc.latitude, loc.longitude);
          if (localizacoesAtivas.indexOf(loc) < localizacoesAtivas.length - 1) {
            await sleep(1100);
          }
        }
      }

      return tecnicosDisponiveis.map(({ profile: p, loc, rolePermanente, roleOperacional, appAtivo, disponibilidadeTipo }) => {
        const tarefas = (servicosAtribuidos || [])
          .filter(s => s.profissional_id === p.id)
          .map(s => ({
            ...s,
            zona: getZonaAtendimento(s.bairro, s.cidade, (s as any).uf),
            localizacaoFormatada: formatLocalizacaoComZona(s.bairro, s.cidade, (s as any).uf),
          }));
        return {
          ...p,
          role_permanente: rolePermanente,
          role_operacional: roleOperacional,
          perfilAtualLabel: roleOperacional === 'vistoriador_base' ? 'Base' : 'Rota',
          fonteDisponibilidade: roleOperacional === 'vistoriador_base'
            ? (appAtivo ? 'Na base • App ativo' : 'Na base')
            : 'Online',
          disponibilidadeTipo,
          appAtivo,
          latitude: loc?.latitude ?? null,
          longitude: loc?.longitude ?? null,
          ultimaAtualizacao: loc?.updated_at ?? null,
          bairroAtual: bairroMap[p.id] || null,
          tarefas,
        };
      }).sort((a, b) => {
        if (a.disponibilidadeTipo !== b.disponibilidadeTipo) {
          return a.disponibilidadeTipo === 'rota_online' ? -1 : 1;
        }
        return (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
      });
    },
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
    staleTime: 25000,
  });
}

async function getProfileId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();
  return profile?.id || null;
}

export function useAtribuirServicoManual() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ servicoId, profissionalId, isBase }: { servicoId: string; profissionalId: string; isBase?: boolean }) => {
      // Validação cross-cutting: se o profissional está alocado como BASE hoje,
      // só pode receber vistorias de base da MESMA oficina.
      const hojeStr = new Date().toISOString().split('T')[0];
      const { data: alocacaoHoje } = await supabase
        .from('alocacoes_diarias')
        .select('tipo_alocacao, base_id')
        .eq('profissional_id', profissionalId)
        .eq('data', hojeStr)
        .maybeSingle();

      const profEhBase = alocacaoHoje?.tipo_alocacao === 'base';
      const profBaseId = (alocacaoHoje as any)?.base_id ?? null;

      if (isBase) {
        // Buscar oficina_id do agendamento para validar pareamento
        const { data: agendData } = await supabase
          .from('agendamentos_base')
          .select('oficina_id, cliente_nome, veiculo_placa, data_agendada, horario')
          .eq('id', servicoId)
          .maybeSingle();

        if (profEhBase && profBaseId && agendData?.oficina_id && agendData.oficina_id !== profBaseId) {
          throw new Error('Este técnico está alocado em outra base. Atribua a um técnico da base correspondente.');
        }

        // Update agendamentos_base
        const { error } = await supabase
          .from('agendamentos_base')
          .update({
            atendido_por: profissionalId,
            status: 'confirmado',
          })
          .eq('id', servicoId);

        if (error) throw error;

        // Log with agendamento_base_id instead of servico_id
        const profileId = await getProfileId();
        const { error: logError } = await supabase.from('servicos_atribuicoes_log').insert({
          agendamento_base_id: servicoId,
          profissional_id: profissionalId,
          tipo_atribuicao: 'manual',
          atribuido_por: profileId,
          observacoes: 'Atribuição manual - vistoria base',
        } as any);
        if (logError) console.error('Erro ao registrar log:', logError);

        // Send WhatsApp notification to technician
        const baseData = agendData;

        const { data: profissional } = await supabase
          .from('profiles')
          .select('telefone, whatsapp, nome')
          .eq('id', profissionalId)
          .maybeSingle();

        if (profissional?.telefone || profissional?.whatsapp) {
          try {
            const telefone = (profissional.whatsapp || profissional.telefone || '').replace(/\D/g, '');
            await supabase.functions.invoke('whatsapp-send-text', {
              body: {
                telefone,
                mensagem: `Nova tarefa atribuída: Vistoria Base - ${baseData?.cliente_nome || 'Cliente'}`,
                template_name: 'servico_atribuido_v1',
                template_params: [
                  profissional.nome?.split(' ')[0] || 'Técnico',
                  'Vistoria Base',
                  `${baseData?.cliente_nome || 'Cliente'} - ${baseData?.veiculo_placa || ''} (${baseData?.data_agendada || ''} ${baseData?.horario || ''})`,
                ],
                referencia_tipo: 'agendamento_base',
                referencia_id: servicoId,
              },
            });
          } catch (e) {
            console.error('Erro ao enviar WhatsApp vistoria base:', e);
          }
        }

        return { id: servicoId, tipo: 'vistoria_base' };
      }

      // SERVIÇO DE ROTA: técnico em modo BASE não pode receber rota
      if (profEhBase) {
        throw new Error('Este técnico está alocado em base hoje e não pode receber serviços de rota.');
      }

      // Update regular servico
      const { error } = await supabase
        .from('servicos')
        .update({
          profissional_id: profissionalId,
          status: 'agendada',
        })
        .eq('id', servicoId);

      if (error) throw error;

      const profileId = await getProfileId();
      const { error: logError } = await supabase.from('servicos_atribuicoes_log').insert({
        servico_id: servicoId,
        profissional_id: profissionalId,
        tipo_atribuicao: 'manual',
        atribuido_por: profileId,
        observacoes: 'Atribuição manual pelo painel',
      });
      if (logError) console.error('Erro ao registrar log de atribuição:', logError);

      const { data: servico } = await supabase
        .from('servicos')
        .select(`
          id, tipo, data_agendada, hora_agendada, bairro, cidade, logradouro, numero,
          associado:associados!servicos_associado_id_fkey(nome, telefone),
          veiculo:veiculos!servicos_veiculo_id_fkey(placa)
        `)
        .eq('id', servicoId)
        .maybeSingle();

      const { data: profissional } = await supabase
        .from('profiles')
        .select('telefone, whatsapp, nome')
        .eq('id', profissionalId)
        .maybeSingle();

      if (profissional?.telefone || profissional?.whatsapp) {
        try {
          const telefone = (profissional.whatsapp || profissional.telefone || '').replace(/\D/g, '');
          const assocData = servico?.associado as any;
          const veicData = servico?.veiculo as any;
          const enderecoCompleto = [servico?.logradouro, servico?.numero, servico?.bairro, servico?.cidade]
            .filter(Boolean).join(', ') || 'A definir';

          await supabase.functions.invoke('whatsapp-send-text', {
            body: {
              telefone,
              mensagem: `Nova tarefa atribuída: ${servico?.tipo || 'Serviço'} - ${assocData?.nome || 'Cliente'}`,
              template_name: 'servico_atribuido_v1',
              template_params: [
                profissional.nome?.split(' ')[0] || 'Técnico',
                servico?.tipo || 'Serviço',
                `${assocData?.nome || 'Cliente'} - ${veicData?.placa || ''} | ${enderecoCompleto} | ${servico?.data_agendada || ''} ${servico?.hora_agendada || ''}`,
              ],
              referencia_tipo: 'servico',
              referencia_id: servicoId,
            },
          });
        } catch (e) {
          console.error('Erro ao enviar template WhatsApp:', e);
        }
      }

      return servico;
    },
    onSuccess: () => {
      toast.success('Serviço atribuído com sucesso');
      qc.invalidateQueries({ queryKey: ['servicos-para-atribuir-manual'] });
      qc.invalidateQueries({ queryKey: ['vistoriadores-ativos-manual'] });
      qc.invalidateQueries({ queryKey: ['vistorias-mapa'] });
      qc.invalidateQueries({ queryKey: ['vistoriadores-localizacao-realtime'] });
      qc.invalidateQueries({ queryKey: ['calendario-dia-base'] });
      qc.invalidateQueries({ queryKey: ['tarefa-atual-servico'] });
      // Hook principal usado pelo app do técnico (/instalador) para mostrar a tarefa
      qc.invalidateQueries({ queryKey: ['tarefa-atual'] });
      qc.invalidateQueries({ queryKey: ['servicos'] });
    },
    onError: (err: any) => {
      toast.error('Erro ao atribuir serviço: ' + (err.message || ''));
    },
  });
}

export interface AtribuirPrestadorParams {
  servicoId: string;
  prestadorId: string;
  prestadorNome: string;
  prestadorTelefone?: string | null;
  valor: number;
}

export interface AtribuirPrestadorResult {
  token: string;
  url: string;
  prestadorNome: string;
  prestadorTelefone?: string | null;
}

export function useAtribuirServicoPrestador() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: AtribuirPrestadorParams): Promise<AtribuirPrestadorResult> => {
      const { servicoId, prestadorId, valor } = params;

      // 1) Determine type: check if it's an instalação or vistoria service
      const { data: servico, error: sErr } = await supabase
        .from('servicos')
        .select('id, tipo, instalacao_origem_id, vistoria_origem_id, associado_id, veiculo_id, contrato_id, cotacao_id')
        .eq('id', servicoId)
        .maybeSingle();

      if (sErr || !servico) throw new Error('Serviço não encontrado');

      const profileId = await getProfileId();
      let result: any;

      const isInstalacao = servico.tipo === 'instalacao';

      if (isInstalacao) {
        // Get instalacao_id
        let instalacaoId = servico.instalacao_origem_id;
        if (!instalacaoId) {
          // Try finding via associado + veiculo
          const { data: inst } = await supabase
            .from('instalacoes')
            .select('id')
            .eq('associado_id', servico.associado_id)
            .eq('veiculo_id', servico.veiculo_id)
            .in('status', ['agendada', 'em_andamento'] as any[])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          instalacaoId = inst?.id;
        }

        if (!instalacaoId) throw new Error('Instalação não encontrada para este serviço');

        const { data, error } = await supabase.functions.invoke('gerar-link-prestador', {
          body: {
            instalacao_id: instalacaoId,
            vistoriador_prestador_id: prestadorId,
            valor,
            atribuido_por: profileId,
            skip_whatsapp: true,
          },
        });

        if (error) throw new Error(error.message || 'Erro ao gerar link do prestador');
        if (!data?.success) throw new Error(data?.error || 'Erro ao gerar link');
        result = data;
      } else {
        // Vistoria type - find instalacao_id via vistoria
        let instalacaoId: string | null = null;

        if (servico.vistoria_origem_id) {
          const { data: vist } = await supabase
            .from('vistorias')
            .select('instalacao_id')
            .eq('id', servico.vistoria_origem_id)
            .maybeSingle();
          instalacaoId = vist?.instalacao_id || null;
        }

        if (!instalacaoId) {
          // Fallback: find active instalação for same associado+veiculo
          const { data: inst } = await supabase
            .from('instalacoes')
            .select('id')
            .eq('associado_id', servico.associado_id)
            .eq('veiculo_id', servico.veiculo_id)
            .in('status', ['agendada', 'em_andamento'] as any[])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          instalacaoId = inst?.id;
        }

        if (!instalacaoId) throw new Error('Instalação de origem não encontrada para vistoria');

        const { data, error } = await supabase.functions.invoke('gerar-link-vistoriador-prestador', {
          body: {
            instalacao_id: instalacaoId,
            vistoriador_prestador_id: prestadorId,
            valor,
            atribuido_por: profileId,
            skip_whatsapp: true,
          },
        });

        if (error) throw new Error(error.message || 'Erro ao gerar link do prestador');
        if (!data?.success) throw new Error(data?.error || 'Erro ao gerar link');
        result = data;
      }

      // Log assignment
      try {
        await supabase.from('servicos_atribuicoes_log').insert({
          servico_id: servicoId,
          profissional_id: prestadorId,
          tipo_atribuicao: 'manual_prestador',
          atribuido_por: profileId,
          observacoes: `Atribuição a prestador externo ${params.prestadorNome} — Valor: R$ ${valor.toFixed(2)} — Link gerado (sem WhatsApp automático)`,
        } as any);
      } catch (logErr) {
        console.error('Erro ao registrar log de atribuição prestador:', logErr);
      }

      return {
        token: result.token,
        url: result.url,
        prestadorNome: params.prestadorNome,
        prestadorTelefone: params.prestadorTelefone,
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['servicos-para-atribuir-manual'] });
      qc.invalidateQueries({ queryKey: ['vistoriadores-ativos-manual'] });
      qc.invalidateQueries({ queryKey: ['vistorias-mapa'] });
      qc.invalidateQueries({ queryKey: ['servicos'] });
    },
    onError: (err: any) => {
      toast.error('Erro ao atribuir a prestador: ' + (err.message || ''));
    },
  });
}
