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
  valor?: number;
}
interface DestinatarioIn {
  nome: string;
  primeiro_nome?: string;
  matricula: string;
  telefones_validos: string[];
  boletos: BoletoIn[];
}

function montarBlocoBoletos(boletos: BoletoIn[]): string {
  // Meta WhatsApp body params NÃO aceitam \n, \t ou 4+ espaços (erro #132018).
  // Usamos separadores inline para manter legibilidade sem quebra de linha.
  return boletos
    .map((b) => {
      const placa = b.placa ? `Placa ${b.placa}` : "Boleto";
      return `• ${placa} venc. ${b.vencimento} | ${b.linha_digitavel}`;
    })
    .join(" ⏐ ");
}

function sanitizeMetaParam(s: string): string {
  // Remove caracteres bloqueados pela Meta em parâmetros de template (#132000/#132018).
  return (s || "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/ {4,}/g, "   ")
    .trim();
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

function normLinha(s: string): string {
  return (s || "").replace(/\D/g, "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.slice(7);
    const { data: claims } = await supabase.auth.getClaims(token);
    const userId = claims?.claims?.sub;
    if (!userId) {
      return new Response(JSON.stringify({ success: false, error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const templateNome: string = body.template_nome || "cobranca_inadimplencia_pratic";
    const destinatarios: DestinatarioIn[] = body.destinatarios || [];
    const isFirstChunk: boolean = body.is_first_chunk === true;
    const isLastChunk: boolean = body.is_last_chunk === true;
    let loteId: string | null = body.lote_id || null;
    const nomeArquivo: string = body.nome_arquivo || "cobranca.csv";
    const totalRemessa: number | undefined = body.total_remessa;

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

    // ===== 1. Criar lote no PRIMEIRO chunk e reconciliar com lote ATIVO anterior =====
    let recuperadosCount = 0;
    let recuperadosValor = 0;
    let reemitidosCount = 0;
    let reemitidosValor = 0;

    if (isFirstChunk) {
      const todasLinhas = (body.todas_linhas_digitaveis as string[] | undefined) ?? [];
      const todasMatriculas = (body.todas_matriculas as string[] | undefined) ?? [];
      const totalBoletosRemessa = todasLinhas.length;
      const valorTotalRemessa = typeof totalRemessa === "number" ? totalRemessa : 0;
      const totalAssoc = (body.total_associados_remessa as number | undefined) ?? destinatarios.length;

      // Cria lote em PROCESSANDO (não ativo) — só vira 'ativo' no último chunk.
      // Isso impede que outra importação simultânea o trate como "lote anterior".
      const { data: novoLote, error: errLote } = await supabase
        .from("cobranca_csv_lotes")
        .insert({
          nome_arquivo: nomeArquivo,
          total_boletos: totalBoletosRemessa,
          total_associados: totalAssoc,
          valor_total: valorTotalRemessa,
          status: "processando",
          criado_por: userId,
        })
        .select("id")
        .single();
      if (errLote || !novoLote) {
        return new Response(JSON.stringify({ success: false, error: `Falha ao criar lote: ${errLote?.message}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      loteId = novoLote.id;

      // Buscar lote ATIVO anterior (somente lotes finalizados)
      const { data: anteriores } = await supabase
        .from("cobranca_csv_lotes")
        .select("id")
        .eq("status", "ativo")
        .order("created_at", { ascending: false })
        .limit(1);

      const loteAnteriorId = anteriores?.[0]?.id;
      if (loteAnteriorId && todasLinhas.length > 0) {
        const novaLinhasSet = new Set<string>(todasLinhas.map(normLinha).filter(Boolean));
        const novaMatriculasSet = new Set<string>(
          (todasMatriculas.length > 0 ? todasMatriculas : destinatarios.map((d) => d.matricula))
            .map((s) => (s || "").trim())
            .filter(Boolean),
        );

        // Boletos do lote anterior em páginas de 1000
        const ausenteIds: string[] = [];
        const reemitidoIds: string[] = [];
        let valorAusente = 0;
        let valorReemitido = 0;
        let from = 0;
        while (true) {
          const { data: pageBol } = await supabase
            .from("cobranca_csv_boletos")
            .select("id, matricula, linha_digitavel, valor")
            .eq("lote_id", loteAnteriorId)
            .in("status", ["pendente_envio", "enviado"])
            .range(from, from + 999);
          if (!pageBol || pageBol.length === 0) break;
          for (const b of pageBol) {
            if (novaLinhasSet.has(normLinha(b.linha_digitavel))) continue; // ainda está na nova lista
            const matriculaContinua = novaMatriculasSet.has((b.matricula || "").trim());
            if (matriculaContinua) {
              // mesma matrícula, boleto diferente => provavelmente reemitido
              reemitidoIds.push(b.id);
              valorReemitido += Number(b.valor || 0);
            } else {
              ausenteIds.push(b.id);
              valorAusente += Number(b.valor || 0);
            }
          }
          if (pageBol.length < 1000) break;
          from += 1000;
        }

        // Atualiza ausentes (recuperação real)
        for (let i = 0; i < ausenteIds.length; i += 500) {
          const chunkIds = ausenteIds.slice(i, i + 500);
          await supabase
            .from("cobranca_csv_boletos")
            .update({
              status: "recuperado",
              recuperado_em: new Date().toISOString(),
              recuperado_no_lote_id: loteId,
              motivo_recuperacao: "ausente_na_nova_lista",
            })
            .in("id", chunkIds);
        }
        // Atualiza reemitidos (não somam no KPI principal)
        for (let i = 0; i < reemitidoIds.length; i += 500) {
          const chunkIds = reemitidoIds.slice(i, i + 500);
          await supabase
            .from("cobranca_csv_boletos")
            .update({
              status: "recuperado",
              recuperado_em: new Date().toISOString(),
              recuperado_no_lote_id: loteId,
              motivo_recuperacao: "reemitido",
            })
            .in("id", chunkIds);
        }

        // Marca lote anterior como substituido
        await supabase
          .from("cobranca_csv_lotes")
          .update({ status: "substituido" })
          .eq("id", loteAnteriorId);

        recuperadosCount = ausenteIds.length;
        recuperadosValor = valorAusente;
        reemitidosCount = reemitidoIds.length;
        reemitidosValor = valorReemitido;
      }
    }

    if (!loteId) {
      return new Response(JSON.stringify({ success: false, error: "lote_id ausente" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== 2. Persistir os boletos deste chunk =====
    const boletoRows: any[] = [];
    for (const dest of destinatarios) {
      for (const b of dest.boletos || []) {
        boletoRows.push({
          lote_id: loteId,
          matricula: dest.matricula,
          nome: dest.nome,
          placa: b.placa || null,
          vencimento: b.vencimento,
          linha_digitavel: b.linha_digitavel,
          valor: typeof b.valor === "number" ? b.valor : 0,
          telefones: dest.telefones_validos || [],
          status: "pendente_envio",
        });
      }
    }
    let boletosInsertedIds: Record<string, string[]> = {}; // matricula -> ids
    if (boletoRows.length > 0) {
      const { data: ins } = await supabase
        .from("cobranca_csv_boletos")
        .insert(boletoRows)
        .select("id, matricula");
      if (ins) {
        for (const r of ins) {
          if (!boletosInsertedIds[r.matricula]) boletosInsertedIds[r.matricula] = [];
          boletosInsertedIds[r.matricula].push(r.id);
        }
      }
    }

    // ===== 3. Buscar config Meta =====
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
    const associadosAtingidos = new Set<string>();

    for (const dest of destinatarios) {
      const bloco = montarBlocoBoletos(dest.boletos || []);
      const nome = dest.primeiro_nome || primeiroNome(dest.nome);
      let envioOkParaEsteAssoc = false;

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
                    { type: "text", text: sanitizeMetaParam(nome) },
                    { type: "text", text: sanitizeMetaParam(bloco) },
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
            },
          );

          const json = await resp.json();
          if (!resp.ok) {
            const errMsg = json?.error?.message || `HTTP ${resp.status}`;
            detalhes.push({ matricula: dest.matricula, nome: dest.nome, telefone: tel, status: "erro", erro: errMsg });
            erros++;
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
            envioOkParaEsteAssoc = true;
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

        await new Promise((r) => setTimeout(r, 1000));
      }

      // Se ao menos um telefone deu ok, marca todos os boletos deste assoc deste chunk como enviado
      if (envioOkParaEsteAssoc) {
        associadosAtingidos.add(dest.matricula);
        const ids = boletosInsertedIds[dest.matricula] || [];
        if (ids.length > 0) {
          await supabase
            .from("cobranca_csv_boletos")
            .update({ status: "enviado", enviado_em: new Date().toISOString() })
            .in("id", ids);
        }
      }
    }

    // ===== 4. Atualiza contadores do lote (incremental) =====
    if (sucesso > 0 || associadosAtingidos.size > 0) {
      const { data: cur } = await supabase
        .from("cobranca_csv_lotes")
        .select("total_enviados, total_associados_atingidos")
        .eq("id", loteId)
        .single();
      await supabase
        .from("cobranca_csv_lotes")
        .update({
          total_enviados: (cur?.total_enviados || 0) + sucesso,
          total_associados_atingidos: (cur?.total_associados_atingidos || 0) + associadosAtingidos.size,
        })
        .eq("id", loteId);
    }

    // ===== 5. Promove o lote para 'ativo' no último chunk =====
    if (isLastChunk) {
      await supabase
        .from("cobranca_csv_lotes")
        .update({ status: "ativo" })
        .eq("id", loteId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        sucesso,
        erros,
        detalhes,
        lote_id: loteId,
        recuperados_count: recuperadosCount,
        recuperados_valor: recuperadosValor,
        reemitidos_count: reemitidosCount,
        reemitidos_valor: reemitidosValor,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[disparar-cobranca-csv-meta]", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
