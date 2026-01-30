import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Labels de tipo de sinistro
const TIPO_LABELS: Record<string, string> = {
  colisao: 'Colisão',
  roubo: 'Roubo',
  furto: 'Furto',
  incendio: 'Incêndio',
  fenomeno_natural: 'Fenômeno Natural',
  vidros: 'Vidros',
  vandalismo: 'Vandalismo',
  terceiros: 'Terceiros',
  outro: 'Outro',
};

// Templates de mensagem por status - COM SLAs E PRÓXIMOS PASSOS
const STATUS_TEMPLATES: Record<string, { titulo: string; mensagem: (protocolo: string, extras?: any) => string }> = {
  comunicado: {
    titulo: '✅ Sinistro Registrado',
    mensagem: (protocolo, extras) => {
      const tipoLabel = extras?.tipo_label || 'Sinistro';
      const veiculo = extras?.veiculo;
      const dataEvento = extras?.data_ocorrencia 
        ? new Date(extras.data_ocorrencia).toLocaleDateString('pt-BR') 
        : '';
      const local = [extras?.cidade_ocorrencia, extras?.estado_ocorrencia]
        .filter(Boolean).join('/') || 'Local não informado';
      
      let msg = `Olá! Recebemos sua comunicação de sinistro e nossa equipe já está analisando.

📋 *Protocolo:* ${protocolo}
📌 *Tipo:* ${tipoLabel}`;

      if (veiculo) {
        msg += `

🚗 *Veículo:*
${veiculo.placa} - ${veiculo.marca} ${veiculo.modelo}`;
      }
      
      msg += `

📍 *Local:* ${local}`;
      
      if (dataEvento) {
        msg += `
📅 *Data do evento:* ${dataEvento}`;
      }
      
      msg += `

⏰ *Próximos passos:*
1. Analisaremos em até 24h úteis
2. Se necessário, solicitaremos documentos
3. Acompanhe pelo app ou aqui no WhatsApp

Em breve um analista entrará em contato. Fique tranquilo! 💙`;
      
      return msg;
    },
  },
  documentacao_pendente: {
    titulo: '📄 Documentos Pendentes',
    mensagem: (protocolo, extras) => {
      const docs = extras?.documentos || [];
      const listaFormatada = docs.length > 0 
        ? `\n\n📝 *Documentos solicitados:*\n• ${docs.join('\n• ')}`
        : '';
      return `Precisamos de documentos para o sinistro ${protocolo}.${listaFormatada}\n\n⏰ *Prazo:* 48 horas\n\nEnvie pelo app ou responda esta mensagem com as fotos dos documentos.`;
    },
  },
  em_analise: {
    titulo: '🔍 Em Análise',
    mensagem: (protocolo) => `Todos os documentos do sinistro ${protocolo} foram recebidos!\n\n🔍 *Status:* Análise técnica em andamento\n\n⏰ *Prazo estimado:* até 5 dias úteis\n\nVocê será notificado sobre o resultado.`,
  },
  aguardando_vistoria: {
    titulo: '🔎 Vistoria Agendada',
    mensagem: (protocolo) => `Uma vistoria foi agendada para o sinistro ${protocolo}.\n\n🚗 Nosso técnico entrará em contato para confirmar data e local.\n\nConfira os detalhes no app.`,
  },
  em_vistoria: {
    titulo: '🔎 Vistoria em Andamento',
    mensagem: (protocolo) => `A vistoria do sinistro ${protocolo} está em andamento.\n\n📝 O laudo técnico será emitido em breve.`,
  },
  aguardando_parecer: {
    titulo: '⏳ Aguardando Parecer',
    mensagem: (protocolo) => `A vistoria do sinistro ${protocolo} foi concluída.\n\n📋 Aguardando parecer técnico final.\n\n⏰ Prazo: até 3 dias úteis.`,
  },
  aprovado: {
    titulo: '🎉 Sinistro APROVADO!',
    mensagem: (protocolo, extras) => {
      const valor = extras?.valor_indenizacao ? `\n\n💰 *Valor aprovado:* R$ ${extras.valor_indenizacao.toFixed(2)}` : '';
      const tipoDano = extras?.tipo_dano === 'perda_total' ? '\n\n⚠️ *Classificação:* Perda Total' : '';
      return `Ótima notícia! Seu sinistro ${protocolo} foi *APROVADO*!${valor}${tipoDano}\n\n📋 *Próximos passos:*\n1. Verificação dos dados bancários\n2. Pagamento em até 10 dias úteis\n\nAcompanhe os detalhes no app.`;
    },
  },
  negado: {
    titulo: '❌ Sinistro Negado',
    mensagem: (protocolo, extras) => {
      const motivo = extras?.parecer ? `\n\n📝 *Motivo resumido:* ${extras.parecer.substring(0, 150)}...` : '';
      return `Seu sinistro ${protocolo} foi negado.${motivo}\n\n📋 Consulte o parecer completo no app.\n\n⚖️ *Recurso:* Você pode solicitar revisão em até 15 dias.\n\nDúvidas? Responda esta mensagem ou entre em contato.`;
    },
  },
  em_regulacao: {
    titulo: '📋 Em Regulação',
    mensagem: (protocolo) => `O sinistro ${protocolo} está em fase de regulação.\n\n📝 Estamos finalizando os trâmites para pagamento.\n\nVocê será notificado quando concluído.`,
  },
  em_reparo: {
    titulo: '🔧 Em Reparo',
    mensagem: (protocolo) => `O reparo do veículo referente ao sinistro ${protocolo} está em andamento.\n\n🚗 Acompanhe o status pelo app.`,
  },
  pago: {
    titulo: '💰 Pagamento Realizado!',
    mensagem: (protocolo, extras) => {
      const valor = extras?.valor_indenizacao ? ` no valor de R$ ${extras.valor_indenizacao.toFixed(2)}` : '';
      return `O pagamento do sinistro ${protocolo}${valor} foi realizado com sucesso!\n\n✅ Confira sua conta bancária.\n\nAgradecemos a confiança na PRATICCAR! 🚗`;
    },
  },
  encerrado: {
    titulo: '✔️ Sinistro Encerrado',
    mensagem: (protocolo) => `Seu sinistro ${protocolo} foi encerrado.\n\n⭐ Como foi nossa análise?\n\nSua opinião é muito importante! Avalie pelo link no app.`,
  },
  cancelado: {
    titulo: '🚫 Sinistro Cancelado',
    mensagem: (protocolo) => `O sinistro ${protocolo} foi cancelado.\n\nSe isso foi um engano, entre em contato conosco.`,
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

    // Buscar dados do sinistro com associado e veículo
    const { data: sinistro, error: sinistroError } = await supabase
      .from('sinistros')
      .select(`
        id,
        protocolo,
        tipo,
        status,
        valor_indenizacao,
        tipo_dano,
        parecer,
        data_ocorrencia,
        local_ocorrencia,
        cidade_ocorrencia,
        estado_ocorrencia,
        associado_id,
        associados:associado_id (
          id,
          nome,
          user_id,
          email,
          telefone,
          whatsapp
        ),
        veiculos:veiculo_id (
          id,
          placa,
          marca,
          modelo,
          ano_modelo
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

    // Preparar dados extras para templates
    const veiculo = sinistro.veiculos as any;
    const extrasParaTemplate = {
      ...dados_extras,
      valor_indenizacao: sinistro.valor_indenizacao,
      tipo_dano: sinistro.tipo_dano,
      parecer: sinistro.parecer,
      // Dados adicionais para template comunicado
      tipo_label: TIPO_LABELS[sinistro.tipo] || sinistro.tipo,
      veiculo: veiculo,
      data_ocorrencia: sinistro.data_ocorrencia,
      local_ocorrencia: sinistro.local_ocorrencia,
      cidade_ocorrencia: sinistro.cidade_ocorrencia,
      estado_ocorrencia: sinistro.estado_ocorrencia,
    };

    // Obter template de mensagem
    const template = STATUS_TEMPLATES[status] || {
      titulo: 'Atualização do Sinistro',
      mensagem: (protocolo: string) => `O status do seu sinistro ${protocolo} foi atualizado para: ${status}`,
    };

    const titulo = template.titulo;
    const mensagem = template.mensagem(sinistro.protocolo, extrasParaTemplate);

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

    // Enviar email se o associado tiver email
    if (associado.email) {
      try {
        const appUrl = Deno.env.get('APP_URL') || 'https://iyxdgmukrrdkffraptsx.lovableproject.com';
        
        await supabase.functions.invoke('send-email', {
          body: {
            template: 'sinistro-status',
            to: associado.email,
            data: {
              protocolo: sinistro.protocolo,
              statusLabel: titulo,
              titulo,
              mensagem,
              link: `${appUrl}/app/sinistros/${sinistro_id}`,
            }
          }
        });
        
        console.log(`[notificar-sinistro] Email enviado para ${associado.email}`);
      } catch (emailError) {
        console.error(`[notificar-sinistro] Erro ao enviar email:`, emailError);
        // Não falhar a função por erro de email
      }
    }

    // ========================================
    // ENVIAR WHATSAPP VIA EVOLUTION API
    // ========================================
    const telefone = associado.whatsapp || associado.telefone;
    if (telefone) {
      try {
        console.log(`[notificar-sinistro] Enviando WhatsApp para ${telefone}`);
        
        // Formatar mensagem com negrito do WhatsApp
        const mensagemWhatsApp = `*${titulo}*\n\n${mensagem}`;
        
        await supabase.functions.invoke('whatsapp-send-text', {
          body: {
            telefone: telefone.replace(/\D/g, ''),
            mensagem: mensagemWhatsApp,
          },
        });
        
        console.log(`[notificar-sinistro] WhatsApp enviado para ${telefone}`);
      } catch (whatsErr) {
        console.error(`[notificar-sinistro] Erro ao enviar WhatsApp:`, whatsErr);
        // Não falhar a função por erro de WhatsApp
      }
    } else {
      console.log(`[notificar-sinistro] Associado sem telefone/whatsapp cadastrado`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Notificação enviada',
        notificacao: { titulo, mensagem },
        whatsapp_enviado: !!telefone,
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
