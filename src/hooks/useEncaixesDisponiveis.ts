import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface EncaixeDisponivel {
  id: string;
  tipo: 'instalacao' | 'vistoria' | 'vistoria_evento';
  tipo_vistoria?: string | null;
  cliente_nome: string;
  cliente_telefone: string | null;
  endereco_logradouro: string | null;
  endereco_numero: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  endereco_cep: string | null;
  data_agendada: string;
  periodo: string | null;
  placa: string | null;
  marca: string | null;
  modelo: string | null;
  distancia_km: number;
  latitude: number | null;
  longitude: number | null;
  // Novos campos para profissional atribuído
  profissional_atribuido_id?: string | null;
  profissional_atribuido_nome?: string | null;
  isAdiantamento?: boolean;
  sinistro_protocolo?: string | null;
}

interface UltimaLocalizacao {
  latitude: number;
  longitude: number;
}

// Fórmula de Haversine para calcular distância entre dois pontos
function calcularDistanciaKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helper: buscar vistorias_evento com permite_encaixe e mapear para EncaixeDisponivel
async function fetchVistoriasEventoEncaixe(filtros: {
  reguladorId?: string | null;
  semRegulador?: boolean;
  comRegulador?: boolean;
  hoje: string;
  ultimaLocalizacao?: UltimaLocalizacao | null;
  raioKm?: number;
}): Promise<EncaixeDisponivel[]> {
  let query = supabase
    .from('vistorias_evento')
    .select(`
      id,
      data_agendada,
      horario_agendado,
      endereco_rua,
      endereco_numero,
      endereco_bairro,
      endereco_cidade,
      endereco_latitude,
      endereco_longitude,
      regulador_id,
      sinistro:sinistros(protocolo, associado:associados(nome, telefone), veiculo:veiculos(placa, marca, modelo))
    `)
    .eq('permite_encaixe', true)
    .gte('data_agendada', filtros.hoje)
    .eq('status', 'agendada');

  if (filtros.semRegulador) {
    query = query.is('regulador_id', null);
  }
  if (filtros.reguladorId) {
    query = query.eq('regulador_id', filtros.reguladorId);
  }

  const { data: vistoriasEvento } = await query;

  const resultado: EncaixeDisponivel[] = [];

  vistoriasEvento?.forEach((ve: any) => {
    const lat = ve.endereco_latitude;
    const lng = ve.endereco_longitude;

    let distancia = 0;
    if (filtros.ultimaLocalizacao && lat && lng) {
      distancia = calcularDistanciaKm(
        filtros.ultimaLocalizacao.latitude,
        filtros.ultimaLocalizacao.longitude,
        lat, lng
      );
      if (filtros.raioKm && distancia > filtros.raioKm) return;
    } else if (filtros.raioKm) {
      // Se precisa de raio mas não tem coordenadas, pular
      if (!lat || !lng) return;
    }

    const sinistro = ve.sinistro;
    const associado = sinistro?.associado;
    const veiculo = sinistro?.veiculo;

    resultado.push({
      id: ve.id,
      tipo: 'vistoria_evento',
      tipo_vistoria: 'evento',
      cliente_nome: associado?.nome || 'Não informado',
      cliente_telefone: associado?.telefone || null,
      endereco_logradouro: ve.endereco_rua,
      endereco_numero: ve.endereco_numero,
      endereco_bairro: ve.endereco_bairro,
      endereco_cidade: ve.endereco_cidade,
      endereco_cep: null,
      data_agendada: ve.data_agendada,
      periodo: ve.horario_agendado ? ve.horario_agendado.substring(0, 5) : null,
      placa: veiculo?.placa || null,
      marca: veiculo?.marca || null,
      modelo: veiculo?.modelo || null,
      distancia_km: Math.round(distancia * 10) / 10,
      latitude: lat,
      longitude: lng,
      profissional_atribuido_id: ve.regulador_id || null,
      profissional_atribuido_nome: null,
      sinistro_protocolo: sinistro?.protocolo || null,
      isAdiantamento: !!filtros.reguladorId,
    });
  });

  return resultado;
}

