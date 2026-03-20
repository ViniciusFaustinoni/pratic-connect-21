import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getConfiguracaoNumero } from "../_shared/config-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    if (!ASAAS_API_KEY) {
      throw new Error("ASAAS_API_KEY não configurada");
    }

    const isSandbox = ASAAS_API_KEY.includes('_hmlg_');
    const ASAAS_BASE_URL = isSandbox
      ? 'https://sandbox.asaas.com/api/v3'
      : 'https://api.asaas.com/v3';

    const asaasReq = async (endpoint: string, method: string, body?: object) => {
      const resp = await fetch(`${ASAAS_BASE_URL}${endpoint}`, {
        method,
        headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
        body: body ? JSON.stringify(body) : undefined,
      });
      const d = await resp.json();
      if (!resp.ok) throw new Error(d.errors?.[0]?.description || `Erro ASAAS: ${resp.status}`);
      return d;
    };

    // Buscar sinistros com termo assinado mas sem cobrança
    const { data: sinistros, error: queryError } = await supabase
      .from("sinistros")
      .select(`
        id, protocolo, valor_cota_participacao, cota_paga, cobranca_cota_id, associado_id,
        associado:associados(id, nome, cpf, telefone, whatsapp, email)
      `)
      .eq("termo_anuencia_assinado", true)
      .eq("cota_paga", false)
      .is("cobranca_cota_id", null)
      .gt("valor_cota_participacao", 0);

    if (queryError) throw queryError;

    console.log(`[retroativo] Encontrados ${sinistros?.length || 0} sinistros pendentes`);

    const resultados: any[] = [];

    for (const sinistro of (sinistros || [])) {
      const associado = sinistro.associado as any;
      if (!associado) {
        resultados.push({ protocolo: sinistro.protocolo, status: "erro", erro: "Associado não encontrado" });
        continue;
      }

      try {
        // 0. Verificar duplicata antes de criar cobrança
        const { data: cobrancaDuplicata } = await supabase
          .from("asaas_cobrancas")
          .select("id, asaas_id")
          .eq("associado_id", associado.id)
          .eq("tipo", "cota_participacao")
          .eq("referencia", sinistro.protocolo)
          .neq("status", "CANCELLED")
          .maybeSingle();

        if (cobrancaDuplicata) {
          console.log(`[retroativo] Cobrança já existe (${cobrancaDuplicata.asaas_id}), vinculando ao sinistro`);
          await supabase.from("sinistros").update({ cobranca_cota_id: cobrancaDuplicata.id }).eq("id", sinistro.id);
          resultados.push({ protocolo: sinistro.protocolo, status: "ja_existente", asaas_id: cobrancaDuplicata.asaas_id });
          continue;
        }

        // 1. Buscar/criar cliente Asaas
        let customerAsaasId: string | null = null;
        const { data: clienteExistente } = await supabase
          .from("asaas_clientes")
          .select("asaas_id")
          .eq("associado_id", associado.id)
          .maybeSingle();

        if (clienteExistente?.asaas_id) {
          customerAsaasId = clienteExistente.asaas_id;
        } else {
          const novoCliente = await asaasReq('/customers', 'POST', {
            name: associado.nome,
            cpfCnpj: associado.cpf?.replace(/\D/g, ''),
            email: associado.email,
            mobilePhone: (associado.whatsapp || associado.telefone)?.replace(/\D/g, ''),
            externalReference: associado.id,
            notificationDisabled: true,
          });
          customerAsaasId = novoCliente.id;

          await supabase.from("asaas_clientes").insert({
            asaas_id: novoCliente.id,
            associado_id: associado.id,
            nome: associado.nome,
            cpf_cnpj: associado.cpf,
            email: associado.email,
            telefone: associado.whatsapp || associado.telefone,
            sincronizado_em: new Date().toISOString(),
          });
        }

        // 2. Criar cobrança PIX (prazo dinâmico)
        const prazoAdesao = await getConfiguracaoNumero(supabase, 'prazo_vencimento_adesao_dias', 3);
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + prazoAdesao);
        const dueDateStr = dueDate.toISOString().split('T')[0];

        const cobranca = await asaasReq('/payments', 'POST', {
          customer: customerAsaasId,
          billingType: 'PIX',
          value: sinistro.valor_cota_participacao,
          dueDate: dueDateStr,
          description: `Cota de Coparticipação - Evento ${sinistro.protocolo}`,
          externalReference: sinistro.id,
        });

        // 3. Buscar QR Code PIX
        let pixQrCode = null, pixPayload = null;
        try {
          const pixData = await asaasReq(`/payments/${cobranca.id}/pixQrCode`, 'GET');
          pixQrCode = pixData.encodedImage;
          pixPayload = pixData.payload;
        } catch (_) { /* PIX pode não estar disponível ainda */ }

        // 4. Salvar cobrança
        const { data: cobrancaSalva } = await supabase
          .from("asaas_cobrancas")
          .insert({
            asaas_id: cobranca.id,
            asaas_cliente_id: customerAsaasId,
            associado_id: associado.id,
            tipo: 'cota_participacao',
            referencia: sinistro.protocolo,
            valor: sinistro.valor_cota_participacao,
            data_emissao: new Date().toISOString().split('T')[0],
            data_vencimento: dueDateStr,
            status: cobranca.status,
            forma_pagamento: 'PIX',
            pix_qrcode: pixQrCode,
            pix_copia_cola: pixPayload,
          })
          .select()
          .single();

        // 5. Atualizar sinistro
        if (cobrancaSalva) {
          await supabase
            .from("sinistros")
            .update({ cobranca_cota_id: cobrancaSalva.id })
            .eq("id", sinistro.id);
        }

        // 6. Enviar WhatsApp
        const telefone = associado.whatsapp || associado.telefone;
        if (telefone) {
          const valorFormatado = sinistro.valor_cota_participacao.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

          // Buscar token do link ativo do sinistro
          const { data: linkAtivo } = await supabase
            .from("sinistro_evento_links")
            .select("token")
            .eq("sinistro_id", sinistro.id)
            .in("status", ["ativo", "completado"])
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          const appUrl = Deno.env.get("APP_PUBLIC_URL") || "https://pratic-connect-21.lovable.app";
          const linkPagamento = linkAtivo?.token
            ? `${appUrl}/evento/${linkAtivo.token}`
            : cobranca.invoiceUrl || `https://www.asaas.com/c/${cobranca.id}`;

          let mensagem = `💳 *PRATIC - Pagamento da Cota de Coparticipação*\n\n`;
          mensagem += `Olá ${associado.nome},\n\n`;
          mensagem += `O Termo de Entrada do evento *${sinistro.protocolo}* foi assinado com sucesso! ✅\n\n`;
          mensagem += `Agora, efetue o pagamento da cota de coparticipação:\n\n`;
          mensagem += `💰 *Valor:* R$ ${valorFormatado}\n`;
          mensagem += `📋 *Link de pagamento:* ${linkPagamento}\n`;
          mensagem += `\nApós o pagamento, seu evento será encaminhado para a oficina.`;

          try {
            const whatsResp = await fetch(`${supabaseUrl}/functions/v1/whatsapp-send-text`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                telefone,
                mensagem,
                template_name: 'sinistro_atualizado',
                template_params: [
                  associado.nome?.split(' ')[0] || 'Associado',
                  sinistro.protocolo || 'Evento',
                  `Pagamento da cota - R$ ${valorFormatado}`,
                ],
              }),
            });
            const whatsResult = await whatsResp.json();
            console.log(`[retroativo] WhatsApp enviado para ${sinistro.protocolo}:`, whatsResult.success);
          } catch (whatsErr: any) {
            console.error(`[retroativo] Erro WhatsApp ${sinistro.protocolo}:`, whatsErr.message);
          }
        }

        resultados.push({ protocolo: sinistro.protocolo, status: "ok", asaas_id: cobranca.id });
        console.log(`[retroativo] ✓ ${sinistro.protocolo} - cobrança ${cobranca.id} criada`);

        // Delay entre sinistros para não sobrecarregar APIs
        await new Promise(r => setTimeout(r, 1000));
      } catch (err: any) {
        console.error(`[retroativo] Erro ${sinistro.protocolo}:`, err.message);
        resultados.push({ protocolo: sinistro.protocolo, status: "erro", erro: err.message });
      }
    }

    return new Response(
      JSON.stringify({ success: true, total: sinistros?.length || 0, resultados }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[retroativo] Erro:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
