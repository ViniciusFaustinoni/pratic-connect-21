import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Oficina, StatusOficina } from '@/types/database';
import { atualizarCoordenadasOficina } from '@/services/geocodingService';

export interface OficinaFilters {
  status?: StatusOficina;
  cidade?: string;
  estado?: string;
  search?: string;
  especialidade?: string;
  marca?: string;
}

export function useOficinas(filters?: OficinaFilters) {
  const geocodingDone = useRef(false);

  const query = useQuery({
    queryKey: ['oficinas', filters],
    queryFn: async () => {
      let q = supabase
        .from('oficinas')
        .select('*')
        .order('razao_social');

      if (filters?.status) {
        q = q.eq('status', filters.status);
      }
      if (filters?.cidade) {
        q = q.eq('cidade', filters.cidade);
      }
      if (filters?.estado) {
        q = q.eq('estado', filters.estado);
      }
      if (filters?.search) {
        q = q.or(`razao_social.ilike.%${filters.search}%,nome_fantasia.ilike.%${filters.search}%,cnpj.ilike.%${filters.search}%`);
      }
      if (filters?.especialidade) {
        q = q.contains('especialidades', [filters.especialidade]);
      }
      if (filters?.marca) {
        q = q.or(`marcas_atendidas.cs.{${filters.marca}},marcas_atendidas.cs.{GLOBAL}`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data as Oficina[];
    },
  });

  // Lazy geocoding: geocodificar oficinas existentes sem coordenadas
  useEffect(() => {
    if (!query.data || geocodingDone.current) return;
    geocodingDone.current = true;

    const semCoordenadas = query.data.filter(
      (o: any) => o.logradouro && (o.latitude == null || o.longitude == null)
    ).slice(0, 3);

    if (semCoordenadas.length === 0) return;

    // Geocodificar com delay de 1.2s entre cada para respeitar rate limit
    semCoordenadas.forEach((oficina: any, index: number) => {
      setTimeout(() => {
        atualizarCoordenadasOficina(oficina.id, {
          logradouro: oficina.logradouro,
          numero: oficina.numero,
          bairro: oficina.bairro,
          cidade: oficina.cidade,
          uf: oficina.estado,
          cep: oficina.cep,
        }).then((result) => {
          if (result.success) {
            console.log(`[Lazy Geocode] Oficina ${oficina.razao_social} geocodificada`);
          }
        });
      }, index * 1200);
    });
  }, [query.data]);

  return query;
}

export function useOficina(id: string | undefined) {
  return useQuery({
    queryKey: ['oficina', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('oficinas')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Oficina;
    },
    enabled: !!id,
  });
}

export function useCreateOficina() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (oficina: Omit<Oficina, 'id' | 'created_at' | 'updated_at' | 'nota_media' | 'total_avaliacoes'>) => {
      const { data, error } = await supabase
        .from('oficinas')
        .insert(oficina)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oficinas'] });
      toast.success('Oficina cadastrada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao cadastrar oficina: ' + error.message);
    },
  });
}

export function useUpdateOficina() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Oficina> & { id: string }) => {
      const { error } = await supabase
        .from('oficinas')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['oficinas'] });
      queryClient.invalidateQueries({ queryKey: ['oficina', variables.id] });
      toast.success('Oficina atualizada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar oficina: ' + error.message);
    },
  });
}
