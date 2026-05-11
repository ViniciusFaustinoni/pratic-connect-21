// Aprovação da etapa de Cadastro: avança status para aguardando_monitoramento
// Antes de aprovar:
//   1) trava se termo de cancelamento não foi assinado
//   2) regrava snapshot de análise prévia do novo titular (base local + SGA) — idempotente
// Obs: a checagem financeira do antigo titular foi removida — não é mais
// requisito que o antigo esteja adimplente para aprovar a troca.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { solicitacao_id, observacao } = await req.json();
    if (!solicitacao_id) {
      return new Response(JSON.stringify({ error: 'solicitacao_id obrigatório' }), {
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

    // 1) Carregar solicitação
    const { data: sol, error: solErr } = await admin
      .from('solicitacoes_troca_titularidade')
      .select('id, status, termo_cancelamento_assinado_em, associado_antigo_id, novo_titular_dados, cotacao_id, veiculo_id, criado_por')
      .eq('id', solicitacao_id)
      .maybeSingle();
    if (solErr) throw solErr;
    if (!sol) {
      return new Response(JSON.stringify({ error: 'Solicitação não encontrada' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2) Trava: assinatura do termo
    if (!sol.termo_cancelamento_assinado_em) {
      return new Response(
        JSON.stringify({ error: 'Aprovação bloqueada: o titular antigo ainda não assinou o termo de cancelamento no Autentique.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 3) Trava: débito do antigo (relacionamento_debitos_pendentes em 'aberto')
    const { data: debitoAberto } = await admin
      .from('relacionamento_debitos_pendentes')
      .select('id, valor_total, quantidade_boletos')
      .eq('associado_id', sol.associado_antigo_id)
      .eq('status', 'aberto')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (debitoAberto) {
      return new Response(
        JSON.stringify({
          error: 'Aprovação bloqueada: o titular antigo possui débitos em aberto no SGA. A liberação ocorre automaticamente após a quitação.',
          code: 'DEBITO_PENDENTE_ANTIGO',
          valor_total: debitoAberto.valor_total,
          quantidade_boletos: debitoAberto.quantidade_boletos,
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 4) Resolver profile.id do aprovador
    const { data: prof } = await admin
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    const aprovadorId = prof?.id ?? null;

    // 5) COMMIT PRIMEIRO: avançar status com CAS (idempotente)
    const { data: updated, error: updErr } = await admin
      .from('solicitacoes_troca_titularidade')
      .update({
        status: 'aguardando_monitoramento',
        aprovado_cadastro_por: aprovadorId,
        aprovado_cadastro_em: new Date().toISOString(),
        observacao_cadastro: observacao || null,
      })
      .eq('id', solicitacao_id)
      .eq('status', 'aguardando_cadastro')
      .select('id');

    if (updErr) {
      console.error('[aprovar-troca-cadastro] update error:', updErr);
      throw new Error(updErr.message || 'Falha ao atualizar solicitação');
    }

    if (!updated || updated.length === 0) {
      return new Response(
        JSON.stringify({ success: true, already_advanced: true, status: 'aguardando_monitoramento' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 6) Trabalho pesado em background (snapshot SGA + atribuição vendedor + WhatsApp)
    const novoTitular = (sol.novo_titular_dados || {}) as { nome?: string; cpf?: string };
    const cpfNovoLimpo = (novoTitular.cpf || '').replace(/\D/g, '');

    const backgroundWork = async () => {
      const analisePrevia: Record<string, unknown> = { gerado_em: new Date().toISOString() };
      try {
        if (cpfNovoLimpo.length === 11) {
          const { data: assocLocal } = await admin
            .from('associados')
            .select('id, nome, cpf, email, telefone, status, created_at')
            .eq('cpf', cpfNovoLimpo)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          analisePrevia.base_local = assocLocal
            ? { encontrado: true, associado: assocLocal }
            : { encontrado: false };

          try {
            const { data: sgaResp, error: sgaErr } = await admin.functions.invoke(
              'sga-buscar-associado-completo',
              { body: { cpf: cpfNovoLimpo } },
            );
            if (sgaErr) throw sgaErr;
            analisePrevia.sga = sgaResp ?? { encontrado: false };
          } catch (sgaCatch) {
            analisePrevia.sga = { erro: sgaCatch instanceof Error ? sgaCatch.message : 'falha SGA' };
          }
        } else {
          analisePrevia.base_local = { erro: 'CPF do novo titular inválido/ausente' };
          analisePrevia.sga = { erro: 'CPF do novo titular inválido/ausente' };
        }

        await admin
          .from('solicitacoes_troca_titularidade')
          .update({
            analise_previa_resultado: analisePrevia,
            analise_previa_em: new Date().toISOString(),
          })
          .eq('id', solicitacao_id);
      } catch (anaErr) {
        console.warn('[aprovar-troca-cadastro/bg] análise prévia falhou:', anaErr);
      }

      try {
        if (!sol.cotacao_id) return;
        let vendedorAuthUserId: string | null = null;
        let vendedorAtribuido: { profile_id: string; nome: string; telefone: string | null } | null = null;

        if (sol.criado_por) {
          const { data: profCriador } = await admin
            .from('profiles')
            .select('id, user_id, tipo, nome, telefone')
            .eq('user_id', sol.criado_por)
            .maybeSingle();
          if (profCriador && ['vendedor', 'agencia', 'consultor_externo'].includes(profCriador.tipo || '')) {
            vendedorAuthUserId = profCriador.user_id;
            vendedorAtribuido = { profile_id: profCriador.id, nome: profCriador.nome, telefone: profCriador.telefone };
          }
        }

        if (!vendedorAuthUserId && sol.veiculo_id) {
          const { data: contratoAntigo } = await admin
            .from('contratos')
            .select('vendedor_id')
            .eq('veiculo_id', sol.veiculo_id)
            .not('vendedor_id', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (contratoAntigo?.vendedor_id) {
            const { data: profVend } = await admin
              .from('profiles')
              .select('id, user_id, nome, telefone')
              .eq('id', contratoAntigo.vendedor_id)
              .maybeSingle();
            if (profVend?.user_id) {
              vendedorAuthUserId = profVend.user_id;
              vendedorAtribuido = { profile_id: profVend.id, nome: profVend.nome, telefone: profVend.telefone };
            }
          }
        }

        const { data: cotAtual } = await admin
          .from('cotacoes')
          .select('id, numero, vendedor_id')
          .eq('id', sol.cotacao_id)
          .maybeSingle();

        const updateCot: Record<string, unknown> = {
          prioridade: 'alta',
          origem_troca_titularidade: true,
        };
        if (vendedorAuthUserId && !cotAtual?.vendedor_id) {
          updateCot.vendedor_id = vendedorAuthUserId;
        }
        await admin.from('cotacoes').update(updateCot).eq('id', sol.cotacao_id);

        if (vendedorAtribuido?.telefone) {
          const numero = (cotAtual?.numero || sol.cotacao_id.slice(0, 8)).toString();
          const novoNome = ((sol.novo_titular_dados || {}) as { nome?: string }).nome || 'novo titular';
          const mensagem =
            `🔁 *Troca de titularidade — cadastro aprovado*\n\n` +
            `Cotação *${numero}* foi liberada e marcada como *PRIORIDADE ALTA*.\n` +
            `Novo titular: ${novoNome}\n\n` +
            `A placa já está liberada para fechamento. Acesse o sistema para dar continuidade.`;
          try {
            await admin.functions.invoke('whatsapp-send-text', {
              body: { telefone: vendedorAtribuido.telefone, mensagem, force_provider: 'evolution' },
            });
          } catch (waCatch) {
            console.warn('[aprovar-troca-cadastro/bg] whatsapp falhou:', waCatch);
          }
        }
      } catch (notifErr) {
        console.warn('[aprovar-troca-cadastro/bg] notificação vendedor falhou:', notifErr);
      }
    };

    // @ts-ignore - EdgeRuntime global é disponibilizado pelo Supabase Edge
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(backgroundWork());
    } else {
      backgroundWork().catch((e) => console.warn('[aprovar-troca-cadastro/bg] erro:', e));
    }

    return new Response(
      JSON.stringify({ success: true, status: 'aguardando_monitoramento' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e: any) {
    console.error('[aprovar-troca-cadastro] FATAL:', e, JSON.stringify(e));
    const msg = (e && (e.message || e.error_description || e.hint || e.details)) || (typeof e === 'string' ? e : 'erro');
    return new Response(JSON.stringify({ error: msg, raw: typeof e === 'object' ? e : null }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
