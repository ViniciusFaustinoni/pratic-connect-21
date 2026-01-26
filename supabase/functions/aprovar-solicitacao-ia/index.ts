import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // Validate JWT and get user
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claims.claims.sub;

    // Verificar se usuário é diretor
    const { data: userRole, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["diretor", "admin_master", "desenvolvedor"])
      .maybeSingle();

    if (roleError || !userRole) {
      console.error("[aprovar-solicitacao-ia] Usuário não é diretor:", roleError);
      return new Response(JSON.stringify({ error: "Acesso negado. Apenas diretores podem aprovar solicitações." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { solicitacao_id, acao, motivo } = await req.json();

    if (!solicitacao_id || !acao) {
      return new Response(JSON.stringify({ error: "Parâmetros inválidos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["aprovar", "rejeitar"].includes(acao)) {
      return new Response(JSON.stringify({ error: "Ação deve ser 'aprovar' ou 'rejeitar'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Buscar solicitação
    const { data: solicitacao, error: solError } = await supabase
      .from("chat_solicitacoes_ia")
      .select("*")
      .eq("id", solicitacao_id)
      .single();

    if (solError || !solicitacao) {
      return new Response(JSON.stringify({ error: "Solicitação não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (solicitacao.status !== "pendente") {
      return new Response(JSON.stringify({ error: "Solicitação já foi processada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cliente com service role para criar registros
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Processar ação
    if (acao === "rejeitar") {
      // Atualizar status para rejeitado
      await supabaseAdmin
        .from("chat_solicitacoes_ia")
        .update({
          status: "rejeitado",
          aprovado_em: new Date().toISOString(),
          aprovador_id: userId,
          motivo_rejeicao: motivo || "Rejeitado pelo diretor",
        })
        .eq("id", solicitacao_id);

      return new Response(JSON.stringify({ success: true, message: "Solicitação rejeitada" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // APROVAR - Criar o registro real
    const dados = solicitacao.dados as Record<string, unknown>;
    let resultado_id: string | null = null;
    let resultado_protocolo: string | null = null;

    if (solicitacao.tipo === "sinistro") {
      // Chamar a edge function criar-sinistro
      console.log("[aprovar-solicitacao-ia] Criando sinistro...", dados);

      // Gerar protocolo
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const random = Math.floor(Math.random() * 9999).toString().padStart(4, "0");
      const protocolo = `SIN-${year}${month}${day}-${random}`;

      // Buscar veículo se não informado
      let veiculoId = dados.veiculo_id;
      if (!veiculoId) {
        const { data: veiculos } = await supabaseAdmin
          .from("veiculos")
          .select("id")
          .eq("associado_id", solicitacao.associado_id)
          .eq("status", "ativo")
          .limit(1);
        veiculoId = veiculos?.[0]?.id;
      }

      // Buscar contrato ativo
      const { data: contrato } = await supabaseAdmin
        .from("contratos")
        .select("id")
        .eq("associado_id", solicitacao.associado_id)
        .eq("status", "ativo")
        .limit(1)
        .maybeSingle();

      // Criar sinistro
      const { data: sinistro, error: sinError } = await supabaseAdmin
        .from("sinistros")
        .insert({
          protocolo,
          associado_id: solicitacao.associado_id,
          veiculo_id: veiculoId,
          contrato_id: contrato?.id || null,
          tipo: dados.tipo || "outro",
          data_ocorrencia: dados.data_ocorrencia || new Date().toISOString(),
          local_ocorrencia: dados.local as string || null,
          descricao: dados.descricao as string || null,
          status: "comunicado",
          canal: "ia",
        })
        .select("id, protocolo")
        .single();

      if (sinError) {
        console.error("[aprovar-solicitacao-ia] Erro ao criar sinistro:", sinError);
        return new Response(JSON.stringify({ success: false, error: "Erro ao criar sinistro" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      resultado_id = sinistro.id;
      resultado_protocolo = sinistro.protocolo;

      // Registrar histórico
      await supabaseAdmin.from("sinistro_historico").insert({
        sinistro_id: sinistro.id,
        status_anterior: null,
        status_novo: "comunicado",
        observacao: "Sinistro criado via aprovação de solicitação IA",
      });

      // Transferir documentos coletados pela IA para sinistro_documentos
      const boPath = dados.bo_path as string | null;
      const fotosPaths = (dados.fotos_paths as string[]) || [];

      // Anexar B.O. se existir
      if (boPath) {
        await supabaseAdmin.from("sinistro_documentos").insert({
          sinistro_id: sinistro.id,
          tipo: "bo",
          nome_arquivo: "Boletim de Ocorrência",
          arquivo_url: boPath,
          status: "aprovado",
          enviado_em: new Date().toISOString(),
        });
        console.log("[aprovar-solicitacao-ia] B.O. anexado ao sinistro");
      }

      // Anexar fotos se existirem
      for (let i = 0; i < fotosPaths.length; i++) {
        await supabaseAdmin.from("sinistro_documentos").insert({
          sinistro_id: sinistro.id,
          tipo: i === 0 ? "foto_dano_frontal" : i === 1 ? "foto_dano_traseiro" : "foto_dano",
          nome_arquivo: `Foto do Veículo ${i + 1}`,
          arquivo_url: fotosPaths[i],
          status: "aprovado",
          enviado_em: new Date().toISOString(),
        });
      }
      
      if (fotosPaths.length > 0) {
        console.log(`[aprovar-solicitacao-ia] ${fotosPaths.length} foto(s) anexadas ao sinistro`);
      }

    } else if (solicitacao.tipo === "assistencia") {
      // Criar chamado de assistência
      console.log("[aprovar-solicitacao-ia] Criando assistência...", dados);

      // Gerar protocolo
      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
      const random = Math.floor(Math.random() * 9999).toString().padStart(4, "0");
      const protocolo = `ASS-${dateStr}-${random}`;

      // Buscar veículo se não informado
      let veiculoId = dados.veiculo_id;
      if (!veiculoId) {
        const { data: veiculos } = await supabaseAdmin
          .from("veiculos")
          .select("id")
          .eq("associado_id", solicitacao.associado_id)
          .eq("status", "ativo")
          .limit(1);
        veiculoId = veiculos?.[0]?.id;
      }

      // Criar chamado
      const { data: chamado, error: chamError } = await supabaseAdmin
        .from("chamados_assistencia")
        .insert({
          protocolo,
          associado_id: solicitacao.associado_id,
          veiculo_id: veiculoId,
          tipo_servico: dados.tipo_servico || "guincho",
          descricao: dados.descricao as string || null,
          origem_endereco: dados.localizacao as string || null,
          canal: "ia",
          status: "aberto",
          data_abertura: new Date().toISOString(),
        })
        .select("id, protocolo")
        .single();

      if (chamError) {
        console.error("[aprovar-solicitacao-ia] Erro ao criar assistência:", chamError);
        return new Response(JSON.stringify({ success: false, error: "Erro ao criar chamado" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      resultado_id = chamado.id;
      resultado_protocolo = chamado.protocolo;
    }

    // Atualizar solicitação como aprovada
    await supabaseAdmin
      .from("chat_solicitacoes_ia")
      .update({
        status: "aprovado",
        aprovado_em: new Date().toISOString(),
        aprovador_id: userId,
        resultado_id,
      })
      .eq("id", solicitacao_id);

    console.log(`[aprovar-solicitacao-ia] Solicitação ${solicitacao_id} aprovada - ${solicitacao.tipo} ${resultado_protocolo}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `${solicitacao.tipo === "sinistro" ? "Sinistro" : "Assistência"} criado com sucesso`,
        resultado_id,
        protocolo: resultado_protocolo,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[aprovar-solicitacao-ia] Erro:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
