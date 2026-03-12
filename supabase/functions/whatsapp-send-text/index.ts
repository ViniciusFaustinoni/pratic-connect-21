import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ====== HELPER: Detectar links no texto ======
function contemLink(texto: string): boolean {
  return /https?:\/\/\S+/i.test(texto);
}

// ====== HELPER: Formatar telefone ======
function formatarTelefone(telefone: string): string {
  let limpo = telefone.replace(/\D/g, "");
  if (!limpo.startsWith("55")) limpo = "55" + limpo;
  return limpo;
}

// ====== HELPER: Enviar via Evolution API ======
async function enviarViaEvolution(
  supabase: any,
  telefoneFormatado: string,
  mensagem: string,
  instancia: any,
  apiKey: string,
  delayMs: number
) {
  // Verificar status
  const rawApiUrl = Deno.env.get('EVOLUTION_API_URL') || instancia.api_url;
  const apiUrl = rawApiUrl ? rawApiUrl.replace(/\/+$/, '') : null;
  if (!apiUrl) throw new Error("URL da Evolution API não configurada");

  if (!instancia.status || instancia.status !== 'open') {
    console.log(`[whatsapp-send-text] Status no banco: ${instancia.status} - verificando API...`);
    try {
      const statusResponse = await fetch(
        `${apiUrl}/instance/connectionState/${instancia.instance_name}`,
        { method: 'GET', headers: { 'apikey': apiKey } }
      );
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        if (statusData.instance?.state === 'open') {
          await supabase.from('whatsapp_instancias')
            .update({ status: 'open', updated_at: new Date().toISOString() })
            .eq('id', instancia.id);
        } else {
          throw new Error("WhatsApp não está conectado. Acesse as configurações para reconectar.");
        }
      } else {
        throw new Error("WhatsApp não está conectado. Acesse as configurações para reconectar.");
      }
    } catch (apiError: any) {
      if (apiError.message?.includes("WhatsApp não está")) throw apiError;
      throw new Error("WhatsApp não está conectado. Acesse as configurações para reconectar.");
    }
  }

  if (telefoneFormatado.length < 12) throw new Error("Número de telefone inválido.");

  // Delay anti-bloqueio
  if (delayMs > 0) {
    console.log(`[whatsapp-send-text] Delay: ${delayMs}ms`);
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  console.log(`[whatsapp-send-text] Enviando via Evolution para ${telefoneFormatado}`);

  const response = await fetch(`${apiUrl}/message/sendText/${instancia.instance_name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify({ number: telefoneFormatado, text: mensagem }),
  });

  const result = await response.json();

  if (!response.ok) {
    console.error("[whatsapp-send-text] Erro Evolution:", result);
    await supabase.from("whatsapp_mensagens").insert({
      instancia_id: instancia.id, telefone: telefoneFormatado, tipo: "text",
      mensagem, direcao: "saida", status: "erro",
      erro_mensagem: result.message || result.error || "Erro desconhecido",
    });
    throw new Error(result.message || "Erro ao enviar");
  }

  await supabase.from("whatsapp_mensagens").insert({
    instancia_id: instancia.id, telefone: telefoneFormatado, tipo: "text",
    mensagem, direcao: "saida", status: "enviada", message_id: result.key?.id,
  });

  console.log(`[whatsapp-send-text] ✓ Evolution: ${telefoneFormatado} - ID: ${result.key?.id}`);
  return { success: true, message_id: result.key?.id, telefone: telefoneFormatado, provedor: 'evolution' };
}

// ====== HELPER: Enviar via Meta API ======
async function enviarViaMeta(
  supabase: any,
  telefoneFormatado: string,
  mensagem: string,
  templateName?: string,
  templateParams?: string[],
  allowText: boolean = false,
  templateButtonParams?: string[]
) {
  const { data: metaConfig } = await supabase
    .from("whatsapp_meta_config")
    .select("phone_number_id, access_token")
    .eq("ativo", true)
    .single();

  const accessToken = metaConfig?.access_token || Deno.env.get("META_WHATSAPP_ACCESS_TOKEN");
  if (!accessToken) throw new Error("Access Token da Meta não configurado");

  if (!metaConfig?.phone_number_id) throw new Error("Configuração da Meta não encontrada");

  const phoneNumberId = metaConfig.phone_number_id;
  let metaBody: any;
  let bodyParams: string[] = templateParams || [];
  let buttonParams: string[] = templateButtonParams || [];
  let template: any = null;

  if (templateName) {
    // Enviar como template
    const { data: tmpl } = await supabase
      .from("whatsapp_meta_templates")
      .select("nome, idioma, status, corpo, botoes")
      .eq("nome", templateName)
      .single();

    template = tmpl;
    if (!template) throw new Error(`Template '${templateName}' não encontrado`);
    if (template.status !== "APPROVED") {
      console.warn(`[whatsapp-send-text] Template '${templateName}' não aprovado (${template.status})`);
      throw new Error(`Template '${templateName}' não aprovado. Status: ${template.status}`);
    }

    // Se não temos buttonParams explícitos, verificar se template tem botão URL com {{}}
    if (buttonParams.length === 0 && bodyParams.length > 0) {
      const botoes = template.botoes as any[] | null;
      const hasUrlButton = botoes?.some((b: any) => (b.type === 'URL' || b.tipo === 'url') && b.url?.includes('{{'));
      
      if (hasUrlButton) {
        // Contar variáveis únicas apenas no corpo do template
        const bodyVarCount = new Set((template.corpo || '').match(/\{\{\d+\}\}/g) || []).size;
        
        if (bodyParams.length > bodyVarCount) {
          // Separar: os primeiros são body, os restantes são button
          buttonParams = bodyParams.slice(bodyVarCount);
          bodyParams = bodyParams.slice(0, bodyVarCount);
          console.log(`[whatsapp-send-text] Auto-split params: ${bodyParams.length} body + ${buttonParams.length} button`);
        }
      }
    }

    const components: any[] = [];
    if (bodyParams.length > 0) {
      components.push({
        type: "body",
        parameters: bodyParams.map(p => ({ type: "text", text: p })),
      });
    }

    // Suporte a botões com URL dinâmica
    if (buttonParams.length > 0) {
      buttonParams.forEach((param: string, index: number) => {
        components.push({
          type: "button",
          sub_type: "url",
          index,
          parameters: [{ type: "text", text: param }],
        });
      });
    }

    metaBody = {
      messaging_product: "whatsapp",
      to: telefoneFormatado,
      type: "template",
      template: {
        name: template.nome,
        language: { code: template.idioma || "pt_BR" },
        components,
      },
    };

    console.log(`[whatsapp-send-text] Enviando template '${templateName}' via Meta para ${telefoneFormatado}`);
  } else if (allowText) {
    // Texto livre permitido (respostas da Maya/chatbot dentro da janela 24h)
    metaBody = {
      messaging_product: "whatsapp",
      to: telefoneFormatado,
      type: "text",
      text: {
        preview_url: contemLink(mensagem),
        body: mensagem,
      },
    };

    console.log(`[whatsapp-send-text] Enviando texto livre via Meta para ${telefoneFormatado} (allow_text=true, preview_url=${contemLink(mensagem)})`);
  } else {
    // BLOQUEAR texto livre proativo sem template — NÃO é entregue fora da janela 24h
    console.error(`[whatsapp-send-text] ❌ BLOQUEADO: Tentativa de envio sem template via Meta para ${telefoneFormatado}. Mensagem: "${mensagem.substring(0, 80)}..."`);
    
    await supabase.from("whatsapp_mensagens").insert({
      telefone: telefoneFormatado, tipo: "text", mensagem,
      direcao: "saida", status: "erro",
      erro_mensagem: "Bloqueado: Meta API ativa requer template_name. Texto livre não é entregue fora da janela 24h. Use allow_text=true para respostas na janela 24h.",
      provedor: "meta_oficial",
    });

    throw new Error("Meta API ativa: template_name obrigatório. Texto livre não será entregue fora da janela de 24h. Adicione template_name/template_params ou allow_text=true.");
  }

  const response = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metaBody),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    // Se erro de contagem de params, tentar auto-corrigir
    const errorDetails = result.error?.error_data?.details || '';
    const paramMismatch = errorDetails.match(/number of localizable_params \((\d+)\) does not match the expected number of params \((\d+)\)/);
    
    if (paramMismatch && bodyParams.length > 0) {
      const sent = parseInt(paramMismatch[1]);
      const expected = parseInt(paramMismatch[2]);
      const excess = sent - expected;
      
      if (excess > 0 && excess < bodyParams.length) {
        // Tentativa 1: mover params excedentes para buttons (se template tem URL dinâmica)
        if (buttonParams.length === 0) {
          console.log(`[whatsapp-send-text] Auto-retry #1: movendo ${excess} param(s) do body para button`);
          const newButtonParams = bodyParams.slice(bodyParams.length - excess);
          const newBodyParams = bodyParams.slice(0, bodyParams.length - excess);
          
          const retryComponents: any[] = [];
          if (newBodyParams.length > 0) {
            retryComponents.push({
              type: "body",
              parameters: newBodyParams.map(p => ({ type: "text", text: p })),
            });
          }
          newButtonParams.forEach((param: string, index: number) => {
            retryComponents.push({
              type: "button", sub_type: "url", index,
              parameters: [{ type: "text", text: param }],
            });
          });

          const retryBody = {
            messaging_product: "whatsapp",
            to: telefoneFormatado,
            type: "template",
            template: {
              name: template.nome,
              language: { code: template.idioma || "pt_BR" },
              components: retryComponents,
            },
          };

          const retryResponse = await fetch(
            `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
            {
              method: "POST",
              headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
              body: JSON.stringify(retryBody),
            }
          );
          const retryResult = await retryResponse.json();
          
          if (retryResponse.ok) {
            const retryMessageId = retryResult.messages?.[0]?.id;
            await supabase.from("whatsapp_mensagens").insert({
              telefone: telefoneFormatado, tipo: "text", mensagem,
              direcao: "saida", status: 'enviada', message_id: retryMessageId,
              provedor: "meta_oficial",
            });
            console.log(`[whatsapp-send-text] ✓ Meta (retry #1 button split): ${telefoneFormatado} - ID: ${retryMessageId}`);
            return { success: true, message_id: retryMessageId, telefone: telefoneFormatado, provedor: 'meta_oficial' };
          }
          
          console.warn("[whatsapp-send-text] Retry #1 (button split) falhou:", JSON.stringify(retryResult));
        }

        // NÃO truncar — isso envia mensagens incompletas e mascara o problema real
        console.error(`[whatsapp-send-text] ❌ Param mismatch definitivo: enviados=${sent}, esperados pela Meta=${expected}. O template na Meta está desatualizado. Reenvie o template pela aba de Templates Meta.`);
      }
    }

    console.error("[whatsapp-send-text] Erro Meta:", JSON.stringify(result));
    
    const errorCode = result.error?.code;
    const errorSubCode = result.error?.error_subcode;
    let errorMsg = result.error?.message || "Erro ao enviar via Meta";

    if (errorCode === 131026 || errorSubCode === 131026) {
      errorMsg = "Mensagem não enviada: o contato não interagiu nas últimas 24h. Use um template aprovado para iniciar a conversa.";
    }

    await supabase.from("whatsapp_mensagens").insert({
      telefone: telefoneFormatado, tipo: "text", mensagem,
      direcao: "saida", status: "erro", 
      erro_codigo: String(errorCode || errorSubCode || ''),
      erro_mensagem: errorMsg,
      provedor: "meta_oficial",
    });

    throw new Error(errorMsg);
  }

  const messageId = result.messages?.[0]?.id;

  const statusLabel = templateName ? 'enviada' : 'enviada_texto_livre';
  await supabase.from("whatsapp_mensagens").insert({
    telefone: telefoneFormatado, tipo: "text", mensagem,
    direcao: "saida", status: statusLabel, message_id: messageId,
    provedor: "meta_oficial",
  });

  console.log(`[whatsapp-send-text] ✓ Meta: ${telefoneFormatado} - ID: ${messageId}`);
  return { success: true, message_id: messageId, telefone: telefoneFormatado, provedor: 'meta_oficial' };
}

