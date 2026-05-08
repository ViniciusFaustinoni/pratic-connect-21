import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BackfillRequest {
  // Quantidade máxima por execução (default 50, max 200)
  limit?: number;
  // Se true, processa também rastreadores que já tiveram tentativa anterior falha
  incluirFalhas?: boolean;
  // Apenas simular (não chama API Softruck)
  dryRun?: boolean;
}

const RATE_LIMIT_MS = 250; // 4 requests/seg

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // Auth: aceita (a) JWT admin/diretor; (b) header x-cron-secret == CRON_SECRET (cron interno)
    const cronSecretHeader = req.headers.get('x-cron-secret');
    const CRON_SECRET = Deno.env.get('CRON_SECRET');
    const isCron = !!CRON_SECRET && cronSecretHeader === CRON_SECRET;

    if (!isCron) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ success: false, error: 'Não autorizado' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const token = authHeader.replace('Bearer ', '');
      const { data: userData, error: userErr } = await supabase.auth.getUser(token);
      if (userErr || !userData.user) {
        return new Response(JSON.stringify({ success: false, error: 'Token inválido' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userData.user.id);
      const roleSet = new Set((roles || []).map((r: any) => r.role));
      const allowed = roleSet.has('admin') || roleSet.has('diretor');
      if (!allowed) {
        return new Response(JSON.stringify({ success: false, error: 'Sem permissão' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const body = (await req.json().catch(() => ({}))) as BackfillRequest;
    const limit = Math.min(Math.max(body.limit ?? 50, 1), 200);
    const incluirFalhas = body.incluirFalhas ?? false;
    const dryRun = body.dryRun ?? false;

    console.log(`[softruck-backfill] Iniciando backfill — limit=${limit}, incluirFalhas=${incluirFalhas}, dryRun=${dryRun}, cron=${isCron}`);

    // Status considerados pendentes/incompletos
    const statusFiltro = incluirFalhas
      ? ['PENDING', 'FAILED_DEVICE', 'FAILED_VEHICLE', 'FAILED_AUTH', 'FAILED_CHIP', 'FAILED_ASSOCIATION', 'CREATED_BUT_NOT_ACTIVATED']
      : ['PENDING', 'CREATED_BUT_NOT_ACTIVATED'];

    // Captura DOIS cenários incompletos:
    //  (1) device_id ausente (nunca chegou na Softruck)
    //  (2) device_id presente, mas veiculo_id ausente (vínculo não concluído — bug histórico do early-return)
    const { data: rastreadores, error: rError } = await supabase
      .from('rastreadores')
      .select('id, imei, veiculo_id, associado_id, associado_email, plataforma, status, plataforma_device_id, plataforma_veiculo_id, softruck_integration_status')
      .eq('plataforma', 'softruck')
      .eq('status', 'instalado')
      .or('plataforma_device_id.is.null,plataforma_veiculo_id.is.null')
      .in('softruck_integration_status', statusFiltro)
      .not('veiculo_id', 'is', null)
      .not('imei', 'is', null)
      .limit(limit);

    if (rError) {
      throw new Error(`Erro ao buscar rastreadores: ${rError.message}`);
    }

    const total = rastreadores?.length || 0;
    console.log(`[softruck-backfill] Encontrados ${total} rastreadores a sincronizar`);

    if (dryRun) {
      return new Response(
        JSON.stringify({
          success: true,
          dryRun: true,
          total_encontrados: total,
          rastreadores: rastreadores?.map((r: any) => ({ id: r.id, imei: r.imei, veiculo_id: r.veiculo_id })),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let sucessos = 0;
    let falhas = 0;
    const erros: Array<{ rastreador_id: string; imei: string; error: string }> = [];

    for (const r of rastreadores || []) {
      try {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));

        const ativarRes = await fetch(`${supabaseUrl}/functions/v1/softruck-ativar-dispositivo`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            imei: r.imei,
            veiculoId: r.veiculo_id,
            associadoId: r.associado_id,
            associadoEmail: r.associado_email,
          }),
        });

        const result = await ativarRes.json();
        if (result.success) {
          sucessos++;
          console.log(`[softruck-backfill] ✓ ${r.imei}`);
        } else {
          falhas++;
          erros.push({ rastreador_id: r.id, imei: r.imei, error: result.error || 'erro desconhecido' });
          console.warn(`[softruck-backfill] ✗ ${r.imei}: ${result.error}`);
        }
      } catch (err) {
        falhas++;
        const msg = err instanceof Error ? err.message : 'erro desconhecido';
        erros.push({ rastreador_id: r.id, imei: r.imei, error: msg });
        console.error(`[softruck-backfill] ✗ ${r.imei}:`, err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_processados: total,
        sucessos,
        falhas,
        erros: erros.slice(0, 20),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[softruck-backfill] Erro geral:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
