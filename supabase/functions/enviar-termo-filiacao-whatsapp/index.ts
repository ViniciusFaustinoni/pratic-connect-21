// ============================================================
// Edge Function: enviar-termo-filiacao-whatsapp
// Wrapper para reenvio manual (botão na UI) do link de assinatura
// do Termo de Filiação via WhatsApp.
// ============================================================

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';
import { enviarTermoFiliacaoWhatsApp } from '../_shared/enviar-termo-filiacao-whatsapp.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: claims, error: claimsError } = await supabase.auth.getClaims(
      authHeader.replace('Bearer ', ''),
    );
    if (claimsError || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const contratoId: string | undefined = body?.contratoId;
    if (!contratoId) {
      return new Response(JSON.stringify({ error: 'contratoId é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // service-role para ler dados do contrato sem depender de RLS
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: contrato, error: contratoErr } = await admin
      .from('contratos')
      .select(`
        id, numero, autentique_url, status,
        leads:lead_id (nome, telefone, veiculo_marca, veiculo_modelo, veiculo_placa),
        associados:associado_id (nome, telefone),
        veiculos:veiculo_id (marca, modelo, placa)
      `)
      .eq('id', contratoId)
      .maybeSingle();

    if (contratoErr || !contrato) {
      return new Response(JSON.stringify({ error: 'contrato não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!contrato.autentique_url) {
      return new Response(JSON.stringify({ error: 'contrato sem link Autentique' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cliente: any = contrato.associados || contrato.leads || {};
    const veiculo: any = contrato.veiculos || contrato.leads || {};
    const placa = veiculo.placa || veiculo.veiculo_placa || '';
    const modelo = veiculo.modelo || veiculo.veiculo_modelo || '';
    const veiculoLabel = [modelo, placa].filter(Boolean).join(' - ') || null;

    const result = await enviarTermoFiliacaoWhatsApp(admin, {
      contratoId: contrato.id,
      telefone: cliente.telefone,
      nomeCompleto: cliente.nome,
      veiculoLabel,
      numeroContrato: contrato.numero,
      autentiqueUrl: contrato.autentique_url,
    });

    const status = result.success ? 200 : 400;
    return new Response(JSON.stringify(result), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[enviar-termo-filiacao-whatsapp] erro:', err);
    return new Response(JSON.stringify({ success: false, error: err?.message || 'erro' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
