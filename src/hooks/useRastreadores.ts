import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert, TablesUpdate, Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';

export type Rastreador = Tables<'rastreadores'>;
export type RastreadorInsert = TablesInsert<'rastreadores'>;
export type RastreadorUpdate = TablesUpdate<'rastreadores'>;
export type StatusRastreador = Database['public']['Enums']['status_rastreador'];

export interface RastreadorWithRelations extends Rastreador {
  veiculos?: (Tables<'veiculos'> & {
    associados?: (Tables<'associados'> & { email?: string }) | null;
  }) | null;
  portador?: { id: string; nome: string } | null;
}

export interface RastreadorFilters {
  status?: StatusRastreador[];
  plataforma?: string;
  search?: string;
  comunicacao?: 'online' | 'offline' | 'todos';
}

export interface RastreadoresMetricas {
  total: number;
  estoque: number;
  instalados: number;
  manutencao: number;
  baixados: number;
  online: number;
  offline: number;
  alertas: number;
}

// Helper to check if tracker is online (last communication < 24h)
export function isRastreadorOnline(ultimaComunicacao: string | null): boolean {
  if (!ultimaComunicacao) return false;
  const lastComm = new Date(ultimaComunicacao);
  const now = new Date();
  const diffHours = (now.getTime() - lastComm.getTime()) / (1000 * 60 * 60);
  return diffHours < 24;
}

export function useRastreadores(filters?: RastreadorFilters) {
  return useQuery({
    queryKey: ['rastreadores', filters],
    queryFn: async () => {
      let query = supabase
        .from('rastreadores')
        .select(`
          *,
          veiculos (
            *,
            associados (id, nome, email, telefone, cpf)
          ),
          portador:profiles!rastreadores_portador_id_fkey(id, nome)
        `)
        .order('created_at', { ascending: false });

      if (filters?.status && filters.status.length > 0) {
        query = query.in('status', filters.status);
      }

      if (filters?.plataforma) {
        query = query.eq('plataforma', filters.plataforma);
      }

      if (filters?.search) {
        query = query.or(`codigo.ilike.%${filters.search}%,numero_serie.ilike.%${filters.search}%,imei.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Filter by communication status if needed
      let result = data as RastreadorWithRelations[];
      
      if (filters?.comunicacao && filters.comunicacao !== 'todos') {
        result = result.filter(r => {
          if (r.status !== 'instalado') return true; // Only filter installed trackers
          const online = isRastreadorOnline(r.ultima_comunicacao);
          return filters.comunicacao === 'online' ? online : !online;
        });
      }

      return result;
    },
  });
}

export function useRastreador(id: string | undefined) {
  return useQuery({
    queryKey: ['rastreador', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('rastreadores')
        .select(`
          *,
          veiculos (
            *,
            associados (*)
          ),
          portador:profiles!rastreadores_portador_id_fkey(id, nome)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data as RastreadorWithRelations | null;
    },
    enabled: !!id,
  });
}

export function useRastreadoresMetricas() {
  return useQuery({
    queryKey: ['rastreadores-metricas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rastreadores')
        .select('status, ultima_comunicacao');

      if (error) throw error;

      const now = new Date();
      const metricas: RastreadoresMetricas = {
        total: data.length,
        estoque: 0,
        instalados: 0,
        manutencao: 0,
        baixados: 0,
        online: 0,
        offline: 0,
        alertas: 0,
      };

      data.forEach(r => {
        switch (r.status) {
          case 'estoque':
            metricas.estoque++;
            break;
          case 'instalado':
            metricas.instalados++;
            const online = isRastreadorOnline(r.ultima_comunicacao);
            if (online) {
              metricas.online++;
            } else {
              metricas.offline++;
              metricas.alertas++; // Installed but offline = alert
            }
            break;
          case 'manutencao':
            metricas.manutencao++;
            break;
          case 'baixado':
            metricas.baixados++;
            break;
        }
      });

      return metricas;
    },
  });
}

export function useCreateRastreador() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: RastreadorInsert) => {
      const { data: result, error } = await supabase
        .from('rastreadores')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rastreadores'] });
      queryClient.invalidateQueries({ queryKey: ['rastreadores-metricas'] });
      toast.success('Rastreador criado com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao criar rastreador:', error);
      toast.error('Erro ao criar rastreador');
    },
  });
}

