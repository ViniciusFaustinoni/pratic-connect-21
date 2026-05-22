// Polling do termo de cancelamento (Troca de Titularidade + Substituição de Placa).
//
// Por que existe: o webhook Autentique (autentique-webhook) NÃO está chegando ao
// projeto há semanas (verificado em function_edge_logs — zero requisições). Para
// contratos, o gap é coberto por autentique-sync-contrato (acionado pelo front
// quando o associado volta da Autentique). Para Troca/Substituição não havia
// equivalente: a solicitação ficava presa em `aguardando_termo_cancelamento`
// mesmo depois da assinatura por biometria SERPRO (caso KOU6D37 — sol
// af5d46d0-0c9a-4e16-9b3b-9e6346bc72d1, e a sol 65d581ba-... de 20/05).
//
// Esta edge espelha o branch de Troca (linhas 305–478 do autentique-webhook) e
// o branch de Substituição (linhas 486–510). Suporta dois modos:
//   1. Solicitação específica   → { tipo: 'troca'|'substituicao', solicitacao_id }
//   2. Cron / varredura          → { mode: 'sweep' }
//
// Idempotente: só atua quando `termo_cancelamento_assinado_em IS NULL` e o
// documento foi efetivamente assinado no Autentique (signed.created_at OU
// biometric_approved.created_at + viewed.created_at — mesma regra de
// autentique-sync-contrato:362-364).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AUTENTIQUE_API_URL = "https://api.autentique.com.br/v2/graphql";

interface SignatureNode {
  signed?: { created_at: string } | null;
  viewed?: { created_at: string } | null;
  rejected?: { created_at: string } | null;
  biometric_approved?: { created_at: string } | null;
  biometric_rejected?: { created_at: string } | null;
  name?: string | null;
  email?: string | null;
}

interface AutentiqueDocStatus {
  found: boolean;
  signed: boolean;
  signedAt: string | null;
  signerName: string | null;
}

async function consultarStatusAutentique(token: string, documentId: string): Promise<AutentiqueDocStatus> {
  const query = `
    query GetDocument($id: UUID!) {
      document(id: $id) {
        id
        signatures {
          name
          email
          signed { created_at }
          viewed { created_at }
          rejected { created_at }
          biometric_approved { created_at }
          biometric_rejected { created_at }
        }
      }
    }
  `;
  const resp = await fetch(AUTENTIQUE_API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { id: documentId } }),
  });
  const json = await resp.json();
  if (!resp.ok || json.errors) {
    console.warn("[autentique-sync-termo-cancelamento] GraphQL error", documentId, json.errors || resp.status);
    return { found: false, signed: false, signedAt: null, signerName: null };
  }
  const doc = json?.data?.document;
  if (!doc) return { found: false, signed: false, signedAt: null, signerName: null };

  const sigs: SignatureNode[] = doc.signatures || [];
  const isEffectivelySigned = (s: SignatureNode) =>
    !!s.signed?.created_at || (!!s.biometric_approved?.created_at && !!s.viewed?.created_at);

  const signer = sigs.find(isEffectivelySigned) || null;
  if (!signer) return { found: true, signed: false, signedAt: null, signerName: null };

  const signedAt =
    signer.signed?.created_at || signer.biometric_approved?.created_at || new Date().toISOString();
  return { found: true, signed: true, signedAt, signerName: signer.name || null };
}

