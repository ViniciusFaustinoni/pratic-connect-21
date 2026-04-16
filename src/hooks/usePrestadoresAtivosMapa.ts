import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { subMinutes } from "date-fns";

export interface PrestadorMapa {
  link_id: string;
  origem_tabela: 'vistoria' | 'instalacao';
  prestador_id: string;
  prestador_nome: string;
  prestador_telefone: string | null;
  status: 'aceito' | 'em_rota' | 'em_execucao';
  latitude: number;
  longitude: number;
  localizacao_atualizada_em: string;
  // Destination (instalacao)
  instalacao_id: string;
  destino_lat: number | null;
  destino_lng: number | null;
  associado_nome: string | null;
  associado_telefone: string | null;
  veiculo_placa: string | null;
  is_prestador: true;
}

const STATUS_ATIVO = ['aceito', 'em_rota', 'em_execucao'];

async function buscarLinksAtivos(tabela: 'vistoria_prestador_links' | 'instalacao_prestador_links', cutoff: string) {
  const isVistoria = tabela === 'vistoria_prestador_links';
  const prestadorFk = isVistoria ? 'vistoriador_prestador_id' : 'prestador_id';
  const prestadorTbl = isVistoria ? 'vistoriadores_prestadores' : 'prestadores_assistencia';

  const { data, error } = await supabase
    .from(tabela as any)
    .select(`
      id, status, latitude, longitude, localizacao_atualizada_em,
      ${prestadorFk},
      instalacao_id,
      instalacoes:instalacao_id (
        id, endereco_latitude, endereco_longitude,
        veiculos:veiculo_id ( placa ),
        associados:associado_id ( nome, telefone )
      )
    `)
    .in('status', STATUS_ATIVO)
    .gte('localizacao_atualizada_em', cutoff)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null);

  if (error) {
    console.error(`Erro ${tabela}:`, error);
    return [];
  }
  if (!data?.length) return [];

  const prestadorIds = Array.from(new Set(data.map((r: any) => r[prestadorFk]).filter(Boolean)));
  if (!prestadorIds.length) return [];

  const nomeField = isVistoria ? 'nome' : 'razao_social';
  const fantasiaField = isVistoria ? null : 'nome_fantasia';
  const telField = isVistoria ? 'telefone' : 'whatsapp';
  const telFallback = isVistoria ? null : 'telefone';

  const { data: prestadores } = await supabase
    .from(prestadorTbl as any)
    .select('*')
    .in('id', prestadorIds);

  const mapPrestador = new Map((prestadores || []).map((p: any) => [p.id, p]));

  return data.map((r: any) => {
    const prest = mapPrestador.get(r[prestadorFk]);
    if (!prest) return null;
    const inst = r.instalacoes;
    return {
      link_id: r.id,
      origem_tabela: isVistoria ? 'vistoria' : 'instalacao',
      prestador_id: r[prestadorFk],
      prestador_nome: (fantasiaField && (prest as any)[fantasiaField]) || (prest as any)[nomeField] || 'Prestador',
      prestador_telefone: (prest as any)[telField] || (telFallback ? (prest as any)[telFallback] : null) || null,
      status: r.status,
      latitude: r.latitude,
      longitude: r.longitude,
      localizacao_atualizada_em: r.localizacao_atualizada_em,
      instalacao_id: r.instalacao_id,
      destino_lat: inst?.endereco_latitude ? Number(inst.endereco_latitude) : null,
      destino_lng: inst?.endereco_longitude ? Number(inst.endereco_longitude) : null,
      associado_nome: inst?.associados?.nome || null,
      associado_telefone: inst?.associados?.telefone || null,
      veiculo_placa: inst?.veiculos?.placa || null,
      is_prestador: true as const,
    } as PrestadorMapa;
  }).filter(Boolean) as PrestadorMapa[];
}

export function usePrestadoresAtivosMapa() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['prestadores-ativos-mapa'],
    queryFn: async (): Promise<PrestadorMapa[]> => {
      const cutoff = subMinutes(new Date(), 15).toISOString();
      const [vist, inst] = await Promise.all([
        buscarLinksAtivos('vistoria_prestador_links', cutoff),
        buscarLinksAtivos('instalacao_prestador_links', cutoff),
      ]);
      return [...vist, ...inst];
    },
    refetchInterval: 30_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel('prestadores-mapa-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vistoria_prestador_links' }, () => {
        queryClient.invalidateQueries({ queryKey: ['prestadores-ativos-mapa'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'instalacao_prestador_links' }, () => {
        queryClient.invalidateQueries({ queryKey: ['prestadores-ativos-mapa'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}
