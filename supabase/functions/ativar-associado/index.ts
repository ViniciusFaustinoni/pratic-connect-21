import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AtivarAssociadoRequest {
  veiculo_id?: string;
  rastreador_id?: string;
  associado_id?: string;
}

// Gerar senha padrão: Pratic@ + 4 últimos dígitos do CPF
function gerarSenhaPadrao(cpf: string): string {
  const cpfLimpo = cpf.replace(/\D/g, '');
  const ultimosDigitos = cpfLimpo.slice(-4);
  return `Pratic@${ultimosDigitos}`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const body: AtivarAssociadoRequest = await req.json();
    const { veiculo_id, rastreador_id, associado_id } = body;

    console.log('Ativando associado:', { veiculo_id, rastreador_id, associado_id });

    // Buscar associado
    let associado;
    
    if (associado_id) {
      const { data, error } = await supabaseAdmin
        .from('associados')
        .select('*')
        .eq('id', associado_id)
        .single();
      
      if (error) throw new Error(`Associado não encontrado: ${error.message}`);
      associado = data;
    } else if (veiculo_id) {
      // Buscar via veículo
      const { data: veiculo, error: veiculoError } = await supabaseAdmin
        .from('veiculos')
        .select('associado_id')
        .eq('id', veiculo_id)
        .single();
      
      if (veiculoError) throw new Error(`Veículo não encontrado: ${veiculoError.message}`);
      
      const { data, error } = await supabaseAdmin
        .from('associados')
        .select('*')
        .eq('id', veiculo.associado_id)
        .single();
      
      if (error) throw new Error(`Associado não encontrado: ${error.message}`);
      associado = data;
    } else if (rastreador_id) {
      // Buscar via rastreador
      const { data: rastreador, error: rastreadorError } = await supabaseAdmin
        .from('rastreadores')
        .select('veiculo_id')
        .eq('id', rastreador_id)
        .single();
      
      if (rastreadorError) throw new Error(`Rastreador não encontrado: ${rastreadorError.message}`);
      
      const { data: veiculo, error: veiculoError } = await supabaseAdmin
        .from('veiculos')
        .select('associado_id')
        .eq('id', rastreador.veiculo_id)
        .single();
      
      if (veiculoError) throw new Error(`Veículo não encontrado: ${veiculoError.message}`);
      
      const { data, error } = await supabaseAdmin
        .from('associados')
        .select('*')
        .eq('id', veiculo.associado_id)
        .single();
      
      if (error) throw new Error(`Associado não encontrado: ${error.message}`);
      associado = data;
    } else {
      throw new Error('Informe veiculo_id, rastreador_id ou associado_id');
    }

    console.log('Associado encontrado:', associado.nome, associado.cpf);

    // Verificar se já tem user_id (já tem acesso)
    if (associado.user_id) {
      console.log('Associado já possui acesso, apenas notificando...');
      
      // Apenas enviar notificação de que rastreador foi ativado
      await supabaseAdmin.functions.invoke('send-email', {
        body: {
          template: 'rastreador-ativado',
          to: associado.email,
          data: {
            nome: associado.nome,
          }
        }
      });
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Associado já possui acesso. Notificação enviada.',
          alreadyActive: true 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Gerar senha padrão
    const senhaPadrao = gerarSenhaPadrao(associado.cpf);

    // Criar usuário no Auth com senha
    let userId: string;
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: associado.email.toLowerCase(),
      password: senhaPadrao,
      email_confirm: true,
      user_metadata: {
        nome: associado.nome,
        cpf: associado.cpf,
        telefone: associado.telefone,
        tipo: 'associado',
      }
    });

    if (authError) {
      // Se o email já existe no Auth, buscar o user existente e vincular
      if ((authError as any).code === 'email_exists' || authError.message?.includes('already been registered')) {
        console.log('Email já registrado no Auth, buscando user existente...');
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = users?.find(u => u.email?.toLowerCase() === associado.email.toLowerCase());
        
        if (!existingUser || listError) {
          throw new Error('Email já registrado mas não foi possível localizar o usuário existente.');
        }
        
        userId = existingUser.id;
        console.log('User existente encontrado:', userId);
      } else {
        console.error('Erro ao criar usuário:', authError);
        throw new Error(`Erro ao criar acesso: ${authError.message}`);
      }
    } else {
      userId = authUser.user.id;
      console.log('Usuário Auth criado:', userId);
    }

    // Atualizar associado com user_id
    const { error: updateAssociadoError } = await supabaseAdmin
      .from('associados')
      .update({ user_id: userId })
      .eq('id', associado.id);

    if (updateAssociadoError) {
      console.error('Erro ao vincular associado:', updateAssociadoError);
    }

    // Atualizar profile com primeiro_acesso e tipo
    const { error: updateProfileError } = await supabaseAdmin
      .from('profiles')
      .update({
        primeiro_acesso: true,
        tipo: 'associado',
        cpf: associado.cpf,
        telefone: associado.telefone,
      })
      .eq('user_id', userId);

    if (updateProfileError) {
      console.error('Erro ao atualizar profile:', updateProfileError);
    }

    // Adicionar role de associado
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: userId,
        role: 'associado',
      });

    if (roleError) {
      console.error('Erro ao adicionar role:', roleError);
    }

    // URL do app
    const appUrl = supabaseUrl.replace('supabase.co', 'lovable.app').replace('https://iyxdgmukrrdkffraptsx.', 'https://');
    
    // Enviar email
    try {
      await supabaseAdmin.functions.invoke('send-email', {
        body: {
          template: 'acesso-associado',
          to: associado.email.toLowerCase(),
          data: {
            nome: associado.nome,
            cpf: associado.cpf,
            senha: senhaPadrao,
            appUrl: appUrl + '/app/login',
          }
        }
      });
      console.log('Email de acesso enviado');
    } catch (emailError) {
      console.error('Erro ao enviar email:', emailError);
    }

    // Enviar WhatsApp (se configurado)
    if (associado.whatsapp || associado.telefone) {
      const telefoneWhatsapp = associado.whatsapp || associado.telefone;
      try {
        // Verificar se Meta está ativo para usar template
        const { data: metaConfig } = await supabaseAdmin
          .from('whatsapp_meta_config')
          .select('ativo')
          .limit(1)
          .maybeSingle();

        const isMetaAtivo = metaConfig?.ativo === true;
        const primeiroNome = associado.nome?.split(' ')[0] || 'Cliente';

        const sendBody: Record<string, unknown> = {
          telefone: telefoneWhatsapp.replace(/\D/g, ''),
          mensagem: `Olá ${associado.nome}! 🚗\n\nSeu acesso ao App PRATIC está liberado!\n\n🔗 URL: ${appUrl}/app/login\n👤 Login: ${associado.cpf}\n🔑 Senha: ${senhaPadrao}\n\nNo primeiro acesso você deverá trocar sua senha.`,
        };

        // Se Meta ativo, usar template ativacao_conta_pratic com botão de acesso
        if (isMetaAtivo) {
          // Buscar dados do veículo para o template
          let placa = 'N/A';
          let marcaModelo = 'seu veículo';
          if (body.veiculo_id) {
            const { data: veiculo } = await supabaseAdmin
              .from('veiculos')
              .select('placa, marca, modelo')
              .eq('id', body.veiculo_id)
              .single();
            if (veiculo?.placa) {
              placa = veiculo.placa;
              marcaModelo = [veiculo.marca, veiculo.modelo].filter(Boolean).join(' ') || 'seu veículo';
            }
          }

          // Buscar plano/cobertura do associado
          let cobertura = 'Roubo e Furto';
          if (associado.plano_id) {
            const { data: plano } = await supabaseAdmin
              .from('planos')
              .select('nome')
              .eq('id', associado.plano_id)
              .single();
            if (plano?.nome) cobertura = plano.nome;
          }

          // Gerar token de primeiro acesso (48h)
          const tokenPrimeiroAcesso = crypto.randomUUID();
          const expiraEm = new Date(Date.now() + 48 * 60 * 60 * 1000);

          // Invalidar tokens anteriores
          await supabaseAdmin
            .from('auth_tokens_primeiro_acesso')
            .update({ usado: true, usado_em: new Date().toISOString() })
            .eq('associado_id', associado.id)
            .eq('usado', false);

          // Salvar novo token
          await supabaseAdmin
            .from('auth_tokens_primeiro_acesso')
            .insert({
              associado_id: associado.id,
              token: tokenPrimeiroAcesso,
              expira_em: expiraEm.toISOString(),
              usado: false
            });

          // Template cadastro_aprovado_botao: 5 body params + 1 button param
          // Body: {{1}} nome, {{2}} placa, {{3}} marca+modelo, {{4}} cobertura, {{5}} próximo passo
          // Button URL: https://pratic-connect-21.lovable.app/acompanhar/{{1}} → associado.id
          sendBody.template_name = 'cadastro_aprovado_botao';
          sendBody.template_params = [primeiroNome, placa, marcaModelo, cobertura, 'Instalação do rastreador', associado.id];
          console.log(`[ativar-associado] Usando template Meta 'cadastro_aprovado_botao' para ${telefoneWhatsapp}`);
        }

        await supabaseAdmin.functions.invoke('whatsapp-send-text', {
          body: sendBody,
        });
        console.log('WhatsApp enviado');
      } catch (whatsappError) {
        console.error('Erro ao enviar WhatsApp:', whatsappError);
      }
    }

    // Registrar histórico
    await supabaseAdmin
      .from('associados_historico')
      .insert({
        associado_id: associado.id,
        tipo: 'acesso_criado',
        descricao: 'Acesso ao App do Associado criado automaticamente após ativação do rastreador',
      });

    // Registrar log de auditoria
    await supabaseAdmin
      .from('auth_logs')
      .insert({
        profile_id: userId,
        email: associado.email.toLowerCase(),
        acao: 'associado_ativado',
        metadata: {
          associado_id: associado.id,
          veiculo_id,
          rastreador_id,
        }
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId: userId,
        message: 'Acesso do associado criado. Email e WhatsApp enviados.'
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error('Erro na função ativar-associado:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
