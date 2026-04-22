// ============================================================
// Edge Function: autentique-reenviar-selfie
// Solicita ao cliente que refaça a selfie biométrica do Autentique,
// reenviando o link de assinatura via WhatsApp.
//
// Aplicável a contratos com autentique_status = 'biometric_rejected'
// (selfie reprovada — o cliente pode tentar novamente acessando o
// mesmo link). Não aprova biometrias em 'biometric_review' (a API
// pública do Autentique não suporta isso).
// ============================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { enviarTermoFiliacaoWhatsApp } from "../_shared/enviar-termo-filiacao-whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ROLES_PERMITIDOS = ["diretor", "admin", "admin_master", "desenvolvedor", "gerente_comercial", "analista_cadastro"];
const RATE_LIMIT_HOURS = 6;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    // Validar role
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: rolesData } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const userRoles = (rolesData || []).map((r: any) => r.role);
    const temPermissao = userRoles.some((r: string) => ROLES_PERMITIDOS.includes(r));
    if (!temPermissao) {
      return new Response(JSON.stringify({ error: "Acesso negado: requer perfil administrativo." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validar input
    const body = await req.json().catch(() => ({}));
    const contratoId: string | undefined = body?.contratoId;
    const motivo: string | undefined = body?.motivo;
    if (!contratoId || typeof contratoId !== "string") {
      return new Response(JSON.stringify({ error: "contratoId é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Buscar contrato (service role para evitar problemas com RLS)
    const { data: contrato, error: contratoErr } = await admin
      .from("contratos")
      .select(`
        id, numero, status, autentique_status, autentique_url, autentique_documento_id,
        biometric_resent_at, biometric_resend_count,
        cliente_nome, cliente_telefone,
        veiculo_marca, veiculo_modelo, veiculo_placa,
        leads:lead_id (nome, telefone, veiculo_marca, veiculo_modelo, veiculo_placa),
        associados:associado_id (nome, telefone),
        veiculos:veiculo_id (marca, modelo, placa)
      `)
      .eq("id", contratoId)
      .maybeSingle();

    if (contratoErr || !contrato) {
      return new Response(JSON.stringify({ error: "Contrato não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!contrato.autentique_url) {
      return new Response(JSON.stringify({ error: "Contrato sem link Autentique configurado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit: 1 reenvio a cada 6h
    if (contrato.biometric_resent_at) {
      const last = new Date(contrato.biometric_resent_at).getTime();
      const horas = (Date.now() - last) / 1000 / 60 / 60;
      if (horas < RATE_LIMIT_HOURS) {
        const restantes = Math.ceil(RATE_LIMIT_HOURS - horas);
        return new Response(JSON.stringify({
          error: `Aguarde ${restantes}h antes de solicitar novo reenvio para este contrato.`,
        }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Resolver dados do cliente/veículo (mesma lógica do enviar-termo-filiacao-whatsapp)
    const cliente: any = contrato.associados || contrato.leads || {
      nome: contrato.cliente_nome,
      telefone: contrato.cliente_telefone,
    };
    const veiculo: any = contrato.veiculos || contrato.leads || {
      marca: contrato.veiculo_marca,
      modelo: contrato.veiculo_modelo,
      placa: contrato.veiculo_placa,
    };
    const placa = veiculo.placa || veiculo.veiculo_placa || contrato.veiculo_placa || "";
    const modelo = veiculo.modelo || veiculo.veiculo_modelo || contrato.veiculo_modelo || "";
    const veiculoLabel = [modelo, placa].filter(Boolean).join(" - ") || null;

    if (!cliente.telefone) {
      return new Response(JSON.stringify({ error: "Cliente sem telefone cadastrado." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Disparar WhatsApp com o link existente
    const wppResult = await enviarTermoFiliacaoWhatsApp(admin, {
      contratoId: contrato.id,
      telefone: cliente.telefone,
      nomeCompleto: cliente.nome,
      veiculoLabel,
      numeroContrato: contrato.numero,
      autentiqueUrl: contrato.autentique_url,
    });

    if (!wppResult.success) {
      return new Response(JSON.stringify({
        success: false,
        error: wppResult.error || "Falha ao enviar WhatsApp",
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Atualizar auditoria + limpar status biométrico
    const novoCount = (contrato.biometric_resend_count || 0) + 1;
    await admin
      .from("contratos")
      .update({
        biometric_resent_at: new Date().toISOString(),
        biometric_resent_by: userId,
        biometric_resend_count: novoCount,
        // Se estava em biometric_rejected, voltar para pendente_assinatura
        // para que o cliente possa refazer a selfie.
        autentique_status: contrato.autentique_status === "biometric_rejected"
          ? "pending"
          : contrato.autentique_status,
      })
      .eq("id", contrato.id);

    // Histórico do contrato
    await admin.from("contratos_historico").insert({
      contrato_id: contrato.id,
      evento: "biometria_reenviada",
      descricao: `Reenvio de selfie biométrica solicitado por operador (tentativa #${novoCount})`,
      dados: {
        motivo: motivo || null,
        operador_id: userId,
        autentique_status_anterior: contrato.autentique_status,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      message: "Solicitação de nova selfie enviada ao cliente via WhatsApp.",
      signature_url: contrato.autentique_url,
      tentativa: novoCount,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[autentique-reenviar-selfie] Erro:", err);
    return new Response(JSON.stringify({
      success: false,
      error: err?.message || "Erro interno",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
