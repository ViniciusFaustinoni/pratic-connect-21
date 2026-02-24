import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TIPOS_SERVICO_VALIDOS = [
  "reboque", "pane_seca", "socorro_mecanico", "socorro_eletrico",
  "troca_pneu", "chaveiro", "bateria", "taxi", "hospedagem", "outro",
];
const TIPOS_REBOQUE_VALIDOS = ["leve", "utilitario", "pesado"];

interface PrestadorInput {
  razao_social: string;
  telefone: string;
  cidade: string;
  estado: string;
  tipos_servico: string[];
  nome_fantasia?: string;
  tipo_pessoa?: string;
  cnpj?: string;
  cpf?: string;
  whatsapp?: string;
  telefone_extra?: string;
  email?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  raio_atendimento_km?: number;
  tipos_reboque?: string[];
  banco?: string;
  agencia?: string;
  conta?: string;
  pix_tipo?: string;
  pix_chave?: string;
  valores?: ValorInput[];
}

interface ValorInput {
  tipo_servico: string;
  tipo_reboque?: string | null;
  valor_saida?: number;
  valor_km?: number;
  km_franquia?: number;
  hr_trabalhada?: number;
  hr_parada?: number;
  diaria_base?: number;
}

interface ImportResult {
  linha: number;
  razao_social: string;
  sucesso: boolean;
  erro?: string;
  prestador_id?: string;
  valores_inseridos?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: currentUser }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !currentUser) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", currentUser.id);

    const allowedRoles = ["diretor", "gerente_comercial", "supervisor_vendas"];
    const hasPermission = roles?.some((r: { role: string }) => allowedRoles.includes(r.role));

    if (!hasPermission) {
      return new Response(
        JSON.stringify({ error: "Sem permissão para importar prestadores" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const prestadores: PrestadorInput[] = body.prestadores;

    if (!prestadores || !Array.isArray(prestadores) || prestadores.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhum prestador para importar" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Iniciando importação de ${prestadores.length} prestadores`);

    const resultados: ImportResult[] = [];
    let sucesso = 0;
    let erros = 0;

    for (let i = 0; i < prestadores.length; i++) {
      const p = prestadores[i];
      const linha = i + 1;

      try {
        // Validar campos obrigatórios
        if (!p.razao_social?.trim()) throw new Error("razao_social é obrigatório");
        if (!p.telefone?.trim()) throw new Error("telefone é obrigatório");
        if (!p.cidade?.trim()) throw new Error("cidade é obrigatório");
        if (!p.estado?.trim()) throw new Error("estado é obrigatório");
        if (!p.tipos_servico || !Array.isArray(p.tipos_servico) || p.tipos_servico.length === 0) {
          throw new Error("tipos_servico deve ter ao menos 1 item");
        }

        // Validar tipos_servico
        for (const ts of p.tipos_servico) {
          if (!TIPOS_SERVICO_VALIDOS.includes(ts)) {
            throw new Error(`tipo_servico inválido: ${ts}`);
          }
        }

        // Validar tipos_reboque se tem reboque
        if (p.tipos_servico.includes("reboque")) {
          if (!p.tipos_reboque || p.tipos_reboque.length === 0) {
            throw new Error("tipos_reboque obrigatório quando tem serviço de reboque");
          }
          for (const tr of p.tipos_reboque) {
            if (!TIPOS_REBOQUE_VALIDOS.includes(tr)) {
              throw new Error(`tipo_reboque inválido: ${tr}`);
            }
          }
        }

        // Insert prestador
        const { data: novoPrestador, error: insertError } = await supabaseAdmin
          .from("prestadores_assistencia")
          .insert({
            razao_social: p.razao_social.trim(),
            nome_fantasia: p.nome_fantasia?.trim() || null,
            tipo_pessoa: p.tipo_pessoa || "pj",
            cnpj: p.cnpj || null,
            cpf: p.cpf || null,
            telefone: p.telefone.trim(),
            whatsapp: p.whatsapp || null,
            telefone_extra: p.telefone_extra || null,
            email: p.email || null,
            cidade: p.cidade.trim(),
            estado: p.estado.trim().toUpperCase(),
            cep: p.cep || null,
            logradouro: p.logradouro || null,
            numero: p.numero || null,
            bairro: p.bairro || null,
            raio_atendimento_km: p.raio_atendimento_km || null,
            tipos_servico: p.tipos_servico,
            tipos_reboque: p.tipos_reboque || null,
            banco: p.banco || null,
            agencia: p.agencia || null,
            conta: p.conta || null,
            pix_tipo: p.pix_tipo || null,
            pix_chave: p.pix_chave || null,
            status: "ativo",
            disponivel: true,
          })
          .select("id")
          .single();

        if (insertError) throw new Error(insertError.message);

        let valoresInseridos = 0;

        // Insert valores se houver
        if (p.valores && p.valores.length > 0) {
          const valoresRows = p.valores.map((v) => {
            if (!TIPOS_SERVICO_VALIDOS.includes(v.tipo_servico)) {
              throw new Error(`Valor com tipo_servico inválido: ${v.tipo_servico}`);
            }
            if (!p.tipos_servico.includes(v.tipo_servico)) {
              throw new Error(`Valor tipo_servico "${v.tipo_servico}" não está nos tipos_servico do prestador`);
            }
            return {
              prestador_id: novoPrestador.id,
              tipo_servico: v.tipo_servico,
              tipo_reboque: v.tipo_reboque || null,
              valor_saida: v.valor_saida || null,
              valor_km: v.valor_km || null,
              km_franquia: v.km_franquia || null,
              hr_trabalhada: v.hr_trabalhada || null,
              hr_parada: v.hr_parada || null,
              diaria_base: v.diaria_base || null,
            };
          });

          const { error: valoresError } = await supabaseAdmin
            .from("prestadores_assistencia_valores")
            .insert(valoresRows);

          if (valoresError) {
            console.error(`Erro ao inserir valores do prestador ${novoPrestador.id}:`, valoresError);
            // Prestador foi criado mas valores falharam - reportar parcial
            resultados.push({
              linha,
              razao_social: p.razao_social,
              sucesso: true,
              prestador_id: novoPrestador.id,
              valores_inseridos: 0,
              erro: `Prestador criado, mas erro nos valores: ${valoresError.message}`,
            });
            sucesso++;
            continue;
          }
          valoresInseridos = valoresRows.length;
        }

        resultados.push({
          linha,
          razao_social: p.razao_social,
          sucesso: true,
          prestador_id: novoPrestador.id,
          valores_inseridos: valoresInseridos,
        });
        sucesso++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
        resultados.push({
          linha,
          razao_social: p.razao_social || "N/A",
          sucesso: false,
          erro: errorMessage,
        });
        erros++;
      }
    }

    console.log(`Importação concluída: ${sucesso} sucesso, ${erros} erros`);

    return new Response(
      JSON.stringify({ total: prestadores.length, sucesso, erros, resultados }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Erro na função import-prestadores:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
