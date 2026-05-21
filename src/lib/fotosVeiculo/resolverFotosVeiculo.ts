/**
 * Resolver canônico unificado de fotos do veículo.
 *
 * Une as 3 fontes possíveis e remove duplicatas por arquivo_url:
 *   1. vistoria_fotos  via vistorias.veiculo_id   (canônica — captura
 *      autovistoria, presencial técnica, troca de titularidade, etc.)
 *   2. cotacoes_vistoria_fotos via cotacao_id     (autovistoria que ficou
 *      apenas no espaço da cotação pública)
 *   3. instalacao_fotos via instalacao_id         (fotos gravadas pelo
 *      instalador no fluxo legado)
 *
 * O vídeo 360° é resolvido pela mesma ordem de prioridade, separando
 *   - videoInstalador  → vistoria.modalidade = 'presencial'
 *   - videoAssociado   → vistoria.modalidade = 'autovistoria'
 *                       (ou cotacoes_vistoria_fotos.tipo = 'video_360')
 *
 * Usado por todas as telas de aprovação/análise que precisam mostrar as
 * fotos de um mesmo veículo sem depender da cadeia frágil
 * instalacao_origem_id / vistoria_origem_id do `servicos`.
 *
 * Referência: mem://logic/operations/historico-fotos-veiculo-canonico
 */

import { supabase } from '@/integrations/supabase/client';

export interface FotoVeiculoUnificada {
  id: string;
  tipo: string | null;
  arquivo_url: string;
  created_at: string | null;
  source: 'vistoria_fotos' | 'cotacoes_vistoria_fotos' | 'instalacao_fotos';
  vistoria_id?: string | null;
  vistoria_modalidade?: string | null;
}

export interface ResolverFotosVeiculoInput {
  veiculoId?: string | null;
  contratoId?: string | null;
  cotacaoId?: string | null;
  instalacaoId?: string | null;
}

export interface ResolverFotosVeiculoResult {
  fotos: FotoVeiculoUnificada[];
  videoInstalador: string | null;
  videoAssociado: string | null;
  vistoriaModalidade: string | null; // modalidade da vistoria "principal" (presencial > autovistoria)
  counts: {
    vistoria_fotos: number;
    cotacoes_vistoria_fotos: number;
    instalacao_fotos: number;
    duplicatas_removidas: number;
    total: number;
  };
}

/**
 * Resolve todas as fotos + vídeo 360° de um veículo a partir de qualquer
 * combinação de identificadores disponíveis (veiculoId, contratoId,
 * cotacaoId, instalacaoId).
 */
