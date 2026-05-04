// Cron diário (00:00 BRT) — reverifica no SGA se os débitos enfileirados em
// `relacionamento_debitos_pendentes` foram quitados. Se sim, marca como
// 'resolvido' e libera a cotação vinculada à solicitação de troca.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const stats = { verificados: 0, resolvidos: 0, ainda_devedor: 0, erros: 0 };

  try {
    const { data: pendentes, error } = await admin
      .from('relacionamento_debitos_pendentes')
      .select('id, cpf, solicitacao_troca_id, valor_total')
      .eq('status', 'aberto')
      .limit(500);
    if (error) throw error;

    for (const p of pendentes || []) {
      stats.verificados++;
      try {
        const cpf = (p.cpf || '').replace(/\D/g, '');
        if (cpf.length !== 11) continue;

        const { data: dbResp } = await admin.functions.invoke('sga-buscar-associado-completo', {
          body: { cpf },
        });
        const veiculos = (dbResp as any)?.veiculos || [];
        let saldo = 0;
        for (const v of veiculos) {
          for (const b of (v?.boletos_abertos || [])) saldo += Number(b.valor || 0);
        }

        if (saldo <= 0.01) {
          await admin
            .from('relacionamento_debitos_pendentes')
            .update({
              status: 'resolvido',
              resolvido_em: new Date().toISOString(),
              observacao: 'Quitado automaticamente via cron-recheck',
            })
            .eq('id', p.id);
          stats.resolvidos++;
        } else {
          stats.ainda_devedor++;
        }
      } catch (e) {
        stats.erros++;
        console.warn('[cron-recheck-debitos-troca] item falhou:', p.id, e);
      }
    }

    return new Response(JSON.stringify({ ok: true, stats }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e), stats }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
