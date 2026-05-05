import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BoletoIn {
  placa: string;
  vencimento: string;
  linha_digitavel: string;
}
interface DestinatarioIn {
  nome: string;
  primeiro_nome?: string;
  matricula: string;
  telefones_validos: string[];
  boletos: BoletoIn[];
}

function montarBlocoBoletos(boletos: BoletoIn[]): string {
  return boletos
    .map((b) => {
      const placa = b.placa ? `Placa ${b.placa}` : "Boleto";
      return `• ${placa} — venc. ${b.vencimento}\n  ${b.linha_digitavel}`;
    })
    .join("\n\n");
}

function primeiroNome(s: string): string {
  const p = (s || "").trim().split(/\s+/)[0] || "";
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : "Associado";
}

function validarTelefone(t: string): string | null {
  const num = (t || "").replace(/\D/g, "");
  if (num.length < 12 || num.length > 13) return null;
  if (!num.startsWith("55")) return null;
  return num;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.slice(7);
    const { data: claims } = await supabase.auth.getClaims(token);
    if (!claims?.claims?.sub) {
      return new Response(JSON.stringify({ success: false, error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const templateNome: string = body.template_nome || "cobranca_inadimplencia_pratic";
    const destinatarios: DestinatarioIn[] = body.destinatarios || [];

    if (!Array.isArray(destinatarios) || destinatarios.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "Lista vazia" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (destinatarios.length > 200) {
      return new Response(JSON.stringify({ success: false, error: "Máximo 200 por chunk" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Buscar config Meta
    const { data: config } = await supabase
      .from("whatsapp_meta_config")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (!config?.phone_number_id) {
      return new Response(JSON.stringify({ success: false, error: "WhatsApp Meta não configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const accessToken = config.access_token || Deno.env.get("META_WHATSAPP_ACCESS_TOKEN");
    if (!accessToken) {
      return new Response(JSON.stringify({ success: false, error: "Access Token Meta ausente" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const detalhes: Array<{ matricula: string; nome: string; telefone: string; status: "ok" | "erro"; erro?: string }> = [];
    let sucesso = 0;
    let erros = 0;

    for (const dest of destinatarios) {
      const bloco = montarBlocoBoletos(dest.boletos || []);
      const nome = dest.primeiro_nome || primeiroNome(dest.nome);

      for (const telRaw of dest.telefones_validos || []) {
        const tel = validarTelefone(telRaw);
        if (!tel) {
          detalhes.push({ matricula: dest.matricula, nome: dest.nome, telefone: telRaw, status: "erro", erro: "telefone inválido" });
          erros++;
          continue;
        }

        try {
          const payload = {
            messaging_product: "whatsapp",
            to: tel,
            type: "template",
            template: {
              name: templateNome,
              language: { code: "pt_BR" },
              components: [
                {
                  type: "body",
                  parameters: [
                    { type: "text", text: nome },
                    { type: "text", text: bloco },
                  ],
                },
              ],
            },
          };

          const resp = await fetch(
            `https://graph.facebook.com/v21.0/${config.phone_number_id}/messages`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(payload),
            }
          );

          const json = await resp.json();
          if (!resp.ok) {
            const errMsg = json?.error?.message || `HTTP ${resp.status}`;
            detalhes.push({ matricula: dest.matricula, nome: dest.nome, telefone: tel, status: "erro", erro: errMsg });
            erros++;

            // Log
            await supabase.from("whatsapp_mensagens").insert({
              direcao: "saida",
              telefone: tel,
              mensagem: `[template ${templateNome}] ${nome} — ${dest.boletos.length} boleto(s)`,
              status: "erro",
              template_id: templateNome,
              referencia_tipo: "cobranca_csv",
              referencia_id: dest.matricula,
              erro_mensagem: errMsg,
            }).then(() => {}).catch(() => {});
          } else {
            sucesso++;
            detalhes.push({ matricula: dest.matricula, nome: dest.nome, telefone: tel, status: "ok" });

            await supabase.from("whatsapp_mensagens").insert({
              direcao: "saida",
              telefone: tel,
              mensagem: `[template ${templateNome}] ${nome} — ${dest.boletos.length} boleto(s)`,
              status: "enviada",
              template_id: templateNome,
              referencia_tipo: "cobranca_csv",
              referencia_id: dest.matricula,
              mensagem_id_externo: json?.messages?.[0]?.id || null,
            }).then(() => {}).catch(() => {});
          }
        } catch (e: any) {
          detalhes.push({ matricula: dest.matricula, nome: dest.nome, telefone: tel, status: "erro", erro: e.message });
          erros++;
        }

        // throttle ~1 msg/s
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    return new Response(
      JSON.stringify({ success: true, sucesso, erros, detalhes }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[disparar-cobranca-csv-meta]", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
