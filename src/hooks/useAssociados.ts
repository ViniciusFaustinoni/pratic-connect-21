import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import type { StatusAssociado } from '@/types/database';
import { normalizarBusca, escapeOrValue } from '@/lib/buscaUtils';

type Associado = Tables<'associados'>;
type AssociadoInsert = TablesInsert<'associados'>;
type AssociadoUpdate = TablesUpdate<'associados'>;

// ============================================
// FUNÇÃO STANDALONE: BUSCAR ASSOCIADO POR CPF
// ============================================
export async function buscarAssociadoPorCpf(cpf: string): Promise<Associado | null> {
  // Normalizar CPF para diferentes formatos
  const cpfDigits = cpf.replace(/\D/g, '');
  if (cpfDigits.length !== 11) return null;
  
  const cpfFormatado = `${cpfDigits.slice(0, 3)}.${cpfDigits.slice(3, 6)}.${cpfDigits.slice(6, 9)}-${cpfDigits.slice(9)}`;
  
  const { data, error } = await supabase
    .from('associados')
    .select('*')
    .or(`cpf.eq.${cpf},cpf.eq.${cpfDigits},cpf.eq.${cpfFormatado}`)
    .maybeSingle();
    
  if (error) {
    console.error('[buscarAssociadoPorCpf] Erro:', error);
    throw error;
  }
  
  return data as Associado | null;
}

export interface AssociadoWithRelations extends Associado {
  planos?: Tables<'planos'> | null;
  contratos?: Tables<'contratos'>[] | null;
  veiculos?: Tables<'veiculos'>[];
  veiculos_count?: number;
  documentos_pendentes?: number;
}

export interface VeiculoComRelacoes extends Tables<'veiculos'> {
  rastreador?: {
    id: string;
    codigo: string;
    numero_serie: string | null;
    imei: string | null;
    plataforma: string | null;
    plataforma_device_id: string | null;
    status: string | null;
    ultima_posicao_lat: number | null;
    ultima_posicao_lng: number | null;
    ultima_velocidade: number | null;
    ultima_ignicao: boolean | null;
    ultima_comunicacao: string | null;
  } | null;
}

export interface AssociadoFilters {
  search?: string;
  status?: StatusAssociado | StatusAssociado[];
  plano_id?: string | string[];
  cidade?: string | string[];
  estado?: string;
  data_adesao_inicio?: string;
  data_adesao_fim?: string;
  vendedor_id?: string;
  tipos_entrada?: string[];
}

// Aliases canônicos: 'substituicao_placa' é canônico, 'substituicao' é alias.
function expandTipoEntradaAliases(tipos: string[]): string[] {
  const set = new Set(tipos);
  if (set.has('substituicao_placa')) set.add('substituicao');
  if (set.has('substituicao')) set.add('substituicao_placa');
  return Array.from(set);
}

export interface ContagemAssociados {
  total: number;
  em_analise: number;
  pendente_vistoria: number;
  aprovado: number;
  documentacao_pendente: number;
  aguardando_instalacao: number;
  ativo: number;
  inadimplente: number;
  suspenso: number;
  cancelado: number;
  bloqueado: number;
  recusado: number;
}

// ============================================
// HOOK: LISTA DE ASSOCIADOS COM FILTROS/PAGINAÇÃO
// ============================================
interface UseAssociadosParams {
  filters?: AssociadoFilters;
  pagination?: { page: number; pageSize: number };
  enabled?: boolean;
}