export async function resolverFotosVeiculo(
  input: ResolverFotosVeiculoInput,
): Promise<ResolverFotosVeiculoResult> {
  const { veiculoId, contratoId } = input;
  let { cotacaoId, instalacaoId } = input;

  // Resolver cotacaoId via contrato (quando não veio direto)
  if (!cotacaoId && contratoId) {
    const { data } = await supabase
      .from('contratos')
      .select('cotacao_id')
      .eq('id', contratoId)
      .maybeSingle();
    cotacaoId = data?.cotacao_id ?? null;
  }

  // ============= 1) vistoria_fotos via vistorias.veiculo_id (canônica)
  let vistoriaRows: any[] = [];
  let vistoriaFotos: any[] = [];
  if (veiculoId) {
    const { data: vistorias } = await supabase
      .from('vistorias')
      .select('id, modalidade, video_360_url, status, created_at')
      .eq('veiculo_id', veiculoId);
    vistoriaRows = vistorias || [];
    const ids = vistoriaRows.map((v) => v.id);
    if (ids.length > 0) {
      const { data } = await supabase
        .from('vistoria_fotos')
        .select('id, tipo, arquivo_url, created_at, vistoria_id')
        .in('vistoria_id', ids)
        .order('created_at', { ascending: true });
      vistoriaFotos = data || [];
    }
  }

  // ============= 2) cotacoes_vistoria_fotos via cotacao_id
  let cotacaoFotos: any[] = [];
  if (cotacaoId) {
    const { data } = await supabase
      .from('cotacoes_vistoria_fotos')
      .select('id, tipo, arquivo_url, created_at')
      .eq('cotacao_id', cotacaoId)
      .order('created_at', { ascending: true });
    cotacaoFotos = data || [];
  }

  // ============= 3) instalacao_fotos via instalacao_id
  // Se não veio instalacaoId mas temos veiculoId, tenta resolver via instalacao
  // ativa do veículo (fallback útil quando só temos veiculoId).
  if (!instalacaoId && veiculoId) {
    const { data } = await supabase
      .from('instalacoes')
      .select('id, created_at')
      .eq('veiculo_id', veiculoId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    instalacaoId = data?.id ?? null;
  }
  let instalacaoFotos: any[] = [];
  if (instalacaoId) {
    const { data } = await supabase
      .from('instalacao_fotos')
      .select('id, tipo, arquivo_url, created_at')
      .eq('instalacao_id', instalacaoId)
      .order('created_at', { ascending: true });
    instalacaoFotos = data || [];
  }

  // ============= Mesclar com dedupe por arquivo_url
  const vistoriaModalidadeMap = new Map<string, string | null>(
    vistoriaRows.map((v) => [v.id, v.modalidade ?? null]),
  );

  const mapaPorUrl = new Map<string, FotoVeiculoUnificada>();
  let duplicatas = 0;

  const addFoto = (foto: FotoVeiculoUnificada) => {
    const key = foto.arquivo_url;
    if (!key) return;
    if (mapaPorUrl.has(key)) {
      duplicatas++;
      return;
    }
    mapaPorUrl.set(key, foto);
  };

  for (const f of vistoriaFotos) {
    addFoto({
      id: f.id,
      tipo: f.tipo,
      arquivo_url: f.arquivo_url,
      created_at: f.created_at,
      source: 'vistoria_fotos',
      vistoria_id: f.vistoria_id,
      vistoria_modalidade: vistoriaModalidadeMap.get(f.vistoria_id) ?? null,
    });
  }
  for (const f of cotacaoFotos) {
    addFoto({
      id: f.id,
      tipo: f.tipo,
      arquivo_url: f.arquivo_url,
      created_at: f.created_at,
      source: 'cotacoes_vistoria_fotos',
    });
  }
  for (const f of instalacaoFotos) {
    addFoto({
      id: f.id,
      tipo: f.tipo,
      arquivo_url: f.arquivo_url,
      created_at: f.created_at,
      source: 'instalacao_fotos',
    });
  }

  const fotos = Array.from(mapaPorUrl.values()).filter(
    (f) => f.tipo !== 'video_360',
  );

  // ============= Vídeo 360°: prioridade modalidade=presencial → autovistoria
  let videoInstalador: string | null = null;
  let videoAssociado: string | null = null;
  let vistoriaModalidade: string | null = null;

  for (const v of vistoriaRows) {
    if (!v.video_360_url) continue;
    if (v.modalidade === 'presencial' && !videoInstalador) {
      videoInstalador = v.video_360_url;
      vistoriaModalidade = vistoriaModalidade || 'presencial';
    } else if (v.modalidade === 'autovistoria' && !videoAssociado) {
      videoAssociado = v.video_360_url;
      vistoriaModalidade = vistoriaModalidade || 'autovistoria';
    }
  }

  // Vídeo 360 da cotação como fallback do videoAssociado
  if (!videoAssociado) {
    const videoCotacao = cotacaoFotos.find((f) => f.tipo === 'video_360');
    if (videoCotacao?.arquivo_url) videoAssociado = videoCotacao.arquivo_url;
  }

  // Vídeo 360 em vistoria_fotos (legacy: gravado como foto tipo=video_360)
  if (!videoInstalador && !videoAssociado) {
    const v = vistoriaFotos.find((f) => f.tipo === 'video_360');
    if (v?.arquivo_url) {
      const modalidade = vistoriaModalidadeMap.get(v.vistoria_id);
      if (modalidade === 'autovistoria') videoAssociado = v.arquivo_url;
      else videoInstalador = v.arquivo_url;
    }
  }

  return {
    fotos,
    videoInstalador,
    videoAssociado,
    vistoriaModalidade,
    counts: {
      vistoria_fotos: vistoriaFotos.length,
      cotacoes_vistoria_fotos: cotacaoFotos.length,
      instalacao_fotos: instalacaoFotos.length,
      duplicatas_removidas: duplicatas,
      total: fotos.length,
    },
  };
}