// Hook para buscar configurações de encaixe
export function useConfiguracoesEncaixe() {
  return useQuery({
    queryKey: ['configuracoes-encaixe'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', ['operacional_encaixe_raio_km', 'operacional_encaixe_janela_horas', 'operacional_encaixe_ativo']);

      if (error) {
        console.warn('[useConfiguracoesEncaixe] Erro:', error);
        return { raioKm: 10, janelaHoras: 2, ativo: true };
      }

      const config = { raioKm: 10, janelaHoras: 2, ativo: true };
      data?.forEach((item) => {
        if (item.chave === 'operacional_encaixe_raio_km') {
          config.raioKm = Number(item.valor) || 10;
        }
        if (item.chave === 'operacional_encaixe_janela_horas') {
          config.janelaHoras = Number(item.valor) || 2;
        }
        if (item.chave === 'operacional_encaixe_ativo') {
          config.ativo = item.valor !== 'false';
        }
      });

      return config;
    },
    staleTime: 1000 * 60 * 5,
  });
}

// Hook para atualizar configurações de encaixe
export function useAtualizarConfiguracoesEncaixe() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ chave, valor }: { chave: string; valor: string }) => {
      const { error } = await supabase
        .from('configuracoes')
        .update({
          valor,
          updated_at: new Date().toISOString(),
          updated_by: profile?.id,
        })
        .eq('chave', chave);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracoes-encaixe'] });
      toast.success('Configuração atualizada');
    },
    onError: (error) => {
      console.error('[useAtualizarConfiguracoesEncaixe] Erro:', error);
      toast.error('Erro ao atualizar configuração');
    },
  });
}

// Hook para verificar se o vistoriador tem tarefas nas próximas X horas
export function useTemTarefasProximas(vistoriadorId: string | undefined, horasAdiante: number = 2) {
  return useQuery({
    queryKey: ['tarefas-proximas', vistoriadorId, horasAdiante],
    queryFn: async () => {
      if (!vistoriadorId) return true;

      const agora = new Date();
      const limite = new Date(agora.getTime() + horasAdiante * 60 * 60 * 1000);
      const hojeStr = agora.toISOString().split('T')[0];
      const limiteStr = limite.toISOString().split('T')[0];

      // Buscar instalações agendadas
      const { data: instalacoes } = await supabase
        .from('instalacoes')
        .select('id')
        .eq('instalador_responsavel_id', vistoriadorId)
        .in('status', ['agendada', 'em_rota'])
        .gte('data_agendada', hojeStr)
        .lte('data_agendada', limiteStr);

      // Buscar vistorias agendadas
      const { data: vistorias } = await supabase
        .from('vistorias')
        .select('id')
        .eq('vistoriador_id', vistoriadorId)
        .eq('status', 'agendada')
        .gte('data_agendada', hojeStr)
        .lte('data_agendada', limiteStr);

      // Buscar vistorias de evento agendadas
      const { data: vistoriasEvento } = await supabase
        .from('vistorias_evento')
        .select('id')
        .eq('regulador_id', vistoriadorId)
        .eq('status', 'agendada')
        .gte('data_agendada', hojeStr)
        .lte('data_agendada', limiteStr);

      const totalTarefas = (instalacoes?.length || 0) + (vistorias?.length || 0) + (vistoriasEvento?.length || 0);
      return totalTarefas > 0;
    },
    enabled: !!vistoriadorId,
    staleTime: 1000 * 60 * 2,
  });
}

// Hook para buscar última localização do vistoriador
export function useUltimaLocalizacao(vistoriadorId: string | undefined) {
  return useQuery({
    queryKey: ['ultima-localizacao', vistoriadorId],
    queryFn: async (): Promise<UltimaLocalizacao | null> => {
      if (!vistoriadorId) return null;

      const { data: ultimaInstalacao } = await supabase
        .from('instalacoes')
        .select('endereco_latitude, endereco_longitude, updated_at')
        .eq('instalador_responsavel_id', vistoriadorId)
        .eq('status', 'concluida')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      const { data: ultimaVistoria } = await supabase
        .from('vistorias')
        .select('endereco_latitude, endereco_longitude, updated_at')
        .eq('vistoriador_id', vistoriadorId)
        .eq('status', 'aprovada')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      const instalacaoData = ultimaInstalacao?.updated_at ? new Date(ultimaInstalacao.updated_at) : new Date(0);
      const vistoriaData = ultimaVistoria?.updated_at ? new Date(ultimaVistoria.updated_at) : new Date(0);

      if (instalacaoData > vistoriaData && ultimaInstalacao?.endereco_latitude && ultimaInstalacao?.endereco_longitude) {
        return {
          latitude: ultimaInstalacao.endereco_latitude,
          longitude: ultimaInstalacao.endereco_longitude,
        };
      }

      if (ultimaVistoria?.endereco_latitude && ultimaVistoria?.endereco_longitude) {
        return {
          latitude: ultimaVistoria.endereco_latitude,
          longitude: ultimaVistoria.endereco_longitude,
        };
      }

      return null;
    },
    enabled: !!vistoriadorId,
    staleTime: 1000 * 60 * 5,
  });
}

