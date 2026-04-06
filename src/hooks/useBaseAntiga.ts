import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BaseAntigaFilters {
  search?: string;
  semRastreador?: boolean;
}

export function useBaseAntigaAssociados(filters?: BaseAntigaFilters, pagination?: { page: number; pageSize: number }) {
  const page = pagination?.page ?? 1;
  const pageSize = pagination?.pageSize ?? 20;

  return useQuery({
    queryKey: ['base-antiga-associados', filters, pagination],
    queryFn: async () => {
      let query = supabase
        .from('associados')
        .select('id, nome, cpf, telefone, email, status, cidade, uf, plano_id, data_adesao, codigo_hinova, created_at, planos(nome)', { count: 'exact' })
        .eq('origem_cadastro', 'api_externa');

      if (filters?.search && filters.search.length >= 2) {
        const term = filters.search.trim();
        const digits = term.replace(/\D/g, '');

        if (digits.length === 11) {
          // CPF search
          query = query.eq('cpf', digits);
        } else {
          // Name search — also search plates via a separate query
          query = query.ilike('nome', `%${term}%`);
        }
      }

      query = query
        .order('nome', { ascending: true })
        .range((page - 1) * pageSize, page * pageSize - 1);

      const { data, error, count } = await query;
      if (error) throw error;

      // If searching by plate/chassi, do a secondary search
      let extraIds: string[] = [];
      if (filters?.search && filters.search.length >= 2) {
        const term = filters.search.trim().toUpperCase();
        const digits = term.replace(/\D/g, '');
        if (digits.length !== 11) {
          const { data: veiculos } = await supabase
            .from('veiculos')
            .select('associado_id')
            .or(`placa.ilike.%${term}%,chassi.ilike.%${term}%`)
            .limit(50);
          if (veiculos?.length) {
            extraIds = veiculos.map(v => v.associado_id).filter(Boolean) as string[];
          }
        }
      }

      // If we found vehicles, merge those associados
      let allData = data || [];
      if (extraIds.length > 0) {
        const existingIds = new Set(allData.map(a => a.id));
        const missingIds = extraIds.filter(id => !existingIds.has(id));
        if (missingIds.length > 0) {
          const { data: extra } = await supabase
            .from('associados')
            .select('id, nome, cpf, telefone, email, status, cidade, uf, plano_id, data_adesao, codigo_hinova, created_at, planos(nome)')
            .eq('origem_cadastro', 'api_externa')
            .in('id', missingIds);
          if (extra) allData = [...allData, ...extra];
        }
      }

      return {
        associados: allData,
        pagination: {
          page,
          pageSize,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / pageSize),
        },
      };
    },
  });
}

export function useBaseAntigaVeiculos(filters?: BaseAntigaFilters, pagination?: { page: number; pageSize: number }) {
  const page = pagination?.page ?? 1;
  const pageSize = pagination?.pageSize ?? 20;

  return useQuery({
    queryKey: ['base-antiga-veiculos', filters, pagination],
    queryFn: async () => {
      // If filtering vehicles without tracker, fetch all veiculo_ids that HAVE a tracker
      let excludeIds: string[] = [];
      if (filters?.semRastreador) {
        const { data: comRastreador } = await supabase
          .from('rastreadores')
          .select('veiculo_id')
          .not('veiculo_id', 'is', null);
        if (comRastreador?.length) {
          excludeIds = comRastreador.map(r => r.veiculo_id).filter(Boolean) as string[];
        }
      }

      // 1) Lightweight count query (head-only, no joins with rastreadores)
      let countQuery = (supabase
        .from('veiculos')
        .select('id, associado:associados!inner(id, origem_cadastro)', { count: 'exact', head: true }) as any)
        .eq('associado.origem_cadastro', 'api_externa');

      if (filters?.search && filters.search.length >= 2) {
        const term = filters.search.trim();
        const upper = term.toUpperCase();
        countQuery = countQuery.or(`placa.ilike.%${upper}%,chassi.ilike.%${upper}%,marca.ilike.%${term}%,modelo.ilike.%${term}%`);
      }

      if (excludeIds.length > 0) {
        countQuery = countQuery.not('id', 'in', `(${excludeIds.join(',')})`);
      }

      // 2) Data query (no count)
      let dataQuery = (supabase
        .from('veiculos')
        .select('id, placa, marca, modelo, ano_fabricacao, ano_modelo, cor, chassi, status, associado_id, associado:associados!inner(id, nome, cpf, origem_cadastro), rastreador:rastreadores!rastreadores_veiculo_id_fkey(id, codigo, status, plataforma)') as any)
        .eq('associado.origem_cadastro', 'api_externa');

      if (filters?.search && filters.search.length >= 2) {
        const term = filters.search.trim();
        const upper = term.toUpperCase();
        dataQuery = dataQuery.or(`placa.ilike.%${upper}%,chassi.ilike.%${upper}%,marca.ilike.%${term}%,modelo.ilike.%${term}%`);
      }

      if (excludeIds.length > 0) {
        dataQuery = dataQuery.not('id', 'in', `(${excludeIds.join(',')})`);
      }

      dataQuery = dataQuery
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      // Run both in parallel
      const [countRes, dataRes] = await Promise.all([countQuery, dataQuery]);

      if (countRes.error) throw countRes.error;
      if (dataRes.error) throw dataRes.error;

      const total = countRes.count || 0;

      const veiculos = (dataRes.data || []).map((v: any) => ({
        ...v,
        associado: Array.isArray(v.associado) ? v.associado[0] : v.associado,
        rastreador: Array.isArray(v.rastreador) ? (v.rastreador.length > 0 ? v.rastreador[0] : null) : v.rastreador || null,
      }));

      return {
        veiculos,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      };
    },
  });
}

export function useBaseAntigaDetalhe(id: string | undefined) {
  return useQuery({
    queryKey: ['base-antiga-detalhe', id],
    queryFn: async () => {
      if (!id) throw new Error('ID obrigatório');

      const [assocRes, veiculosRes, cobrancasRes] = await Promise.all([
        supabase
          .from('associados')
          .select('*, planos(*)')
          .eq('id', id)
          .single(),
        supabase
          .from('veiculos')
          .select('*, rastreador:rastreadores!rastreadores_veiculo_id_fkey(id, codigo, numero_serie, imei, plataforma, status, ultima_comunicacao)')
          .eq('associado_id', id)
          .order('created_at', { ascending: false }),
        supabase
          .from('asaas_cobrancas')
          .select('id, status, valor, data_vencimento, data_pagamento, tipo, referencia, boleto_url, pix_copia_cola')
          .eq('associado_id', id)
          .order('data_vencimento', { ascending: false })
          .limit(50),
      ]);

      if (assocRes.error) throw assocRes.error;

      return {
        associado: assocRes.data,
        veiculos: (veiculosRes.data || []).map((v: any) => ({
          ...v,
          rastreador: Array.isArray(v.rastreador) && v.rastreador.length > 0 ? v.rastreador[0] : v.rastreador || null,
        })),
        cobrancas: cobrancasRes.data || [],
      };
    },
    enabled: !!id,
  });
}
