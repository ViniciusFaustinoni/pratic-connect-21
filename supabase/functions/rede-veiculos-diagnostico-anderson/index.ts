/**
 * rede-veiculos-diagnostico-anderson
 *
 * DIAGNÓSTICO READ-ONLY pontual do caso ANDERSON / KPJ4994 / IMEI 354522186314659.
 *
 * Passo 1: /obterDadosVeiculo/ com IMEI + cpfCnpjCliente (Anderson e Gabriel).
 * Passo 2a: /obterDadosCliente/ com incluirVeiculos:true (Anderson e Gabriel).
 * Passo 2b: varredura paginada /obterEquipamentos/ até achar o IMEI alvo.
 *
 * Não escreve nada no banco. Não escreve nada na Rede. Retorna payload enviado +
 * resposta crua de cada chamada.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const IMEI_ALVO = '354522186314659';
const CPF_ANDERSON = '00337172730';
const CPF_GABRIEL = '15582970738';

async function callRede(baseUrl: string, token: string, path: string, filtro: Record<string, unknown>) {
  const params = new URLSearchParams();
  params.append('json', JSON.stringify(filtro));
  const url = `${baseUrl}${path}`;
  let httpStatus: number | null = null;
  let raw: string = '';
  let parsed: unknown = null;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    httpStatus = r.status;
    raw = await r.text();
    try { parsed = JSON.parse(raw); } catch { parsed = null; }
  } catch (e: any) {
    return { url, payload_enviado: filtro, http_status: httpStatus, raw: null, parsed: null, network_error: e?.message || String(e) };
  }
  return { url, payload_enviado: filtro, http_status: httpStatus, raw, parsed };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: plataforma } = await supabase
      .from('rastreadores_config_plataformas')
      .select('*').eq('plataforma', 'rede_veiculos').single();
    const baseUrl = plataforma.ambiente_atual === 'producao'
      ? plataforma.api_url_producao
      : plataforma.api_url_sandbox;

    const authResp = await fetch(`${supabaseUrl}/functions/v1/rastreador-auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
      body: JSON.stringify({ plataforma: 'rede_veiculos' }),
    });
    const authJson = await authResp.json();
    if (!authJson?.success || !authJson?.token) {
      return new Response(JSON.stringify({ success: false, error: 'auth_falhou', authJson }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const token = authJson.token as string;

    const resultados: Record<string, unknown> = {
      baseUrl,
      imei_alvo: IMEI_ALVO,
      passo_1: {},
      passo_2a: {},
      passo_2b: null as unknown,
    };

    // ===== Passo 1: /obterDadosVeiculo/ IMEI + cpfCnpjCliente =====
    resultados.passo_1 = {
      anderson: await callRede(baseUrl, token, '/obterDadosVeiculo/', {
        imei: IMEI_ALVO, cpfCnpjCliente: CPF_ANDERSON,
      }),
      gabriel: await callRede(baseUrl, token, '/obterDadosVeiculo/', {
        imei: IMEI_ALVO, cpfCnpjCliente: CPF_GABRIEL,
      }),
    };

    // ===== Passo 2a: /obterDadosCliente/ com incluirVeiculos:true =====
    resultados.passo_2a = {
      anderson: await callRede(baseUrl, token, '/obterDadosCliente/', {
        cpfCnpjCliente: CPF_ANDERSON, incluirVeiculos: true,
      }),
      gabriel: await callRede(baseUrl, token, '/obterDadosCliente/', {
        cpfCnpjCliente: CPF_GABRIEL, incluirVeiculos: true,
      }),
    };

    // ===== Passo 2b: varredura /obterEquipamentos/ =====
    // Só roda se passo 1 e 2a falharem em localizar o IMEI.
    const achouNoPasso1 =
      JSON.stringify(resultados.passo_1).includes(IMEI_ALVO) &&
        !JSON.stringify((resultados as any).passo_1).match(/n[aã]o.*localizad|inv[aá]lido|n[aã]o.*encontrad/i);
    const achouNoPasso2a = JSON.stringify(resultados.passo_2a).includes(IMEI_ALVO);

    if (!achouNoPasso1 && !achouNoPasso2a) {
      const varredura: any[] = [];
      let pagina = 1;
      const POR_PAGINA = 100;
      const MAX_PAGINAS = 50; // teto de segurança = 5000 equipamentos
      let achadoEquipamento: any = null;
      let totalVarridos = 0;
      let pararPor: string | null = null;

      while (pagina <= MAX_PAGINAS) {
        const r = await callRede(baseUrl, token, '/obterEquipamentos/', {
          pagina, registrosPorPagina: POR_PAGINA,
        });
        varredura.push({ pagina, http_status: r.http_status, payload_enviado: r.payload_enviado, raw_preview: r.raw?.slice(0, 400) });

        if (r.http_status !== 200 || !r.parsed) {
          pararPor = `http_status=${r.http_status} ou parse falhou`;
          break;
        }
        const parsedAny: any = r.parsed;
        if (parsedAny?.error === true || parsedAny?.error === 'true') {
          pararPor = `erro Rede: ${parsedAny?.message || 'desconhecido'}`;
          break;
        }

        // Tentar diferentes shapes possíveis
        const lista =
          parsedAny?.equipamentos ||
          parsedAny?.data ||
          parsedAny?.dados ||
          (Array.isArray(parsedAny) ? parsedAny : null);

        if (!Array.isArray(lista)) {
          pararPor = `resposta inesperada (não-array): ${JSON.stringify(parsedAny).slice(0, 300)}`;
          break;
        }
        totalVarridos += lista.length;

        const hit = lista.find((eq: any) => {
          const candidato = String(eq?.imei || eq?.dados?.imei || '').replace(/\D/g, '');
          return candidato === IMEI_ALVO;
        });
        if (hit) {
          achadoEquipamento = hit;
          pararPor = 'IMEI encontrado';
          break;
        }
        if (lista.length < POR_PAGINA) {
          pararPor = 'fim da paginação (página parcial)';
          break;
        }
        pagina++;
      }

      resultados.passo_2b = {
        executado: true,
        motivo_parada: pararPor,
        total_equipamentos_varridos: totalVarridos,
        paginas_consultadas: varredura.length,
        ultima_pagina_consultada: pagina,
        achado: achadoEquipamento,
        varredura_resumo: varredura,
      };
    } else {
      resultados.passo_2b = { executado: false, motivo: 'IMEI já apareceu no Passo 1 ou 2a' };
    }

    return new Response(JSON.stringify(resultados, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err?.message || String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