export function useAssociados({ filters, pagination, enabled = true }: UseAssociadosParams = {}) {
  const page = pagination?.page ?? 1;
  const pageSize = pagination?.pageSize ?? 20;

  return useQuery({
    queryKey: ['associados', filters, pagination],
    refetchOnMount: 'always',
    placeholderData: keepPreviousData,
    queryFn: async () => {
      // Projeção enxuta — antes trazia `*` em associados + planos + contratos + veiculos,
      // o que inflava o payload da listagem em ~5x. Mantemos só o necessário p/ cards/tabela.
      let query = supabase
        .from('associados')
        .select(`
          id, nome, cpf, email, telefone, status, plano_id, uf, cidade, data_adesao,
          created_at, updated_at, origem_cadastro, sincronizado_hinova, tipo_saida,
          planos:planos!plano_id (id, nome, codigo),
          contratos:contratos!fk_contratos_associado (id, numero, status),
          veiculos (id, placa, marca, modelo, ano_modelo, status, cobertura_total, cobertura_roubo_furto, cobertura_suspensa)
        `, { count: 'exact' });

      // Pré-busca em contratos quando filtra por consultor ou tipo de adesão
      if (filters?.vendedor_id || (filters?.tipos_entrada && filters.tipos_entrada.length > 0)) {
        let cq = supabase
          .from('contratos')
          .select('associado_id')
          .not('associado_id', 'is', null);

        if (filters.vendedor_id) {
          cq = cq.eq('vendedor_id', filters.vendedor_id);
        }
        if (filters.tipos_entrada && filters.tipos_entrada.length > 0) {
          const tipos = expandTipoEntradaAliases(filters.tipos_entrada);
          cq = cq.in('tipo_entrada', tipos);
        }

        const { data: contratosData, error: cErr } = await cq.limit(50000);
        if (cErr) throw cErr;

        const associadoIds = Array.from(
          new Set((contratosData || []).map((r: any) => r.associado_id).filter(Boolean))
        );

        if (associadoIds.length === 0) {
          return {
            associados: [] as AssociadoWithRelations[],
            pagination: { page, pageSize, total: 0, totalPages: 0 },
          };
        }

        query = query.in('id', associadoIds);
      }

      // Filtro por status (pode ser array)
      if (filters?.status) {
        if (Array.isArray(filters.status)) {
          query = query.in('status', filters.status);
        } else {
          query = query.eq('status', filters.status);
        }
      }

      // Filtro por plano (pode ser array)
      if (filters?.plano_id) {
        if (Array.isArray(filters.plano_id)) {
          if (filters.plano_id.length > 0) query = query.in('plano_id', filters.plano_id);
        } else {
          query = query.eq('plano_id', filters.plano_id);
        }
      }

      // Filtro por cidade (pode ser array)
      if (filters?.cidade) {
        if (Array.isArray(filters.cidade)) {
          if (filters.cidade.length > 0) query = query.in('cidade', filters.cidade);
        } else {
          query = query.eq('cidade', filters.cidade);
        }
      }

      // Filtro por estado
      if (filters?.estado) {
        query = query.eq('uf', filters.estado);
      }

      // Filtro por período de adesão
      if (filters?.data_adesao_inicio) {
        query = query.gte('data_adesao', filters.data_adesao_inicio);
      }
      if (filters?.data_adesao_fim) {
        query = query.lte('data_adesao', filters.data_adesao_fim);
      }

      // Busca por nome, CPF, email, telefone ou placa
      // Aceita CPF/telefone com OU sem máscara, e placa com OU sem hífen.
      if (filters?.search) {
        const { raw, digits, cpfFormatado, telefoneFormatado, placa, placaForte, chassi, chassiForte } = normalizarBusca(filters.search);
        const rawSafe = escapeOrValue(raw);

        // Busca por placa OU chassi em veículos vinculados
        let associadoIdsByVeiculo: string[] = [];
        if (placa || chassi) {
          const orVeic: string[] = [];
          if (placa) orVeic.push(`placa.ilike.%${placa}%`);
          if (chassi) orVeic.push(`chassi.ilike.%${chassi}%`);
          const { data: veics } = await supabase
            .from('veiculos')
            .select('associado_id')
            .or(orVeic.join(','))
            .not('associado_id', 'is', null)
            .limit(500);
          associadoIdsByVeiculo = (veics || [])
            .map((v: any) => v.associado_id)
            .filter(Boolean);
        }

        const orParts: string[] = [];

        if (placaForte || chassiForte) {
          // Termo é claramente placa ou chassi. Restringir a nome + ids de veículo
          // para evitar que dígitos casem em CPF/telefone parciais de outros associados.
          orParts.push(`nome.ilike.%${rawSafe}%`);
          if (associadoIdsByVeiculo.length > 0) {
            orParts.push(`id.in.(${associadoIdsByVeiculo.join(',')})`);
          } else {
            orParts.push(`id.eq.00000000-0000-0000-0000-000000000000`);
          }
        } else {
          orParts.push(`nome.ilike.%${rawSafe}%`);
          orParts.push(`email.ilike.%${rawSafe}%`);

          if (digits.length === 11 && cpfFormatado) {
            orParts.push(`cpf.eq.${digits}`);
            orParts.push(`cpf.eq.${cpfFormatado}`);
          } else if (digits.length >= 3) {
            orParts.push(`cpf.ilike.%${digits}%`);
          }

          if (telefoneFormatado) {
            orParts.push(`telefone.ilike.%${digits}%`);
            orParts.push(`telefone.ilike.%${escapeOrValue(telefoneFormatado)}%`);
          } else if (digits.length >= 3) {
            orParts.push(`telefone.ilike.%${digits}%`);
          }

          if (associadoIdsByVeiculo.length > 0) {
            orParts.push(`id.in.(${associadoIdsByVeiculo.join(',')})`);
          }
        }

        query = query.or(orParts.join(','));
      }

      // Ordenação e paginação
      query = query
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        associados: (data || []) as AssociadoWithRelations[],
        pagination: {
          page,
          pageSize,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / pageSize),
        },
      };
    },
    enabled,
  });
}

