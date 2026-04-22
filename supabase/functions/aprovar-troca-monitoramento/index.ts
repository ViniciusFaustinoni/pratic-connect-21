// Aprovação do Monitoramento: aprova direto OU solicita vistoria de entrada
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { solicitacao_id, acao, observacao } = await req.json();
    // acao: 'aprovar' | 'solicitar_vistoria'
    if (!solicitacao_id || !['aprovar', 'solicitar_vistoria'].includes(acao)) {
      return new Response(JSON.stringify({ error: 'parâmetros inválidos' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader }}});
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: solicitacao, error: getErr } = await admin
      .from('solicitacoes_troca_titularidade')
      .select('id, veiculo_id, associado_antigo_id, status')
      .eq('id', solicitacao_id)
      .maybeSingle();
    if (getErr || !solicitacao) throw new Error('Solicitação não encontrada');
    if (solicitacao.status !== 'aguardando_monitoramento') {
      throw new Error('Solicitação não está aguardando monitoramento');
    }

    const baseUpdate = {
      aprovado_monitoramento_por: user.id,
      aprovado_monitoramento_em: new Date().toISOString(),
      observacao_monitoramento: observacao || null,
    };

    if (acao === 'aprovar') {
      const { error } = await admin
        .from('solicitacoes_troca_titularidade')
        .update({ ...baseUpdate, status: 'liberada_para_assinatura' })
        .eq('id', solicitacao_id);
      if (error) throw error;
    } else {
      // Criar serviço de vistoria_entrada
      const { data: servico, error: servErr } = await admin
        .from('servicos')
        .insert({
          tipo: 'vistoria_entrada',
          status: 'pendente',
          associado_id: solicitacao.associado_antigo_id,
          veiculo_id: solicitacao.veiculo_id,
          observacoes: 'Vistoria de troca de titularidade — solicitada pelo monitoramento',
        })
        .select('id')
        .single();
      if (servErr) throw servErr;

      const { error } = await admin
        .from('solicitacoes_troca_titularidade')
        .update({
          ...baseUpdate,
          status: 'aguardando_vistoria',
          servico_vistoria_id: servico.id,
        })
        .eq('id', solicitacao_id);
      if (error) throw error;
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