// ====== MAIN ======
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    // Aceitar ambos os formatos de parâmetros (telefone/mensagem e phone/message)
    const telefone = body.telefone || body.phone;
    const mensagem = body.mensagem || body.message;
    const instancia_id = body.instancia_id;
    const delay_ms = body.delay_ms;
    const template_name = body.template_name;
    const template_params = body.template_params;
    const template_button_params = body.template_button_params;
    const allow_text = body.allow_text === true;

    if (!telefone || !mensagem) {
      return new Response(
        JSON.stringify({ success: false, error: "telefone e mensagem são obrigatórios" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const telefoneFormatado = formatarTelefone(telefone);

    // Verificar qual provedor está ativo
    const { data: metaConfig } = await supabase
      .from("whatsapp_meta_config")
      .select("ativo")
      .limit(1)
      .maybeSingle();

    const provedorAtivo = metaConfig?.ativo === true ? 'meta_oficial' : 'evolution';

    console.log(`[whatsapp-send-text] Provedor ativo: ${provedorAtivo}`);

    if (provedorAtivo === 'meta_oficial') {
      const result = await enviarViaMeta(supabase, telefoneFormatado, mensagem, template_name, template_params, allow_text, template_button_params);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Evolution API (fluxo padrão)
    let query = supabase.from("whatsapp_instancias").select("id, api_url, instance_name, status");
    if (instancia_id) {
      query = query.eq("id", instancia_id);
    } else {
      query = query.eq("principal", true);
    }

    const { data: instancia, error: instError } = await query.single();
    if (instError || !instancia) {
      return new Response(
        JSON.stringify({ success: false, error: "Instância não encontrada" }),
        { status: 404, headers: corsHeaders }
      );
    }

    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
    if (!EVOLUTION_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "EVOLUTION_API_KEY não configurada" }),
        { status: 500, headers: corsHeaders }
      );
    }

    const delayGlobal = parseInt(Deno.env.get('WHATSAPP_SEND_DELAY_MS') || '0');
    const delayFinal = delay_ms || delayGlobal;

    const result = await enviarViaEvolution(supabase, telefoneFormatado, mensagem, instancia, EVOLUTION_API_KEY, delayFinal);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[whatsapp-send-text] Erro:", error);
    const status = error.message?.includes("não está conectado") ? 503 : 500;
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status, headers: corsHeaders }
    );
  }
});
