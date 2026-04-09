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

// Função reutilizável para enviar WhatsApp de boas-vindas
async function enviarWhatsAppBoasVindas(
  supabaseAdmin: ReturnType<typeof createClient>,
  associado: Record<string, unknown>,
  body: AtivarAssociadoRequest
) {
  const telefoneWhatsapp = (associado.whatsapp || associado.telefone) as string | null;
  if (!telefoneWhatsapp) {
    console.log('[ativar-associado] Sem telefone/whatsapp para envio');
    return;
  }

  try {
    // Verificar se Meta está ativo para usar template
    const { data: metaConfig } = await supabaseAdmin
      .from('whatsapp_meta_config')
      .select('ativo')
      .limit(1)
      .maybeSingle();

    const isMetaAtivo = metaConfig?.ativo === true;
    const primeiroNome = (associado.nome as string)?.split(' ')[0] || 'Cliente';
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const appUrl = supabaseUrl.replace('supabase.co', 'lovable.app').replace('https://iyxdgmukrrdkffraptsx.', 'https://');
    const senhaPadrao = gerarSenhaPadrao(associado.cpf as string);

    const sendBody: Record<string, unknown> = {
      telefone: telefoneWhatsapp.replace(/\D/g, ''),
      mensagem: `Olá ${associado.nome}! 🚗\n\nSeu acesso ao App PRATIC está liberado!\n\n🔗 URL: ${appUrl}/app/login\n👤 Login: ${associado.cpf}\n🔑 Senha: ${senhaPadrao}\n\nNo primeiro acesso você deverá trocar sua senha.`,
    };

    // Se Meta ativo, usar template cadastro_aprovado_botao
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
          .eq('id', associado.plano_id as string)
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
        .eq('associado_id', associado.id as string)
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

      // Buscar link_token do contrato
      let linkToken: string | null = null;
      
      if (body.veiculo_id) {
        const { data: contratoVeiculo } = await supabaseAdmin
          .from('contratos')
          .select('link_token')
          .eq('associado_id', associado.id as string)
          .eq('veiculo_id', body.veiculo_id)
          .in('status', ['ativo', 'assinado', 'pendente_assinatura'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        linkToken = contratoVeiculo?.link_token || null;
      }
      
      if (!linkToken) {
        const { data: contratoFallback } = await supabaseAdmin
          .from('contratos')
          .select('link_token')
          .eq('associado_id', associado.id as string)
          .in('status', ['ativo', 'assinado', 'pendente_assinatura'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        linkToken = contratoFallback?.link_token || null;
      }

      console.log(`[ativar-associado] link_token resolvido: ${linkToken} (veiculo_id: ${body.veiculo_id})`);

      sendBody.template_name = 'cadastro_aprovado_botao';
      sendBody.template_params = [primeiroNome, placa, marcaModelo, cobertura, 'Instalação do rastreador'];
      
      if (linkToken) {
        sendBody.template_button_params = [linkToken];
      } else {
        console.warn(`[ativar-associado] ⚠️ Nenhum link_token encontrado para associado ${associado.id}. Botão de URL pode não funcionar.`);
        sendBody.template_button_params = [tokenPrimeiroAcesso];
      }
      
      console.log(`[ativar-associado] Usando template Meta 'cadastro_aprovado_botao' para ${telefoneWhatsapp}`);
    }

    await supabaseAdmin.functions.invoke('whatsapp-send-text', {
      body: sendBody,
    });
    console.log('[ativar-associado] WhatsApp enviado com sucesso');
  } catch (whatsappError) {
    console.error('[ativar-associado] Erro ao enviar WhatsApp:', whatsappError);
  }
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
      console.log('Associado já possui acesso, enviando WhatsApp e notificando...');
      
      // ENVIAR WHATSAPP mesmo quando já possui acesso
      await enviarWhatsAppBoasVindas(supabaseAdmin, associado, body);

      // Enviar notificação por email
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
          message: 'Associado já possui acesso. WhatsApp e notificação enviados.',
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
      if ((authError as any).code === 'email_exists' || authError.message?.includes('already been registered')) {
        console.log('Email já registrado no Auth, buscando user existente via API...');
        // listUsers() só retorna a primeira página (50 users). Usar fetch direto para buscar por email.
        const authResponse = await fetch(
          `${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'apikey': supabaseServiceKey,
            },
          }
        );
        
        // Buscar pelo email específico usando filter na query
        const emailLower = associado.email.toLowerCase();
        let existingUser = null;
        
        // Tentar via listUsers com paginação ampla
        let page = 1;
        const perPage = 500;
        while (!existingUser) {
          const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
          if (listError || !users || users.length === 0) break;
          existingUser = users.find(u => u.email?.toLowerCase() === emailLower);
          if (users.length < perPage) break;
          page++;
        }
        
        if (!existingUser) {
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

    // Atualizar profile
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

    // Enviar email
    const supabaseUrlEnv = Deno.env.get("SUPABASE_URL")!;
    const appUrl = supabaseUrlEnv.replace('supabase.co', 'lovable.app').replace('https://iyxdgmukrrdkffraptsx.', 'https://');
    
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

    // Enviar WhatsApp usando função reutilizável
    await enviarWhatsAppBoasVindas(supabaseAdmin, associado, body);

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