// Hook principal para buscar encaixes disponíveis (para profissional)
export function useEncaixesDisponiveis() {
  const { profile } = useAuth();
  const { data: config } = useConfiguracoesEncaixe();
  const { data: temTarefas, isLoading: loadingTarefas } = useTemTarefasProximas(profile?.id, config?.janelaHoras);
  const { data: ultimaLocalizacao, isLoading: loadingLocalizacao } = useUltimaLocalizacao(profile?.id);

  // Encaixes disponíveis (sem atribuição)
  const encaixesDisponiveisQuery = useQuery({
    queryKey: ['encaixes-disponiveis', profile?.id, config?.raioKm, ultimaLocalizacao],
    queryFn: async (): Promise<EncaixeDisponivel[]> => {
      if (!ultimaLocalizacao || !config) return [];
      // Se encaixe está desativado, retorna lista vazia
      if (!config.ativo) return [];

      const encaixes: EncaixeDisponivel[] = [];
      const hoje = new Date().toISOString().split('T')[0];

      // Buscar instalações com permite_encaixe e SEM profissional
      const { data: instalacoes } = await supabase
        .from('instalacoes')
        .select(`
          id, data_agendada, periodo,
          endereco_logradouro, endereco_numero, endereco_bairro, endereco_cidade, endereco_cep,
          endereco_latitude, endereco_longitude,
          associado:associados(nome, telefone),
          veiculo:veiculos(placa, marca, modelo)
        `)
        .eq('permite_encaixe', true)
        .is('instalador_responsavel_id', null)
        .gte('data_agendada', hoje)
        .eq('status', 'agendada');

      instalacoes?.forEach((inst: any) => {
        if (inst.endereco_latitude && inst.endereco_longitude) {
          const distancia = calcularDistanciaKm(
            ultimaLocalizacao.latitude, ultimaLocalizacao.longitude,
            inst.endereco_latitude, inst.endereco_longitude
          );
          if (distancia <= config.raioKm) {
            encaixes.push({
              id: inst.id, tipo: 'instalacao',
              cliente_nome: inst.associado?.nome || 'Não informado',
              cliente_telefone: inst.associado?.telefone,
              endereco_logradouro: inst.endereco_logradouro, endereco_numero: inst.endereco_numero,
              endereco_bairro: inst.endereco_bairro, endereco_cidade: inst.endereco_cidade,
              endereco_cep: inst.endereco_cep,
              data_agendada: inst.data_agendada, periodo: inst.periodo,
              placa: inst.veiculo?.placa, marca: inst.veiculo?.marca, modelo: inst.veiculo?.modelo,
              distancia_km: Math.round(distancia * 10) / 10,
              latitude: inst.endereco_latitude, longitude: inst.endereco_longitude,
              isAdiantamento: false,
            });
          }
        }
      });

      // Buscar vistorias com permite_encaixe e SEM profissional
      const { data: vistorias } = await supabase
        .from('vistorias')
        .select(`
          id, tipo, data_agendada, periodo,
          endereco_logradouro, endereco_numero, endereco_bairro, endereco_cidade, endereco_cep,
          endereco_latitude, endereco_longitude,
          associado:associados(nome, telefone),
          veiculo:veiculos(placa, marca, modelo)
        `)
        .eq('permite_encaixe', true)
        .is('vistoriador_id', null)
        .gte('data_agendada', hoje)
        .eq('status', 'agendada');

      vistorias?.forEach((vist: any) => {
        if (vist.endereco_latitude && vist.endereco_longitude) {
          const distancia = calcularDistanciaKm(
            ultimaLocalizacao.latitude, ultimaLocalizacao.longitude,
            vist.endereco_latitude, vist.endereco_longitude
          );
          if (distancia <= config.raioKm) {
            encaixes.push({
              id: vist.id, tipo: 'vistoria', tipo_vistoria: vist.tipo,
              cliente_nome: vist.associado?.nome || 'Não informado',
              cliente_telefone: vist.associado?.telefone,
              endereco_logradouro: vist.endereco_logradouro, endereco_numero: vist.endereco_numero,
              endereco_bairro: vist.endereco_bairro, endereco_cidade: vist.endereco_cidade,
              endereco_cep: vist.endereco_cep,
              data_agendada: vist.data_agendada, periodo: vist.periodo,
              placa: vist.veiculo?.placa, marca: vist.veiculo?.marca, modelo: vist.veiculo?.modelo,
              distancia_km: Math.round(distancia * 10) / 10,
              latitude: vist.endereco_latitude, longitude: vist.endereco_longitude,
              isAdiantamento: false,
            });
          }
        }
      });

      // Buscar vistorias de evento com permite_encaixe e SEM regulador
      const vistoriasEvento = await fetchVistoriasEventoEncaixe({
        semRegulador: true,
        hoje,
        ultimaLocalizacao,
        raioKm: config.raioKm,
      });
      encaixes.push(...vistoriasEvento);

      return encaixes.sort((a, b) => a.distancia_km - b.distancia_km);
    },
    enabled: !loadingTarefas && !loadingLocalizacao && !temTarefas && !!ultimaLocalizacao,
    staleTime: 1000 * 60 * 2,
  });

  // Tarefas PRÓPRIAS com permite_encaixe (para adiantamento)
  const adiantamentosQuery = useQuery({
    queryKey: ['adiantamentos-proprios', profile?.id],
    queryFn: async (): Promise<EncaixeDisponivel[]> => {
      if (!profile?.id) return [];

      const adiantamentos: EncaixeDisponivel[] = [];
      const hoje = new Date().toISOString().split('T')[0];

      // Instalações PRÓPRIAS
      const { data: instalacoesProprias } = await supabase
        .from('instalacoes')
        .select(`
          id, data_agendada, periodo,
          endereco_logradouro, endereco_numero, endereco_bairro, endereco_cidade, endereco_cep,
          endereco_latitude, endereco_longitude,
          associado:associados(nome, telefone),
          veiculo:veiculos(placa, marca, modelo)
        `)
        .eq('permite_encaixe', true)
        .eq('instalador_responsavel_id', profile.id)
        .gte('data_agendada', hoje)
        .eq('status', 'agendada');

      instalacoesProprias?.forEach((inst: any) => {
        adiantamentos.push({
          id: inst.id, tipo: 'instalacao',
          cliente_nome: inst.associado?.nome || 'Não informado',
          cliente_telefone: inst.associado?.telefone,
          endereco_logradouro: inst.endereco_logradouro, endereco_numero: inst.endereco_numero,
          endereco_bairro: inst.endereco_bairro, endereco_cidade: inst.endereco_cidade,
          endereco_cep: inst.endereco_cep,
          data_agendada: inst.data_agendada, periodo: inst.periodo,
          placa: inst.veiculo?.placa, marca: inst.veiculo?.marca, modelo: inst.veiculo?.modelo,
          distancia_km: 0, latitude: inst.endereco_latitude, longitude: inst.endereco_longitude,
          isAdiantamento: true,
        });
      });

      // Vistorias PRÓPRIAS
      const { data: vistoriasProprias } = await supabase
        .from('vistorias')
        .select(`
          id, tipo, data_agendada, periodo,
          endereco_logradouro, endereco_numero, endereco_bairro, endereco_cidade, endereco_cep,
          endereco_latitude, endereco_longitude,
          associado:associados(nome, telefone),
          veiculo:veiculos(placa, marca, modelo)
        `)
        .eq('permite_encaixe', true)
        .eq('vistoriador_id', profile.id)
        .gte('data_agendada', hoje)
        .eq('status', 'agendada');

      vistoriasProprias?.forEach((vist: any) => {
        adiantamentos.push({
          id: vist.id, tipo: 'vistoria', tipo_vistoria: vist.tipo,
          cliente_nome: vist.associado?.nome || 'Não informado',
          cliente_telefone: vist.associado?.telefone,
          endereco_logradouro: vist.endereco_logradouro, endereco_numero: vist.endereco_numero,
          endereco_bairro: vist.endereco_bairro, endereco_cidade: vist.endereco_cidade,
          endereco_cep: vist.endereco_cep,
          data_agendada: vist.data_agendada, periodo: vist.periodo,
          placa: vist.veiculo?.placa, marca: vist.veiculo?.marca, modelo: vist.veiculo?.modelo,
          distancia_km: 0, latitude: vist.endereco_latitude, longitude: vist.endereco_longitude,
          isAdiantamento: true,
        });
      });

      // Vistorias de evento PRÓPRIAS
      const vistoriasEventoProprias = await fetchVistoriasEventoEncaixe({
        reguladorId: profile.id,
        hoje,
      });
      adiantamentos.push(...vistoriasEventoProprias);

      return adiantamentos.sort((a, b) =>
        new Date(a.data_agendada).getTime() - new Date(b.data_agendada).getTime()
      );
    },
    enabled: !!profile?.id,
    staleTime: 1000 * 60 * 2,
  });

  return {
    encaixes: encaixesDisponiveisQuery.data || [],
    adiantamentos: adiantamentosQuery.data || [],
    isLoading: loadingTarefas || loadingLocalizacao || encaixesDisponiveisQuery.isLoading || adiantamentosQuery.isLoading,
    temTarefasProximas: temTarefas,
    ultimaLocalizacao,
    config,
    podeVerEncaixes: !temTarefas && !!ultimaLocalizacao,
  };
}

