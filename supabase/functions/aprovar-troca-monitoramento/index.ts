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

    // FK aprovado_monitoramento_por aponta para profiles.id (não auth.users.id)
    const { data: profile } = await admin
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    const profileId = profile?.id || null;

    const { data: solicitacao, error: getErr } = await admin
      .from('solicitacoes_troca_titularidade')
      .select('id, veiculo_id, associado_antigo_id, novo_associado_id, cotacao_id, status')
      .eq('id', solicitacao_id)
      .maybeSingle();
    if (getErr || !solicitacao) throw new Error('Solicitação não encontrada');
    // 'aprovar' aceita tanto a fila inicial (aguardando_monitoramento) quanto
    // a aprovação final pós-vistoria (aguardando_vistoria, após o novo titular
    // concluir a vistoria pelo link público). 'solicitar_vistoria' só na fila inicial.
    if (acao === 'solicitar_vistoria' && solicitacao.status !== 'aguardando_monitoramento') {
      throw new Error('Solicitação não está aguardando monitoramento');
    }
    if (acao === 'aprovar' && !['aguardando_monitoramento', 'aguardando_vistoria'].includes(solicitacao.status as string)) {
      throw new Error(`Solicitação no status "${solicitacao.status}" não pode ser aprovada`);
    }

    const baseUpdate = {
      aprovado_monitoramento_por: profileId,
      aprovado_monitoramento_em: new Date().toISOString(),
      observacao_monitoramento: observacao || null,
    };

    if (acao === 'aprovar') {
      const { error } = await admin
        .from('solicitacoes_troca_titularidade')
        .update({ ...baseUpdate, status: 'liberada_para_assinatura' })
        .eq('id', solicitacao_id);
      if (error) throw error;

      // Após a aprovação do Monitoramento, dispara a ativação do novo associado
      // e a efetivação da troca (transferência do veículo + criação do contrato final).
      // Esta é a ÚNICA porta para a efetivação — vistoria e pagamento não efetivam mais.
      if (solicitacao.novo_associado_id) {
        try {
          // Buscar contrato do novo titular gerado pelo fluxo público (associado ao cotacao_id)
          let contratoNovoId: string | null = null;
          if (solicitacao.cotacao_id) {
            const { data: contratoNovo } = await admin
              .from('contratos')
              .select('id')
              .eq('cotacao_id', solicitacao.cotacao_id)
              .eq('associado_id', solicitacao.novo_associado_id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            contratoNovoId = contratoNovo?.id || null;
          }

          const ativResp = await fetch(`${SUPABASE_URL}/functions/v1/ativar-associado`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              associado_id: solicitacao.novo_associado_id,
              contrato_id: contratoNovoId,
              cotacao_id: solicitacao.cotacao_id,
              source: 'edge:aprovar-troca-monitoramento',
              actor_id: profileId,
              allowed_from: ['assinado', 'aguardando_instalacao', 'pendente'],
              metadata: { solicitacao_troca_id: solicitacao_id },
            }),
          });
          const ativData = await ativResp.json().catch(() => ({}));
          if (!ativData?.success) {
            console.warn('[aprovar-troca-monitoramento] ativar-associado falhou (não bloqueante):', ativData);
          } else {
            console.log('[aprovar-troca-monitoramento] novo associado ativado:', solicitacao.novo_associado_id);
          }
        } catch (ativErr) {
          console.error('[aprovar-troca-monitoramento] erro ao ativar novo associado (não bloqueante):', ativErr);
        }
      } else {
        console.warn(`[aprovar-troca-monitoramento] Solicitação ${solicitacao_id} sem novo_associado_id — pulando ativação`);
      }

      // Efetivar a troca (transferência veículo + novo contrato final)
      try {
        const efetResp = await fetch(`${SUPABASE_URL}/functions/v1/efetivar-troca-titularidade`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ solicitacao_id, cenario_override: 'B' }),
        });
        const efetData = await efetResp.json().catch(() => ({}));
        if (!efetData?.success) {
          console.error('[aprovar-troca-monitoramento] efetivar-troca-titularidade falhou:', efetData);
        } else {
          console.log('[aprovar-troca-monitoramento] troca efetivada:', efetData.novo_contrato_numero);
        }
      } catch (efetErr) {
        console.error('[aprovar-troca-monitoramento] erro ao efetivar troca (não bloqueante):', efetErr);
      }
    } else {
      // Solicitar vistoria: NÃO criar serviço de campo.
      // A vistoria será executada pelo NOVO titular dentro do link público
      // (etapa "Vistoria" do fluxo de contratação). O sinal de "vistoria pedida"
      // é o próprio status `aguardando_vistoria`. O monitoramento aprova depois,
      // assim que a vistoria for concluída no link público.
      const { error } = await admin
        .from('solicitacoes_troca_titularidade')
        .update({
          ...baseUpdate,
          status: 'aguardando_vistoria',
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
