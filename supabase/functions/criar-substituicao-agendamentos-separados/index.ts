// Substituição com locais diferentes: cria 2 agendamentos independentes.
//   1) Instalação do veículo NOVO  → invoca `agendar-vistoria-presencial`
//      (mesmo caminho canônico de qualquer adesão presencial).
//   2) Retirada do veículo ANTIGO  → cria diretamente um `servicos` tipo
//      `vistoria_retirada`, com data/período/endereço próprios.
//
// Idempotência: marca `cotacoes.dados_extras.substituicao_agendamentos_separados=true`
// antes de invocar a 1ª edge — assim o bloco 6.2 de `criar-instalacao-pos-pagamento`
// pula a criação automática da retirada (que materializaria no MESMO local da install).
//
// Reentrância segura: se já houver instalação OU serviço de retirada vivo para a
// cotação, devolvemos success=true sem refazer.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EnderecoPayload {
  cep: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
}

interface AgendamentoPayload {
  dataAgendada: string; // YYYY-MM-DD
  periodo: 'manha' | 'tarde';
  endereco: EnderecoPayload;
  responsavel: { euMesmo: boolean; nome?: string; telefone?: string };
  permiteEncaixe: boolean;
}

interface BodyShape {
  cotacaoId: string;
  instalacao: AgendamentoPayload;
  retirada: AgendamentoPayload;
}