// Hook para buscar TODOS os encaixes (para coordenador)
export function useTodosEncaixes() {
  return useQuery({
    queryKey: ['todos-encaixes'],
    queryFn: async (): Promise<EncaixeDisponivel[]> => {
      const encaixes: EncaixeDisponivel[] = [];
      const hoje = new Date().toISOString().split('T')[0];

      // Instalações com permite_encaixe
      const { data: instalacoes } = await supabase
        .from('instalacoes')
        .select(`
          id, data_agendada, periodo,
          logradouro, numero, bairro, cidade, cep,
          endereco_latitude, endereco_longitude,
          instalador_responsavel_id,
          associado:associados(nome, telefone),
          veiculo:veiculos(placa, marca, modelo),
          profissional:profiles!instalador_responsavel_id(id, nome)
        `)
        .eq('permite_encaixe', true)
        .gte('data_agendada', hoje)
        .eq('status', 'agendada')
        .order('data_agendada', { ascending: true });

      instalacoes?.forEach((inst: any) => {
        encaixes.push({
          id: inst.id, tipo: 'instalacao',
          cliente_nome: inst.associado?.nome || 'Não informado',
          cliente_telefone: inst.associado?.telefone,
          endereco_logradouro: inst.logradouro, endereco_numero: inst.numero,
          endereco_bairro: inst.bairro, endereco_cidade: inst.cidade,
          endereco_cep: inst.cep,
          data_agendada: inst.data_agendada, periodo: inst.periodo,
          placa: inst.veiculo?.placa, marca: inst.veiculo?.marca, modelo: inst.veiculo?.modelo,
          distancia_km: 0, latitude: inst.endereco_latitude, longitude: inst.endereco_longitude,
          profissional_atribuido_id: inst.instalador_responsavel_id,
          profissional_atribuido_nome: inst.profissional?.nome || null,
        });
      });

      // Vistorias com permite_encaixe
      const { data: vistorias } = await supabase
        .from('vistorias')
        .select(`
          id, tipo, data_agendada, periodo,
          endereco_logradouro, endereco_numero, endereco_bairro, endereco_cidade, endereco_cep,
          endereco_latitude, endereco_longitude,
          vistoriador_id,
          associado:associados(nome, telefone),
          veiculo:veiculos(placa, marca, modelo),
          profissional:profiles!vistoriador_id(id, nome)
        `)
        .eq('permite_encaixe', true)
        .gte('data_agendada', hoje)
        .eq('status', 'agendada')
        .order('data_agendada', { ascending: true });

      vistorias?.forEach((vist: any) => {
        encaixes.push({
          id: vist.id, tipo: 'vistoria', tipo_vistoria: vist.tipo,
          cliente_nome: vist.associado?.nome || 'Não informado',
          cliente_telefone: vist.associado?.telefone,
          endereco_logradouro: vist.endereco_logradouro, endereco_numero: vist.endereco_numero,
          endereco_bairro: vist.endereco_bairro, endereco_cidade: vist.endereco_cidade,
          endereco_cep: vist.endereco_cep,
          data_agendada: vist.data_agendada, periodo: vist.periodo,
          placa: vist.veiculo?.placa, marca: vist.veiculo?.marca, modelo: vist.veiculo?.modelo,
          distancia_km: 0, latitude: vist.endereco_latitude, longitude: vist.endereco_longitude,
          profissional_atribuido_id: vist.vistoriador_id,
          profissional_atribuido_nome: vist.profissional?.nome || null,
        });
      });

      // Vistorias de evento com permite_encaixe
      const vistoriasEvento = await fetchVistoriasEventoEncaixe({ hoje });
      encaixes.push(...vistoriasEvento);

      return encaixes.sort((a, b) =>
        new Date(a.data_agendada).getTime() - new Date(b.data_agendada).getTime()
      );
    },
    staleTime: 1000 * 60 * 2,
  });
}