// ============================================
// HOOK: ASSOCIADO INDIVIDUAL
// ============================================
export function useAssociado(id: string | undefined) {
  return useQuery({
    queryKey: ['associado', id],
    queryFn: async () => {
      if (!id) throw new Error('ID é obrigatório');

      const { data, error } = await supabase
        .from('associados')
        .select(`
          *,
          planos (*),
          contratos!fk_contratos_associado (*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      // Fetch vehicles separately
      const { data: veiculos } = await supabase
        .from('veiculos')
        .select('*')
        .eq('associado_id', id);

      // Fetch pending documents count
      const { count: docsPendentes } = await supabase
        .from('documentos')
        .select('*', { count: 'exact', head: true })
        .eq('associado_id', id)
        .eq('status', 'pendente');

      return {
        ...data,
        veiculos: veiculos || [],
        documentos_pendentes: docsPendentes || 0,
      } as AssociadoWithRelations;
    },
    enabled: !!id,
  });
}

// ============================================
// HOOK: CONTAGEM POR STATUS (com filtros opcionais — RPC única)
// ============================================
export interface UseAssociadosContagemFilters {
  search?: string;
  plano_id?: string;
  cidade?: string;
  uf?: string;
  data_adesao_inicio?: string;
  data_adesao_fim?: string;
  vendedor_id?: string;
  tipos_entrada?: string[];
}

export function useAssociadosContagem(filters?: UseAssociadosContagemFilters) {
  return useQuery({
    queryKey: ['associados-contagem', filters ?? {}],
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('associados_contagem_por_status', {
        p_search: filters?.search || null,
        p_plano_id: (filters?.plano_id as any) || null,
        p_cidade: filters?.cidade || null,
        p_uf: filters?.uf || null,
        p_data_inicio: filters?.data_adesao_inicio || null,
        p_data_fim: filters?.data_adesao_fim || null,
        p_vendedor_id: (filters?.vendedor_id as any) || null,
        p_tipos_entrada: filters?.tipos_entrada && filters.tipos_entrada.length > 0
          ? filters.tipos_entrada
          : null,
      });
      if (error) throw error;
      const v = (data || {}) as Partial<ContagemAssociados>;
      return {
        total: v.total ?? 0,
        em_analise: v.em_analise ?? 0,
        pendente_vistoria: v.pendente_vistoria ?? 0,
        aprovado: v.aprovado ?? 0,
        documentacao_pendente: v.documentacao_pendente ?? 0,
        aguardando_instalacao: v.aguardando_instalacao ?? 0,
        ativo: v.ativo ?? 0,
        inadimplente: v.inadimplente ?? 0,
        suspenso: v.suspenso ?? 0,
        cancelado: v.cancelado ?? 0,
        bloqueado: v.bloqueado ?? 0,
        recusado: v.recusado ?? 0,
      } as ContagemAssociados;
    },
  });
}

// Legacy alias for backwards compatibility
export function useAssociadosMetricas() {
  return useQuery({
    queryKey: ['associados', 'metricas'],
    queryFn: async () => {
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);

      const [ativos, emAnalise, inadimplentes, canceladosMes] = await Promise.all([
        supabase.from('associados').select('*', { count: 'exact', head: true }).eq('status', 'ativo'),
        supabase.from('associados').select('*', { count: 'exact', head: true }).eq('status', 'em_analise'),
        supabase.from('associados').select('*', { count: 'exact', head: true }).eq('status', 'inadimplente'),
        supabase.from('associados')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'cancelado')
          .gte('updated_at', inicioMes.toISOString())
      ]);

      return {
        ativos: ativos.count || 0,
        emAnalise: emAnalise.count || 0,
        inadimplentes: inadimplentes.count || 0,
        canceladosMes: canceladosMes.count || 0
      };
    }
  });
}

// ============================================
// HOOK: CIDADES (para filtros)
// ============================================
export function useAssociadosCidades() {
  return useQuery({
    queryKey: ['associados', 'cidades'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('associados')
        .select('cidade')
        .not('cidade', 'is', null);

      if (error) throw error;

      const cidades = [...new Set(data.map(a => a.cidade).filter(Boolean))] as string[];
      return cidades.sort();
    }
  });
}

// ============================================
// HOOK: VEÍCULOS DO ASSOCIADO
// ============================================
export function useVeiculosDoAssociado(associadoId: string | undefined) {
  return useQuery({
    queryKey: ['veiculos-associado', associadoId],
    queryFn: async () => {
      if (!associadoId) throw new Error('ID do associado não informado');

      const { data, error } = await supabase
        .from('veiculos')
        .select(`
          *,
          rastreador:rastreadores!rastreadores_veiculo_id_fkey(id, codigo, numero_serie, imei, plataforma, plataforma_device_id, status, ultima_posicao_lat, ultima_posicao_lng, ultima_velocidade, ultima_ignicao, ultima_comunicacao),
          contratos!contratos_veiculo_id_fkey(tipo_entrada)
        `)
        .eq('associado_id', associadoId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transformar array em objeto único (pegar primeiro rastreador de cada veículo)
      const veiculosTransformados = (data || []).map(v => {
        const contratos = (v as any).contratos;
        const tipoEntrada = Array.isArray(contratos) && contratos.length > 0
          ? contratos[contratos.length - 1]?.tipo_entrada || null
          : contratos?.tipo_entrada || null;
        return {
          ...v,
          rastreador: Array.isArray(v.rastreador) && v.rastreador.length > 0 
            ? v.rastreador[0] 
            : (v.rastreador || null),
          tipo_entrada: tipoEntrada,
        };
      });
      
      return veiculosTransformados as unknown as VeiculoComRelacoes[];
    },
    enabled: !!associadoId,
  });
}

// ============================================
// HOOK: BUSCA RÁPIDA (AUTOCOMPLETE)
// ============================================
export function useBuscaAssociados(termo: string) {
  return useQuery({
    queryKey: ['busca-associados', termo],
    queryFn: async () => {
      if (!termo || termo.length < 3) return [];

      const { data, error } = await supabase
        .from('associados')
        .select('id, nome, cpf, telefone, status')
        .or(`nome.ilike.%${termo}%,cpf.ilike.%${termo}%`)
        .limit(10);

      if (error) throw error;
      return data;
    },
    enabled: termo.length >= 3,
  });
}

// ============================================
// HOOK: ESTATÍSTICAS DO ASSOCIADO
// ============================================
export function useAssociadoStats(associadoId: string | undefined) {
  return useQuery({
    queryKey: ['associado-stats', associadoId],
    queryFn: async () => {
      if (!associadoId) throw new Error('ID não informado');

      const { count: veiculosCount } = await supabase
        .from('veiculos')
        .select('*', { count: 'exact', head: true })
        .eq('associado_id', associadoId);

      const { data: documentos } = await supabase
        .from('documentos')
        .select('status')
        .eq('associado_id', associadoId);

      const docStats = {
        total: documentos?.length || 0,
        pendentes: documentos?.filter(d => d.status === 'pendente').length || 0,
        aprovados: documentos?.filter(d => d.status === 'aprovado').length || 0,
        reprovados: documentos?.filter(d => d.status === 'reprovado').length || 0,
      };

      let sinistrosCount = 0;
      try {
        const { count } = await supabase
          .from('sinistros')
          .select('*', { count: 'exact', head: true })
          .eq('associado_id', associadoId);
        sinistrosCount = count || 0;
      } catch {
        // Table may not exist yet
      }

      return {
        veiculos: veiculosCount || 0,
        documentos: docStats,
        sinistros: sinistrosCount,
      };
    },
    enabled: !!associadoId,
  });
}

// ============================================
// HOOK: AÇÕES DE ASSOCIADO (CONSOLIDADO)
// ============================================
export function useAssociadoActions() {
  const queryClient = useQueryClient();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['associados'] });
    queryClient.invalidateQueries({ queryKey: ['associados-contagem'] });
    queryClient.invalidateQueries({ queryKey: ['associado'] });
    queryClient.invalidateQueries({ queryKey: ['associado-stats'] });
  };

  const atualizarStatus = useMutation({
    mutationFn: async ({ id, status, motivo }: { id: string; status: StatusAssociado; motivo?: string }) => {
      const updateData: TablesUpdate<'associados'> = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (status === 'bloqueado' && motivo) {
        updateData.bloqueado = true;
        updateData.motivo_bloqueio = motivo;
        updateData.data_bloqueio = new Date().toISOString();
      }

      if (status === 'ativo') {
        updateData.bloqueado = false;
        updateData.motivo_bloqueio = null;
      }

      const { error } = await supabase.from('associados').update(updateData).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      invalidateAll();
      toast.success(`Status alterado para ${status}`);
    },
    onError: () => toast.error('Erro ao atualizar status'),
  });

  const suspenderAssociado = useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo?: string }) => {
      // 1. Atualizar status local
      const { error } = await supabase.from('associados').update({
        status: 'suspenso' as StatusAssociado,
        motivo_bloqueio: motivo || 'Suspenso pelo sistema',
        data_bloqueio: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;

      // 2. Registrar histórico
      await supabase.from('associados_historico').insert({
        associado_id: id,
        tipo: 'status_alterado',
        descricao: `Associado suspenso manualmente. Motivo: ${motivo || 'Não informado'}`,
        dados_anteriores: { status: 'ativo' },
        dados_novos: { status: 'suspenso', motivo_bloqueio: motivo },
      });

      // 3. Notificar Rede Veículos sobre inadimplência
      try {
        const motivoRede = motivo?.toLowerCase().includes('judicial') 
          ? 'cobranca_judicial' 
          : 'bloqueio_diretoria';
          
        await supabase.functions.invoke('rede-veiculos-informar-inadimplente', {
          body: {
            associadoId: id,
            motivo: motivoRede,
          },
        });
        console.log('[suspenderAssociado] Inadimplência notificada à Rede Veículos');
      } catch (redeErr) {
        console.warn('[suspenderAssociado] Erro ao notificar Rede Veículos:', redeErr);
        // Não bloqueia o fluxo
      }
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('Associado suspenso');
    },
    onError: () => toast.error('Erro ao suspender associado'),
  });

  const reativarAssociado = useMutation({
    mutationFn: async (id: string) => {
      // 1. Atualizar status local
      const { error } = await supabase.from('associados').update({
        status: 'ativo' as StatusAssociado,
        bloqueado: false,
        motivo_bloqueio: null,
        data_bloqueio: null,
        updated_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;

      // 2. Registrar histórico
      await supabase.from('associados_historico').insert({
        associado_id: id,
        tipo: 'status_alterado',
        descricao: 'Associado reativado manualmente',
        dados_anteriores: { status: 'suspenso' },
        dados_novos: { status: 'ativo' },
      });

      // 3. Usar orquestrador para ativar cliente completamente na Rede Veículos
      // Isso vai: revincular veículos desvinculados, ativar todos, informar adimplência
      try {
        const result = await supabase.functions.invoke('rede-veiculos-ativar-cliente-completo', {
          body: {
            associadoId: id,
            motivo: 'reativacao_manual',
            revincular: true,
          },
        });
        console.log('[reativarAssociado] Cliente ativado na Rede Veículos:', result.data);
      } catch (redeErr) {
        console.warn('[reativarAssociado] Erro ao ativar na Rede Veículos:', redeErr);
        // Não bloquear fluxo
      }
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('Associado reativado!');
    },
    onError: (error) => toast.error(`Erro ao reativar associado: ${error.message}`),
  });

  const excluirAssociado = useMutation({
    mutationFn: async (id: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Você precisa estar autenticado');
      }

      const response = await fetch(
        'https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/delete-associado',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ associadoId: id }),
        }
      );

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao excluir associado');
      }
      
      return result;
    },
    onSuccess: (result) => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ['associados-cidades'] });
      toast.success(result.message || 'Associado excluído permanentemente');
    },
    onError: (error) => toast.error(`Erro ao excluir associado: ${error.message}`),
  });

  const cancelarAssociado = useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      // 1. Usar orquestrador para inativar + desvincular todos os veículos Rede Veículos
      try {
        const result = await supabase.functions.invoke('rede-veiculos-inativar-cliente-completo', {
          body: {
            associadoId: id,
            motivo: 'cancelamento',
            observacoes: motivo,
            atualizarBancoLocal: true,
            desvincular: true, // Desvincular ao cancelar
          },
        });
        console.log('[cancelarAssociado] Cliente inativado na Rede Veículos:', result.data);
      } catch (redeErr) {
        console.warn('[cancelarAssociado] Erro ao inativar na Rede Veículos:', redeErr);
        // Continua mesmo com erro
      }

      // 2. Tratar Softruck separadamente
      const { data: veiculos } = await supabase
        .from('veiculos')
        .select('id')
        .eq('associado_id', id);

      if (veiculos && veiculos.length > 0) {
        const veiculoIds = veiculos.map(v => v.id);
        const { data: rastreadores } = await supabase
          .from('rastreadores')
          .select('id, imei, plataforma, status')
          .in('veiculo_id', veiculoIds)
          .eq('status', 'instalado')
          .eq('plataforma', 'softruck');

        for (const rastreador of rastreadores || []) {
          try {
            await supabase.functions.invoke('softruck-api', {
              body: {
                operation: 'desassociar-device-veiculo',
                data: { deviceId: rastreador.id },
              },
            });
            await supabase.from('rastreadores').update({
              veiculo_id: null,
              status: 'estoque',
            }).eq('id', rastreador.id);
          } catch (error) {
            console.error('Erro ao desvincular Softruck:', error);
          }
        }
      }

      // 3. Atualizar status do associado
      const { error } = await supabase.from('associados').update({
        status: 'cancelado' as StatusAssociado,
        motivo_bloqueio: motivo,
        updated_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('Associado cancelado');
    },
    onError: () => toast.error('Erro ao cancelar associado'),
  });

  const atualizarDados = useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: AssociadoUpdate }) => {
      // 1. Atualizar banco local
      const { error } = await supabase.from('associados').update({
        ...dados,
        updated_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;

      // 2. Verificar se associado tem veículo com rastreador Rede Veículos
      const { data: veiculos } = await supabase
        .from('veiculos')
        .select('id, rede_veiculos_cliente_id')
        .eq('associado_id', id);

      const temRedeVeiculos = veiculos?.some(v => v.rede_veiculos_cliente_id);

      // 3. Se tem, sincronizar com plataforma
      if (temRedeVeiculos) {
        try {
          await supabase.functions.invoke('rede-veiculos-atualizar-cliente', {
            body: {
              associadoId: id,
              camposAlterados: dados,
            },
          });
          console.log('[atualizarDados] Dados sincronizados com Rede Veículos');
        } catch (err) {
          console.warn('[atualizarDados] Erro ao sincronizar com Rede Veículos:', err);
          // Não bloqueia o fluxo
        }
      }
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('Dados atualizados!');
    },
    onError: () => toast.error('Erro ao atualizar dados'),
  });

  return {
    atualizarStatus: atualizarStatus.mutate,
    suspenderAssociado: suspenderAssociado.mutate,
    reativarAssociado: reativarAssociado.mutate,
    cancelarAssociado: cancelarAssociado.mutate,
    excluirAssociado: excluirAssociado.mutateAsync,
    atualizarDados: atualizarDados.mutate,
    isAtualizandoStatus: atualizarStatus.isPending,
    isSuspendendo: suspenderAssociado.isPending,
    isReativando: reativarAssociado.isPending,
    isCancelando: cancelarAssociado.isPending,
    isExcluindo: excluirAssociado.isPending,
    isAtualizandoDados: atualizarDados.isPending,
  };
}

// ============================================
// HOOK: EXCLUIR ASSOCIADO (standalone) - Usa Edge Function
// ============================================
export function useDeleteAssociado() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (associadoId: string) => {
      // Usar Edge Function para exclusão robusta com service role
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Você precisa estar autenticado');
      }

      const response = await fetch(
        'https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/delete-associado',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ associadoId }),
        }
      );

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao excluir associado');
      }
      
      return result;
    },
    onSuccess: (result) => {
      // Invalidar todas as queries relacionadas a associados
      queryClient.invalidateQueries({ queryKey: ['associados'] });
      queryClient.invalidateQueries({ queryKey: ['associados-contagem'] });
      queryClient.invalidateQueries({ queryKey: ['associados-cidades'] });
      queryClient.invalidateQueries({ queryKey: ['associado'] });
      
      // Invalidar instalações e veículos (excluídos junto com associado)
      queryClient.invalidateQueries({ queryKey: ['instalacoes-aguardando-ativacao'] });
      queryClient.invalidateQueries({ queryKey: ['instalacoes'] });
      queryClient.invalidateQueries({ queryKey: ['veiculos'] });
      queryClient.invalidateQueries({ queryKey: ['veiculos-associado'] });
      
      // Invalidar propostas pendentes (UI atualizada)
      queryClient.invalidateQueries({ queryKey: ['propostas-pendentes'] });
      queryClient.invalidateQueries({ queryKey: ['proposta-stats'] });
      
      toast.success(result.message || 'Associado excluído permanentemente');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Erro ao excluir associado');
    },
  });
}

// ============================================
// HOOKS DE MUTAÇÃO (legado - mantido para compatibilidade)
// ============================================
export function useCreateAssociado() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (associado: AssociadoInsert) => {
      const { data, error } = await supabase
        .from('associados')
        .insert(associado)
        .select()
        .single();

      if (error) throw error;
      return data as Associado;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['associados'] });
      queryClient.invalidateQueries({ queryKey: ['associados-contagem'] });
    },
  });
}

export function useUpdateAssociado() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      motivo,
      dadosAnteriores,
      camposAlteradosLabels,
      ...updates
    }: AssociadoUpdate & {
      id: string;
      motivo?: string;
      dadosAnteriores?: Record<string, unknown>;
      camposAlteradosLabels?: Record<string, string>;
    }) => {
      // 0. Registrar histórico ANTES do update, para garantir auditoria
      //    mesmo se o UPDATE falhar parcialmente em alguma trigger.
      if (motivo && dadosAnteriores && Object.keys(dadosAnteriores).length > 0) {
        try {
          const { data: authData } = await supabase.auth.getUser();
          const authUserId = authData.user?.id || null;
          let profileId: string | null = null;
          if (authUserId) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('id')
              .eq('user_id', authUserId)
              .maybeSingle();
            profileId = profile?.id || null;
          }

          const camposAlterados = Object.keys(dadosAnteriores);
          const labelList = camposAlterados
            .map((c) => camposAlteradosLabels?.[c] || c)
            .slice(0, 5)
            .join(', ');
          const extra = camposAlterados.length > 5 ? ` e mais ${camposAlterados.length - 5}` : '';

          const dadosNovosFiltrados: Record<string, unknown> = {};
          for (const k of camposAlterados) {
            dadosNovosFiltrados[k] = (updates as any)[k];
          }

          await supabase.from('associados_historico').insert({
            associado_id: id,
            tipo: 'dados_atualizados',
            acao: 'editar_dados_associado',
            descricao: `Edição manual de cadastro: ${camposAlterados.length} ${camposAlterados.length === 1 ? 'campo alterado' : 'campos alterados'} (${labelList}${extra})`,
            dados_anteriores: dadosAnteriores as any,
            dados_novos: dadosNovosFiltrados as any,
            motivo,
            usuario_id: profileId,
            executado_por: authUserId,
            metadata: {
              origem: 'cadastro_editar_dados',
              campos: camposAlterados,
              user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
            } as any,
          });
        } catch (histErr) {
          console.error('[useUpdateAssociado] Falha ao gravar histórico:', histErr);
          throw new Error('Não foi possível registrar a alteração no histórico. Operação cancelada.');
        }
      }

      // 1. Atualizar banco local
      const { data, error } = await supabase
        .from('associados')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // 2. Verificar se associado tem veículo com rastreador Rede Veículos
      const { data: veiculos } = await supabase
        .from('veiculos')
        .select('id, rede_veiculos_cliente_id')
        .eq('associado_id', id);

      const temRedeVeiculos = veiculos?.some(v => v.rede_veiculos_cliente_id);

      // 3. Se tem, sincronizar com plataforma
      if (temRedeVeiculos) {
        try {
          await supabase.functions.invoke('rede-veiculos-atualizar-cliente', {
            body: {
              associadoId: id,
              camposAlterados: updates,
            },
          });
          console.log('[useUpdateAssociado] Dados sincronizados com Rede Veículos');
        } catch (err) {
          console.warn('[useUpdateAssociado] Erro ao sincronizar com Rede Veículos:', err);
          // Não bloqueia o fluxo
        }
      }

      return data as Associado;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['associados'] });
      queryClient.invalidateQueries({ queryKey: ['associado', data.id] });
      queryClient.invalidateQueries({ queryKey: ['associado-historico-completo', data.id] });
    },
  });
}

export function useUpdateAssociadoStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
      motivo
    }: {
      id: string;
      status: StatusAssociado;
      motivo?: string;
    }) => {
      const updates: Partial<Associado> = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (status === 'bloqueado' || status === 'suspenso' || status === 'cancelado') {
        updates.motivo_bloqueio = motivo;
        updates.data_bloqueio = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('associados')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Associado;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['associados'] });
      queryClient.invalidateQueries({ queryKey: ['associado', data.id] });
    },
  });
}
