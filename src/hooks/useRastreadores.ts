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
  comunicacao?: 'online' | 'offline' | 'atencao' | 'todos';
  page?: number;
  pageSize?: number;
}

export interface RastreadoresPaginatedResult {
  items: RastreadorWithRelations[];
  total: number;
  totalPages: number;
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
    queryFn: async (): Promise<RastreadoresPaginatedResult> => {
      const page = filters?.page ?? 1;
      const pageSize = filters?.pageSize ?? 50;
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('rastreadores')
        .select(`
          *,
          veiculos (
            *,
            associados (id, nome, email, telefone, cpf)
          ),
          portador:profiles!rastreadores_portador_id_fkey(id, nome)
        `, { count: 'exact' });

      // When filtering by communication status, use server-side filters where possible
      if (filters?.comunicacao === 'online') {
        const threshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        query = query.gte('ultima_comunicacao', threshold);
        query = query.order('ultima_comunicacao', { ascending: false, nullsFirst: false });
      } else if (filters?.comunicacao === 'offline') {
        query = query.order('created_at', { ascending: false });
      } else if (filters?.comunicacao === 'atencao') {
        const threshold1h = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
        const threshold24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        query = query.lt('ultima_comunicacao', threshold1h).gte('ultima_comunicacao', threshold24h);
        query = query.order('ultima_comunicacao', { ascending: false });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      if (filters?.status && filters.status.length > 0) {
        query = query.in('status', filters.status);
      }

      if (filters?.plataforma) {
        query = query.eq('plataforma', filters.plataforma);
      }

      if (filters?.search) {
        const searchTerm = filters.search.trim();
        
        // Search in related tables (veiculos by placa, associados by nome/cpf)
        const { data: veiculoIds } = await supabase
          .from('veiculos')
          .select('id')
          .ilike('placa', `%${searchTerm}%`);
        
        const { data: associadoVeiculos } = await supabase
          .from('veiculos')
          .select('id, associados!inner(nome, cpf)')
          .or(`nome.ilike.%${searchTerm}%,cpf.ilike.%${searchTerm.replace(/\D/g, '')}%`, { referencedTable: 'associados' });

        // Collect all matching veiculo_ids
        const matchingVeiculoIds = new Set<string>();
        veiculoIds?.forEach(v => matchingVeiculoIds.add(v.id));
        associadoVeiculos?.forEach(v => matchingVeiculoIds.add(v.id));

        // Build OR filter combining direct fields + veiculo_id matches
        const directFilter = `codigo.ilike.%${searchTerm}%,numero_serie.ilike.%${searchTerm}%,imei.ilike.%${searchTerm}%`;
        
        if (matchingVeiculoIds.size > 0) {
          const ids = Array.from(matchingVeiculoIds);
          query = query.or(`${directFilter},veiculo_id.in.(${ids.join(',')})`);
        } else {
          query = query.or(directFilter);
        }
      }

      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      // Filter by communication status if needed (client-side refinement)
      let result = data as RastreadorWithRelations[];
      
      if (filters?.comunicacao && filters.comunicacao !== 'todos') {
        result = result.filter(r => {
          if (r.status !== 'instalado') return filters.comunicacao === 'online' ? false : true;
          const online = isRastreadorOnline(r.ultima_comunicacao);
          
          if (filters.comunicacao === 'online') return online;
          if (filters.comunicacao === 'atencao') {
            if (!r.ultima_comunicacao) return false;
            const lastComm = new Date(r.ultima_comunicacao);
            const now = new Date();
            const diffHours = (now.getTime() - lastComm.getTime()) / (1000 * 60 * 60);
            return diffHours >= 1 && diffHours < 24;
          }
          if (filters.comunicacao === 'offline') return !online;
          return true;
        });
      }

      const total = count ?? 0;
      return {
        items: result,
        total,
        totalPages: Math.ceil(total / pageSize),
      };
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
      // 1. Contagens por status em paralelo (sem limite de 1000)
      const [totalRes, estoqueRes, instaladosRes, manutencaoRes, baixadosRes] = await Promise.all([
        supabase.from('rastreadores').select('*', { count: 'exact', head: true }),
        supabase.from('rastreadores').select('*', { count: 'exact', head: true }).eq('status', 'estoque'),
        supabase.from('rastreadores').select('*', { count: 'exact', head: true }).eq('status', 'instalado'),
        supabase.from('rastreadores').select('*', { count: 'exact', head: true }).eq('status', 'manutencao'),
        supabase.from('rastreadores').select('*', { count: 'exact', head: true }).eq('status', 'baixado'),
      ]);

      // 2. Fetch recursivo dos instalados para calcular online/offline
      const allInstalados: { ultima_comunicacao: string | null }[] = [];
      const PAGE_SIZE = 1000;
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: page, error } = await supabase
          .from('rastreadores')
          .select('ultima_comunicacao')
          .eq('status', 'instalado')
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        if (!page || page.length === 0) {
          hasMore = false;
        } else {
          allInstalados.push(...page);
          if (page.length < PAGE_SIZE) {
            hasMore = false;
          } else {
            from += PAGE_SIZE;
          }
        }
      }

      // 3. Classificar online/offline/alertas
      let online = 0;
      let offline = 0;
      let alertas = 0;

      allInstalados.forEach(r => {
        if (isRastreadorOnline(r.ultima_comunicacao)) {
          online++;
        } else {
          offline++;
          alertas++;
        }
      });

      const metricas: RastreadoresMetricas = {
        total: totalRes.count ?? 0,
        estoque: estoqueRes.count ?? 0,
        instalados: instaladosRes.count ?? 0,
        manutencao: manutencaoRes.count ?? 0,
        baixados: baixadosRes.count ?? 0,
        online,
        offline,
        alertas,
      };

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

// Rastreadores disponíveis (em estoque) - fetches all stock items (no pagination)
export function useRastreadoresDisponiveis() {
  return useRastreadores({ status: ['estoque'], pageSize: 1000 });
}

// Busca rastreadores em estoque por código/IMEI/série (para vinculação manual)
export function useRastreadoresEmEstoqueBusca(search: string) {
  return useQuery({
    queryKey: ['rastreadores-estoque-busca', search],
    queryFn: async () => {
      if (!search || search.length < 2) return [];

      const { data, error } = await supabase
        .from('rastreadores')
        .select('id, codigo, imei, numero_serie, plataforma')
        .eq('status', 'estoque')
        .is('veiculo_id', null)
        .or(`codigo.ilike.%${search}%,imei.ilike.%${search}%,numero_serie.ilike.%${search}%`)
        .limit(10);

      if (error) throw error;
      return data;
    },
    enabled: search.length >= 2,
  });
}

// Contagem de rastreadores (alias para useRastreadoresMetricas)
export function useRastreadoresContagem() {
  return useRastreadoresMetricas();
}
