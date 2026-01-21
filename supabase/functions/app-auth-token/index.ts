import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Gerar código de 6 dígitos
function gerarCodigo(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Mascarar telefone (11) 9****-1234
function mascararTelefone(telefone: string): string {
  const limpo = telefone.replace(/\D/g, '');
  if (limpo.length < 8) return '*****';
  return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 3)}****-${limpo.slice(-4)}`;
}

// Mascarar email jo***@gmail.com
function mascararEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return '*****';
  const maskedUser = user.slice(0, 2) + '***';
  return `${maskedUser}@${domain}`;
}

interface SolicitarRequest {
  cpf: string;
  tipo: 'primeiro_acesso' | 'recuperar_senha';
}

interface ConfirmarRequest {
  cpf: string;
  codigo: string;
  nova_senha: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const url = new URL(req.url);
    const action = url.pathname.split('/').pop();

    // ============================================================
    // SOLICITAR TOKEN
    // ============================================================
    if (action === 'solicitar' && req.method === 'POST') {
      const { cpf, tipo }: SolicitarRequest = await req.json();

      if (!cpf || !tipo) {
        return new Response(
          JSON.stringify({ error: 'CPF e tipo são obrigatórios' }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Limpar CPF
      const cpfLimpo = cpf.replace(/\D/g, '');

      // Buscar associado
      const { data: associado, error: assocError } = await supabase
        .from('associados')
        .select('id, user_id, nome, email, telefone, whatsapp')
        .eq('cpf', cpfLimpo)
        .single();

      if (assocError || !associado) {
        console.error('[app-auth-token] Associado não encontrado:', cpfLimpo);
        return new Response(
          JSON.stringify({ error: 'CPF não encontrado em nossa base' }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validar tipo
      if (tipo === 'primeiro_acesso' && associado.user_id) {
        return new Response(
          JSON.stringify({ 
            error: 'Você já possui acesso ao aplicativo. Use a opção "Esqueci minha senha".' 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (tipo === 'recuperar_senha' && !associado.user_id) {
        return new Response(
          JSON.stringify({ 
            error: 'Você ainda não possui acesso ao aplicativo. Use a opção "Primeiro Acesso".' 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Rate limit: verificar tentativas recentes
      const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from('auth_tokens_app')
        .select('*', { count: 'exact', head: true })
        .eq('associado_id', associado.id)
        .gte('created_at', umaHoraAtras);

      if (count && count >= 3) {
        return new Response(
          JSON.stringify({ 
            error: 'Muitas tentativas. Aguarde 1 hora antes de tentar novamente.' 
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Invalidar tokens anteriores do mesmo tipo
      await supabase
        .from('auth_tokens_app')
        .update({ usado: true })
        .eq('associado_id', associado.id)
        .eq('tipo', tipo)
        .eq('usado', false);

      // Gerar código
      const codigo = gerarCodigo();
      const expiraEm = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

      // Determinar canal de envio
      const telefone = associado.whatsapp || associado.telefone;
      let canalEnvio: 'whatsapp' | 'sms' | 'email' = 'email';
      let destinoMascarado = '';

      if (telefone) {
        canalEnvio = 'whatsapp';
        destinoMascarado = mascararTelefone(telefone);
      } else if (associado.email) {
        canalEnvio = 'email';
        destinoMascarado = mascararEmail(associado.email);
      } else {
        return new Response(
          JSON.stringify({ error: 'Nenhum contato cadastrado para envio do código' }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Salvar token
      const { error: tokenError } = await supabase
        .from('auth_tokens_app')
        .insert({
          associado_id: associado.id,
          tipo,
          codigo,
          canal_envio: canalEnvio,
          expira_em: expiraEm.toISOString(),
        });

      if (tokenError) {
        console.error('[app-auth-token] Erro ao salvar token:', tokenError);
        throw tokenError;
      }

      // Enviar código
      const mensagem = `Seu código de acesso PRATIC é: *${codigo}*\n\nVálido por 15 minutos.\n\nSe você não solicitou este código, ignore esta mensagem.`;

      if (canalEnvio === 'whatsapp' && telefone) {
        try {
          await supabase.functions.invoke('enviar-whatsapp', {
            body: {
              telefone,
              mensagem,
              tipo: 'auth_token'
            }
          });
        } catch (whatsappError) {
          console.error('[app-auth-token] Erro WhatsApp, tentando email:', whatsappError);
          // Fallback para email
          if (associado.email) {
            canalEnvio = 'email';
            destinoMascarado = mascararEmail(associado.email);
          }
        }
      }

      if (canalEnvio === 'email' && associado.email) {
        try {
          await supabase.functions.invoke('enviar-email', {
            body: {
              para: associado.email,
              assunto: 'Código de Acesso PRATIC',
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
                  <h2 style="color: #333; text-align: center;">Código de Acesso</h2>
                  <div style="background-color: #f5f5f5; padding: 30px; text-align: center; border-radius: 10px; margin: 20px 0;">
                    <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #333;">${codigo}</span>
                  </div>
                  <p style="color: #666; text-align: center;">Este código é válido por 15 minutos.</p>
                  <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                  <p style="color: #999; font-size: 12px; text-align: center;">
                    Se você não solicitou este código, ignore este e-mail.
                  </p>
                </div>
              `
            }
          });
        } catch (emailError) {
          console.error('[app-auth-token] Erro ao enviar email:', emailError);
          throw new Error('Não foi possível enviar o código. Tente novamente.');
        }
      }

      console.log(`[app-auth-token] Código enviado para ${associado.id} via ${canalEnvio}`);

      return new Response(
        JSON.stringify({
          success: true,
          canal_envio: canalEnvio,
          destino_mascarado: destinoMascarado,
          expira_em: expiraEm.toISOString(),
          mensagem: `Código enviado para ${destinoMascarado}`
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============================================================
    // CONFIRMAR TOKEN
    // ============================================================
    if (action === 'confirmar' && req.method === 'POST') {
      const { cpf, codigo, nova_senha }: ConfirmarRequest = await req.json();

      if (!cpf || !codigo || !nova_senha) {
        return new Response(
          JSON.stringify({ error: 'CPF, código e nova senha são obrigatórios' }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validar senha
      if (nova_senha.length < 6) {
        return new Response(
          JSON.stringify({ error: 'A senha deve ter no mínimo 6 caracteres' }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const cpfLimpo = cpf.replace(/\D/g, '');

      // Buscar associado
      const { data: associado, error: assocError } = await supabase
        .from('associados')
        .select('id, user_id, nome, email, telefone, whatsapp, cpf')
        .eq('cpf', cpfLimpo)
        .single();

      if (assocError || !associado) {
        return new Response(
          JSON.stringify({ error: 'CPF não encontrado' }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Buscar token válido
      const { data: token, error: tokenError } = await supabase
        .from('auth_tokens_app')
        .select('*')
        .eq('associado_id', associado.id)
        .eq('codigo', codigo)
        .eq('usado', false)
        .gt('expira_em', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (tokenError || !token) {
        // Incrementar tentativas do token mais recente
        const { data: ultimoToken } = await supabase
          .from('auth_tokens_app')
          .select('id, tentativas, max_tentativas')
          .eq('associado_id', associado.id)
          .eq('usado', false)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (ultimoToken) {
          await supabase
            .from('auth_tokens_app')
            .update({ tentativas: ultimoToken.tentativas + 1 })
            .eq('id', ultimoToken.id);

          if (ultimoToken.tentativas + 1 >= ultimoToken.max_tentativas) {
            await supabase
              .from('auth_tokens_app')
              .update({ usado: true })
              .eq('id', ultimoToken.id);

            return new Response(
              JSON.stringify({ error: 'Código inválido. Máximo de tentativas atingido. Solicite um novo código.' }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }

        return new Response(
          JSON.stringify({ error: 'Código inválido ou expirado' }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verificar tentativas
      if (token.tentativas >= token.max_tentativas) {
        return new Response(
          JSON.stringify({ error: 'Máximo de tentativas atingido. Solicite um novo código.' }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Processar baseado no tipo
      if (token.tipo === 'primeiro_acesso') {
        // Criar usuário no Supabase Auth
        const email = associado.email || `${cpfLimpo}@app.pratic.com.br`;

        const { data: authUser, error: createError } = await supabase.auth.admin.createUser({
          email,
          password: nova_senha,
          email_confirm: true,
          user_metadata: {
            nome: associado.nome,
            cpf: cpfLimpo,
            tipo: 'associado'
          }
        });

        if (createError) {
          console.error('[app-auth-token] Erro ao criar usuário:', createError);
          
          if (createError.message?.includes('already been registered')) {
            return new Response(
              JSON.stringify({ error: 'Este e-mail já possui uma conta. Use "Esqueci minha senha".' }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          
          throw createError;
        }

        // Vincular user_id ao associado
        await supabase
          .from('associados')
          .update({ user_id: authUser.user.id })
          .eq('id', associado.id);

        // Criar profile
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: authUser.user.id,
            nome: associado.nome,
            email,
            telefone: associado.telefone || associado.whatsapp,
            role: 'associado',
            ativo: true
          });

        if (profileError) {
          console.error('[app-auth-token] Erro ao criar profile:', profileError);
        }

        // Criar preferências de notificação padrão
        await supabase
          .from('notificacoes_preferencias')
          .upsert({
            associado_id: associado.id,
            notif_financeiro: true,
            notif_sinistros: true,
            notif_assistencia: true,
            notif_rastreamento: true,
            push_ativo: false,
            whatsapp_ativo: true,
            email_ativo: true
          });

        console.log(`[app-auth-token] Primeiro acesso concluído para ${associado.id}`);
      } 
      else if (token.tipo === 'recuperar_senha') {
        // Atualizar senha do usuário existente
        if (!associado.user_id) {
          return new Response(
            JSON.stringify({ error: 'Usuário não possui conta. Use "Primeiro Acesso".' }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error: updateError } = await supabase.auth.admin.updateUserById(
          associado.user_id,
          { password: nova_senha }
        );

        if (updateError) {
          console.error('[app-auth-token] Erro ao atualizar senha:', updateError);
          throw updateError;
        }

        console.log(`[app-auth-token] Senha recuperada para ${associado.id}`);
      }

      // Marcar token como usado
      await supabase
        .from('auth_tokens_app')
        .update({ usado: true, usado_em: new Date().toISOString() })
        .eq('id', token.id);

      // Registrar log
      await supabase
        .from('auth_logs')
        .insert({
          acao: token.tipo,
          email: associado.email,
          profile_id: associado.user_id,
          modulo: 'app',
          metadata: { cpf: cpfLimpo }
        });

      return new Response(
        JSON.stringify({
          success: true,
          tipo: token.tipo,
          mensagem: token.tipo === 'primeiro_acesso' 
            ? 'Conta criada com sucesso! Faça login para continuar.'
            : 'Senha alterada com sucesso! Faça login para continuar.'
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rota não encontrada
    return new Response(
      JSON.stringify({ error: 'Rota não encontrada. Use /solicitar ou /confirmar' }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('[app-auth-token] Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
