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

    // 1.b Detectar sub-FIPE (carro <30k / moto <9k não-Diesel) — exige passagem pelo Cadastro
    // ANTES de entrar na fila do Monitoramento. O servico vistoria_entrada nasce em
    // `em_analise` (não `concluida`) — quando o Cadastro aprovar (aprovar-proposta),
    // o serviço é promovido para `concluida` e libera Roubo/Furto + entra na fila do Monitoramento.
    const FIPE_MIN_CARRO = 30000;
    const FIPE_MIN_MOTO = 9000;
    let veiculoSubFipe = false;
    try {
      const { data: cfgRows } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', ['operacional_fipe_minimo_rastreador', 'operacional_fipe_minimo_rastreador_moto']);
      const cfgMap: Record<string, string> = {};
      (cfgRows || []).forEach((r: any) => { cfgMap[r.chave] = r.valor; });
      const fipeMinCarro = Number(cfgMap['operacional_fipe_minimo_rastreador']) || FIPE_MIN_CARRO;
      const fipeMinMoto = Number(cfgMap['operacional_fipe_minimo_rastreador_moto']) || FIPE_MIN_MOTO;

      const { data: veicRow } = await supabase
        .from('veiculos')
        .select('id, marca, modelo, valor_fipe, combustivel, categoria')
        .eq('placa', cotacao.veiculo_placa || '___nope___')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (veicRow) {
        const combustivel = (veicRow.combustivel || '').toLowerCase();
        if (combustivel !== 'diesel') {
          const cat = (veicRow.categoria || '').toLowerCase();
          const modelo = (veicRow.modelo || '').toLowerCase();
          const isMoto = cat.includes('moto') || cat.includes('ciclomotor') || /\b(moto|cg|cb|cbr|pcx|biz|nxr|bros|titan|fan|ybr|fazer|hornet|crosser|xre)\b/.test(modelo);
          const fipe = Number(veicRow.valor_fipe || 0);
          if (fipe > 0) {
            veiculoSubFipe = isMoto ? fipe < fipeMinMoto : fipe < fipeMinCarro;
          }
        }
      }
      console.log(`[finalizar-autovistoria] cotacao=${cotacao.numero} subFipe=${veiculoSubFipe}`);
    } catch (e) {
      console.warn('[finalizar-autovistoria] Falha detect sub-FIPE (segue como ≥30k):', e);
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

    // REGRA MESTRA (8 etapas): autovistoria SEMPRE espera Cadastro aprovar manualmente
    // antes de virar serviço pronto p/ Monitoramento. Vale para sub-FIPE e ≥30k.
    // `aprovar-proposta` promove em_analise → concluida ao registrar cadastro_aprovado=true.
    const servicoStatusInicial = 'em_analise';
    const obsTag = ' [AUTOVISTORIA_AGUARDA_CADASTRO]';

    if (!servicoId) {
      const hojeISO = agora.toISOString().slice(0, 10);
      const { data: novoServico, error: errServ } = await supabase
        .from('servicos')
        .insert({
          tipo: 'vistoria_entrada',
          status: servicoStatusInicial,
          modalidade: 'autovistoria',
          data_agendada: hojeISO,
          periodo: 'manha',
          associado_id: associadoId,
          veiculo_id: veiculoId,
          contrato_id: contratoId,
          cotacao_id: cotacaoId,
          vistoria_origem_id: vistoriaId,
          concluida_em: null,
          iniciada_em: agora.toISOString(),
          km_atual: cotacao.km_atual ?? null,
          video_360_url: videoUrl,
          origem: 'autovistoria_publica',
          observacoes: `Autovistoria — ${cotacao.nome_solicitante || ''} (${cotacao.numero}).${obsTag}`,
        })
        .select('id')
        .single();

      if (errServ) {
        console.error('[finalizar-autovistoria] insert servicos falhou:', errServ);
      } else if (novoServico) {
        servicoId = novoServico.id;
        createdServico = true;
      }
    } else {
      // Garantir status correto e vinculado à vistoria.
      // Para sub-FIPE, NÃO sobrescrever 'concluida' ou 'aprovada' (caso o Cadastro já tenha promovido).
      const isTerminal = ['concluida', 'aprovada', 'aprovada_ressalvas'].includes(servicoExistente?.status || '');
      if (!isTerminal) {
        await supabase
          .from('servicos')
          .update({
            status: servicoStatusInicial,
            concluida_em: null,
            vistoria_origem_id: vistoriaId,
          })
          .eq('id', servicoId);
      }
    }

    // 7. Atualizar cotação + contrato com referências
    await supabase
      .from('cotacoes')
      .update({
        tipo_vistoria: cotacao.tipo_vistoria || 'autovistoria',
        status_contratacao: veiculoSubFipe ? 'aguardando_aprovacao_cadastro' : 'vistoria_ok',
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