async function processarTroca(supabase: any, sol: any, signedAt: string) {
  const solicitacaoId: string = sol.id;
  console.log(`[autentique-sync-termo-cancelamento] Marcando troca ${solicitacaoId} como assinada em ${signedAt}`);

  const { count, error: updErr } = await supabase
    .from("solicitacoes_troca_titularidade")
    .update(
      {
        termo_cancelamento_assinado_em: signedAt,
        status: "cotacao_em_andamento",
        updated_at: new Date().toISOString(),
      },
      { count: "exact" },
    )
    .eq("id", solicitacaoId)
    .is("termo_cancelamento_assinado_em", null);

  if (updErr || !count) {
    console.warn(`[autentique-sync-termo-cancelamento] update sem efeito ${solicitacaoId}`, updErr?.message);
    return { atualizado: false, motivo: updErr?.message || "ja_assinada_ou_concorrente" };
  }

  // Desvínculo lógico: marca veículo em troca + suspende cobertura.
  // (Mesmo bloco do autentique-webhook:339-369.)
  try {
    if (sol.veiculo_id) {
      await supabase
        .from("veiculos")
        .update({
          em_troca_titularidade: true,
          troca_titularidade_id: solicitacaoId,
          troca_titularidade_iniciada_em: new Date().toISOString(),
          cobertura_suspensa: true,
          cobertura_suspensa_em: new Date().toISOString(),
          cobertura_suspensa_motivo: "troca_titularidade_em_andamento",
          updated_at: new Date().toISOString(),
        })
        .eq("id", sol.veiculo_id);
    }
  } catch (vErr) {
    console.warn("[autentique-sync-termo-cancelamento] marcar veículo falhou", vErr);
  }

  // Auto-vínculo cotação ↔ solicitação (cotação on-demand).
  // (Mesmo bloco do autentique-webhook:385-427.)
  if (!sol.cotacao_id && sol.veiculo_id) {
    try {
      const { data: cotacaoAlvo } = await supabase
        .from("cotacoes")
        .select("id, dados_extras, status_contratacao")
        .eq("origem_troca_titularidade", true)
        .contains("dados_extras", { veiculo_origem_id: sol.veiculo_id })
        .not("status_contratacao", "in", '("cancelada","expirada")')
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cotacaoAlvo) {
        await supabase
          .from("solicitacoes_troca_titularidade")
          .update({ cotacao_id: cotacaoAlvo.id })
          .eq("id", solicitacaoId);

        const extrasAtuais = (cotacaoAlvo.dados_extras as Record<string, unknown> | null) ?? {};
        await supabase
          .from("cotacoes")
          .update({ dados_extras: { ...extrasAtuais, solicitacao_troca_id: solicitacaoId } })
          .eq("id", cotacaoAlvo.id);

        console.log(`[autentique-sync-termo-cancelamento] ✓ Auto-vinculou cotação ${cotacaoAlvo.id}`);
      }
    } catch (linkErr) {
      console.warn("[autentique-sync-termo-cancelamento] auto-vincular falhou", linkErr);
    }
  }

  // Notifica novo titular via WhatsApp (mesmo template do webhook:432-476).
  try {
    const { data: solComCot } = await supabase
      .from("solicitacoes_troca_titularidade")
      .select("cotacao_id")
      .eq("id", solicitacaoId)
      .maybeSingle();
    const cotId = solComCot?.cotacao_id || sol.cotacao_id;
    if (cotId) {
      const { data: cot } = await supabase
        .from("cotacoes")
        .select("numero, token_publico, nome_solicitante, telefone1_solicitante, veiculo_placa")
        .eq("id", cotId)
        .maybeSingle();
      const tel = (cot?.telefone1_solicitante || "").toString().replace(/\D/g, "");
      if (tel && cot?.token_publico) {
        const link = `https://app.praticcar.org/cotacao/${cot.token_publico}`;
        const primeiroNome = (cot.nome_solicitante || "Olá").trim().split(/\s+/)[0];
        await supabase.functions.invoke("whatsapp-send-text", {
          body: {
            telefone: tel,
            mensagem:
              `✅ *Troca de titularidade liberada*\n\n` +
              `${primeiroNome}, o titular anterior assinou o termo de cancelamento. ` +
              `Continue sua contratação aqui:\n${link}`,
            template_name: "notificacao_atendimento_pratic",
            template_params: [
              primeiroNome,
              `Cotação ${cot.numero || ""} liberada`,
              `Troca de titularidade: termo assinado pelo titular anterior. Continue a contratação: ${link}`,
            ],
          },
        });
      }
    }
  } catch (notifErr) {
    console.warn("[autentique-sync-termo-cancelamento] notificar novo titular falhou", notifErr);
  }

  return { atualizado: true };
}

async function processarSubstituicao(supabase: any, sol: any, signedAt: string) {
  const solicitacaoId: string = sol.id;
  console.log(`[autentique-sync-termo-cancelamento] Marcando substituição ${solicitacaoId} como assinada`);
  const { count, error: updErr } = await supabase
    .from("solicitacoes_substituicao_placa")
    .update(
      {
        termo_cancelamento_assinado_em: signedAt,
        status: "termo_assinado",
        updated_at: new Date().toISOString(),
      },
      { count: "exact" },
    )
    .eq("id", solicitacaoId)
    .is("termo_cancelamento_assinado_em", null);
  if (updErr || !count) {
    return { atualizado: false, motivo: updErr?.message || "ja_assinada_ou_concorrente" };
  }
  return { atualizado: true };
}