// Hook para assumir um encaixe (para o próprio profissional)
export function usePuxarEncaixe() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({
      id,
      tipo,
      isAdiantamento
    }: {
      id: string;
      tipo: 'instalacao' | 'vistoria' | 'vistoria_evento';
      isAdiantamento?: boolean;
    }) => {
      if (!profile?.id) throw new Error('Usuário não autenticado');

      const hoje = new Date().toISOString().split('T')[0];

      if (isAdiantamento) {
        if (tipo === 'instalacao') {
          const { error } = await supabase
            .from('instalacoes')
            .update({ data_agendada: hoje, permite_encaixe: false })
            .eq('id', id);
          if (error) throw error;
        } else if (tipo === 'vistoria') {
          const { error } = await supabase
            .from('vistorias')
            .update({ data_agendada: hoje, permite_encaixe: false })
            .eq('id', id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('vistorias_evento')
            .update({ data_agendada: hoje, permite_encaixe: false })
            .eq('id', id);
          if (error) throw error;
        }
      } else {
        if (tipo === 'instalacao') {
          const { error } = await supabase
            .from('instalacoes')
            .update({ instalador_responsavel_id: profile.id, permite_encaixe: false })
            .eq('id', id);
          if (error) throw error;
        } else if (tipo === 'vistoria') {
          const { error } = await supabase
            .from('vistorias')
            .update({ vistoriador_id: profile.id, permite_encaixe: false })
            .eq('id', id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('vistorias_evento')
            .update({ regulador_id: profile.id, permite_encaixe: false })
            .eq('id', id);
          if (error) throw error;
        }
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['encaixes-disponiveis'] });
      queryClient.invalidateQueries({ queryKey: ['adiantamentos-proprios'] });
      queryClient.invalidateQueries({ queryKey: ['tarefas-proximas'] });

      if (variables.isAdiantamento) {
        toast.success('Tarefa adiantada para hoje!');
      } else {
        const labels = { instalacao: 'Instalação', vistoria: 'Vistoria', vistoria_evento: 'Vistoria de Evento' };
        toast.success(`${labels[variables.tipo]} assumida com sucesso!`);
      }
    },
    onError: (error) => {
      console.error('[usePuxarEncaixe] Erro:', error);
      toast.error('Erro ao processar o serviço');
    },
  });
}

