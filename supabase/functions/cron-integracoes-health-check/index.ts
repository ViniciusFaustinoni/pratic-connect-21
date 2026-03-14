import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Test functions per integration ──────────────────

async function testHinova(supabase: any) {
  const user = Deno.env.get('HINOVA_USUARIO');
  const pass = Deno.env.get('HINOVA_SENHA');
  if (!user || !pass) return { conexao_ok: false, tempo_resposta_ms: 0, erro_mensagem: 'Credenciais Hinova não configuradas', detalhes: {} };

  const start = Date.now();
  try {
    const resp = await fetch('https://api.hinova.com.br/api/sga/v2/usuario/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario: user, senha: pass }),
    });
    const ms = Date.now() - start;
    if (resp.ok) {
      const data = await resp.json();
      const ok = !!data?.token_usuario;
      // Count queue items
      const { count: pendentes } = await supabase.from('sga_sync_queue').select('id', { count: 'exact', head: true }).eq('status', 'pendente');
      const { count: falhas } = await supabase.from('sga_sync_queue').select('id', { count: 'exact', head: true }).in('status', ['falha', 'falha_permanente']);
      const { count: naoSync } = await supabase.from('veiculos').select('id', { count: 'exact', head: true }).eq('status', 'ativo').eq('sincronizado_hinova', false);
      return {
        conexao_ok: ok,
        tempo_resposta_ms: ms,
        erro_mensagem: ok ? null : 'Token não retornado',
        detalhes: { fila_pendentes: pendentes || 0, fila_falhas: falhas || 0, veiculos_nao_sincronizados: naoSync || 0 },
      };
    }
    return { conexao_ok: false, tempo_resposta_ms: ms, erro_mensagem: `API status ${resp.status}`, detalhes: {} };
  } catch (e) {
    return { conexao_ok: false, tempo_resposta_ms: Date.now() - start, erro_mensagem: `Rede: ${e.message}`, detalhes: {} };
  }
}

async function testAsaas() {
  const key = Deno.env.get('ASAAS_API_KEY');
  if (!key) return { conexao_ok: false, tempo_resposta_ms: 0, erro_mensagem: 'ASAAS_API_KEY não configurada', detalhes: {} };
  const isSandbox = key.startsWith('$aact_') ? false : true;
  const baseUrl = isSandbox ? 'https://sandbox.asaas.com/api/v3' : 'https://api.asaas.com/v3';
  const start = Date.now();
  try {
    const resp = await fetch(`${baseUrl}/finance/getCurrentBalance`, { headers: { access_token: key } });
    const ms = Date.now() - start;
    return { conexao_ok: resp.ok, tempo_resposta_ms: ms, erro_mensagem: resp.ok ? null : `Status ${resp.status}`, detalhes: { ambiente: isSandbox ? 'sandbox' : 'producao' } };
  } catch (e) {
    return { conexao_ok: false, tempo_resposta_ms: Date.now() - start, erro_mensagem: `Rede: ${e.message}`, detalhes: {} };
  }
}

async function testWhatsapp(supabase: any) {
  const apiKey = Deno.env.get('EVOLUTION_API_KEY');
  const { data: inst } = await supabase.from('whatsapp_instancias').select('status, nome, api_url').eq('principal', true).maybeSingle();
  if (!apiKey && !inst) return { conexao_ok: false, tempo_resposta_ms: 0, erro_mensagem: 'WhatsApp não configurado', detalhes: {} };
  const conectado = inst?.status === 'open';
  return {
    conexao_ok: conectado,
    tempo_resposta_ms: 0,
    erro_mensagem: conectado ? null : `Instância ${inst?.status || 'não encontrada'}`,
    detalhes: { instancia: inst?.nome || null, status: inst?.status || null },
  };
}

async function testAutentique() {
  const key = Deno.env.get('AUTENTIQUE_API_KEY');
  if (!key) return { conexao_ok: false, tempo_resposta_ms: 0, erro_mensagem: 'AUTENTIQUE_API_KEY não configurada', detalhes: {} };
  const start = Date.now();
  try {
    const resp = await fetch('https://api.autentique.com.br/v2/graphql', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ me { name } }' }),
    });
    const ms = Date.now() - start;
    const ok = resp.ok;
    return { conexao_ok: ok, tempo_resposta_ms: ms, erro_mensagem: ok ? null : `Status ${resp.status}`, detalhes: {} };
  } catch (e) {
    return { conexao_ok: false, tempo_resposta_ms: Date.now() - start, erro_mensagem: `Rede: ${e.message}`, detalhes: {} };
  }
}