async function sincronizarTroca(supabase: any, autentiqueToken: string, solicitacaoId: string) {
  const { data: sol, error } = await supabase
    .from("solicitacoes_troca_titularidade")
    .select("id, status, cotacao_id, veiculo_id, termo_cancelamento_assinado_em, termo_cancelamento_autentique_id")
    .eq("id", solicitacaoId)
    .maybeSingle();
  if (error) throw error;
  if (!sol) return { atualizado: false, motivo: "nao_encontrada" };
  if (sol.termo_cancelamento_assinado_em) return { atualizado: false, motivo: "ja_assinada", signedAt: sol.termo_cancelamento_assinado_em };
  if (!sol.termo_cancelamento_autentique_id) return { atualizado: false, motivo: "sem_documento_autentique" };
  const status = await consultarStatusAutentique(autentiqueToken, sol.termo_cancelamento_autentique_id);
  if (!status.found) return { atualizado: false, motivo: "documento_nao_encontrado_autentique" };
  if (!status.signed) return { atualizado: false, motivo: "aguardando_assinatura" };
  return processarTroca(supabase, sol, status.signedAt!);
}

async function sincronizarSubstituicao(supabase: any, autentiqueToken: string, solicitacaoId: string) {
  const { data: sol, error } = await supabase
    .from("solicitacoes_substituicao_placa")
    .select("id, status, termo_cancelamento_assinado_em, termo_cancelamento_autentique_id")
    .eq("id", solicitacaoId)
    .maybeSingle();
  if (error) throw error;
  if (!sol) return { atualizado: false, motivo: "nao_encontrada" };
  if (sol.termo_cancelamento_assinado_em) return { atualizado: false, motivo: "ja_assinada", signedAt: sol.termo_cancelamento_assinado_em };
  if (!sol.termo_cancelamento_autentique_id) return { atualizado: false, motivo: "sem_documento_autentique" };
  const status = await consultarStatusAutentique(autentiqueToken, sol.termo_cancelamento_autentique_id);
  if (!status.found) return { atualizado: false, motivo: "documento_nao_encontrado_autentique" };
  if (!status.signed) return { atualizado: false, motivo: "aguardando_assinatura" };
  return processarSubstituicao(supabase, sol, status.signedAt!);
}

async function sweep(supabase: any, autentiqueToken: string) {
  const resultados = { troca: [] as any[], substituicao: [] as any[] };

  // Trocas: pegou enviou há ao menos 60s, ainda sem assinatura, com docId.
  const { data: trocas } = await supabase
    .from("solicitacoes_troca_titularidade")
    .select("id")
    .is("termo_cancelamento_assinado_em", null)
    .not("termo_cancelamento_autentique_id", "is", null)
    .not("termo_cancelamento_enviado_em", "is", null)
    .lt("termo_cancelamento_enviado_em", new Date(Date.now() - 60_000).toISOString())
    .limit(50);
  for (const t of trocas || []) {
    try {
      const r = await sincronizarTroca(supabase, autentiqueToken, t.id);
      resultados.troca.push({ id: t.id, ...r });
    } catch (e: any) {
      resultados.troca.push({ id: t.id, atualizado: false, motivo: e.message });
    }
  }

  const { data: substs } = await supabase
    .from("solicitacoes_substituicao_placa")
    .select("id")
    .is("termo_cancelamento_assinado_em", null)
    .not("termo_cancelamento_autentique_id", "is", null)
    .not("termo_cancelamento_enviado_em", "is", null)
    .lt("termo_cancelamento_enviado_em", new Date(Date.now() - 60_000).toISOString())
    .limit(50);
  for (const s of substs || []) {
    try {
      const r = await sincronizarSubstituicao(supabase, autentiqueToken, s.id);
      resultados.substituicao.push({ id: s.id, ...r });
    } catch (e: any) {
      resultados.substituicao.push({ id: s.id, atualizado: false, motivo: e.message });
    }
  }

  return resultados;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const autentiqueToken = Deno.env.get("AUTENTIQUE_API_KEY");
    if (!autentiqueToken) throw new Error("AUTENTIQUE_API_KEY não configurada");
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const { tipo, solicitacao_id, mode } = body as {
      tipo?: "troca" | "substituicao";
      solicitacao_id?: string;
      mode?: "sweep";
    };

    if (mode === "sweep") {
      const r = await sweep(supabase, autentiqueToken);
      return new Response(JSON.stringify({ success: true, ...r }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!tipo || !solicitacao_id) {
      return new Response(JSON.stringify({ error: "tipo e solicitacao_id são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resultado =
      tipo === "troca"
        ? await sincronizarTroca(supabase, autentiqueToken, solicitacao_id)
        : await sincronizarSubstituicao(supabase, autentiqueToken, solicitacao_id);

    return new Response(JSON.stringify({ success: true, tipo, solicitacao_id, ...resultado }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[autentique-sync-termo-cancelamento]", e);
    return new Response(JSON.stringify({ success: false, error: e?.message || "erro" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
