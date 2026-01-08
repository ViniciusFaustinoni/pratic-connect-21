import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { cpf } = await req.json();

    if (!cpf || cpf.length !== 11) {
      return new Response(
        JSON.stringify({ success: false, error: 'CPF inválido' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Buscar associado pelo CPF
    const { data: associado, error: assocError } = await supabase
      .from('associados')
      .select(`
        id,
        nome,
        email,
        whatsapp,
        telefone,
        status,
        user_id
      `)
      .eq('cpf', cpf)
      .single();

    if (assocError || !associado) {
      console.log('Associado não encontrado:', assocError);
      return new Response(
        JSON.stringify({ success: false, error: 'CPF não encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Verificar se está ativo
    if (!['ativo', 'aprovado'].includes(associado.status)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Cadastro ainda em análise ou inativo' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Verificar se tem veículo com rastreador instalado
    const { data: veiculos } = await supabase
      .from('veiculos')
      .select(`
        id,
        status,
        rastreadores!inner (
          id,
          status
        )
      `)
      .eq('associado_id', associado.id)
      .eq('rastreadores.status', 'instalado');

    if (!veiculos || veiculos.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Rastreador ainda não instalado' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Se já tem user_id, redirecionar para recuperar senha
    if (associado.user_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Você já possui uma conta. Use "Esqueci minha senha" para recuperar o acesso.',
          hasAccount: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Gerar token único para criação de senha
    const token = crypto.randomUUID();
    const expiraEm = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 horas

    // 6. Invalidar tokens anteriores do mesmo associado
    await supabase
      .from('auth_tokens_primeiro_acesso')
      .update({ usado: true, usado_em: new Date().toISOString() })
      .eq('associado_id', associado.id)
      .eq('usado', false);

    // 7. Salvar novo token no banco
    const { error: tokenError } = await supabase
      .from('auth_tokens_primeiro_acesso')
      .insert({
        associado_id: associado.id,
        token,
        expira_em: expiraEm.toISOString(),
        usado: false
      });

    if (tokenError) {
      console.error('Erro ao salvar token:', tokenError);
      throw new Error('Erro ao gerar token de acesso');
    }

    // 8. Montar link
    const appUrl = Deno.env.get('APP_URL') || supabaseUrl.replace('.supabase.co', '.lovable.app');
    const linkCriarSenha = `${appUrl}/app/criar-senha?token=${token}`;

    // 9. Enviar WhatsApp
    const whatsappNumero = associado.whatsapp || associado.telefone;
    if (whatsappNumero) {
      try {
        await supabase.functions.invoke('whatsapp-send-media', {
          body: {
            telefone: whatsappNumero.replace(/\D/g, ''),
            tipo: 'text',
            mensagem: `🎉 Olá, ${associado.nome.split(' ')[0]}!\n\nSeu veículo está protegido pela PRATIC!\n\nAcesse o App e crie sua senha:\n🔗 ${linkCriarSenha}\n\n⏰ Link válido por 48 horas.`,
            referencia_tipo: 'primeiro_acesso',
            referencia_id: associado.id
          }
        });
      } catch (whatsappError) {
        console.error('Erro ao enviar WhatsApp:', whatsappError);
        // Continua mesmo se falhar o WhatsApp
      }
    }

    // 10. Enviar Email
    if (associado.email) {
      try {
        await supabase.functions.invoke('send-email', {
          body: {
            template: 'primeiro-acesso',
            to: associado.email,
            data: {
              nome: associado.nome.split(' ')[0],
              linkCriarSenha
            }
          }
        });
      } catch (emailError) {
        console.error('Erro ao enviar email:', emailError);
        // Continua mesmo se falhar o email
      }
    }

    // 11. Registrar log
    await supabase
      .from('auth_logs')
      .insert({
        email: associado.email,
        acao: 'primeiro_acesso_solicitado',
        metadata: { cpf, metodo: 'modal_app' }
      });

    return new Response(
      JSON.stringify({ 
        success: true,
        whatsapp: whatsappNumero || '',
        email: associado.email || ''
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao processar solicitação';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})
