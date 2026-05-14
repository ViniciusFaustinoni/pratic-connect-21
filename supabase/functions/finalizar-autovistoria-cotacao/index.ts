// Edge: finalizar-autovistoria-cotacao
// Materializa a finalização da autovistoria pública criando registros canônicos:
//  - vistorias (tipo='entrada', status='pendente', modalidade='autovistoria')
//  - vistoria_fotos (cópia das cotacoes_vistoria_fotos)
//  - servicos (tipo='vistoria_entrada', status='concluida', modalidade='autovistoria')
//
// Sem isso, a fila Monitoramento › Aprovação de Associados (que lê servicos
// concluida do tipo vistoria_entrada/instalacao) NÃO enxerga o caso e o veículo
// fica em limbo após o pagamento — exatamente o bug da COT-…-563.
//
// Idempotente por cotacao_id: se já existir vistoria/servico para essa cotação,
// apenas retorna os ids existentes (não duplica).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { cotacaoId } = await req.json().catch(() => ({}));
    if (!cotacaoId || typeof cotacaoId !== 'string') {
      return jsonResponse({ success: false, error: 'cotacaoId obrigatório' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    // 1. Cotação
    const { data: cotacao, error: errCot } = await supabase
      .from('cotacoes')
      .select('id, numero, nome_solicitante, telefone1_solicitante, tipo_vistoria, veiculo_placa, veiculo_chassi, km_atual, status_contratacao, vistoria_concluida_em')
      .eq('id', cotacaoId)
      .maybeSingle();

    if (errCot || !cotacao) {
      return jsonResponse({ success: false, error: 'Cotação não encontrada' }, 404);
    }

    // 2. Contrato + veículo + associado (último não-cancelado)
    const { data: contrato } = await supabase
      .from('contratos')
      .select('id, associado_id, veiculo_id, status, vistoria_id')
      .eq('cotacao_id', cotacaoId)
      .neq('status', 'cancelado')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const associadoId = contrato?.associado_id ?? null;
    const veiculoId = contrato?.veiculo_id ?? null;
    const contratoId = contrato?.id ?? null;

    // 3. IDEMPOTÊNCIA: vistoria existente para essa cotação
    const { data: vistoriaExistente } = await supabase
      .from('vistorias')
      .select('id, status')
      .eq('cotacao_id', cotacaoId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 4. Carregar fotos da autovistoria
    const { data: fotos } = await supabase
      .from('cotacoes_vistoria_fotos')
      .select('id, tipo, arquivo_url, latitude, longitude, created_at')
      .eq('cotacao_id', cotacaoId)
      .order('created_at', { ascending: true });

    const fotosArr = fotos ?? [];
    const videoFoto = fotosArr.find((f) => f.tipo === 'video_360' || f.tipo === 'video');
    const videoUrl = videoFoto?.arquivo_url ?? null;

    let vistoriaId = vistoriaExistente?.id ?? null;
    let createdVistoria = false;

    if (!vistoriaId) {
      const { data: novaVistoria, error: errVist } = await supabase
        .from('vistorias')
        .insert({
          cotacao_id: cotacaoId,
          contrato_id: contratoId,
          veiculo_id: veiculoId,
          associado_id: associadoId,
          tipo: 'entrada',
          status: 'pendente',
          modalidade: 'autovistoria',
          origem: 'autovistoria_publica',
          km_atual: cotacao.km_atual ?? null,
          video_360_url: videoUrl,
          observacoes: `Autovistoria enviada pelo cliente (${cotacao.numero}).`,
        })
        .select('id')
        .single();

      if (errVist || !novaVistoria) {
        console.error('[finalizar-autovistoria] insert vistorias falhou:', errVist);
        return jsonResponse({ success: false, error: 'Falha ao criar vistoria', detail: errVist?.message }, 500);
      }
      vistoriaId = novaVistoria.id;
      createdVistoria = true;
    }

    // 5. Materializar fotos em vistoria_fotos (idempotente: pula se já tem)
    let fotosCopiadas = 0;
    if (createdVistoria && fotosArr.length > 0) {
      const rows = fotosArr
        .filter((f) => !!f.arquivo_url)
        .map((f) => ({
          vistoria_id: vistoriaId,
          tipo: f.tipo,
          arquivo_url: f.arquivo_url,
        }));
      if (rows.length > 0) {
        const { error: errFotos } = await supabase.from('vistoria_fotos').insert(rows);
        if (errFotos) {
          console.error('[finalizar-autovistoria] insert vistoria_fotos falhou:', errFotos);
        } else {
          fotosCopiadas = rows.length;
        }
      }
    }

    // 6. Criar/garantir servico vistoria_entrada concluida → entra na fila do Monitoramento
    const { data: servicoExistente } = await supabase
      .from('servicos')
      .select('id, status')
      .eq('cotacao_id', cotacaoId)
      .eq('tipo', 'vistoria_entrada')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let servicoId = servicoExistente?.id ?? null;
    let createdServico = false;
    const agora = new Date();

    if (!servicoId) {
      const hojeISO = agora.toISOString().slice(0, 10);
      const { data: novoServico, error: errServ } = await supabase
        .from('servicos')
        .insert({
          tipo: 'vistoria_entrada',
          status: 'concluida',
          modalidade: 'autovistoria',
          data_agendada: hojeISO,
          periodo: 'manha',
          associado_id: associadoId,
          veiculo_id: veiculoId,
          contrato_id: contratoId,
          cotacao_id: cotacaoId,
          concluida_em: agora.toISOString(),
          iniciada_em: agora.toISOString(),
          km_atual: cotacao.km_atual ?? null,
          video_360_url: videoUrl,
          origem: 'autovistoria_publica',
          observacoes: `Autovistoria — ${cotacao.nome_solicitante || ''} (${cotacao.numero}).`,
        })
        .select('id')
        .single();

      if (errServ) {
        console.error('[finalizar-autovistoria] insert servicos falhou:', errServ);
      } else if (novoServico) {
        servicoId = novoServico.id;
        createdServico = true;
      }
    } else if (servicoExistente?.status !== 'concluida') {
      // Garantir que servico fica em 'concluida' para entrar na fila
      await supabase
        .from('servicos')
        .update({ status: 'concluida', concluida_em: agora.toISOString() })
        .eq('id', servicoId);
    }

    // 7. Atualizar cotação + contrato com referências
    await supabase
      .from('cotacoes')
      .update({
        tipo_vistoria: cotacao.tipo_vistoria || 'autovistoria',
        status_contratacao: 'vistoria_ok',
        vistoria_concluida_em: cotacao.vistoria_concluida_em || agora.toISOString(),
      })
      .eq('id', cotacaoId);

    if (contratoId && !contrato?.vistoria_id && vistoriaId) {
      await supabase
        .from('contratos')
        .update({ vistoria_id: vistoriaId })
        .eq('id', contratoId);
    }

    // 8. Auditoria (best effort)
    await supabase.from('logs_auditoria').insert({
      acao: 'autovistoria_materializada',
      modulo: 'vistorias',
      tabela: 'vistorias',
      registro_id: vistoriaId,
      descricao: `Autovistoria materializada para cotação ${cotacao.numero} (${cotacaoId}). vistoria=${vistoriaId} servico=${servicoId} fotos=${fotosCopiadas} created_v=${createdVistoria} created_s=${createdServico}`,
    }).then(() => {}, () => {});

    return jsonResponse({
      success: true,
      vistoriaId,
      servicoId,
      fotosCopiadas,
      idempotent: !createdVistoria && !createdServico,
    });
  } catch (e) {
    console.error('[finalizar-autovistoria] erro:', e);
    return jsonResponse({ success: false, error: (e as Error)?.message || 'erro' }, 500);
  }
});
