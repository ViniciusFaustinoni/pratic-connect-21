import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { registrarLog } from './useAuditLog';

type Veiculo = Tables<'veiculos'>;
type VeiculoInsert = TablesInsert<'veiculos'>;
type VeiculoUpdate = TablesUpdate<'veiculos'>;

// ============================================
// FUNÇÃO STANDALONE: BUSCAR VEÍCULO POR PLACA
// ============================================
export async function buscarVeiculoPorPlaca(placa: string): Promise<Veiculo | null> {
  // Normalizar placa (remover caracteres especiais e uppercase)
  const placaNormalizada = placa.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  
  if (placaNormalizada.length < 7) return null;
  
  const { data, error } = await supabase
    .from('veiculos')
    .select('*')
    .or(`placa.ilike.${placaNormalizada},placa.ilike.${placa}`)
    .maybeSingle();
    
  if (error) {
    console.error('[buscarVeiculoPorPlaca] Erro:', error);
    throw error;
  }
  
  return data as Veiculo | null;
}

// Sobrecargas: mantém compatibilidade com `useVeiculos(associadoId?)` e
// adiciona paginação server-side via `useVeiculos({ page, pageSize, search, status })`.
export interface UseVeiculosOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  enabled?: boolean;
}

export function useVeiculos(arg?: string | UseVeiculosOptions) {
  const associadoId = typeof arg === 'string' ? arg : undefined;
  const opts: UseVeiculosOptions = (arg && typeof arg === 'object') ? arg : {};
  const { page = 1, pageSize = 50, search = '', status, enabled = true } = opts;
  const usePagination = arg && typeof arg === 'object';

  return useQuery({
    queryKey: usePagination
      ? ['veiculos', 'paginated', { page, pageSize, search, status }]
      : ['veiculos', associadoId],
    enabled,
    queryFn: async () => {
      // Modo legado: por associado (mantém payload completo p/ telas que precisam)
      if (associadoId) {
        const { data, error } = await supabase
          .from('veiculos')
          .select('*, associado:associados(id, nome, cpf)')
          .eq('associado_id', associadoId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return data as Veiculo[];
      }

      // Modo paginado (listagem geral) — colunas enxutas + range + count
      if (usePagination) {
        let q = supabase
          .from('veiculos')
          .select(
            'id, placa, chassi, marca, modelo, ano_fabricacao, ano_modelo, cor, valor_fipe, status, ativo, uso_aplicativo, plataforma_app, associado_id, created_at, associado:associados(id, nome, cpf)',
            { count: 'exact' }
          )
          .order('created_at', { ascending: false });

        if (status) q = q.eq('status', status);
        if (search) {
          const s = search.replace(/[,()]/g, '');
          const like = `%${s}%`;
          q = q.or(
            [
              `placa.ilike.${like}`,
              `chassi.ilike.${like}`,
              `marca.ilike.${like}`,
              `modelo.ilike.${like}`,
            ].join(',')
          );
        }
        q = q.range((page - 1) * pageSize, page * pageSize - 1);
        const { data, error, count } = await q;
        if (error) throw error;
        return {
          veiculos: (data || []) as unknown as Veiculo[],
          pagination: {
            page,
            pageSize,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / pageSize),
          },
        };
      }

      // Compat antigo: lista geral sem paginação (ainda usado por algumas telas)
      const { data, error } = await supabase
        .from('veiculos')
        .select('*, associado:associados(id, nome, cpf, origem_cadastro)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Veiculo[];
    },
  });
}

export function useVeiculo(id: string | undefined) {
  return useQuery({
    queryKey: ['veiculos', 'detail', id],
    queryFn: async () => {
      if (!id) throw new Error('ID é obrigatório');
      
      const { data, error } = await supabase
        .from('veiculos')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as Veiculo;
    },
    enabled: !!id,
  });
}

export function useCreateVeiculo() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (veiculo: VeiculoInsert) => {
      // ═══════════════════════════════════════════════════════════════
      // GUARDA ANTI-SEQUESTRO DE PLACA
      // Antes de criar, verifica se a placa já pertence a OUTRO associado.
      // Cenário evitado: operador inclui veículo num associado errado e o
      // sistema o vincula silenciosamente (incidente RIR1B37 / TOVAR×ERICO).
      // Placas placeholder "0KM*" são liberadas pois são únicas por geração.
      // ═══════════════════════════════════════════════════════════════
      const placaInput = (veiculo.placa || '').toString();
      const placaNormalizada = placaInput.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const ehPlaceholder0km = placaNormalizada.startsWith('0KM');

      if (placaNormalizada.length >= 7 && !ehPlaceholder0km) {
        const { data: existente } = await supabase
          .from('veiculos')
          .select('id, placa, associado_id, associado:associados(nome, cpf)')
          .eq('placa', placaNormalizada)
          .maybeSingle();

        if (existente?.associado_id && existente.associado_id !== veiculo.associado_id) {
          const dono = (existente.associado as { nome?: string; cpf?: string } | null);
          const detalhe = dono?.nome ? ` (titular atual: ${dono.nome}${dono.cpf ? ' — CPF ' + dono.cpf : ''})` : '';
          throw new Error(
            `A placa ${placaNormalizada} já está cadastrada em outro associado${detalhe}. ` +
            `Use o fluxo de Substituição/Troca de Titularidade ou confira se a placa foi digitada corretamente.`
          );
        }
      }

      const { data, error } = await supabase
        .from('veiculos')
        .insert(veiculo)
        .select()
        .single();
      
      if (error) throw error;
      return data as Veiculo;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['veiculos'] });
      queryClient.invalidateQueries({ queryKey: ['associados', data.associado_id] });
      registrarLog({
        acao: 'criar',
        modulo: 'veiculos',
        descricao: `Veículo ${data.placa} cadastrado`,
        entidade_id: data.id,
        dados_novos: { placa: data.placa, marca: data.marca, modelo: data.modelo },
      });
    },
  });
}

