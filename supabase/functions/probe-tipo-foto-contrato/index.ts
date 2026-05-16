// One-shot probe: testa /veiculo/foto/cadastrar com codigo_tipo configurável
// para descobrir qual código a Hinova aceita para "Contrato/Termo de filiação".
//
// Uso:
//   POST { codigo_veiculo: 36183, link: "https://...pdf", codigo_tipo: 13 }
//   (ou body vazio → usa defaults abaixo)
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { cadastrarFotosVeiculoHinova } from '../_shared/hinova-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const codigo_veiculo = Number(body.codigo_veiculo ?? 36183); // KOU6D37 / MARCUS
    const link = body.link ?? 'https://iyxdgmukrrdkffraptsx.supabase.co/storage/v1/object/public/contratos-assinados/76831a73-71c2-4164-b678-00f4cda225d1/CTR-20260515190321-H6UAUG_assinado_1778871868212.pdf';
    const codigos_tipo: number[] = Array.isArray(body.codigos_tipo) && body.codigos_tipo.length
      ? body.codigos_tipo.map(Number)
      : [Number(body.codigo_tipo ?? 13)];

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const resultados: any[] = [];
    for (const codigo_tipo of codigos_tipo) {
      const foto = {
        nome_arquivo: `probe_termo_filiacao_tipo_${codigo_tipo}.pdf`,
        codigo_tipo,
        link,
        observacao: `Probe codigo_tipo=${codigo_tipo} para descobrir mapping de termo de filiação`,
      };
      const r = await cadastrarFotosVeiculoHinova(supabase, codigo_veiculo, [foto]);
      resultados.push({
        codigo_tipo,
        ok: r.ok,
        status: r.status,
        mensagem: r.mensagem,
        errors: r.errors,
        raw: r.raw,
      });
    }

    return new Response(JSON.stringify({ codigo_veiculo, link, resultados }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message, stack: e?.stack }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
