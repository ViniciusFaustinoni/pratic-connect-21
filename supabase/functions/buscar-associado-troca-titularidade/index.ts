// Edge function: buscar-associado-troca-titularidade
// Permite que VENDEDORES (CLT/externo/agência) e funcionários internos achem
// QUALQUER associado/placa quando estão abrindo uma Troca de Titularidade —
// caso em que o "antigo dono" não está no escopo de RLS do vendedor.
// Roda com service_role (bypass RLS), com auth obrigatória e log de auditoria.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const PLACA_REGEX = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;

interface AssociadoResult {
  id: string;
  nome: string;
  telefone: string | null;
  cpf: string;
  status: string | null;
  codigo_hinova: number | null;
  codigo_associado?: number;
  origem_sga: boolean;
}

interface PlacaResult {
  veiculoId: string;
  placa: string;
  marca: string;
  modelo: string;
  associadoId: string;
  associadoNome: string;
  associadoCpf: string;
  associadoStatus: string;
  origem_sga: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // 1. Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "missing_auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "invalid_auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    // 2. Input
    const body = await req.json().catch(() => ({}));
    const termoRaw = String(body?.termo ?? "").trim();
    if (termoRaw.length < 2) {
      return new Response(
        JSON.stringify({ associados: [], placas: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const cleaned = termoRaw.replace(/\D/g, "");
    const alnum = termoRaw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    const isCpfCompleto = cleaned.length === 11;
    const isPlaca = PLACA_REGEX.test(alnum);

    // 3. Service-role client (bypass RLS)
    const svc = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    const associados: AssociadoResult[] = [];
    const placas: PlacaResult[] = [];
    let erroTransitorio = false;
    let motivoTransitorio: string | null = null;

    // 3.1 Busca local de associado por CPF/nome/telefone
    if (isCpfCompleto) {
      const cpfFmt = `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9, 11)}`;
      const { data } = await svc
        .from("associados")
        .select("id, nome, telefone, cpf, status, codigo_hinova")
        .or(`cpf.eq.${cleaned},cpf.eq.${cpfFmt}`)
        .limit(5);
      (data || []).forEach((a: any) => {
        associados.push({
          id: a.id,
          nome: a.nome,
          telefone: a.telefone,
          cpf: a.cpf,
          status: a.status,
          codigo_hinova: a.codigo_hinova ?? null,
          codigo_associado: a.codigo_hinova ?? undefined,
          origem_sga: false,
        });
      });
    } else if (!isPlaca) {
      // Texto livre — busca por nome/telefone/cpf parcial
      let q = svc
        .from("associados")
        .select("id, nome, telefone, cpf, status, codigo_hinova")
        .in("status", ["ativo", "inadimplente", "suspenso"]);
      if (cleaned.length >= 3) {
        q = q.or(`nome.ilike.%${termoRaw}%,telefone.ilike.%${cleaned}%,cpf.ilike.%${cleaned}%`);
      } else {
        q = q.ilike("nome", `%${termoRaw}%`);
      }
      const { data } = await q.limit(15).order("nome");
      (data || []).forEach((a: any) => {
        associados.push({
          id: a.id,
          nome: a.nome,
          telefone: a.telefone,
          cpf: a.cpf,
          status: a.status,
          codigo_hinova: a.codigo_hinova ?? null,
          codigo_associado: a.codigo_hinova ?? undefined,
          origem_sga: false,
        });
      });
    }

    // 3.2 Busca local por placa
    if (isPlaca) {
      const { data: vlocais } = await svc
        .from("veiculos")
        .select("id, placa, marca, modelo, associado_id, associados:associado_id(id, nome, cpf, status, codigo_hinova)")
        .ilike("placa", alnum)
        .limit(5);
      (vlocais || []).forEach((v: any) => {
        if (!v.associados) return;
        placas.push({
          veiculoId: String(v.id),
          placa: v.placa,
          marca: v.marca || "",
          modelo: v.modelo || "",
          associadoId: v.associados.id,
          associadoNome: v.associados.nome,
          associadoCpf: v.associados.cpf,
          associadoStatus: v.associados.status || "",
          origem_sga: false,
        });
      });
    }

    // 3.3 SGA fallback — CPF completo, sem hit local
    if (isCpfCompleto && associados.length === 0) {
      try {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/sga-buscar-associado-completo`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SERVICE_ROLE}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ cpf: cleaned }),
        });
        const data = await r.json().catch(() => ({}));
        if (data?.encontrado && data?.codigo_associado) {
          associados.push({
            id: "",
            nome: data.associado?.nome || "",
            telefone: data.associado?.telefone || null,
            cpf: data.associado?.cpf || cleaned,
            status: "ativo",
            codigo_hinova: data.codigo_associado,
            codigo_associado: data.codigo_associado,
            origem_sga: true,
          });
        } else if (data?.erro_transitorio) {
          erroTransitorio = true;
          motivoTransitorio = data?.motivo ?? null;
        }
      } catch (e) {
        console.warn("[buscar-troca] SGA cpf fallback falhou:", e);
      }
    }

    // 3.4 SGA por placa — sempre quando termo é placa
    if (isPlaca) {
      try {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/sga-buscar-associado-completo`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SERVICE_ROLE}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ placa: alnum }),
        });
        const data = await r.json().catch(() => ({}));
        if (data?.encontrado && data?.codigo_associado) {
          const veiculo = (data.veiculos || []).find((v: any) => v.placa === alnum) || data.veiculos?.[0];
          if (veiculo) {
            const key = String(veiculo.codigo_veiculo);
            const already = placas.find((p) => p.veiculoId === key);
            if (!already) {
              placas.push({
                veiculoId: key,
                placa: veiculo.placa || alnum,
                marca: veiculo.marca || "",
                modelo: veiculo.modelo || "",
                associadoId: String(data.codigo_associado),
                associadoNome: data.associado?.nome || "",
                associadoCpf: data.associado?.cpf || "",
                associadoStatus: "ativo",
                origem_sga: true,
              });
            }
          }
        } else if (data?.erro_transitorio) {
          erroTransitorio = true;
          motivoTransitorio = data?.motivo ?? null;
        }
      } catch (e) {
        console.warn("[buscar-troca] SGA placa fallback falhou:", e);
      }
    }

    // 4. Auditoria (best-effort)
    try {
      await svc.from("logs_auditoria").insert({
        usuario_id: userId,
        acao: "consultar",
        descricao: `[BUSCA_TROCA_TITULARIDADE] termo="${termoRaw}" hits_assoc=${associados.length} hits_placa=${placas.length}`,
        entidade: "associados",
      });
    } catch (e) {
      console.warn("[buscar-troca] log falhou:", e);
    }

    return new Response(
      JSON.stringify({ associados, placas, erroTransitorio, motivoTransitorio }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("[buscar-troca] erro:", e);
    return new Response(JSON.stringify({ error: e?.message || "erro" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
