// Detecta prefixos no bucket `vistoria-fotos` cujo UUID não existe em `vistorias`
// (arquivos órfãos = upload concluído sem materialização da vistoria).
// Roda sob demanda; pode ser plugado num cron diário.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    // Janela: últimas 72h por padrão
    const url = new URL(req.url);
    const sinceHours = Number(url.searchParams.get('hours') || '72');
    const since = new Date(Date.now() - sinceHours * 3600_000).toISOString();

    const { data: objs, error: objErr } = await supabase
      .schema('storage')
      .from('objects')
      .select('name, created_at, owner_id')
      .eq('bucket_id', 'vistoria-fotos')
      .gte('created_at', since)
      .limit(5000);

    if (objErr) throw objErr;

    const prefixos = new Map<string, { count: number; first: string; last: string; owner: string | null }>();
    for (const o of objs ?? []) {
      const uuid = (o.name as string).split('/')[0];
      if (!/^[0-9a-f-]{36}$/i.test(uuid)) continue;
      const cur = prefixos.get(uuid) ?? { count: 0, first: o.created_at, last: o.created_at, owner: o.owner_id };
      cur.count += 1;
      if (o.created_at < cur.first) cur.first = o.created_at;
      if (o.created_at > cur.last) cur.last = o.created_at;
      prefixos.set(uuid, cur);
    }

    const ids = [...prefixos.keys()];
    if (ids.length === 0) {
      return new Response(JSON.stringify({ ok: true, orfas: [], total_prefixos: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: existentes, error: vErr } = await supabase
      .from('vistorias')
      .select('id')
      .in('id', ids);
    if (vErr) throw vErr;

    const setExist = new Set((existentes ?? []).map((v: any) => v.id));
    const orfas = [...prefixos.entries()]
      .filter(([id]) => !setExist.has(id))
      .map(([id, meta]) => ({ vistoria_id: id, ...meta }));

    return new Response(
      JSON.stringify({
        ok: true,
        janela_horas: sinceHours,
        total_prefixos: ids.length,
        total_orfas: orfas.length,
        orfas,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    console.error('[reconciliar-fotos-vistoria-orfas]', err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
