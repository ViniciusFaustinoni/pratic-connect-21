// Edge function de diagnóstico: tenta múltiplas formas de localizar um associado/veículo no Hinova
// quando o /associado/cadastrar responde "CPF já cadastrado" mas /associado/buscar retorna 404.
// Tenta: CPF (vários formatos), buscar veículo por placa, buscar veículo por chassi.
// Uso: POST { cpf?, placa?, chassi? }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { getHinovaSession, hinovaFetch } from '../_shared/hinova-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const body = await req.json().catch(() => ({}));
    const cpfDigitos = String(body.cpf || '').replace(/\D/g, '');
    const placa = String(body.placa || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const chassi = String(body.chassi || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

    const { apiUrl } = await getHinovaSession(supabase);
    const probes: any[] = [];

    async function probe(label: string, path: string) {
      try {
        const { response, bodyText } = await hinovaFetch(
          supabase,
          (token) => ({
            url: `${apiUrl}${path}`,
            init: { method: 'GET', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } },
          }),
          `probe:${label}`,
        );
        probes.push({ label, path, status: response.status, body: bodyText.slice(0, 600) });
      } catch (e: any) {
        probes.push({ label, path, error: String(e?.message || e) });
      }
    }

    if (cpfDigitos.length === 11) {
      const cpfFmt = `${cpfDigitos.slice(0,3)}.${cpfDigitos.slice(3,6)}.${cpfDigitos.slice(6,9)}-${cpfDigitos.slice(9,11)}`;
      await probe('cpf_digits', `/associado/buscar/${cpfDigitos}/cpf`);
      await probe('cpf_fmt', `/associado/buscar/${encodeURIComponent(cpfFmt)}/cpf`);
      // Tentativas alternativas (caso a API aceite outros caminhos)
      await probe('cpf_alt_listar', `/listar/associado/cpf/${cpfDigitos}`);
      await probe('cpf_alt_consultar', `/associado/consultar/${cpfDigitos}/cpf`);
    }
    if (placa) {
      await probe('placa_buscar', `/veiculo/buscar/${placa}/placa`);
      await probe('placa_sit_fin', `/buscar/situacao-financeira-veiculo/${placa}`);
    }
    if (chassi) {
      await probe('chassi_buscar', `/veiculo/buscar/${chassi}/chassi`);
    }

    return new Response(JSON.stringify({ ok: true, apiUrl, probes }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
