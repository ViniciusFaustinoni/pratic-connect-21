import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert, TablesUpdate, Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { normalizarBusca, escapeOrValue } from '@/lib/buscaUtils';

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
  data_instalacao_inicio?: string; // ISO date (YYYY-MM-DD)
  data_instalacao_fim?: string;    // ISO date (YYYY-MM-DD)
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
    placeholderData: keepPreviousData,
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

      // Filtro por data de instalação (cruza com tabela servicos)
      if (filters?.data_instalacao_inicio || filters?.data_instalacao_fim) {
        let svcQuery = supabase
          .from('servicos')
          .select('rastreador_id')
          .eq('tipo', 'instalacao')
          .eq('status', 'concluida')
          .not('rastreador_id', 'is', null);

        if (filters.data_instalacao_inicio) {
          svcQuery = svcQuery.gte('concluida_em', `${filters.data_instalacao_inicio}T00:00:00`);
        }
        if (filters.data_instalacao_fim) {
          svcQuery = svcQuery.lte('concluida_em', `${filters.data_instalacao_fim}T23:59:59`);
        }

        const { data: svcData, error: svcError } = await svcQuery.limit(5000);
        if (svcError) {
          console.warn('[useRastreadores] busca data instalação erro:', svcError);
        }
        const ids = Array.from(new Set((svcData || []).map((s: any) => s.rastreador_id).filter(Boolean)));

        if (ids.length === 0) {
          return { items: [], total: 0, totalPages: 0 };
        }
        query = query.in('id', ids);
      }

      if (filters?.search) {
        const { raw, digits, placa, placaForte } = normalizarBusca(filters.search);
        const rawSafe = escapeOrValue(raw);

        // 1) Veículos por placa (normalizada, sem hífen)
        const veiculoIdsByPlaca = new Set<string>();
        if (placa) {
          // Quando o termo é claramente uma placa (placaForte), busca EXATA
          // para evitar que substring case com placas não relacionadas.
          // Quando é parcial (ex.: "KVR3"), permite ILIKE.
          const veicQuery = supabase.from('veiculos').select('id');
          const { data: veics, error: vErr } = placaForte
            ? await veicQuery.eq('placa', placaForte).limit(200)
            : await veicQuery.ilike('placa', `%${placa}%`).limit(200);
          if (vErr) console.warn('[useRastreadores] busca placa erro:', vErr);
          (veics || []).forEach((v: any) => veiculoIdsByPlaca.add(v.id));
        }

        // Quando o termo é claramente uma placa (placaForte), restringimos a busca
        // a veículos cuja placa case EXATAMENTE. Sem isso, dígitos extraídos
        // poluiriam o resultado com CPFs/imeis aleatórios.
        if (placaForte) {
          if (veiculoIdsByPlaca.size === 0) {
            return { items: [], total: 0, totalPages: 0 };
          }
          query = query.in('veiculo_id', Array.from(veiculoIdsByPlaca));
        } else {
          // 2) Veículos cujo associado bate por nome OU CPF (consultas separadas)
          const associadoIds = new Set<string>();
          const assocPromises: Array<PromiseLike<any>> = [
            supabase.from('associados').select('id').ilike('nome', `%${rawSafe}%`).limit(200),
          ];
          if (digits.length >= 3) {
            assocPromises.push(
              supabase.from('associados').select('id').ilike('cpf', `%${digits}%`).limit(200)
            );
          }
          const assocResults = await Promise.all(assocPromises);
          assocResults.forEach((r: any) => {
            if (r?.error) console.warn('[useRastreadores] busca associado erro:', r.error);
            (r?.data || []).forEach((a: any) => associadoIds.add(a.id));
          });

          if (associadoIds.size > 0) {
            const { data: vAssoc } = await supabase
              .from('veiculos')
              .select('id')
              .in('associado_id', Array.from(associadoIds))
              .limit(500);
            (vAssoc || []).forEach((v: any) => veiculoIdsByPlaca.add(v.id));
          }

          const directFilter = `codigo.ilike.%${rawSafe}%,numero_serie.ilike.%${rawSafe}%,imei.ilike.%${rawSafe}%`;

          if (veiculoIdsByPlaca.size > 0) {
            const ids = Array.from(veiculoIdsByPlaca);
            query = query.or(`${directFilter},veiculo_id.in.(${ids.join(',')})`);
          } else {
            query = query.or(directFilter);
          }
        }
      }

      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      // Diagnóstico: busca por IMEI (14-16 dígitos puros) sem resultado
      if (filters?.search && (count ?? 0) === 0) {
        const termo = filters.search.trim();
        if (/^\d{14,16}$/.test(termo)) {
          console.info(
            '[useRastreadores] IMEI não encontrado no estoque local',
            { imei: termo, hint: 'Pode estar em plataforma externa não importada (ex.: Pratic Master)' }
          );
        }
      }

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
      // Threshold de 24h para considerar "online"
      const threshold24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // Todas as 7 contagens em paralelo (sem trazer dados — apenas count: exact + head)
      // Substitui o loop client-side anterior que paginava ~todos os instalados
      // (10+ fetches sequenciais) só para calcular online/offline.
      const [
        totalRes,
        estoqueRes,
        instaladosRes,
        manutencaoRes,
        baixadosRes,
        onlineRes,
      ] = await Promise.all([
        supabase.from('rastreadores').select('*', { count: 'exact', head: true }),
        supabase.from('rastreadores').select('*', { count: 'exact', head: true }).eq('status', 'estoque'),
        supabase.from('rastreadores').select('*', { count: 'exact', head: true }).eq('status', 'instalado'),
        supabase.from('rastreadores').select('*', { count: 'exact', head: true }).eq('status', 'manutencao'),
        supabase.from('rastreadores').select('*', { count: 'exact', head: true }).eq('status', 'baixado'),
        supabase
          .from('rastreadores')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'instalado')
          .gte('ultima_comunicacao', threshold24h),
      ]);

      const instalados = instaladosRes.count ?? 0;
      const online = onlineRes.count ?? 0;
      const offline = Math.max(0, instalados - online);
      const alertas = offline; // mesma regra de antes

      const metricas: RastreadoresMetricas = {
        total: totalRes.count ?? 0,
        estoque: estoqueRes.count ?? 0,
        instalados,
        manutencao: manutencaoRes.count ?? 0,
        baixados: baixadosRes.count ?? 0,
        online,
        offline,
        alertas,
      };

      return metricas;
    },
    staleTime: 60_000,
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

      // Status que DESVINCULAM o rastreador do veículo (rastreador deixa fisicamente
      // o veículo ou é descartado). Manutenção/reagendamento/retirada pendente
      // PRESERVAM o vínculo — é o mesmo equipamento daquele veículo, só temporariamente
      // fora de operação.
      const STATUS_DESVINCULA_VEICULO: StatusRastreador[] = [
        'estoque', 'baixado', 'retorno_base', 'triagem',
        'em_analise_plataforma', 'em_garantia',
      ];
      const deveDesvincular = STATUS_DESVINCULA_VEICULO.includes(status);

      // 2. Se estava instalado e vai para um status que desvincula, chamar plataforma externa
      if (rastreadorAtual?.status === 'instalado' && deveDesvincular && rastreadorAtual.veiculo_id) {
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

          // Também desvincula TODOS os usuários do veículo na Softtruck.
          // Regra de negócio: a retirada física do rastreador é o gatilho para
          // remover o acesso do(s) usuário(s) ao veículo. Cancelamento sem
          // retirada NÃO dispara este caminho (status do rastreador não muda).
          try {
            const { data: veic } = await supabase
              .from('veiculos')
              .select('softruck_vehicle_id')
              .eq('id', rastreadorAtual.veiculo_id)
              .maybeSingle();

            const softruckVehicleId = (veic as any)?.softruck_vehicle_id;
            if (softruckVehicleId) {
              const { error: usrError } = await supabase.functions.invoke('softruck-api', {
                body: {
                  operation: 'desassociar-todos-usuarios-veiculo',
                  data: { vehicleId: softruckVehicleId },
                },
              });
              if (usrError) {
                console.error('Erro ao desvincular usuários Softruck:', usrError);
              }
            } else {
              console.warn('Veículo sem softruck_vehicle_id — pulando desvínculo de usuários');
            }
          } catch (error) {
            console.error('Exceção ao desvincular usuários Softruck:', error);
          }
        }

      }

      // 3. Atualizar banco local
      const updateData: RastreadorUpdate = { status };

      // Só limpa veiculo_id quando o status indica desvinculação física/terminal.
      // manutencao / reagendar_manutencao / retirada_pendente preservam o vínculo.
      if (deveDesvincular) {
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
      // status='instalado' é a verdade primária — sempre tem veiculo_id preenchido.
      const { data: veiculosComRastreador, error: rastrError } = await supabase
        .from('rastreadores')
        .select('veiculo_id')
        .eq('status', 'instalado');

      if (rastrError) throw rastrError;

      const veiculosComRastreadorSet = new Set(
        (veiculosComRastreador || [])
          .map(r => r.veiculo_id)
          .filter(Boolean) as string[]
      );

      // Fix: a query antiga `id=not.in.(uuid1,uuid2,...)` quebrava com 400
      // quando a lista passava de ~80 IDs (URL > 8KB). Agora buscamos todos
      // os veículos ativos e filtramos no client com um Set (O(1) por item).
      const { data, error } = await supabase
        .from('veiculos')
        .select('*, associados(*)')
        .eq('ativo', true)
        .order('placa');

      if (error) throw error;
      return (data || []).filter(v => !veiculosComRastreadorSet.has(v.id));
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

/**
 * Altera status de rastreadores em manutenção (retorno_base / em_garantia)
 * com registro de movimentação de estoque
 */
export function useAlterarStatusRastreador() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      rastreadorId,
      statusNovo,
      observacoes,
    }: {
      rastreadorId: string;
      statusNovo: StatusRastreador;
      observacoes?: string;
    }) => {
      // 1. Buscar rastreador atual
      const { data: rastreador, error: fetchError } = await supabase
        .from('rastreadores')
        .select('id, codigo, status, portador_id')
        .eq('id', rastreadorId)
        .single();

      if (fetchError) throw fetchError;

      const statusAnterior = rastreador.status;

      // 2. Montar update
      const updateData: Record<string, unknown> = {
        status: statusNovo,
        updated_at: new Date().toISOString(),
      };

      // Limpar portador quando volta para estoque
      if (statusNovo === 'estoque') {
        updateData.portador_id = null;
      }

      const { error: updateError } = await supabase
        .from('rastreadores')
        .update(updateData)
        .eq('id', rastreadorId);

      if (updateError) throw updateError;

      // 3. Obter usuário atual
      const { data: { user } } = await supabase.auth.getUser();

      // 4. Registrar movimentação de estoque
      const tipoMov = statusNovo === 'estoque' ? 'retorno_estoque' : 'envio_garantia';
      await supabase.from('estoque_movimentacoes').insert({
        rastreador_id: rastreadorId,
        tipo: tipoMov,
        quantidade: 1,
        status_anterior: statusAnterior,
        status_novo: statusNovo,
        usuario_id: user?.id || null,
        observacoes: observacoes || `Mudança de status: ${statusAnterior} → ${statusNovo}`,
      });

      return { rastreadorId, statusNovo, statusAnterior };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['rastreadores'] });
      queryClient.invalidateQueries({ queryKey: ['rastreador', result.rastreadorId] });
      queryClient.invalidateQueries({ queryKey: ['rastreadores-metricas'] });
      const label = result.statusNovo === 'estoque' ? 'Disponível' : result.statusNovo === 'em_garantia' ? 'Enviado para Fornecedor' : result.statusNovo;
      toast.success(`Rastreador marcado como ${label}`);
    },
    onError: (error) => {
      console.error('Erro ao alterar status do rastreador:', error);
      toast.error('Erro ao alterar status do rastreador');
    },
  });
}

/**
 * Histórico de mudanças de vínculo (veiculo_id) e status do rastreador.
 * Alimentado por trigger `trg_rastreador_vinculo_audit` no banco — captura toda
 * alteração feita por qualquer fluxo (app, edge function, SQL manual).
 */
export interface RastreadorVinculoHistoricoItem {
  id: string;
  rastreador_id: string;
  veiculo_id_anterior: string | null;
  veiculo_id_novo: string | null;
  status_anterior: string | null;
  status_novo: string | null;
  placa_anterior: string | null;
  placa_nova: string | null;
  alterado_por: string | null;
  alterado_por_nome: string | null;
  origem: string | null;
  contexto: Record<string, unknown> | null;
  created_at: string;
}

export function useRastreadorHistoricoVinculo(rastreadorId: string | null | undefined) {
  return useQuery({
    queryKey: ['rastreador-vinculo-historico', rastreadorId],
    enabled: !!rastreadorId,
    queryFn: async (): Promise<RastreadorVinculoHistoricoItem[]> => {
      const { data, error } = await supabase
        .from('rastreadores_vinculo_historico' as never)
        .select('*')
        .eq('rastreador_id', rastreadorId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as RastreadorVinculoHistoricoItem[];
    },
  });
}