export function useUpdateRastreador() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: RastreadorUpdate & { id: string }) => {
      const { data: result, error } = await supabase
        .from('rastreadores')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rastreadores'] });
      queryClient.invalidateQueries({ queryKey: ['rastreador', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['rastreadores-metricas'] });
      toast.success('Rastreador atualizado com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao atualizar rastreador:', error);
      toast.error('Erro ao atualizar rastreador');
    },
  });
}

export function useUpdateRastreadorStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status, veiculo_id }: { id: string; status: StatusRastreador; veiculo_id?: string | null }) => {
      // 1. Buscar rastreador atual para verificar se precisa desvincular na plataforma
      const { data: rastreadorAtual, error: fetchError } = await supabase
        .from('rastreadores')
        .select('id, imei, plataforma, status, veiculo_id')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // 2. Se estava instalado e vai para outro status, desvincular na plataforma
      if (rastreadorAtual?.status === 'instalado' && status !== 'instalado' && rastreadorAtual.veiculo_id) {
        console.log(`Desvinculando rastreador ${rastreadorAtual.imei} da plataforma ${rastreadorAtual.plataforma}...`);
        
        if (rastreadorAtual.plataforma === 'rede_veiculos') {
          try {
            const { error: desvincularError } = await supabase.functions.invoke(
              'rede-veiculos-desvincular-cliente',
              {
                body: {
                  rastreadorId: id,
                  motivo: `mudanca_status_${status}`,
                  atualizarBancoLocal: false, // Vamos atualizar manualmente abaixo
                },
              }
            );
            if (desvincularError) {
              console.error('Erro ao desvincular na Rede Veículos:', desvincularError);
              // Continua mesmo com erro na API
            }
          } catch (error) {
            console.error('Exceção ao desvincular:', error);
          }
        } else if (rastreadorAtual.plataforma === 'softruck') {
          try {
            const { error: softError } = await supabase.functions.invoke('softruck-api', {
              body: {
                operation: 'desassociar-device-veiculo',
                data: { deviceId: id },
              },
            });
            if (softError) {
              console.error('Erro ao desvincular Softruck:', softError);
            }
          } catch (error) {
            console.error('Exceção ao desvincular Softruck:', error);
          }
        }
      }

      // 3. Atualizar banco local
      const updateData: RastreadorUpdate = { status };
      
      // If status is not 'instalado', clear vehicle association
      if (status !== 'instalado') {
        updateData.veiculo_id = null;
      } else if (veiculo_id !== undefined) {
        updateData.veiculo_id = veiculo_id;
      }

      const { data: result, error } = await supabase
        .from('rastreadores')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rastreadores'] });
      queryClient.invalidateQueries({ queryKey: ['rastreador', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['rastreadores-metricas'] });
      toast.success('Status atualizado com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status');
    },
  });
}

export function useDeleteRastreador() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('rastreadores')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rastreadores'] });
      queryClient.invalidateQueries({ queryKey: ['rastreadores-metricas'] });
      toast.success('Rastreador removido com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao remover rastreador:', error);
      toast.error('Erro ao remover rastreador');
    },
  });
}

export function usePlataformas() {
  return useQuery({
    queryKey: ['rastreadores-plataformas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rastreadores')
        .select('plataforma')
        .order('plataforma');

      if (error) throw error;

      // Get unique platforms
      const unique = [...new Set(data.map(r => r.plataforma))];
      return unique;
    },
  });
}

export function useVeiculosSemRastreador() {
  return useQuery({
    queryKey: ['veiculos-sem-rastreador'],
    queryFn: async () => {
      // Get vehicles that don't have an installed tracker
      const { data: veiculosComRastreador, error: rastrError } = await supabase
        .from('rastreadores')
        .select('veiculo_id')
        .eq('status', 'instalado')
        .not('veiculo_id', 'is', null);

      if (rastrError) throw rastrError;

      const veiculosIds = veiculosComRastreador.map(r => r.veiculo_id).filter(Boolean) as string[];

      let query = supabase
        .from('veiculos')
        .select('*, associados(*)')
        .eq('ativo', true)
        .order('placa');

      if (veiculosIds.length > 0) {
        query = query.not('id', 'in', `(${veiculosIds.join(',')})`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
  });
}

// Rastreadores disponíveis (em estoque)
export function useRastreadoresDisponiveis() {
  return useRastreadores({ status: ['estoque'] });
}

// Contagem de rastreadores (alias para useRastreadoresMetricas)
export function useRastreadoresContagem() {
  return useRastreadoresMetricas();
}
