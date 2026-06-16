// Helpers compartilhados para notificações WhatsApp do módulo de
// Solicitações e Liberações Financeiras (via Evolution API / whatsapp-send-text).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export const APP_URL = (Deno.env.get("APP_URL") || "https://app.pratic.com.br").replace(/\/+$/, "");

export function formatBRL(v: number | string | null): string {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Data no fuso de São Paulo no formato YYYY-MM-DD (para comparar com colunas DATE)
export function dataBRT(d?: string | Date): string {
  const dt = d ? new Date(d) : new Date();
  return dt.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export function addDias(yyyyMmDd: string, dias: number): string {
  const dt = new Date(yyyyMmDd + "T12:00:00Z");
  dt.setUTCDate(dt.getUTCDate() + dias);
  return dt.toISOString().slice(0, 10);
}

export function formatData(d: string | null): string {
  if (!d) return "—";
  // aceita 'YYYY-MM-DD' ou ISO
  const onlyDate = d.length === 10 ? d + "T00:00:00" : d;
  const dt = new Date(onlyDate);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("pt-BR");
}

const SETOR_LABELS: Record<string, string> = {
  comercial: "Comercial / Vendas", cadastro: "Cadastro", monitoramento: "Monitoramento",
  relacionamento: "Relacionamento", eventos: "Eventos / Sinistros", assistencia: "Assistência 24h",
  oficinas: "Oficinas", financeiro: "Financeiro", contabilidade: "Contabilidade",
  juridico: "Jurídico", rh: "Recursos Humanos", marketing: "Marketing",
  ti: "TI / Desenvolvimento", diretoria: "Diretoria", outros: "Outros",
};
const CATEGORIA_LABELS: Record<string, string> = {
  prestador_assistencia: "Prestador Assistência", oficina: "Oficina", fornecedor: "Fornecedor",
  folha_pagamento: "Folha de Pagamento", impostos: "Impostos", aluguel: "Aluguel",
  servicos: "Serviços", marketing: "Marketing", outros: "Outros",
};
const TIPO_LABELS: Record<string, string> = { pagamento: "Pagamento", reembolso: "Reembolso" };
const PRIORIDADE_LABELS: Record<string, string> = {
  baixa: "Baixa", normal: "Normal", alta: "Alta", urgente: "🔴 URGENTE",
};

export const labelSetor = (v: string | null) => (v ? SETOR_LABELS[v] || v : "—");
export const labelCategoria = (v: string | null) => (v ? CATEGORIA_LABELS[v] || v : "—");
export const labelTipo = (v: string | null) => (v ? TIPO_LABELS[v] || v : "—");
export const labelPrioridade = (v: string | null) => (v ? PRIORIDADE_LABELS[v] || v : "Normal");

// Envia uma mensagem de texto reaproveitando a função whatsapp-send-text
export async function enviarWhatsApp(telefone: string | null | undefined, mensagem: string) {
  const tel = (telefone || "").replace(/\D/g, "");
  if (!tel) return { success: false, skipped: true, reason: "sem_telefone" };
  try {
    const resp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-send-text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ telefone: tel, mensagem }),
    });
    try {
      return await resp.json();
    } catch {
      return { success: resp.ok };
    }
  } catch (e) {
    console.error("[solicitacoes-notify] erro ao enviar WhatsApp:", e);
    return { success: false, error: String(e) };
  }
}

// Telefones dos sócios ativos
export async function getSocios(supabase: any): Promise<{ nome: string; telefone: string }[]> {
  const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "socio");
  const ids = (roles || []).map((r: any) => r.user_id);
  if (ids.length === 0) return [];
  const { data: profs } = await supabase
    .from("profiles")
    .select("nome, telefone")
    .in("user_id", ids)
    .eq("ativo", true);
  return (profs || [])
    .filter((p: any) => p.telefone)
    .map((p: any) => ({ nome: p.nome, telefone: p.telefone }));
}

// Telefone do solicitante (usa o informado na solicitação ou o do profile)
export async function getTelefoneSolicitante(supabase: any, solic: any): Promise<string | null> {
  if (solic.solicitante_telefone) return solic.solicitante_telefone;
  if (solic.solicitante_id) {
    const { data } = await supabase
      .from("profiles")
      .select("telefone")
      .eq("id", solic.solicitante_id)
      .maybeSingle();
    return data?.telefone || null;
  }
  return null;
}

export async function notificarSocios(supabase: any, mensagem: string) {
  const socios = await getSocios(supabase);
  let enviados = 0;
  for (const s of socios) {
    const r = await enviarWhatsApp(s.telefone, mensagem);
    if ((r as any)?.success) enviados++;
  }
  return { total: socios.length, enviados };
}