export function useDeleteVeiculo() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      // Buscar dados do veículo antes de excluir (para log)
      const { data: veiculo, error: fetchError } = await supabase
        .from('veiculos')
        .select('placa, marca, modelo, associado_id')
        .eq('id', id)
        .single();
      
      if (fetchError) throw fetchError;
      
      const { error } = await supabase
        .from('veiculos')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { id, placa: veiculo?.placa, associado_id: veiculo?.associado_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['veiculos'] });
      if (data.associado_id) {
        queryClient.invalidateQueries({ queryKey: ['associados', data.associado_id] });
      }
      registrarLog({
        acao: 'excluir',
        modulo: 'veiculos',
        descricao: `Veículo ${data.placa} excluído`,
        entidade_id: data.id,
      });
    },
  });
}

export function useUpdateVeiculo() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: VeiculoUpdate & { id: string }) => {
      // 1. Buscar veículo atual para verificar vínculo com Rede Veículos
      const { data: veiculoAtual, error: buscarError } = await supabase
        .from('veiculos')
        .select('rede_veiculos_veiculo_id, placa')
        .eq('id', id)
        .single();
      
      if (buscarError) {
        console.error('[useUpdateVeiculo] Erro ao buscar veículo:', buscarError);
        throw buscarError;
      }
      
      // 2. Atualizar banco local
      const { data, error } = await supabase
        .from('veiculos')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      // 3. Se tem vínculo com Rede Veículos, sincronizar
      if (veiculoAtual?.rede_veiculos_veiculo_id) {
        console.log('[useUpdateVeiculo] Sincronizando com Rede Veículos...');
        
        try {
          const { data: syncResult, error: syncError } = await supabase.functions.invoke(
            'rede-veiculos-atualizar-veiculo',
            {
              body: {
                veiculoId: id,
                camposAlterados: updates,
              },
            }
          );
          
          if (syncError) {
            console.error('[useUpdateVeiculo] Erro ao sincronizar com Rede Veículos:', syncError);
            // Não propaga o erro - atualização local foi bem sucedida
          } else {
            console.log('[useUpdateVeiculo] Sincronização concluída:', syncResult);
          }
        } catch (syncException) {
          console.error('[useUpdateVeiculo] Exceção ao sincronizar:', syncException);
          // Não propaga o erro - atualização local foi bem sucedida
        }
      }
      
      return data as Veiculo;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['veiculos'] });
      queryClient.invalidateQueries({ queryKey: ['veiculos', 'detail', data.id] });
      registrarLog({
        acao: 'editar',
        modulo: 'veiculos',
        descricao: `Veículo ${data.placa} atualizado`,
        entidade_id: data.id,
      });
    },
  });
}
