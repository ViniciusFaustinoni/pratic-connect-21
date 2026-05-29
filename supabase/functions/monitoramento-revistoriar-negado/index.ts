// Edge: monitoramento-revistoriar-negado
// Cria uma nova vistoria pelo Monitoramento sobre um veículo previamente negado.
// - Atribui diretamente a um profissional + data/período (sem link público)
// - Preserva instalacao_origem_id do último serviço reprovado (mantém histórico)
// - Promove veiculo.status de 'recusado' para 'instalacao_pendente' (sai da fila Negados)
// - Idempotente: se já houver serviço ativo para o veículo, devolve 409

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface Body {
  veiculo_id: string;
  profissional_id: string;
  data_agendada: string; // YYYY-MM-DD
  periodo: 'manha' | 'tarde';
  tipo?: 'vistoria_entrada' | 'vistoria_manutencao';
  observacoes?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    // Identifica usuário chamador (para log de auditoria)
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json() as Body;
    if (!body?.veiculo_id || !body?.profissional_id || !body?.data_agendada || !body?.periodo) {
      return new Response(
        JSON.stringify({ error: 'campos_obrigatorios', detalhe: 'veiculo_id, profissional_id, data_agendada, periodo' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const tipo = body.tipo ?? 'vistoria_entrada';

    // Carrega veículo
    const { data: veiculo, error: vErr } = await supabase
      .from('veiculos')
      .select('id, status, associado_id, placa')
      .eq('id', body.veiculo_id)
      .maybeSingle();
    if (vErr || !veiculo) {
      return new Response(JSON.stringify({ error: 'veiculo_nao_encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (veiculo.status !== 'recusado') {
      return new Response(JSON.stringify({ error: 'veiculo_nao_esta_negado', status: veiculo.status }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Idempotência: já existe serviço ativo?
    const { data: ativos } = await supabase
      .from('servicos')
      .select('id, tipo, status')
      .eq('veiculo_id', veiculo.id)
      .in('status', ['pendente', 'agendada', 'em_rota', 'em_andamento'])
      .limit(1);
    if (ativos && ativos.length > 0) {
      return new Response(
        JSON.stringify({ error: 'servico_ativo_existente', servico_id: ativos[0].id }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Preserva instalacao_origem_id e contrato do último serviço reprovado
    const { data: ultimoReprovado } = await supabase
      .from('servicos')
      .select('id, instalacao_origem_id, contrato_id, cotacao_id, cep, logradouro, numero, complemento, bairro, cidade, uf, local_vistoria')
      .eq('veiculo_id', veiculo.id)
      .eq('status', 'reprovada')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // profile.id do chamador
    const { data: chamadorProfile } = await supabase
      .from('profiles').select('id').eq('user_id', user.id).maybeSingle();

    const novoServico: Record<string, unknown> = {
      tipo,
      status: 'agendada',
      veiculo_id: veiculo.id,
      associado_id: veiculo.associado_id,
      contrato_id: ultimoReprovado?.contrato_id ?? null,
      cotacao_id: ultimoReprovado?.cotacao_id ?? null,
      instalacao_origem_id: ultimoReprovado?.instalacao_origem_id ?? null,
      profissional_id: body.profissional_id,
      data_agendada: body.data_agendada,
      periodo: body.periodo,
      hora_agendada: body.periodo === 'manha' ? '08:00:00' : '13:00:00',
      origem: 'monitoramento_revistoria_negado',
      observacoes: body.observacoes ?? '[Revistoria pós-negação criada pelo Monitoramento]',
      atribuido_em: new Date().toISOString(),
      local_vistoria: ultimoReprovado?.local_vistoria ?? null,
      cep: ultimoReprovado?.cep ?? null,
      logradouro: ultimoReprovado?.logradouro ?? null,
      numero: ultimoReprovado?.numero ?? null,
      complemento: ultimoReprovado?.complemento ?? null,
      bairro: ultimoReprovado?.bairro ?? null,
      cidade: ultimoReprovado?.cidade ?? null,
      uf: ultimoReprovado?.uf ?? null,
    };

    const { data: insSer, error: insErr } = await supabase
      .from('servicos').insert(novoServico).select('id').single();
    if (insErr) {
      return new Response(JSON.stringify({ error: 'falha_criar_servico', detalhe: insErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Promove veículo para instalacao_pendente (sai da aba Negados)
    const { error: upVErr } = await supabase
      .from('veiculos')
      .update({
        status: 'instalacao_pendente',
        motivo_recusa_veiculo: null,
        recusado: 0,
      })
      .eq('id', veiculo.id);
    if (upVErr) {
      // Não rollback — serviço criado fica auditável; loga aviso
      console.error('[monitoramento-revistoriar-negado] falha promover veiculo:', upVErr.message);
    }

    // Log de atribuição (não-bloqueante)
    try {
      await supabase.from('servicos_atribuicoes_log').insert({
        servico_id: insSer.id,
        profissional_id: body.profissional_id,
        tipo_atribuicao: 'manual_pos_negacao',
        atribuido_por: chamadorProfile?.id ?? null,
        observacoes: 'Revistoria criada pelo Monitoramento após negação do veículo',
      });
    } catch (e) {
      console.warn('[monitoramento-revistoriar-negado] log atribuicao falhou', e);
    }

    // Auditoria
    try {
      await supabase.from('logs_auditoria').insert({
        usuario_id: chamadorProfile?.id ?? null,
        acao: 'criar',
        tabela: 'servicos',
        registro_id: insSer.id,
        descricao: `[REVISTORIA_POS_NEGACAO] veiculo=${veiculo.placa} prof=${body.profissional_id} data=${body.data_agendada}/${body.periodo}`,
        dados_novos: novoServico as any,
        modulo: 'monitoramento',
      });
    } catch (e) {
      console.warn('[monitoramento-revistoriar-negado] auditoria falhou', e);
    }

    return new Response(JSON.stringify({ ok: true, servico_id: insSer.id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[monitoramento-revistoriar-negado] erro inesperado', e);
    return new Response(JSON.stringify({ error: 'erro_inesperado', detalhe: e?.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
