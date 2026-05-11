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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  if (!v || !EMAIL_RE.test(v)) return null;
  // Não aceitar como "real" se já for o sintético
  if (v.endsWith("@n.com.br")) return null;
  return v;
}

async function findUserByEmail(
  supabase: any,
  email: string,
): Promise<{ id: string } | null> {
  // listUsers suporta filtro por email em algumas versões; fazemos paginado por segurança
  try {
    const { data } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    const u = (data?.users || []).find(
      (x: any) => (x.email || "").toLowerCase() === email,
    );
    return u ? { id: u.id } : null;
  } catch (_e) {
    return null;
  }
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
        "id, numero, status_contratacao, contrato_gerado_id, token_publico, email_solicitante, lead_id",
      )
      .eq("token_publico", token)
      .maybeSingle();

    if (errCot || !cotacao) {
      return json({ success: false, error: "Cotação não encontrada" }, 404);
    }

    if (cotacao.status_contratacao !== "ativo" || !cotacao.contrato_gerado_id) {
      return json(
        { success: false, error: "Esta cotação ainda não foi ativada" },
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
      return json({ success: false, error: "CPF do associado ausente" }, 500);
    }
    const fallbackEmail = `${cpfDigits}@n.com.br`;

    // 3. Resolver e-mail real (associado → cotacao → lead)
    let emailReal =
      normalizeEmail(associado.email) ||
      normalizeEmail(cotacao.email_solicitante);

    if (!emailReal && cotacao.lead_id) {
      const { data: lead } = await supabase
        .from("leads")
        .select("email")
        .eq("id", cotacao.lead_id)
        .maybeSingle();
      emailReal = normalizeEmail(lead?.email);
    }

    // 4. Decidir login final: real (se livre/próprio) ou fallback
    let loginEmail = fallbackEmail;
    let emailOrigem: "real" | "fallback_cpf" = "fallback_cpf";

    if (emailReal) {
      const existente = await findUserByEmail(supabase, emailReal);
      if (
        !existente ||
        (associado.user_id && existente.id === associado.user_id)
      ) {
        loginEmail = emailReal;
        emailOrigem = "real";
      } else {
        // E-mail está em uso por outra conta → cair para fallback CPF
        emailOrigem = "fallback_cpf";
      }
    }

    // Persistir e-mail real no associado se ainda não tiver
    if (emailReal && !associado.email) {
      await supabase
        .from("associados")
        .update({ email: emailReal })
        .eq("id", associado.id);
    }

    // 5. Caso já tenha user_id: atualizar senha (e migrar e-mail se aplicável)
    if (associado.user_id) {
      const updates: Record<string, unknown> = { password: senha as string };
      // Se decidimos usar o real e o auth atual tem outro e-mail, migrar
      if (emailOrigem === "real") {
        updates.email = loginEmail;
        updates.email_confirm = true;
      }

      const { error: updErr } = await supabase.auth.admin.updateUserById(
        associado.user_id,
        updates,
      );
      if (updErr) {
        console.error("updateUserById error:", updErr);
        // Conflito de e-mail → tenta de novo só com a senha
        if (
          emailOrigem === "real" &&
          /email|already|registered|duplicate/i.test(updErr.message || "")
        ) {
          loginEmail = fallbackEmail;
          emailOrigem = "fallback_cpf";
          const { error: retryErr } = await supabase.auth.admin.updateUserById(
            associado.user_id,
            { password: senha as string },
          );
          if (retryErr) {
            return json(
              { success: false, error: "Erro ao atualizar senha" },
              500,
            );
          }
        } else {
          return json(
            { success: false, error: "Erro ao atualizar senha" },
            500,
          );
        }
      }

      await supabase
        .from('profiles')
        .update({
          primeiro_acesso: false,
          tipo: 'associado',
          ativo: true,
          bloqueado: false,
          ...(emailOrigem === 'real' ? { email: loginEmail } : {}),
        })
        .eq('user_id', associado.user_id);

      // Garantir role 'associado' (contas legadas podem não ter)
      await supabase
        .from('user_roles')
        .upsert(
          { user_id: associado.user_id, role: 'associado' },
          { onConflict: 'user_id,role' },
        );

      await supabase.from('associados_historico').insert({
        associado_id: associado.id,
        tipo: "senha_redefinida",
        descricao: `Senha redefinida via link da cotação (login: ${loginEmail})`,
      });

      return json({
        success: true,
        message: "Senha atualizada com sucesso",
        email: loginEmail,
        email_origem: emailOrigem,
        cpf: associado.cpf,
        already_existed: true,
      });
    }

    // 6. Criar usuário no Auth
    let createdUser: any = null;
    let createErr: any = null;
    {
      const { data, error } = await supabase.auth.admin.createUser({
        email: loginEmail,
        password: senha as string,
        email_confirm: true,
        user_metadata: {
          nome: associado.nome,
          tipo: "associado",
          cpf: associado.cpf,
        },
      });
      createdUser = data?.user;
      createErr = error;
    }

    // Se falhou usando real, tenta fallback CPF
    if ((createErr || !createdUser) && emailOrigem === "real") {
      console.warn(
        "createUser real falhou, tentando fallback CPF:",
        createErr?.message,
      );
      loginEmail = fallbackEmail;
      emailOrigem = "fallback_cpf";
      const { data, error } = await supabase.auth.admin.createUser({
        email: loginEmail,
        password: senha as string,
        email_confirm: true,
        user_metadata: {
          nome: associado.nome,
          tipo: "associado",
          cpf: associado.cpf,
        },
      });
      createdUser = data?.user;
      createErr = error;
    }

    if (createErr || !createdUser) {
      const msg = createErr?.message || "";
      if (
        msg.includes("already been registered") ||
        msg.includes("already registered")
      ) {
        return json(
          {
            success: false,
            error:
              "Já existe uma conta para este CPF. Vá para o login e use 'Esqueci minha senha'.",
          },
          409,
        );
      }
      console.error("createUser error:", createErr);
      return json({ success: false, error: "Erro ao criar conta" }, 500);
    }

    const userId = createdUser.id;

    // 7. Vincular user_id no associado
    await supabase
      .from("associados")
      .update({ user_id: userId })
      .eq("id", associado.id);

    // 8. Garantir profile
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!existingProfile) {
      await supabase.from("profiles").insert({
        user_id: userId,
        nome: associado.nome,
        email: loginEmail,
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
        .update({
          primeiro_acesso: false,
          tipo: "associado",
          ativo: true,
          bloqueado: false,
          email: loginEmail,
        })
        .eq("user_id", userId);
    }

    // 9. Garantir role
    await supabase
      .from("user_roles")
      .upsert(
        { user_id: userId, role: "associado" },
        { onConflict: "user_id,role" },
      );

    // 10. Logs
    await supabase.from("auth_logs").insert({
      email: loginEmail,
      acao: "primeiro_acesso_via_cotacao",
      metadata: {
        associado_id: associado.id,
        cotacao_id: cotacao.id,
        email_origem: emailOrigem,
      },
    });

    await supabase.from("associados_historico").insert({
      associado_id: associado.id,
      tipo: "acesso_criado",
      descricao: `Conta de acesso criada via link da cotação (login: ${loginEmail})`,
    });

    return json({
      success: true,
      message: "Senha criada com sucesso",
      email: loginEmail,
      email_origem: emailOrigem,
      cpf: associado.cpf,
      already_existed: false,
    });
  } catch (e) {
    console.error("cotacao-criar-senha error:", e);
    const msg = e instanceof Error ? e.message : "Erro inesperado";
    return json({ success: false, error: msg }, 500);
  }
});
