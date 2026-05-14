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
  link?: string; // URL da 2ª via Hinova (opcional)
}
interface DestinatarioIn {
  nome: string;
  primeiro_nome?: string;
  matricula: string;
  telefones_validos: string[];
  boletos: BoletoIn[];
}

const MAX_META_BLOCK_LENGTH = 320; // Body do Meta aceita ~1024; usamos 320 para sobrar margem para múltiplos blocos
const MAX_BLOCOS_POR_DESTINATARIO = 3;
const SLEEP_ENTRE_BLOCOS_MS = 1500;
const SLEEP_ENTRE_DESTINATARIOS_MS = 250;

// Extrai o sufixo de uma URL Hinova "https://short.hinova.com.br/v2/XXXX.pdf" → "XXXX".
// Retorna null quando o formato não bate (template v2 cai automaticamente em v1 nesse caso).
function extrairSufixoHinova(url?: string | null): string | null {
  if (!url) return null;
  const m = url.match(/short\.hinova\.com\.br\/v2\/([A-Za-z0-9_-]+)(?:\.pdf)?/i);
  return m ? m[1] : null;
}

// Parser leniente de "dd/mm/aaaa" → timestamp para ordenar boletos por vencimento (mais antigo primeiro).
function tsVencimento(v?: string): number {
  if (!v) return Number.MAX_SAFE_INTEGER;
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return Number.MAX_SAFE_INTEGER;
  return new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10)).getTime();
}

function formatarBoletoCompacto(b: BoletoIn): string {
  const placa = b.placa ? `Placa ${b.placa}` : "Boleto";
  // Linha digitável só dígitos é mais curta e ainda funciona pra cópia.
  const linha = (b.linha_digitavel || "").replace(/\D/g, "");
  // Inclui o sufixo Hinova ao final quando disponível (curto e copiável)
  const sufixoHinova = extrairSufixoHinova(b.link);
  const linkFrag = sufixoHinova ? ` 🔗 short.hinova.com.br/v2/${sufixoHinova}` : "";
  return `• ${placa} venc. ${b.vencimento} | ${linha}${linkFrag}`;
}

function montarBlocoBoletos(boletos: BoletoIn[]): string {
  return boletos.map(formatarBoletoCompacto).join(" ⏐ ");
}

function renderTemplateBody(corpo: string, vars: Record<string, string>): string {
  if (!corpo) return "";
  return corpo.replace(/\{\{\s*(\d+)\s*\}\}/g, (_m, k) => vars[String(k)] ?? `{{${k}}}`);
}

