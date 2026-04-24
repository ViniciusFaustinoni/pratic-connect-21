import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PLACA_PLACEHOLDER_REGEX = /^0KM[A-Z0-9]{5}$/i;
const isPlacaPlaceholder = (p?: string | null) => !!p && PLACA_PLACEHOLDER_REGEX.test(p.trim());

async function getCredenciaisBanco(supabase: any, supabaseServiceKey: string) {
  try {
    const { data } = await supabase
      .from('integracoes_credenciais')
      .select('credenciais_encrypted, iv, configurado')
      .eq('integracao', 'hinova')
      .single();
    if (!data?.configurado) return null;
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw', encoder.encode(supabaseServiceKey), { name: 'PBKDF2' }, false, ['deriveKey']
    );
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: encoder.encode('integracoes_credenciais_salt'), iterations: 100000, hash: 'SHA-256' },
      keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
    );
    const encrypted = Uint8Array.from(atob(data.credenciais_encrypted), c => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(data.iv), c => c.charCodeAt(0));
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
    return JSON.parse(new TextDecoder().decode(decrypted));
  } catch (e) {
    console.error('[sga-atualizar-placa] getCredenciaisBanco error:', e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    const { veiculo_id } = await req.json();
    if (!veiculo_id) {
      return new Response(JSON.stringify({ success: false, error: 'veiculo_id obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: veiculo, error: vErr } = await supabase
      .from('veiculos')
      .select('id, placa, codigo_hinova, associado_id')
      .eq('id', veiculo_id)
      .maybeSingle();

    if (vErr || !veiculo) {
      return new Response(JSON.stringify({ success: false, error: 'Veículo não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!veiculo.codigo_hinova) {
      return new Response(JSON.stringify({ success: false, error: 'Veículo ainda não cadastrado no SGA (sem codigo_hinova)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (isPlacaPlaceholder(veiculo.placa) || !veiculo.placa) {
      return new Response(JSON.stringify({ success: false, error: 'Placa ainda é placeholder; nada a atualizar' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Carregar credenciais
    let hinovaApiUrl = Deno.env.get('HINOVA_API_URL') || 'https://api.hinova.com.br/api/sga/v2';
    let hinovaToken = Deno.env.get('HINOVA_TOKEN');
    let hinovaUsuario = Deno.env.get('HINOVA_USUARIO');
    let hinovaSenha = Deno.env.get('HINOVA_SENHA');

    if (!hinovaToken || !hinovaUsuario || !hinovaSenha) {
      const cred = await getCredenciaisBanco(supabase, supabaseServiceKey);
      if (cred) {
        hinovaApiUrl = cred.api_url || hinovaApiUrl;
        hinovaToken = cred.token || hinovaToken;
        hinovaUsuario = cred.usuario || hinovaUsuario;
        hinovaSenha = cred.senha || hinovaSenha;
      }
    }

    if (!hinovaToken || !hinovaUsuario || !hinovaSenha) {
      return new Response(JSON.stringify({ success: false, error: 'Credenciais Hinova não configuradas' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Auth
    const authResp = await fetch(`${hinovaApiUrl}/usuario/autenticar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hinovaToken}` },
      body: JSON.stringify({ usuario: hinovaUsuario, senha: hinovaSenha }),
    });
    if (!authResp.ok) {
      const txt = await authResp.text();
      throw new Error(`Auth Hinova falhou: ${authResp.status} ${txt.substring(0, 200)}`);
    }
    const authData = await authResp.json();
    const sessionToken = authData?.token || authData?.access_token;
    if (!sessionToken) throw new Error('Token de sessão não retornado pelo Hinova');

    const opHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sessionToken}`,
    };

    // Atualizar placa no SGA
    const updatePayload = {
      codigo_veiculo: Number(veiculo.codigo_hinova),
      placa: veiculo.placa.trim().toUpperCase(),
    };

    const updResp = await fetch(`${hinovaApiUrl}/veiculo/atualizar`, {
      method: 'POST',
      headers: opHeaders,
      body: JSON.stringify(updatePayload),
    });
    const updText = await updResp.text();
    let updData: any = null;
    try { updData = JSON.parse(updText); } catch { updData = { raw: updText.substring(0, 300) }; }

    await supabase.from('sga_sync_logs').insert({
      veiculo_id: veiculo.id,
      associado_id: veiculo.associado_id,
      action: 'atualizar_placa_sga',
      status: updResp.ok ? 'success' : 'error',
      request_payload: updatePayload,
      response_payload: updData,
      error_message: updResp.ok ? null : (updData?.mensagem || updText.substring(0, 200)),
    });

    if (!updResp.ok) {
      return new Response(JSON.stringify({ success: false, error: updData?.mensagem || 'Erro ao atualizar placa' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Marcar fila como concluída
    await supabase
      .from('sga_sync_queue')
      .update({ status: 'concluido', ultima_tentativa_em: new Date().toISOString() })
      .eq('veiculo_id', veiculo.id)
      .eq('etapa_parou', 'atualizar_placa');

    return new Response(JSON.stringify({ success: true, codigo_veiculo: veiculo.codigo_hinova, placa: veiculo.placa }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('[sga-atualizar-placa] erro:', e);
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
