import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FotoVistoriaVeiculo {
  id: string;
  tipo: string;
  arquivo_url: string;
  created_at: string;
  vistoria_id: string;
  vistoria_status: string | null;
  vistoria_modalidade: string | null;
}

/**
 * Hook para buscar todas as fotos de vistoria de um veículo específico
 * Caminho: veiculos -> contratos -> vistorias -> vistoria_fotos
 */
export function useFotosVistoriaPorVeiculo(veiculoId: string | undefined) {
  return useQuery({
    queryKey: ['veiculo-fotos-vistoria', veiculoId],
    queryFn: async (): Promise<FotoVistoriaVeiculo[]> => {
      if (!veiculoId) return [];

      // 1. Buscar contratos do veículo
      const { data: contratos, error: errContratos } = await supabase
        .from('contratos')
        .select('id')
        .eq('veiculo_id', veiculoId);

      if (errContratos) throw errContratos;
      if (!contratos || contratos.length === 0) return [];

      const contratoIds = contratos.map(c => c.id);

      // 2. Buscar vistorias desses contratos
      const { data: vistorias, error: errVistorias } = await supabase
        .from('vistorias')
        .select('id, status, modalidade')
        .in('contrato_id', contratoIds);

      if (errVistorias) throw errVistorias;
      if (!vistorias || vistorias.length === 0) return [];

      const vistoriaIds = vistorias.map(v => v.id);
      const vistoriaMap = new Map(vistorias.map(v => [v.id, v]));

      // 3. Buscar fotos das vistorias
      const { data: fotos, error: errFotos } = await supabase
        .from('vistoria_fotos')
        .select('id, tipo, arquivo_url, created_at, vistoria_id')
        .in('vistoria_id', vistoriaIds)
        .order('created_at', { ascending: true });

      if (errFotos) throw errFotos;

      // Enriquecer fotos com dados da vistoria
      return (fotos || []).map(foto => {
        const vistoria = vistoriaMap.get(foto.vistoria_id);
        return {
          ...foto,
          vistoria_status: vistoria?.status || null,
          vistoria_modalidade: vistoria?.modalidade || null,
        };
      });
    },
    enabled: !!veiculoId,
  });
}

/**
 * Hook para buscar documentos de um associado (combinando as duas fontes)
 */
export function useDocumentosAssociadoCompleto(associadoId: string | undefined) {
  return useQuery({
    queryKey: ['associado-documentos-completo', associadoId],
    queryFn: async () => {
      if (!associadoId) return { documentos: [], documentosCotacao: [] };

      // 1. Buscar documentos da tabela 'documentos'
      const { data: documentos, error: errDocs } = await supabase
        .from('documentos')
        .select('*')
        .eq('associado_id', associadoId)
        .order('created_at', { ascending: false });

      if (errDocs) throw errDocs;

      // 2. Buscar documentos da cotação via contratos
      const { data: contratos } = await supabase
        .from('contratos')
        .select('id, cotacao_id')
        .eq('associado_id', associadoId);

      let documentosCotacao: any[] = [];
      
      if (contratos && contratos.length > 0) {
        const contratoIds = contratos.map(c => c.id);
        const cotacaoIds = contratos.map(c => c.cotacao_id).filter(Boolean);

        // Buscar documentos vinculados a contratos
        const { data: docsCotacao } = await supabase
          .from('contratos_documentos')
          .select('*')
          .in('contrato_id', contratoIds)
          .order('created_at', { ascending: false });

        documentosCotacao = docsCotacao || [];

        // Também buscar por cotacao_id
        if (cotacaoIds.length > 0) {
          const { data: docsCotacaoId } = await supabase
            .from('contratos_documentos')
            .select('*')
            .in('cotacao_id', cotacaoIds as string[])
            .order('created_at', { ascending: false });

          if (docsCotacaoId) {
            // Evitar duplicatas
            const existingIds = new Set(documentosCotacao.map(d => d.id));
            docsCotacaoId.forEach(doc => {
              if (!existingIds.has(doc.id)) {
                documentosCotacao.push(doc);
              }
            });
          }
        }
      }

      return { documentos: documentos || [], documentosCotacao };
    },
    enabled: !!associadoId,
  });
}

// Tipos de foto agrupados por categoria
const TIPOS_IDENTIFICACAO = ['selfie', 'chassi', 'motor'];
const TIPOS_EXTERIOR = ['frente', 'traseira', 'lateral_esquerda', 'lateral_direita', 'roda'];
const TIPOS_INTERIOR = ['painel', 'hodometro', 'interior'];

export interface FotosAgrupadas {
  identificacao: FotoVistoriaVeiculo[];
  exterior: FotoVistoriaVeiculo[];
  interior: FotoVistoriaVeiculo[];
  outros: FotoVistoriaVeiculo[];
}

/**
 * Agrupa fotos por categoria
 */
export function agruparFotosVeiculo(fotos: FotoVistoriaVeiculo[]): FotosAgrupadas {
  const agrupadas: FotosAgrupadas = {
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
export function formatarTipoFotoVeiculo(tipo: string): string {
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