function ok(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify({ success: true, ...payload }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
function fail(error: string, status = 400, extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ success: false, error, ...extra }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isValidPayload(p: unknown): p is AgendamentoPayload {
  const x = p as AgendamentoPayload;
  return (
    !!x &&
    typeof x.dataAgendada === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(x.dataAgendada) &&
    (x.periodo === 'manha' || x.periodo === 'tarde') &&
    !!x.endereco?.cep &&
    !!x.endereco?.logradouro &&
    !!x.endereco?.cidade
  );
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = (await req.json()) as BodyShape;
    const { cotacaoId } = body || ({} as BodyShape);
    if (!cotacaoId) return fail('cotacaoId é obrigatório');
    if (!isValidPayload(body.instalacao)) return fail('Payload de instalação inválido');
    if (!isValidPayload(body.retirada)) return fail('Payload de retirada inválido');

    console.log('[CriarSubstituicaoSeparados] start', { cotacaoId });

    // 1. Carregar cotação + contrato + dados da solicitação para resolver veículo antigo.
    const { data: cot, error: cotErr } = await supabase
      .from('cotacoes')
      .select('id, tipo_entrada, dados_extras, nome_solicitante, telefone1_solicitante, veiculo_marca, veiculo_modelo, veiculo_placa')
      .eq('id', cotacaoId)
      .maybeSingle();
    if (cotErr || !cot) return fail('Cotação não encontrada', 404);

    const dadosExtras = ((cot as any).dados_extras || {}) as Record<string, unknown>;
    const solicitacaoSubId = (dadosExtras.solicitacao_substituicao_id as string) || null;
    const ehSubstituicao =
      (cot as any).tipo_entrada === 'substituicao_placa' || !!solicitacaoSubId;
    if (!ehSubstituicao) {
      return fail('Esta cotação não é uma substituição', 400, { code: 'NAO_E_SUBSTITUICAO' });
    }

    let veiculoAntigoId: string | null = (dadosExtras.veiculo_antigo_id as string) || null;
    let associadoIdSol: string | null = null;
    if (solicitacaoSubId) {
      const { data: sol } = await supabase
        .from('solicitacoes_substituicao_placa')
        .select('veiculo_antigo_id, associado_id')
        .eq('id', solicitacaoSubId)
        .maybeSingle();
      if (sol?.veiculo_antigo_id) veiculoAntigoId = sol.veiculo_antigo_id;
      if (sol?.associado_id) associadoIdSol = sol.associado_id;
    }

    if (!veiculoAntigoId) {
      return fail(
        'Não foi possível resolver o veículo antigo da substituição',
        400,
        { code: 'VEICULO_ANTIGO_AUSENTE' },
      );
    }

    const { data: contrato } = await supabase
      .from('contratos')
      .select('id, associado_id, veiculo_id, aprovado_em')
      .eq('cotacao_id', cotacaoId)
      .maybeSingle();
    if (!contrato) return fail('Contrato da cotação não encontrado', 404);

    // 2. Marcar a flag idempotente ANTES de invocar a edge da instalação,
    //    para que `criar-instalacao-pos-pagamento` pule o bloco 6.2 (retirada).
    {
      const novosDadosExtras = {
        ...dadosExtras,
        substituicao_agendamentos_separados: true,
        substituicao_separado_marcado_em: new Date().toISOString(),
      };
      const { error: upErr } = await supabase
        .from('cotacoes')
        .update({ dados_extras: novosDadosExtras })
        .eq('id', cotacaoId);
      if (upErr) {
        console.error('[CriarSubstituicaoSeparados] erro setando flag:', upErr);
        return fail('Falha ao registrar flag de agendamento separado', 500);
      }
    }

    // 3. Invocar `agendar-vistoria-presencial` para a INSTALAÇÃO.
    //    Reaproveita 100% do caminho canônico de adesão presencial-direto:
    //    cria vistoria + instalacao + agendamento_base + servico, chama
    //    `criar-instalacao-pos-pagamento` internamente (que agora pula 6.2).
    console.log('[CriarSubstituicaoSeparados] invocando agendar-vistoria-presencial (instalação)');
    const { data: instalRes, error: instalErr } = await supabase.functions.invoke(
      'agendar-vistoria-presencial',
      {
        body: {
          cotacaoId,
          dataAgendada: body.instalacao.dataAgendada,
          horarioAgendado: body.instalacao.periodo, // edge aceita 'manha'/'tarde'
          endereco: body.instalacao.endereco,
          responsavel: body.instalacao.responsavel,
          latitude: null,
          longitude: null,
          permiteEncaixe: !!body.instalacao.permiteEncaixe,
        },
      },
    );
    if (instalErr || !(instalRes as any)?.success) {
      console.error('[CriarSubstituicaoSeparados] agendar-vistoria-presencial falhou:', instalErr, instalRes);
      return fail(
        (instalRes as any)?.error || instalErr?.message || 'Falha ao agendar a instalação',
        500,
        { etapa_falha: 'instalacao' },
      );
    }
    const instalacaoId = (instalRes as any)?.instalacaoId || null;
    console.log('[CriarSubstituicaoSeparados] ✓ instalação agendada:', instalacaoId);

    // 4. Criar serviço de RETIRADA do veículo antigo, com endereço/data próprios.
    //    Idempotência: se já existir serviço vivo (não-terminal), reaproveita.
    const { data: retExistente } = await supabase
      .from('servicos')
      .select('id')
      .eq('tipo', 'vistoria_retirada')
      .eq('veiculo_id', veiculoAntigoId)
      .eq('cotacao_id', cotacaoId)
      .not('status', 'in', '(concluida,aprovada,reprovada,cancelada)')
      .limit(1)
      .maybeSingle();

    let servicoRetiradaId = retExistente?.id || null;

    if (!servicoRetiradaId) {
      const { data: rastr } = await supabase
        .from('rastreadores')
        .select('id, imei')
        .eq('veiculo_id', veiculoAntigoId)
        .maybeSingle();

      const { data: contratoAntigoRow } = await supabase
        .from('contratos')
        .select('id, associado_id')
        .eq('veiculo_id', veiculoAntigoId)
        .in('status', ['ativo', 'aguardando_instalacao', 'assinado'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const contratoAntigoId = contratoAntigoRow?.id || null;
      const associadoIdRet = contratoAntigoRow?.associado_id || associadoIdSol || contrato.associado_id;

      const enderecoRet = body.retirada.endereco;
      const servicoRetirada = {
        tipo: 'vistoria_retirada' as const,
        status: 'agendada' as const,
        data_agendada: body.retirada.dataAgendada,
        hora_agendada: null,
        periodo: body.retirada.periodo,
        veiculo_id: veiculoAntigoId,
        associado_id: associadoIdRet,
        contrato_id: contratoAntigoId,
        cotacao_id: cotacaoId,
        agendamento_base_id: null, // agendamento independente da instalação
        rastreador_id: rastr?.id || null,
        imei_rastreador: rastr?.imei || null,
        origem: 'substituicao_placa',
        local_vistoria: 'cliente',
        cep: enderecoRet.cep,
        logradouro: enderecoRet.logradouro,
        numero: enderecoRet.numero,
        bairro: enderecoRet.bairro,
        cidade: enderecoRet.cidade,
        uf: enderecoRet.estado,
        permite_encaixe: !!body.retirada.permiteEncaixe,
        observacoes:
          'Retirada do veículo antigo (substituição de placa — agendamento separado da instalação)',
        motivo_retirada: 'substituicao',
      };

      const { data: novoSrv, error: srvErr } = await supabase
        .from('servicos')
        .insert(servicoRetirada)
        .select('id')
        .single();

      if (srvErr) {
        console.error('[CriarSubstituicaoSeparados] falha ao criar retirada:', srvErr);
        return fail('Falha ao criar serviço de retirada', 500, {
          etapa_falha: 'retirada',
          detalhe: srvErr.message,
        });
      }
      servicoRetiradaId = novoSrv.id;
      console.log('[CriarSubstituicaoSeparados] ✓ retirada criada:', servicoRetiradaId);
    } else {
      console.log('[CriarSubstituicaoSeparados] retirada já existente — reaproveitando:', servicoRetiradaId);
    }

    return ok({
      cotacaoId,
      instalacaoId,
      servicoRetiradaId,
      message: 'Substituição com 2 agendamentos separados registrada com sucesso',
    });
  } catch (e) {
    console.error('[CriarSubstituicaoSeparados] erro inesperado:', e);
    return fail((e as Error)?.message || 'Erro inesperado', 500);
  }
});