// Hook para atribuir encaixe a qualquer profissional (para coordenador)
export function useAtribuirEncaixe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      tipo,
      profissionalId
    }: {
      id: string;
      tipo: 'instalacao' | 'vistoria' | 'vistoria_evento';
      profissionalId: string;
    }) => {
      if (tipo === 'instalacao') {
        const { error } = await supabase
          .from('instalacoes')
          .update({ instalador_responsavel_id: profissionalId, permite_encaixe: false })
          .eq('id', id);
        if (error) throw error;
      } else if (tipo === 'vistoria') {
        const { error } = await supabase
          .from('vistorias')
          .update({ vistoriador_id: profissionalId, permite_encaixe: false })
          .eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('vistorias_evento')
          .update({ regulador_id: profissionalId, permite_encaixe: false })
          .eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['todos-encaixes'] });
      queryClient.invalidateQueries({ queryKey: ['encaixes-disponiveis'] });
      queryClient.invalidateQueries({ queryKey: ['adiantamentos-proprios'] });
      const labels = { instalacao: 'Instalação', vistoria: 'Vistoria', vistoria_evento: 'Vistoria de Evento' };
      toast.success(`${labels[variables.tipo]} atribuída com sucesso!`);
    },
    onError: (error) => {
      console.error('[useAtribuirEncaixe] Erro:', error);
      toast.error('Erro ao atribuir o serviço');
    },
  });
}
