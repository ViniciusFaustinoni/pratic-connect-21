import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function validarSenha(senha: unknown): string | null {
  if (typeof senha !== "string") return "Senha inválida";
  if (senha.length < 8) return "A senha deve ter pelo menos 8 caracteres";
  if (!/[A-Z]/.test(senha)) return "A senha precisa de uma letra maiúscula";
  if (!/[a-z]/.test(senha)) return "A senha precisa de uma letra minúscula";
  if (!/[0-9]/.test(senha)) return "A senha precisa de um número";
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { token, senha } = await req.json().catch(() => ({}));

    if (!token || typeof token !== "string") {
      return json({ success: false, error: "Token não informado" }, 400);
    }

    const erroSenha = validarSenha(senha);
    if (erroSenha) return json({ success: false, error: erroSenha }, 400);

    // 1. Validar cotação ativa pelo token público
    const { data: cotacao, error: errCot } = await supabase
      .from("cotacoes")
      .select(
        "id, numero, status_contratacao, contrato_gerado_id, token_publico",
      )
      .eq("token_publico", token)
      .maybeSingle();

    if (errCot || !cotacao) {
      return json({ success: false, error: "Cotação não encontrada" }, 404);
    }

    if (cotacao.status_contratacao !== "ativo" || !cotacao.contrato_gerado_id) {
      return json(
        {
          success: false,
          error: "Esta cotação ainda não foi ativada",
        },
        409,
      );
    }

    // 2. Resolver associado a partir do contrato
    const { data: contrato, error: errContrato } = await supabase
      .from("contratos")
      .select("id, status, associado_id")
      .eq("id", cotacao.contrato_gerado_id)
      .maybeSingle();

    if (errContrato || !contrato || !contrato.associado_id) {
      return json({ success: false, error: "Contrato inválido" }, 404);
    }

    if (contrato.status !== "ativo") {
      return json({ success: false, error: "Contrato não está ativo" }, 409);
    }

    const { data: associado, error: errAssoc } = await supabase
      .from("associados")
      .select("id, nome, cpf, email, telefone, user_id")
      .eq("id", contrato.associado_id)
      .maybeSingle();

    if (errAssoc || !associado) {
      return json({ success: false, error: "Associado não encontrado" }, 404);
    }

    const cpfDigits = String(associado.cpf || "").replace(/\D/g, "");
    if (!cpfDigits) {
      return json(
        { success: false, error: "CPF do associado ausente" },
        500,
      );
    }
    const loginEmail = `${cpfDigits}@associado.pratic.com.br`;

    // 3. Caso já tenha user_id: apenas atualizar senha
    if (associado.user_id) {
      const { error: updErr } = await supabase.auth.admin.updateUserById(
        associado.user_id,
        { password: senha as string },
      );
      if (updErr) {
        console.error("updateUserById error:", updErr);
        return json(
          { success: false, error: "Erro ao atualizar senha" },
          500,
        );
      }

      await supabase
        .from("profiles")
        .update({ primeiro_acesso: false })
        .eq("user_id", associado.user_id);

      await supabase.from("associados_historico").insert({
        associado_id: associado.id,
        tipo: "senha_redefinida",
        descricao: "Senha redefinida pelo associado via link da cotação",
      });

      return json({
        success: true,
        message: "Senha atualizada com sucesso",
        email: loginEmail,
        cpf: associado.cpf,
        already_existed: true,
      });
    }

    // 4. Criar usuário no Auth
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email: loginEmail,
        password: senha as string,
        email_confirm: true,
        user_metadata: {
          nome: associado.nome,
          tipo: "associado",
          cpf: associado.cpf,
        },
      });

    if (authError || !authData?.user) {
      const msg = authError?.message || "";
      if (msg.includes("already been registered") || msg.includes("already registered")) {
        return json(
          {
            success: false,
            error:
              "Já existe uma conta para este CPF. Vá para o login e use 'Esqueci minha senha'.",
          },
          409,
        );
      }
      console.error("createUser error:", authError);
      return json({ success: false, error: "Erro ao criar conta" }, 500);
    }

    const userId = authData.user.id;

    // 5. Vincular user_id no associado
    await supabase
      .from("associados")
      .update({ user_id: userId })
      .eq("id", associado.id);

    // 6. Garantir profile
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!existingProfile) {
      await supabase.from("profiles").insert({
        user_id: userId,
        nome: associado.nome,
        email: associado.email || loginEmail,
        telefone: associado.telefone,
        cpf: associado.cpf,
        tipo: "associado",
        ativo: true,
        bloqueado: false,
        primeiro_acesso: false,
      });
    } else {
      await supabase
        .from("profiles")
        .update({ primeiro_acesso: false })
        .eq("user_id", userId);
    }

    // 7. Garantir role
    await supabase
      .from("user_roles")
      .upsert(
        { user_id: userId, role: "associado" },
        { onConflict: "user_id,role" },
      );

    // 8. Logs
    await supabase.from("auth_logs").insert({
      email: associado.email || loginEmail,
      acao: "primeiro_acesso_via_cotacao",
      metadata: {
        associado_id: associado.id,
        cotacao_id: cotacao.id,
      },
    });

    await supabase.from("associados_historico").insert({
      associado_id: associado.id,
      tipo: "acesso_criado",
      descricao: "Conta de acesso criada na ativação via link da cotação",
    });

    return json({
      success: true,
      message: "Senha criada com sucesso",
      email: loginEmail,
      cpf: associado.cpf,
      already_existed: false,
    });
  } catch (e) {
    console.error("cotacao-criar-senha error:", e);
    const msg = e instanceof Error ? e.message : "Erro inesperado";
    return json({ success: false, error: msg }, 500);
  }
});
