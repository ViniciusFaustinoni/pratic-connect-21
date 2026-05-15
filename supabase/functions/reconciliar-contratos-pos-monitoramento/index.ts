// Reconcilia contratos travados em status='assinado' após o Monitoramento já
// ter aprovado o serviço (instalacao/vistoria_entrada). Reinvoca ativar-associado
// (idempotente) para promover contrato/associado/veículo a 'ativo'.
//
// Disparado por pg_cron a cada 15 minutos.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { data: candidatos, error } = await supabase
      .rpc('fn_listar_contratos_pos_monitoramento_travados');

    if (error) throw error;

    const results: any[] = [];
    for (const c of (candidatos || []) as any[]) {
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/ativar-associado`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            associado_id: c.associado_id,
            veiculo_id: c.veiculo_id,
            contrato_id: c.contrato_id,
            servico_id: c.servico_id,
            source: 'cron:reconciliar-contratos-pos-monitoramento',
            ativar_cobertura_total: true,
            ativar_cobertura_roubo_furto: true,
            allowed_from: ['assinado', 'aguardando_instalacao', 'aguardando_aprovacao_monitoramento', 'em_analise', 'documentacao_pendente', 'aprovado'],
            metadata: { reconciliacao: true, motivo: 'contrato_travado_pos_monitoramento' },
          }),
        });
        const body = await resp.json().catch(() => ({}));
        results.push({ contrato_id: c.contrato_id, http: resp.status, ok: resp.ok, idempotente: body?.idempotente, error: body?.error });
      } catch (e: any) {
        results.push({ contrato_id: c.contrato_id, error: e?.message || String(e) });
      }
    }

    return new Response(JSON.stringify({ candidatos: candidatos?.length || 0, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[reconciliar-contratos-pos-monitoramento] erro', e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
