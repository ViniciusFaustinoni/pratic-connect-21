import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FotoAutovistoria {
  id: string;
  tipo: string;
  arquivo_url: string;
  created_at: string;
}

export interface FotosAutovistoriaAgrupadas {
  identificacao: FotoAutovistoria[];
  exterior: FotoAutovistoria[];
  interior: FotoAutovistoria[];
  outros: FotoAutovistoria[];
}

const TIPOS_IDENTIFICACAO = ['selfie', 'chassi', 'motor'];
const TIPOS_EXTERIOR = ['frente', 'traseira', 'lateral_esquerda', 'lateral_direita', 'roda'];
const TIPOS_INTERIOR = ['painel', 'hodometro', 'interior'];

/**
 * Hook para buscar fotos de autovistoria da tabela cotacoes_vistoria_fotos (legado)
 */
export function useFotosAutovistoriaCotacao(cotacaoId: string | undefined) {
  return useQuery({
    queryKey: ['autovistoria-fotos', cotacaoId],
    queryFn: async (): Promise<FotoAutovistoria[]> => {
      if (!cotacaoId) return [];

      const { data, error } = await supabase
        .from('cotacoes_vistoria_fotos')
        .select('id, tipo, arquivo_url, created_at')
        .eq('cotacao_id', cotacaoId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as FotoAutovistoria[];
    },
    enabled: !!cotacaoId,
  });
}

/**
 * Hook UNIFICADO para buscar fotos de vistoria - funciona para cotações E propostas
 * Prioriza fotos da tabela vistoria_fotos (nova arquitetura)
 * Fallback para cotacoes_vistoria_fotos (legado - apenas quando existe cotacao_id)
 */
export function useFotosVistoriaUnificada(params: { 
  contratoId?: string; 
  cotacaoId?: string;
}) {
  const { contratoId, cotacaoId } = params;
  
  return useQuery({
    queryKey: ['vistoria-fotos-unificada', contratoId, cotacaoId],
    queryFn: async (): Promise<{
      fotos: FotoAutovistoria[];
      vistoriaId: string | null;
      origem: 'vistoria_fotos' | 'cotacoes_vistoria_fotos' | null;
    }> => {
      // 1. Tentar buscar vistoria vinculada ao contrato (nova arquitetura)
      if (contratoId) {
        const { data: vistoria } = await supabase
          .from('vistorias')
          .select('id, status, modalidade')
          .eq('contrato_id', contratoId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (vistoria?.id) {
          const { data: fotos, error } = await supabase
            .from('vistoria_fotos')
            .select('id, tipo, arquivo_url, created_at')
            .eq('vistoria_id', vistoria.id)
            .order('created_at', { ascending: true });

          if (!error && fotos && fotos.length > 0) {
            return {
              fotos: fotos as FotoAutovistoria[],
              vistoriaId: vistoria.id,
              origem: 'vistoria_fotos',
            };
          }
        }
      }

      // 2. Fallback: buscar em cotacoes_vistoria_fotos (legado)
      if (cotacaoId) {
        const { data: fotosLegado, error } = await supabase
          .from('cotacoes_vistoria_fotos')
          .select('id, tipo, arquivo_url, created_at')
          .eq('cotacao_id', cotacaoId)
          .order('created_at', { ascending: true });

        if (!error && fotosLegado && fotosLegado.length > 0) {
          return {
            fotos: fotosLegado as FotoAutovistoria[],
            vistoriaId: null,
            origem: 'cotacoes_vistoria_fotos',
          };
        }
      }

      // 3. Sem fotos encontradas
      return { fotos: [], vistoriaId: null, origem: null };
    },
    enabled: !!(contratoId || cotacaoId),
  });
}

/**
 * Hook para buscar fotos diretamente por vistoria_id
 */
export function useFotosByVistoriaId(vistoriaId: string | undefined) {
  return useQuery({
    queryKey: ['vistoria-fotos', vistoriaId],
    queryFn: async (): Promise<FotoAutovistoria[]> => {
      if (!vistoriaId) return [];

      const { data, error } = await supabase
        .from('vistoria_fotos')
        .select('id, tipo, arquivo_url, created_at')
        .eq('vistoria_id', vistoriaId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as FotoAutovistoria[];
    },
    enabled: !!vistoriaId,
  });
}

/**
 * Agrupa fotos por categoria
 */
export function agruparFotosPorCategoria(fotos: FotoAutovistoria[]): FotosAutovistoriaAgrupadas {
  const agrupadas: FotosAutovistoriaAgrupadas = {
    identificacao: [],
    exterior: [],
    interior: [],
    outros: [],
  };

  fotos.forEach((foto) => {
    const tipoLower = foto.tipo.toLowerCase();
    
    if (TIPOS_IDENTIFICACAO.some(t => tipoLower.includes(t))) {
      agrupadas.identificacao.push(foto);
    } else if (TIPOS_EXTERIOR.some(t => tipoLower.includes(t))) {
      agrupadas.exterior.push(foto);
    } else if (TIPOS_INTERIOR.some(t => tipoLower.includes(t))) {
      agrupadas.interior.push(foto);
    } else {
      agrupadas.outros.push(foto);
    }
  });

  return agrupadas;
}

/**
 * Formata o tipo da foto para exibição
 */
export function formatarTipoFoto(tipo: string): string {
  const labels: Record<string, string> = {
    selfie: 'Selfie',
    chassi: 'Chassi',
    motor: 'Motor',
    frente: 'Frente',
    traseira: 'Traseira',
    lateral_esquerda: 'Lateral Esquerda',
    lateral_direita: 'Lateral Direita',
    roda: 'Roda',
    painel: 'Painel',
    hodometro: 'Hodômetro',
    interior: 'Interior',
  };

  const tipoLower = tipo.toLowerCase();
  for (const [key, label] of Object.entries(labels)) {
    if (tipoLower.includes(key)) return label;
  }
  
  return tipo.charAt(0).toUpperCase() + tipo.slice(1).replace(/_/g, ' ');
}