async function testEmail() {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) return { conexao_ok: false, tempo_resposta_ms: 0, erro_mensagem: 'RESEND_API_KEY não configurada', detalhes: {} };
  const start = Date.now();
  try {
    const resp = await fetch('https://api.resend.com/domains', { headers: { 'Authorization': `Bearer ${key}` } });
    const ms = Date.now() - start;
    return { conexao_ok: resp.ok, tempo_resposta_ms: ms, erro_mensagem: resp.ok ? null : `Status ${resp.status}`, detalhes: {} };
  } catch (e) {
    return { conexao_ok: false, tempo_resposta_ms: Date.now() - start, erro_mensagem: `Rede: ${e.message}`, detalhes: {} };
  }
}

async function testOpenAI() {
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) return { conexao_ok: false, tempo_resposta_ms: 0, erro_mensagem: 'OPENAI_API_KEY não configurada', detalhes: {} };
  const start = Date.now();
  try {
    const resp = await fetch('https://api.openai.com/v1/models', { headers: { 'Authorization': `Bearer ${key}` } });
    const ms = Date.now() - start;
    return { conexao_ok: resp.ok, tempo_resposta_ms: ms, erro_mensagem: resp.ok ? null : `Status ${resp.status}`, detalhes: {} };
  } catch (e) {
    return { conexao_ok: false, tempo_resposta_ms: Date.now() - start, erro_mensagem: `Rede: ${e.message}`, detalhes: {} };
  }
}

async function testRastreador(supabase: any, plataforma: string) {
  const { data: cred } = await supabase
    .from('rastreadores_credenciais')
    .select('configurado, teste_sucesso, testado_em, credenciais')
    .eq('plataforma', plataforma)
    .maybeSingle();
  if (!cred) return { conexao_ok: false, tempo_resposta_ms: 0, erro_mensagem: `${plataforma} não configurado`, detalhes: {} };
  return {
    conexao_ok: cred.configurado && cred.teste_sucesso,
    tempo_resposta_ms: 0,
    erro_mensagem: (cred.configurado && cred.teste_sucesso) ? null : 'Credenciais não validadas',
    detalhes: { testado_em: cred.testado_em },
  };
}

// ── Main handler ──────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // Check if a specific integration was requested
    let targetIntegracao: string | null = null;
    try {
      const body = await req.json();
      targetIntegracao = body?.integracao || null;
    } catch { /* no body = test all */ }

    const integracoes: Record<string, () => Promise<any>> = {
      hinova: () => testHinova(supabase),
      asaas: () => testAsaas(),
      whatsapp: () => testWhatsapp(supabase),
      autentique: () => testAutentique(),
      email: () => testEmail(),
      openai: () => testOpenAI(),
      softruck: () => testRastreador(supabase, 'softruck'),
      rede_veiculos: () => testRastreador(supabase, 'rede_veiculos'),
    };

    const toTest = targetIntegracao ? { [targetIntegracao]: integracoes[targetIntegracao] } : integracoes;
    const results: Record<string, any> = {};
    const failures: string[] = [];

    for (const [nome, testFn] of Object.entries(toTest)) {
      if (!testFn) continue;
      const result = await testFn();
      results[nome] = result;

      // Store in DB
      await supabase.from('integracoes_health_checks').insert({
        integracao: nome,
        conexao_ok: result.conexao_ok,
        tempo_resposta_ms: result.tempo_resposta_ms,
        detalhes: result.detalhes || {},
        erro_mensagem: result.erro_mensagem,
      });

      if (!result.conexao_ok) failures.push(nome);
    }

    // Notify admins if failures (only on full check, not single)
    if (!targetIntegracao && failures.length > 0) {
      const { data: admins } = await supabase.from('user_roles').select('user_id').eq('role', 'diretor');
      if (admins?.length) {
        const mensagem = `⚠️ Health Check: ${failures.length} integração(ões) com falha: ${failures.join(', ')}`;
        const notifs = admins.map((a: any) => ({
          user_id: a.user_id,
          titulo: 'Alerta de Integrações',
          mensagem,
          tipo: 'alerta',
          link: '/configuracoes/integracoes',
        }));
        await supabase.from('notificacoes').insert(notifs);
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[cron-integracoes-health-check] Error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
