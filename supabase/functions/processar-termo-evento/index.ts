import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY")!;
const ASAAS_API_URL = Deno.env.get("ASAAS_API_URL") || "https://api.asaas.com/v3";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { acao, token, assinatura_base64, ip_cliente, cobranca_id, cartao, parcelas } = await req.json();

    if (!token || !acao) {
      return new Response(JSON.stringify({ error: "token e acao são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============ VALIDATE TOKEN ============
    const { data: link, error: linkError } = await supabase
      .from("sinistro_evento_links")
      .select("*")
      .eq("token", token)
      .eq("status", "ativo")
      .single();

    if (linkError || !link) {
      return new Response(JSON.stringify({ valid: false, reason: "invalido" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(link.expira_em) < new Date()) {
      return new Response(JSON.stringify({ valid: false, reason: "expirado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch sinistro with associado, veiculo
    const { data: sinistro } = await supabase
      .from("sinistros")
      .select(`
        id, protocolo, tipo, data_ocorrencia, descricao, status, cobranca_cota_id,
        cota_paga, cota_paga_em, termo_anuencia_assinado,
        associado:associados!sinistros_associado_id_fkey(
          id, nome, cpf, email, telefone, whatsapp, plano_id
        ),
        veiculo:veiculos!sinistros_veiculo_id_fkey(
          id, placa, marca, modelo, ano_modelo, cor, valor_fipe, chassi
        )
      `)
      .eq("id", link.sinistro_id)
      .single();

    if (!sinistro) {
      return new Response(JSON.stringify({ error: "Sinistro não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const associado = sinistro.associado as any;
    const veiculo = sinistro.veiculo as any;

    // Calculate cota
    let valorCota = 0;
    let planoInfo: any = null;
    if (associado?.id) {
      // Get active contract -> plan
      const { data: contrato } = await supabase
        .from("contratos")
        .select("plano_id")
        .eq("associado_id", associado.id)
        .eq("status", "ativo")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const planoId = contrato?.plano_id || associado.plano_id;
      if (planoId) {
        const { data: plano } = await supabase
          .from("planos")
          .select("nome, cota_participacao, cota_minima")
          .eq("id", planoId)
          .single();
        planoInfo = plano;
      }
    }

    const valorFipe = veiculo?.valor_fipe || 0;
    const percentual = planoInfo?.cota_participacao || 0;
    const cotaMinima = planoInfo?.cota_minima || 0;
    const valorCalculado = valorFipe * percentual / 100;
    valorCota = Math.max(valorCalculado, cotaMinima);

    // Determine state
    const jaAssinou = !!link.assinatura_em;
    const jaPagou = !!link.pagamento_confirmado_em || sinistro.cota_paga;

    // ============ ACAO: VALIDAR ============
    if (acao === "validar") {
      // Get BO number from etapa2
      const boNumero = (link.dados_etapa2 as any)?.numero_bo || null;

      return new Response(JSON.stringify({
        valid: true,
        ja_assinou: jaAssinou,
        ja_pagou: jaPagou,
        sinistro: {
          id: sinistro.id,
          protocolo: sinistro.protocolo,
          tipo: sinistro.tipo,
          data_ocorrencia: sinistro.data_ocorrencia,
          bo_numero: boNumero,
        },
        associado: {
          nome: associado?.nome,
          cpf: associado?.cpf,
        },
        veiculo: {
          placa: veiculo?.placa,
          marca: veiculo?.marca,
          modelo: veiculo?.modelo,
        },
        cota: {
          valor_fipe: valorFipe,
          percentual,
          cota_minima: cotaMinima,
          valor_cota: valorCota,
          plano_nome: planoInfo?.nome,
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============ ACAO: ASSINAR ============
    if (acao === "assinar") {
      if (!assinatura_base64) {
        return new Response(JSON.stringify({ error: "Assinatura é obrigatória" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Upload signature to storage
      const base64Data = assinatura_base64.replace(/^data:image\/\w+;base64,/, "");
      const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      const filePath = `sinistro-eventos/${sinistro.id}/termo-assinatura.png`;

      const { error: uploadError } = await supabase.storage
        .from("sinistro-eventos")
        .upload(filePath, binaryData, {
          contentType: "image/png",
          upsert: true,
        });

      if (uploadError) {
        console.error("[processar-termo-evento] Upload error:", uploadError);
        // Try creating bucket if it doesn't exist
        await supabase.storage.createBucket("sinistro-eventos", { public: false });
        const { error: retryError } = await supabase.storage
          .from("sinistro-eventos")
          .upload(filePath, binaryData, { contentType: "image/png", upsert: true });
        if (retryError) {
          return new Response(JSON.stringify({ error: "Erro ao salvar assinatura" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const { data: urlData } = supabase.storage
        .from("sinistro-eventos")
        .getPublicUrl(filePath);

      // Use signed URL for private bucket
      const { data: signedData } = await supabase.storage
        .from("sinistro-eventos")
        .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year

      const assinaturaUrl = signedData?.signedUrl || urlData?.publicUrl || filePath;
      const agora = new Date().toISOString();

      // Extract real IP from request headers
      const realIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() 
        || req.headers.get("x-real-ip") 
        || ip_cliente 
        || "unknown";

      // Update link
      await supabase
        .from("sinistro_evento_links")
        .update({
          assinatura_url: assinaturaUrl,
          assinatura_ip: realIp,
          assinatura_em: agora,
          etapa_atual: 1,
        })
        .eq("id", link.id);

      // Update sinistro
      await supabase
        .from("sinistros")
        .update({
          termo_anuencia_assinado: true,
          termo_anuencia_url: assinaturaUrl,
          termo_anuencia_assinado_em: agora,
          status: "aguardando_cota",
        })
        .eq("id", sinistro.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============ ACAO: GERAR COBRANCA PIX ============
    if (acao === "gerar_cobranca_pix") {
      if (!jaAssinou && !link.assinatura_em) {
        return new Response(JSON.stringify({ error: "Assine o termo primeiro" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if already has a pending PIX charge
      if (sinistro.cobranca_cota_id) {
        const { data: existingCharge } = await supabase
          .from("asaas_cobrancas")
          .select("asaas_id, pix_qrcode, pix_copia_cola, status")
          .eq("id", sinistro.cobranca_cota_id)
          .single();

        if (existingCharge && existingCharge.status === "PENDING") {
          return new Response(JSON.stringify({
            success: true,
            cobranca_id: sinistro.cobranca_cota_id,
            qr_code: existingCharge.pix_qrcode,
            copia_cola: existingCharge.pix_copia_cola,
            valor: valorCota,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Sync/find ASAAS customer
      let asaasCustomerId = "";
      const { data: asaasCliente } = await supabase
        .from("asaas_clientes")
        .select("asaas_id")
        .eq("associado_id", associado.id)
        .maybeSingle();

      if (asaasCliente) {
        asaasCustomerId = asaasCliente.asaas_id;
      } else {
        // Create customer in ASAAS
        const customerRes = await fetch(`${ASAAS_API_URL}/customers`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "access_token": ASAAS_API_KEY },
          body: JSON.stringify({
            name: associado.nome,
            cpfCnpj: associado.cpf?.replace(/\D/g, ""),
            email: associado.email,
            phone: associado.telefone,
          }),
        });
        const customerData = await customerRes.json();
        if (!customerData.id) {
          return new Response(JSON.stringify({ error: "Erro ao criar cliente no ASAAS" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        asaasCustomerId = customerData.id;

        await supabase.from("asaas_clientes").insert({
          asaas_id: customerData.id,
          associado_id: associado.id,
          nome: associado.nome,
          cpf_cnpj: associado.cpf,
          email: associado.email,
          telefone: associado.telefone,
        });
      }

      // Create PIX charge
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 1);

      const chargeRes = await fetch(`${ASAAS_API_URL}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "access_token": ASAAS_API_KEY },
        body: JSON.stringify({
          customer: asaasCustomerId,
          billingType: "PIX",
          value: valorCota,
          dueDate: dueDate.toISOString().split("T")[0],
          description: `Cota de Coparticipação - Evento ${sinistro.protocolo}`,
        }),
      });
      const chargeData = await chargeRes.json();

      if (!chargeData.id) {
        console.error("[processar-termo-evento] ASAAS charge error:", chargeData);
        return new Response(JSON.stringify({ error: "Erro ao gerar cobrança PIX" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get PIX QR Code
      let pixQrCode = "";
      let pixCopiaCola = "";
      try {
        const pixRes = await fetch(`${ASAAS_API_URL}/payments/${chargeData.id}/pixQrCode`, {
          headers: { "access_token": ASAAS_API_KEY },
        });
        const pixData = await pixRes.json();
        pixQrCode = pixData.encodedImage || "";
        pixCopiaCola = pixData.payload || "";
      } catch (e) {
        console.error("[processar-termo-evento] PIX QR error:", e);
      }

      // Save charge
      const { data: cobrancaSalva } = await supabase
        .from("asaas_cobrancas")
        .insert({
          asaas_id: chargeData.id,
          associado_id: associado.id,
          valor: valorCota,
          tipo: "cota_participacao",
          status: "PENDING",
          data_emissao: new Date().toISOString().split("T")[0],
          data_vencimento: dueDate.toISOString().split("T")[0],
          forma_pagamento: "PIX",
          pix_qrcode: pixQrCode,
          pix_copia_cola: pixCopiaCola,
          referencia: `cota_evento_${sinistro.protocolo}`,
        })
        .select("id")
        .single();

      if (cobrancaSalva) {
        await supabase
          .from("sinistros")
          .update({ cobranca_cota_id: cobrancaSalva.id })
          .eq("id", sinistro.id);
      }

      return new Response(JSON.stringify({
        success: true,
        cobranca_id: cobrancaSalva?.id,
        qr_code: pixQrCode,
        copia_cola: pixCopiaCola,
        valor: valorCota,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============ ACAO: GERAR COBRANCA CARTAO ============
    if (acao === "gerar_cobranca_cartao") {
      if (!jaAssinou && !link.assinatura_em) {
        return new Response(JSON.stringify({ error: "Assine o termo primeiro" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!cartao || !cartao.numero || !cartao.nome || !cartao.validade || !cartao.cvv) {
        return new Response(JSON.stringify({ error: "Dados do cartão incompletos" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Sync/find ASAAS customer
      let asaasCustomerId = "";
      const { data: asaasCliente } = await supabase
        .from("asaas_clientes")
        .select("asaas_id")
        .eq("associado_id", associado.id)
        .maybeSingle();

      if (asaasCliente) {
        asaasCustomerId = asaasCliente.asaas_id;
      } else {
        const customerRes = await fetch(`${ASAAS_API_URL}/customers`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "access_token": ASAAS_API_KEY },
          body: JSON.stringify({
            name: associado.nome,
            cpfCnpj: associado.cpf?.replace(/\D/g, ""),
            email: associado.email,
            phone: associado.telefone,
          }),
        });
        const customerData = await customerRes.json();
        if (!customerData.id) {
          return new Response(JSON.stringify({ error: "Erro ao criar cliente ASAAS" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        asaasCustomerId = customerData.id;
        await supabase.from("asaas_clientes").insert({
          asaas_id: customerData.id,
          associado_id: associado.id,
          nome: associado.nome,
          cpf_cnpj: associado.cpf,
          email: associado.email,
          telefone: associado.telefone,
        });
      }

      const [expMonth, expYear] = cartao.validade.split("/");
      const installmentCount = parcelas || 1;

      const chargeBody: any = {
        customer: asaasCustomerId,
        billingType: "CREDIT_CARD",
        value: valorCota,
        dueDate: new Date().toISOString().split("T")[0],
        description: `Cota de Coparticipação - Evento ${sinistro.protocolo}`,
        creditCard: {
          holderName: cartao.nome,
          number: cartao.numero.replace(/\s/g, ""),
          expiryMonth: expMonth,
          expiryYear: expYear.length === 2 ? `20${expYear}` : expYear,
          ccv: cartao.cvv,
        },
        creditCardHolderInfo: {
          name: associado.nome,
          cpfCnpj: associado.cpf?.replace(/\D/g, ""),
          email: associado.email,
          phone: associado.telefone?.replace(/\D/g, ""),
          postalCode: "00000000",
          addressNumber: "0",
        },
      };

      if (installmentCount > 1) {
        chargeBody.installmentCount = installmentCount;
        chargeBody.installmentValue = Math.ceil((valorCota / installmentCount) * 100) / 100;
      }

      const chargeRes = await fetch(`${ASAAS_API_URL}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "access_token": ASAAS_API_KEY },
        body: JSON.stringify(chargeBody),
      });
      const chargeData = await chargeRes.json();

      if (chargeData.errors || chargeData.status === "DECLINED") {
        const errorMsg = chargeData.errors?.[0]?.description || "Pagamento recusado pelo cartão";
        return new Response(JSON.stringify({ success: false, error: errorMsg }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!chargeData.id) {
        return new Response(JSON.stringify({ error: "Erro ao processar pagamento" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Save charge
      const { data: cobrancaSalva } = await supabase
        .from("asaas_cobrancas")
        .insert({
          asaas_id: chargeData.id,
          associado_id: associado.id,
          valor: valorCota,
          tipo: "cota_participacao",
          status: chargeData.status || "CONFIRMED",
          data_emissao: new Date().toISOString().split("T")[0],
          data_vencimento: new Date().toISOString().split("T")[0],
          forma_pagamento: "CREDIT_CARD",
          referencia: `cota_evento_${sinistro.protocolo}`,
        })
        .select("id")
        .single();

      if (cobrancaSalva) {
        await supabase
          .from("sinistros")
          .update({ cobranca_cota_id: cobrancaSalva.id })
          .eq("id", sinistro.id);
      }

      // If confirmed immediately (card payment), update sinistro
      if (chargeData.status === "CONFIRMED" || chargeData.status === "RECEIVED") {
        const agora = new Date().toISOString();
        await supabase
          .from("sinistros")
          .update({
            cota_paga: true,
            cota_paga_em: agora,
            status: "pagamento_confirmado",
          })
          .eq("id", sinistro.id);

        await supabase
          .from("sinistro_evento_links")
          .update({ pagamento_confirmado_em: agora })
          .eq("id", link.id);

        // WhatsApp notification
        try {
          const tel = associado.whatsapp || associado.telefone;
          if (tel) {
            await supabase.functions.invoke("whatsapp-send-text", {
              body: {
                phone: tel,
                message: `✅ *PRATIC - Pagamento Confirmado*\n\nOlá ${associado.nome},\n\nO pagamento da cota de coparticipação no valor de R$ ${valorCota.toFixed(2)} foi confirmado!\n\nO reparo do seu veículo será agendado em breve. Você receberá atualizações pelo WhatsApp.`,
              },
            });
          }
        } catch (e) {
          console.error("[processar-termo-evento] WhatsApp error:", e);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        status: chargeData.status,
        cobranca_id: cobrancaSalva?.id,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============ ACAO: VERIFICAR PAGAMENTO ============
    if (acao === "verificar_pagamento") {
      if (!cobranca_id) {
        return new Response(JSON.stringify({ error: "cobranca_id obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: cobranca } = await supabase
        .from("asaas_cobrancas")
        .select("asaas_id, status")
        .eq("id", cobranca_id)
        .single();

      if (!cobranca) {
        return new Response(JSON.stringify({ error: "Cobrança não encontrada" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check ASAAS status
      let asaasStatus = cobranca.status;
      try {
        const statusRes = await fetch(`${ASAAS_API_URL}/payments/${cobranca.asaas_id}`, {
          headers: { "access_token": ASAAS_API_KEY },
        });
        const statusData = await statusRes.json();
        asaasStatus = statusData.status || cobranca.status;

        if (asaasStatus !== cobranca.status) {
          await supabase
            .from("asaas_cobrancas")
            .update({ status: asaasStatus })
            .eq("id", cobranca_id);
        }
      } catch (e) {
        console.error("[processar-termo-evento] ASAAS status check error:", e);
      }

      const confirmado = asaasStatus === "CONFIRMED" || asaasStatus === "RECEIVED";

      if (confirmado) {
        const agora = new Date().toISOString();
        await supabase
          .from("sinistros")
          .update({
            cota_paga: true,
            cota_paga_em: agora,
            status: "pagamento_confirmado",
          })
          .eq("id", sinistro.id);

        await supabase
          .from("sinistro_evento_links")
          .update({ pagamento_confirmado_em: agora })
          .eq("id", link.id);

        // WhatsApp
        try {
          const tel = associado.whatsapp || associado.telefone;
          if (tel) {
            await supabase.functions.invoke("whatsapp-send-text", {
              body: {
                phone: tel,
                message: `✅ *PRATIC - Pagamento Confirmado*\n\nOlá ${associado.nome},\n\nO pagamento da cota de coparticipação no valor de R$ ${valorCota.toFixed(2)} foi confirmado!\n\nO reparo do seu veículo será agendado em breve.`,
              },
            });
          }
        } catch (e) {
          console.error("[processar-termo-evento] WhatsApp error:", e);
        }
      }

      return new Response(JSON.stringify({
        status: asaasStatus,
        confirmado,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[processar-termo-evento] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
