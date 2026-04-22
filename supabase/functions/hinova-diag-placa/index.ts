// Diagnóstico ad-hoc: testa endpoints Hinova com placas conhecidas e
// retorna o body cru de cada chamada para inspeção.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getHinovaCreds, autenticarHinova } from '../_shared/hinova-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const body = await req.json().catch(() => ({}));
  const placas: string[] = body.placas ?? ['QNA4J27', 'LQW4H42'];
  const cpfs: string[] = body.cpfs ?? [];

  try {
    const creds = await getHinovaCreds(supabase);
    if (!creds) throw new Error('sem creds');
    const session = await autenticarHinova(creds);
    if (!session) throw new Error('sem session');

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.tokenUsuario}`,
    };

    const results: any[] = [];

    for (const placa of placas) {
      const placaLimpa = placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      // Endpoint A
      const rA = await fetch(`${session.apiUrl}/veiculo/consultar/placa/${placaLimpa}`, { method: 'GET', headers });
      const txtA = await rA.text();
      // Endpoint B
      const rB = await fetch(`${session.apiUrl}/veiculo/buscar/${placaLimpa}/placa`, { method: 'GET', headers });
      const txtB = await rB.text();

      results.push({
        placa: placaLimpa,
        consultar_placa: { status: rA.status, body: txtA.slice(0, 500) },
        buscar_placa: { status: rB.status, body: txtB.slice(0, 500) },
      });
    }

    for (const cpf of cpfs) {
      const cpfLimpo = cpf.replace(/\D/g, '');
      const rC = await fetch(`${session.apiUrl}/associado/buscar/${cpfLimpo}/cpf`, { method: 'GET', headers });
      const txtC = await rC.text();
      results.push({
        cpf: cpfLimpo,
        associado_buscar_cpf: { status: rC.status, body: txtC.slice(0, 800) },
      });
    }

    return new Response(JSON.stringify({ apiUrl: session.apiUrl, results }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
});
