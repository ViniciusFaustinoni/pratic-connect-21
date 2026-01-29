import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificarPayload {
  tipo: string;
  associado_id: string;
  dados?: Record<string, unknown>;
}

// Templates de notificação
const TEMPLATES: Record<string, {
  titulo: string;
  mensagem: string;
  emailTemplate?: string;
}> = {
  vistoria_aprovada: {
    titulo: '✅ Vistoria Aprovada!',
    mensagem: 'Parabéns {nome}! Sua vistoria foi aprovada. Em breve entraremos em contato para agendar a instalação do rastreador.',
    emailTemplate: 'generico',
  },
  vistoria_reprovada: {
    titulo: '❌ Vistoria não aprovada',
    mensagem: 'Olá {nome}, infelizmente sua vistoria não foi aprovada. Motivo: {motivo}. Entre em contato conosco para mais informações.',
    emailTemplate: 'generico',
  },
  vistoria_nova_tentativa: {
    titulo: '⚠️ Vistoria precisa de ajustes',
    mensagem: 'Olá {nome}, sua vistoria precisa de alguns ajustes. Motivo: {motivo}. Você pode realizar uma nova vistoria pelo nosso app.',
    emailTemplate: 'generico',
  },
  instalacao_agendada: {
    titulo: '📅 Instalação Agendada!',
    mensagem: 'Olá {nome}! Sua instalação foi agendada para {data}. Nosso técnico entrará em contato.',
    emailTemplate: 'generico',
  },
  instalacao_concluida: {
    titulo: '🎉 Instalação Concluída!',
    mensagem: 'Parabéns {nome}! A instalação foi realizada com sucesso. Seu veículo agora está protegido!',
    emailTemplate: 'generico',
  },
  cobertura_total_ativada: {
    titulo: '🛡️ Cobertura Total Ativada!',
    mensagem: 'Parabéns {nome}! Seu veículo {placa} agora está com COBERTURA TOTAL ativa. A instalação do rastreador e vistoria foram concluídas com sucesso. Bem-vindo à PRATIC!',
    emailTemplate: 'generico',
  },
  documentos_solicitados: {
    titulo: '📄 Documentos Pendentes',
    mensagem: 'Olá {nome}! Precisamos de alguns documentos para dar continuidade ao seu cadastro: {documentos}. Acesse o link de acompanhamento para enviar.',
    emailTemplate: 'generico',
  },
  status_atualizado: {
    titulo: '📋 Atualização do seu Cadastro',
    mensagem: 'Olá {nome}! Seu cadastro foi atualizado. Status: {status}. {observacao}',
    emailTemplate: 'generico',
  },
  assistencia_prestador_acionado: {
    titulo: '🚗 Prestador Acionado',
    mensagem: 'Olá! O prestador {prestador_nome} foi acionado para atendê-lo. Previsão de chegada: {previsao}. Acompanhe pelo protocolo {protocolo}.',
    emailTemplate: 'generico',
  },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ success: false, error: 'Configuração do Supabase ausente' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { tipo, associado_id, dados }: NotificarPayload = await req.json();

    console.log(`[notificar-cliente] Iniciando - Tipo: ${tipo}, Associado: ${associado_id}`);

    // Validações
    if (!tipo || !associado_id) {
      throw new Error('tipo e associado_id são obrigatórios');
    }

    // Buscar dados do associado
    const { data: associado, error: assocError } = await supabase
      .from('associados')
      .select('id, nome, email, telefone, whatsapp, user_id')
      .eq('id', associado_id)
      .single();

    if (assocError || !associado) {
      console.error('[notificar-cliente] Associado não encontrado:', assocError);
      throw new Error('Associado não encontrado');
    }

    console.log(`[notificar-cliente] Associado encontrado: ${associado.nome}`);

    // Buscar template
    const template = TEMPLATES[tipo];
    if (!template) {
      console.warn(`[notificar-cliente] Template não encontrado para tipo: ${tipo}`);
      throw new Error(`Template '${tipo}' não encontrado`);
    }

    // Substituir variáveis no template
    let mensagem = template.mensagem;
    let titulo = template.titulo;

    // Substituir {nome}
    const primeiroNome = associado.nome?.split(' ')[0] || 'Cliente';
    mensagem = mensagem.replace('{nome}', primeiroNome);
    titulo = titulo.replace('{nome}', primeiroNome);

    // Substituir outras variáveis dos dados
    if (dados) {
      Object.entries(dados).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          mensagem = mensagem.replace(`{${key}}`, String(value));
          titulo = titulo.replace(`{${key}}`, String(value));
        }
      });
    }

    // Limpar variáveis não substituídas
    mensagem = mensagem.replace(/\{[^}]+\}/g, '');

    console.log(`[notificar-cliente] Mensagem formatada: ${mensagem.substring(0, 50)}...`);

    const resultados = {
      sistema: false,
      whatsapp: false,
      email: false,
    };

    // 1. Salvar notificação no sistema (se o associado tem user_id)
    if (associado.user_id) {
      const { error: notifError } = await supabase.from('notificacoes').insert({
        user_id: associado.user_id,
        titulo,
        mensagem,
        tipo: 'info',
        lida: false,
        categoria: 'vistoria',
        referencia_tipo: 'vistoria',
        referencia_id: dados?.vistoria_id as string || null,
        canal_sistema: true,
      });

      if (notifError) {
        console.error('[notificar-cliente] Erro ao salvar notificação:', notifError);
      } else {
        resultados.sistema = true;
        console.log('[notificar-cliente] Notificação salva no sistema');
      }
    }

    // 2. Enviar por WhatsApp usando whatsapp-send-text (correto para mensagens de texto)
    const telefone = associado.whatsapp || associado.telefone;
    if (telefone) {
      try {
        const whatsappMsg = `${titulo}\n\n${mensagem}`;
        
        // Usar whatsapp-send-text para envio de mensagens de texto
        const { data: whatsResult, error: whatsError } = await supabase.functions.invoke('whatsapp-send-text', {
          body: {
            telefone: telefone.replace(/\D/g, ''),
            mensagem: whatsappMsg,
          },
        });

        if (whatsError) {
          throw whatsError;
        }
        
        if (whatsResult?.success === false) {
          throw new Error(whatsResult.error || 'Erro ao enviar WhatsApp');
        }

        resultados.whatsapp = true;
        console.log('[notificar-cliente] WhatsApp enviado via whatsapp-send-text');
      } catch (whatsappError) {
        console.error('[notificar-cliente] Erro ao enviar WhatsApp:', whatsappError);
        // Continua mesmo se falhar
      }
    } else {
      console.log('[notificar-cliente] Sem telefone para WhatsApp');
    }

    // 3. Enviar por email
    if (associado.email && template.emailTemplate) {
      try {
        await supabase.functions.invoke('send-email', {
          body: {
            template: template.emailTemplate,
            to: associado.email,
            data: {
              assunto: titulo,
              titulo,
              conteudo: `<p>${mensagem.replace(/\n/g, '<br>')}</p>`,
              nome: primeiroNome,
              ...dados,
            },
          },
        });

        resultados.email = true;
        console.log('[notificar-cliente] Email enviado');
      } catch (emailError) {
        console.error('[notificar-cliente] Erro ao enviar email:', emailError);
        // Continua mesmo se falhar
      }
    } else {
      console.log('[notificar-cliente] Sem email ou template não definido');
    }

    console.log('[notificar-cliente] Processamento concluído:', resultados);

    return new Response(
      JSON.stringify({ 
        success: true, 
        resultados,
        mensagem: `Notificação processada. Sistema: ${resultados.sistema}, WhatsApp: ${resultados.whatsapp}, Email: ${resultados.email}`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[notificar-cliente] Erro:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});