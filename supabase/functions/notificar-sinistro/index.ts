import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Templates de mensagem por status
const STATUS_TEMPLATES: Record<string, { titulo: string; mensagem: (protocolo: string) => string }> = {
  comunicado: {
    titulo: 'Sinistro Registrado',
    mensagem: (protocolo) => `Seu sinistro foi registrado com sucesso. Protocolo: ${protocolo}. Acompanhe o status pelo app.`,
  },
  em_analise: {
    titulo: 'Sinistro em Análise',
    mensagem: (protocolo) => `Seu sinistro ${protocolo} está sendo analisado pela nossa equipe.`,
  },
  aguardando_documentos: {
    titulo: 'Documentos Pendentes',
    mensagem: (protocolo) => `Precisamos de documentos adicionais para o sinistro ${protocolo}. Verifique no app.`,
  },
  aguardando_vistoria: {
    titulo: 'Vistoria Agendada',
    mensagem: (protocolo) => `Uma vistoria foi agendada para o sinistro ${protocolo}. Confira os detalhes no app.`,
  },
  aprovado: {
    titulo: '✅ Sinistro Aprovado',
    mensagem: (protocolo) => `Ótima notícia! Seu sinistro ${protocolo} foi APROVADO. Verifique os detalhes no app.`,
  },
  negado: {
    titulo: 'Sinistro Negado',
    mensagem: (protocolo) => `Seu sinistro ${protocolo} foi negado. Consulte o parecer no app para mais informações.`,
  },
  pago: {
    titulo: '💰 Pagamento Realizado',
    mensagem: (protocolo) => `O pagamento referente ao sinistro ${protocolo} foi realizado com sucesso!`,
  },
  encerrado: {
    titulo: 'Sinistro Encerrado',
    mensagem: (protocolo) => `Seu sinistro ${protocolo} foi encerrado. Obrigado por utilizar nossos serviços.`,
  },
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { sinistro_id, status, dados_extras } = body;

    console.log(`[notificar-sinistro] Recebido: sinistro_id=${sinistro_id}, status=${status}`);

    if (!sinistro_id || !status) {
      throw new Error('sinistro_id e status são obrigatórios');
    }

    // Buscar dados do sinistro com associado
    const { data: sinistro, error: sinistroError } = await supabase
      .from('sinistros')
      .select(`
        id,
        protocolo,
        tipo,
        status,
        associado_id,
        associados:associado_id (
          id,
          nome,
          user_id,
          telefone,
          whatsapp
        )
      `)
      .eq('id', sinistro_id)
      .single();

    if (sinistroError || !sinistro) {
      console.error(`[notificar-sinistro] Erro ao buscar sinistro:`, sinistroError);
      throw new Error(`Sinistro não encontrado: ${sinistro_id}`);
    }

    const associado = sinistro.associados as any;
    
    if (!associado?.user_id) {
      console.warn(`[notificar-sinistro] Associado sem user_id vinculado`);
      return new Response(
        JSON.stringify({ success: false, message: 'Associado sem usuário vinculado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obter template de mensagem
    const template = STATUS_TEMPLATES[status] || {
      titulo: 'Atualização do Sinistro',
      mensagem: (protocolo: string) => `O status do seu sinistro ${protocolo} foi atualizado para: ${status}`,
    };

    const titulo = template.titulo;
    const mensagem = template.mensagem(sinistro.protocolo);

    // Inserir notificação na tabela
    const { error: notifError } = await supabase
      .from('notificacoes')
      .insert({
        user_id: associado.user_id,
        titulo,
        mensagem,
        tipo: 'sinistro',
        link: `/app/sinistros/${sinistro_id}`,
        lida: false,
      });

    if (notifError) {
      console.error(`[notificar-sinistro] Erro ao inserir notificação:`, notifError);
      throw new Error(`Erro ao criar notificação: ${notifError.message}`);
    }

    console.log(`[notificar-sinistro] Notificação criada para user_id=${associado.user_id}`);

    // TODO: Integração com Evolution API (WhatsApp)
    // Quando os secrets EVOLUTION_API_URL e EVOLUTION_API_KEY forem configurados:
    // 
    // const evolutionUrl = Deno.env.get('EVOLUTION_API_URL');
    // const evolutionKey = Deno.env.get('EVOLUTION_API_KEY');
    // 
    // if (evolutionUrl && evolutionKey) {
    //   const telefone = associado.whatsapp || associado.telefone;
    //   if (telefone) {
    //     await fetch(`${evolutionUrl}/message/sendText`, {
    //       method: 'POST',
    //       headers: {
    //         'Content-Type': 'application/json',
    //         'apikey': evolutionKey,
    //       },
    //       body: JSON.stringify({
    //         number: telefone.replace(/\D/g, ''),
    //         text: mensagem,
    //       }),
    //     });
    //     console.log(`[notificar-sinistro] WhatsApp enviado para ${telefone}`);
    //   }
    // }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Notificação enviada',
        notificacao: { titulo, mensagem },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error(`[notificar-sinistro] Erro:`, errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