function sanitizeMetaParam(s: string): string {
  // Remove caracteres bloqueados pela Meta em parâmetros de template (#132000/#132018).
  return (s || "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/ {4,}/g, "   ")
    .trim();
}

function montarBlocosBoletosSegmentados(boletos: BoletoIn[]): string[] {
  const partes = (boletos || [])
    .map((b) => sanitizeMetaParam(formatarBoletoCompacto(b)))
    .filter((p) => p && p.length > 4);
  if (partes.length === 0) return [];

  const blocos: string[] = [];
  let atual = "";

  for (const parte of partes) {
    const fragmento = parte.length <= MAX_META_BLOCK_LENGTH
      ? parte
      : `${parte.slice(0, MAX_META_BLOCK_LENGTH - 1).trimEnd()}…`;
    const proximo = atual ? `${atual} ⏐ ${fragmento}` : fragmento;
    if (proximo.length <= MAX_META_BLOCK_LENGTH) {
      atual = proximo;
    } else {
      if (atual) blocos.push(atual);
      atual = fragmento;
    }
  }

  if (atual) blocos.push(atual);
  return blocos;
}

function primeiroNome(s: string): string {
  const p = (s || "").trim().split(/\s+/)[0] || "";
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : "Associado";
}

// DDDs válidos no Brasil (faixas oficiais)
const DDDS_VALIDOS = new Set([
  11,12,13,14,15,16,17,18,19,21,22,24,27,28,31,32,33,34,35,37,38,41,42,43,44,45,46,47,48,49,
  51,53,54,55,61,62,63,64,65,66,67,68,69,71,73,74,75,77,79,81,82,83,84,85,86,87,88,89,
  91,92,93,94,95,96,97,98,99,
]);

function validarTelefone(t: string): string | null {
  let num = (t || "").replace(/\D/g, "");
  // Aceita formato com ou sem 55 inicial
  if (num.length === 10 || num.length === 11) num = "55" + num;
  if (num.length !== 13) return null;          // exige celular com 9º dígito + DDI 55
  if (!num.startsWith("55")) return null;
  // Rejeita sequências repetidas tipo 5500000000000 / (00)0000-00000
  if (/^(\d)\1+$/.test(num.slice(2))) return null;
  // Rejeita DDD inválido
  const ddd = parseInt(num.slice(2, 4), 10);
  if (!DDDS_VALIDOS.has(ddd)) return null;
  // 9º dígito obrigatório (celular)
  if (num[4] !== "9") return null;
  // Rejeita números com mais de 7 zeros consecutivos
  if (/0{7,}/.test(num)) return null;
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
    // Quando template_v2=true, usamos o template Meta com botão URL dinâmico (1 link por mensagem).
    // Se nenhum boleto do destinatário tem link válido, fazemos fallback automático para v1.
    const templateV2: boolean = body.template_v2 === true;
    const templateNomeBase: string = body.template_nome
      || (templateV2 ? "cobranca_inadimplencia_pratic_v2" : "cobranca_inadimplencia_pratic");
    const templateNomeFallback = "cobranca_inadimplencia_pratic";
    const destinatarios: DestinatarioIn[] = body.destinatarios || [];
    const isFirstChunk: boolean = body.is_first_chunk === true;
    const isLastChunk: boolean = body.is_last_chunk === true;
    // init_only: cria o lote (e roda reconciliação), retorna lote_id IMEDIATAMENTE,
    // sem chamar Meta. Resolve o problema do client perder o lote_id por timeout.
    const initOnly: boolean = body.init_only === true;
    let loteId: string | null = body.lote_id || null;
    const nomeArquivo: string = body.nome_arquivo || "cobranca.csv";
    const totalRemessa: number | undefined = body.total_remessa;

    if (!initOnly) {
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
    }

    // ===== 1. Criar lote no PRIMEIRO chunk e reconciliar com lote ATIVO anterior =====
    let recuperadosCount = 0;
    let recuperadosValor = 0;
    let reemitidosCount = 0;
    let reemitidosValor = 0;

    if (isFirstChunk || initOnly) {
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

    // ===== INIT ONLY: devolve lote_id e métricas de reconciliação, sem disparar Meta =====
    if (initOnly) {
      return new Response(
        JSON.stringify({
          success: true,
          init: true,
          lote_id: loteId,
          recuperados_count: recuperadosCount,
          recuperados_valor: recuperadosValor,
          reemitidos_count: reemitidosCount,
          reemitidos_valor: reemitidosValor,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ===== IDEMPOTÊNCIA: pula matrículas já enviadas neste lote (retomada segura) =====
    const matriculasChunk = Array.from(
      new Set(destinatarios.map((d) => (d.matricula || "").trim()).filter(Boolean)),
    );
    const matriculasJaEnviadas = new Set<string>();
    if (matriculasChunk.length > 0) {
      const { data: jaEnv } = await supabase
        .from("cobranca_csv_boletos")
        .select("matricula")
        .eq("lote_id", loteId)
        .eq("status", "enviado")
        .in("matricula", matriculasChunk);
      for (const r of jaEnv || []) {
        if (r.matricula) matriculasJaEnviadas.add(String(r.matricula).trim());
      }
    }
    const destinatariosProcessar = destinatarios.filter(
      (d) => !matriculasJaEnviadas.has((d.matricula || "").trim()),
    );
    const puladosIdempotencia = destinatarios.length - destinatariosProcessar.length;

    // ===== 2. Persistir os boletos deste chunk (apenas dos não-pulados) =====
    const boletoRows: any[] = [];
    for (const dest of destinatariosProcessar) {
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

    // Buscar (ou criar) a instância lógica do provedor Meta para taggear as mensagens
    let metaInstanciaId: string | null = null;
    {
      const { data: inst } = await supabase
        .from("whatsapp_instancias")
        .select("id")
        .eq("provedor", "meta")
        .eq("ativa", true)
        .limit(1)
        .maybeSingle();
      metaInstanciaId = inst?.id ?? null;
    }

    // Corpo do template — usado para gravar o conteúdo real renderizado em whatsapp_mensagens.
    // Sem isso, o agente-consultor-ia não entende o contexto da cobrança ao responder.
    let templateCorpo = "";
    {
      const { data: tpl } = await supabase
        .from("whatsapp_meta_templates")
        .select("corpo")
        .eq("nome", templateNome)
        .maybeSingle();
      templateCorpo = tpl?.corpo || "";
    }

    const detalhes: Array<{
      matricula: string;
      nome: string;
      telefone: string;
      status: "ok" | "erro" | "skip";
      erro?: string;
      erro_codigo?: number | string;
    }> = [];
    const warnings: string[] = []; // erros que não bloqueiam o envio (ex.: insert em whatsapp_mensagens)
    let sucesso = 0;
    let erros = 0;
    let mensagensGravadas = 0;
    let mensagensFalhasGravar = 0;
    const associadosAtingidos = new Set<string>();

    // Inclui no resultado as matrículas puladas por idempotência
    for (const d of destinatarios) {
      if (matriculasJaEnviadas.has((d.matricula || "").trim())) {
        detalhes.push({
          matricula: d.matricula,
          nome: d.nome,
          telefone: "",
          status: "skip",
          erro: "já enviado neste lote (idempotência)",
        });
      }
    }

    for (const dest of destinatariosProcessar) {
      const blocosOriginais = montarBlocosBoletosSegmentados(dest.boletos || []);
      // Limita pra não disparar 131056 (pair rate limit) com listas enormes.
      const blocos = blocosOriginais.slice(0, MAX_BLOCOS_POR_DESTINATARIO);
      const blocosCortados = blocosOriginais.length - blocos.length;
      const nome = dest.primeiro_nome || primeiroNome(dest.nome);

      if (blocos.length === 0) {
        detalhes.push({
          matricula: dest.matricula,
          nome: dest.nome,
          telefone: "",
          status: "skip",
          erro: "sem boletos válidos",
        });
        continue;
      }

      let envioOkParaEsteAssoc = false;

      for (const telRaw of dest.telefones_validos || []) {
        // Já enviou OK pra este associado em outro telefone? Não duplicar (evita 131056 e custo).
        if (envioOkParaEsteAssoc) break;

        const tel = validarTelefone(telRaw);
        if (!tel) {
          detalhes.push({
            matricula: dest.matricula,
            nome: dest.nome,
            telefone: telRaw,
            status: "erro",
            erro: "telefone inválido (precisa ser celular BR com 9º dígito)",
            erro_codigo: "LOCAL_INVALID_PHONE",
          });
          erros++;
          continue;
        }

        let ultimoMessageId: string | null = null;
        let ultimoErroCodigo: number | string | undefined;
        let ultimoErroMsg = "";
        let blocoOk = false;

        for (let i = 0; i < blocos.length; i++) {
          const bloco = blocos[i];
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

          try {
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
              ultimoErroCodigo = json?.error?.code ?? `HTTP_${resp.status}`;
              ultimoErroMsg = json?.error?.error_data?.details
                || json?.error?.message
                || `HTTP ${resp.status}`;
              // 131056 (pair rate limit) ou 131026 (não é WhatsApp): aborta o resto dos blocos
              break;
            }
            ultimoMessageId = json?.messages?.[0]?.id || ultimoMessageId;
            blocoOk = true;
          } catch (e: any) {
            ultimoErroMsg = e?.message || "fetch error";
            ultimoErroCodigo = "FETCH_ERROR";
            break;
          }

          // Espaço entre blocos do MESMO destinatário pra não acionar pair rate limit
          if (i < blocos.length - 1) {
            await new Promise((r) => setTimeout(r, SLEEP_ENTRE_BLOCOS_MS));
          }
        }

        if (blocoOk && !ultimoErroMsg) {
          sucesso++;
          envioOkParaEsteAssoc = true;
          detalhes.push({
            matricula: dest.matricula,
            nome: dest.nome,
            telefone: tel,
            status: "ok",
            ...(blocosCortados > 0
              ? { erro: `${blocosCortados} bloco(s) adiados p/ próximo lote` }
              : {}),
          });
          // Renderiza o corpo real enviado (concatenando blocos) para alimentar o histórico do agente IA
          const corpoBlocos = blocos.join("\n");
          const mensagemRenderizada = templateCorpo
            ? renderTemplateBody(templateCorpo, { "1": nome, "2": corpoBlocos })
            : `Olá, ${nome}! Boletos em aberto:\n${corpoBlocos}`;
          // Payload enxuto: só placa+vencimento, sem linha digitável (evita JSON gigante)
          const boletosResumo = (dest.boletos || []).map((b) => ({
            placa: b.placa,
            vencimento: b.vencimento,
            valor: b.valor,
          }));
          const { error: insErr } = await supabase.from("whatsapp_mensagens").insert({
            direcao: "saida",
            tipo: "template",
            telefone: tel,
            nome_contato: dest.nome,
            mensagem: mensagemRenderizada,
            status: "enviada",
            template_variaveis: {
              template: templateNome,
              matricula: dest.matricula,
              blocos: blocos.length,
              boletos: boletosResumo,
            },
            referencia_tipo: "cobranca_csv",
            message_id: ultimoMessageId,
            provedor: "meta",
            instancia_id: metaInstanciaId,
          });
          if (insErr) {
            mensagensFalhasGravar++;
            const detail = `[whatsapp_mensagens insert ok] code=${(insErr as any).code} msg=${insErr.message} details=${(insErr as any).details ?? ""} hint=${(insErr as any).hint ?? ""}`;
            console.error(detail);
            if (warnings.length < 5) warnings.push(detail);
          } else {
            mensagensGravadas++;
          }
        } else {
          erros++;
          detalhes.push({
            matricula: dest.matricula,
            nome: dest.nome,
            telefone: tel,
            status: "erro",
            erro: ultimoErroMsg || "falha desconhecida",
            erro_codigo: ultimoErroCodigo,
          });
          const corpoBlocosErr = blocos.join("\n");
          const mensagemRenderizadaErr = templateCorpo
            ? renderTemplateBody(templateCorpo, { "1": nome, "2": corpoBlocosErr })
            : `Olá, ${nome}! Boletos em aberto:\n${corpoBlocosErr}`;
          const boletosResumoErr = (dest.boletos || []).map((b) => ({
            placa: b.placa,
            vencimento: b.vencimento,
            valor: b.valor,
          }));
          const { error: insErr } = await supabase.from("whatsapp_mensagens").insert({
            direcao: "saida",
            tipo: "template",
            telefone: tel,
            nome_contato: dest.nome,
            mensagem: mensagemRenderizadaErr,
            status: "erro",
            template_variaveis: {
              template: templateNome,
              matricula: dest.matricula,
              boletos: boletosResumoErr,
            },
            referencia_tipo: "cobranca_csv",
            erro_codigo: ultimoErroCodigo ? String(ultimoErroCodigo) : null,
            erro_mensagem: ultimoErroMsg,
            provedor: "meta",
            instancia_id: metaInstanciaId,
          });
          if (insErr) {
            mensagensFalhasGravar++;
            const detail = `[whatsapp_mensagens insert erro] code=${(insErr as any).code} msg=${insErr.message} details=${(insErr as any).details ?? ""} hint=${(insErr as any).hint ?? ""}`;
            console.error(detail);
            if (warnings.length < 5) warnings.push(detail);
          } else {
            mensagensGravadas++;
          }
        }

        await new Promise((r) => setTimeout(r, SLEEP_ENTRE_DESTINATARIOS_MS));
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

    // ===== 5. Promove o lote no último chunk: 'ativo' se sem erros, 'parcial' caso contrário =====
    if (isLastChunk) {
      // Estado real: olha contadores no banco para decidir
      const { data: loteAtual } = await supabase
        .from("cobranca_csv_lotes")
        .select("total_enviados, total_associados, total_associados_atingidos")
        .eq("id", loteId)
        .single();
      const totalAssoc = loteAtual?.total_associados || 0;
      const atingidos = loteAtual?.total_associados_atingidos || 0;
      const novoStatus = totalAssoc > 0 && atingidos < totalAssoc ? "parcial" : "ativo";
      await supabase
        .from("cobranca_csv_lotes")
        .update({ status: novoStatus })
        .eq("id", loteId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        sucesso,
        erros,
        pulados_idempotencia: puladosIdempotencia,
        detalhes,
        lote_id: loteId,
        recuperados_count: recuperadosCount,
        recuperados_valor: recuperadosValor,
        reemitidos_count: reemitidosCount,
        reemitidos_valor: reemitidosValor,
        mensagens_gravadas: mensagensGravadas,
        mensagens_falhas_gravar: mensagensFalhasGravar,
        warnings,
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
