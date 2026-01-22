import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface EncaixeDisponivel {
  id: string;
  tipo: 'instalacao' | 'vistoria';
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
  const R = 6371; // Raio da Terra em km
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

// Hook para buscar configurações de encaixe
export function useConfiguracoesEncaixe() {
  return useQuery({
    queryKey: ['configuracoes-encaixe'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', ['operacional_encaixe_raio_km', 'operacional_encaixe_janela_horas']);

      if (error) {
        console.warn('[useConfiguracoesEncaixe] Erro:', error);
        return { raioKm: 10, janelaHoras: 2 };
      }

      const config = { raioKm: 10, janelaHoras: 2 };
      data?.forEach((item) => {
        if (item.chave === 'operacional_encaixe_raio_km') {
          config.raioKm = Number(item.valor) || 10;
        }
        if (item.chave === 'operacional_encaixe_janela_horas') {
          config.janelaHoras = Number(item.valor) || 2;
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
      if (!vistoriadorId) return true; // Se não tem ID, considera como ocupado

      const agora = new Date();
      const limite = new Date(agora.getTime() + horasAdiante * 60 * 60 * 1000);

      // Buscar instalações agendadas
      const { data: instalacoes } = await supabase
        .from('instalacoes')
        .select('id')
        .eq('instalador_responsavel_id', vistoriadorId)
        .in('status', ['agendada', 'em_rota'])
        .gte('data_agendada', agora.toISOString().split('T')[0])
        .lte('data_agendada', limite.toISOString().split('T')[0]);

      // Buscar vistorias agendadas
      const { data: vistorias } = await supabase
        .from('vistorias')
        .select('id')
        .eq('vistoriador_id', vistoriadorId)
        .eq('status', 'agendada')
        .gte('data_agendada', agora.toISOString().split('T')[0])
        .lte('data_agendada', limite.toISOString().split('T')[0]);

      const totalTarefas = (instalacoes?.length || 0) + (vistorias?.length || 0);
      return totalTarefas > 0;
    },
    enabled: !!vistoriadorId,
    staleTime: 1000 * 60 * 2,
  });
}

// Hook para buscar última localização do vistoriador (última vistoria/instalação concluída)
export function useUltimaLocalizacao(vistoriadorId: string | undefined) {
  return useQuery({
    queryKey: ['ultima-localizacao', vistoriadorId],
    queryFn: async (): Promise<UltimaLocalizacao | null> => {
      if (!vistoriadorId) return null;

      // Buscar última instalação concluída
      const { data: ultimaInstalacao } = await supabase
        .from('instalacoes')
        .select('endereco_latitude, endereco_longitude, updated_at')
        .eq('instalador_responsavel_id', vistoriadorId)
        .eq('status', 'concluida')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      // Buscar última vistoria concluída
      const { data: ultimaVistoria } = await supabase
        .from('vistorias')
        .select('endereco_latitude, endereco_longitude, updated_at')
        .eq('vistoriador_id', vistoriadorId)
        .eq('status', 'aprovada')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      // Retornar a mais recente
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

// Hook principal para buscar encaixes disponíveis
export function useEncaixesDisponiveis() {
  const { profile } = useAuth();
  const { data: config } = useConfiguracoesEncaixe();
  const { data: temTarefas, isLoading: loadingTarefas } = useTemTarefasProximas(profile?.id, config?.janelaHoras);
  const { data: ultimaLocalizacao, isLoading: loadingLocalizacao } = useUltimaLocalizacao(profile?.id);

  const queryEnabled = !loadingTarefas && !loadingLocalizacao && !temTarefas && !!ultimaLocalizacao;

  const encaixesQuery = useQuery({
    queryKey: ['encaixes-disponiveis', profile?.id, config?.raioKm, ultimaLocalizacao],
    queryFn: async (): Promise<EncaixeDisponivel[]> => {
      if (!ultimaLocalizacao || !config) return [];

      const encaixes: EncaixeDisponivel[] = [];
      const hoje = new Date().toISOString().split('T')[0];

      // Buscar instalações com permite_encaixe e sem vistoriador
      const { data: instalacoes } = await supabase
        .from('instalacoes')
        .select(`
          id,
          data_agendada,
          periodo,
          endereco_logradouro,
          endereco_numero,
          endereco_bairro,
          endereco_cidade,
          endereco_cep,
          endereco_latitude,
          endereco_longitude,
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
            ultimaLocalizacao.latitude,
            ultimaLocalizacao.longitude,
            inst.endereco_latitude,
            inst.endereco_longitude
          );

          if (distancia <= config.raioKm) {
            encaixes.push({
              id: inst.id,
              tipo: 'instalacao',
              cliente_nome: inst.associado?.nome || 'Não informado',
              cliente_telefone: inst.associado?.telefone,
              endereco_logradouro: inst.endereco_logradouro,
              endereco_numero: inst.endereco_numero,
              endereco_bairro: inst.endereco_bairro,
              endereco_cidade: inst.endereco_cidade,
              endereco_cep: inst.endereco_cep,
              data_agendada: inst.data_agendada,
              periodo: inst.periodo,
              placa: inst.veiculo?.placa,
              marca: inst.veiculo?.marca,
              modelo: inst.veiculo?.modelo,
              distancia_km: Math.round(distancia * 10) / 10,
              latitude: inst.endereco_latitude,
              longitude: inst.endereco_longitude,
            });
          }
        }
      });

      // Buscar vistorias com permite_encaixe e sem vistoriador
      const { data: vistorias } = await supabase
        .from('vistorias')
        .select(`
          id,
          tipo,
          data_agendada,
          periodo,
          endereco_logradouro,
          endereco_numero,
          endereco_bairro,
          endereco_cidade,
          endereco_cep,
          endereco_latitude,
          endereco_longitude,
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
            ultimaLocalizacao.latitude,
            ultimaLocalizacao.longitude,
            vist.endereco_latitude,
            vist.endereco_longitude
          );

          if (distancia <= config.raioKm) {
            encaixes.push({
              id: vist.id,
              tipo: 'vistoria',
              tipo_vistoria: vist.tipo,
              cliente_nome: vist.associado?.nome || 'Não informado',
              cliente_telefone: vist.associado?.telefone,
              endereco_logradouro: vist.endereco_logradouro,
              endereco_numero: vist.endereco_numero,
              endereco_bairro: vist.endereco_bairro,
              endereco_cidade: vist.endereco_cidade,
              endereco_cep: vist.endereco_cep,
              data_agendada: vist.data_agendada,
              periodo: vist.periodo,
              placa: vist.veiculo?.placa,
              marca: vist.veiculo?.marca,
              modelo: vist.veiculo?.modelo,
              distancia_km: Math.round(distancia * 10) / 10,
              latitude: vist.endereco_latitude,
              longitude: vist.endereco_longitude,
            });
          }
        }
      });

      // Ordenar por distância
      return encaixes.sort((a, b) => a.distancia_km - b.distancia_km);
    },
    enabled: queryEnabled,
    staleTime: 1000 * 60 * 2,
  });

  return {
    encaixes: encaixesQuery.data || [],
    isLoading: loadingTarefas || loadingLocalizacao || encaixesQuery.isLoading,
    temTarefasProximas: temTarefas,
    ultimaLocalizacao,
    config,
    podeVerEncaixes: !temTarefas && !!ultimaLocalizacao,
  };
}

// Hook para assumir um encaixe
export function usePuxarEncaixe() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ id, tipo }: { id: string; tipo: 'instalacao' | 'vistoria' }) => {
      if (!profile?.id) throw new Error('Usuário não autenticado');

      if (tipo === 'instalacao') {
        const { error } = await supabase
          .from('instalacoes')
          .update({
            instalador_responsavel_id: profile.id,
            permite_encaixe: false,
          })
          .eq('id', id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('vistorias')
          .update({
            vistoriador_id: profile.id,
            permite_encaixe: false,
          })
          .eq('id', id);

        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['encaixes-disponiveis'] });
      queryClient.invalidateQueries({ queryKey: ['tarefas-proximas'] });
      toast.success(
        variables.tipo === 'instalacao'
          ? 'Instalação assumida com sucesso!'
          : 'Vistoria assumida com sucesso!'
      );
    },
    onError: (error) => {
      console.error('[usePuxarEncaixe] Erro:', error);
      toast.error('Erro ao assumir o serviço');
    },
  });
}
