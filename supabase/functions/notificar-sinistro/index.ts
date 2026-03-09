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

// Templates de mensagem por status - SGA PRATIC 2.0
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
      
      let msg = `Olá! Recebemos sua comunicação de sinistro.\n\n📋 *Protocolo:* ${protocolo}\n📌 *Tipo:* ${tipoLabel}`;
      if (veiculo) msg += `\n🚗 *Veículo:* ${veiculo.placa} - ${veiculo.marca} ${veiculo.modelo}`;
      msg += `\n📍 *Local:* ${local}`;
      if (dataEvento) msg += `\n📅 *Data:* ${dataEvento}`;
      msg += `\n\n⏰ *Próximos passos:*\n1. Análise em até 24h úteis\n2. Solicitação de documentos (se necessário)\n3. Acompanhe pelo app\n\nFique tranquilo! 💙`;
      return msg;
    },
  },
  documentacao_pendente: {
    titulo: '📄 Documentos Pendentes',
    mensagem: (protocolo, extras) => {
      const docs = extras?.documentos || [];
      const listaFormatada = docs.length > 0 ? `\n\n📝 *Documentos:*\n• ${docs.join('\n• ')}` : '';
      return `Precisamos de documentos para o sinistro ${protocolo}.${listaFormatada}\n\n⏰ *Prazo:* 30 dias\n\nEnvie pelo app ou responda com as fotos.`;
    },
  },
  em_analise: {
    titulo: '🔍 Em Análise',
    mensagem: (protocolo) => `Documentos do sinistro ${protocolo} recebidos!\n\n🔍 *Status:* Análise técnica\n⏰ *Prazo:* até 5 dias úteis`,
  },
  aguardando_vistoria: {
    titulo: '🔎 Vistoria Agendada',
    mensagem: (protocolo) => `Vistoria agendada para o sinistro ${protocolo}.\n\n🚗 Nosso técnico entrará em contato para confirmar data e local.`,
  },
  em_vistoria: {
    titulo: '🔎 Vistoria em Andamento',
    mensagem: (protocolo) => `Vistoria do sinistro ${protocolo} em andamento.\n\n📝 Laudo técnico em breve.`,
  },
  aguardando_parecer: {
    titulo: '⏳ Aguardando Parecer',
    mensagem: (protocolo) => `Vistoria do sinistro ${protocolo} concluída.\n\n📋 Aguardando parecer final.\n⏰ Prazo: 3 dias úteis.`,
  },
  em_sindicancia: {
    titulo: '🔍 Em Análise Especial',
    mensagem: (protocolo) => `Seu sinistro ${protocolo} está em análise detalhada.\n\n📋 Uma investigação foi aberta para verificação.\n⏰ Prazo: 30 dias.`,
  },
  em_pericia: {
    titulo: '🔬 Em Perícia Técnica',
    mensagem: (protocolo) => `Sinistro ${protocolo} encaminhado para perícia técnica.\n\n🔬 Um perito especializado fará a análise.`,
  },
  suspenso: {
    titulo: '⏸️ Sinistro Suspenso',
    mensagem: (protocolo) => `O sinistro ${protocolo} foi suspenso temporariamente.\n\nAguardando resolução de pendências externas (ex: inquérito policial).`,
  },
  aprovado: {
    titulo: '🎉 Sinistro APROVADO!',
    mensagem: (protocolo, extras) => {
      const valor = extras?.valor_indenizacao ? `\n\n💰 *Valor:* R$ ${extras.valor_indenizacao.toFixed(2)}` : '';
      const tipoDano = extras?.tipo_dano === 'perda_total' ? '\n⚠️ *Classificação:* Perda Total' : '';
      return `Ótima notícia! Sinistro ${protocolo} *APROVADO*!${valor}${tipoDano}\n\n📋 Próximos passos em breve.`;
    },
  },
  negado: {
    titulo: '❌ Sinistro Negado',
    mensagem: (protocolo, extras) => {
      const motivo = extras?.parecer ? `\n\n📝 *Motivo:* ${extras.parecer.substring(0, 150)}...` : '';
      return `Sinistro ${protocolo} foi negado.${motivo}\n\n⚖️ *Recurso:* até 15 dias.\n\nDúvidas? Responda esta mensagem.`;
    },
  },
  em_regulacao: {
    titulo: '📋 Em Regulação',
    mensagem: (protocolo) => `Sinistro ${protocolo} em fase de regulação.\n\n📝 Finalizando orçamentos e trâmites.`,
  },
  aguardando_termo: {
    titulo: '📝 Termo de Anuência',
    mensagem: (protocolo, extras) => {
      const valor = extras?.valor_cota ? `R$ ${extras.valor_cota.toFixed(2)}` : 'R$ 750,00';
      return `Para prosseguir com o reparo do sinistro ${protocolo}, assine o Termo de Anuência.\n\n💰 *Cota de participação:* ${valor}\n⏰ *Prazo:* 30 dias\n\nAcesse o link no app para assinar.`;
    },
  },
  aguardando_cota: {
    titulo: '💰 Cota de Participação',
    mensagem: (protocolo, extras) => {
      const valor = extras?.valor_cota ? `R$ ${extras.valor_cota.toFixed(2)}` : 'R$ 750,00';
      const venc = extras?.vencimento || '';
      return `Para iniciar o reparo do sinistro ${protocolo}, efetue o pagamento:\n\n💰 *Valor:* ${valor}\n📅 *Vencimento:* ${venc}\n\n⏰ Prazo máximo: 30 dias.`;
    },
  },
  em_reparo: {
    titulo: '🔧 Em Reparo',
    mensagem: (protocolo) => `Reparo do sinistro ${protocolo} em andamento!\n\n🚗 Prazo estimado: 90 dias úteis.\nAcompanhe pelo app.`,
  },
  em_garantia: {
    titulo: '✅ Garantia Ativa',
    mensagem: (protocolo) => `Seu veículo foi entregue! Sinistro ${protocolo}.\n\n🛡️ *Garantia:* 90 dias\n\nQualquer problema, entre em contato.`,
  },
  em_recuperacao: {
    titulo: '🔎 Buscando Veículo',
    mensagem: (protocolo) => `Estamos monitorando e buscando seu veículo - Sinistro ${protocolo}.\n\n📍 Você será informado sobre qualquer atualização.`,
  },
  pago: {
    titulo: '💰 Pagamento Realizado!',
    mensagem: (protocolo, extras) => {
      const valor = extras?.valor_indenizacao ? ` de R$ ${extras.valor_indenizacao.toFixed(2)}` : '';
      return `Pagamento do sinistro ${protocolo}${valor} realizado!\n\n✅ Confira sua conta.\n\nAgradecemos a confiança! 🚗`;
    },
  },
  indenizado: {
    titulo: '💰 Indenização Realizada!',
    mensagem: (protocolo, extras) => {
      const valor = extras?.valor_indenizacao ? ` de R$ ${extras.valor_indenizacao.toFixed(2)}` : '';
      return `Indenização do sinistro ${protocolo}${valor} realizada!\n\n✅ Confira sua conta.\n\nAgradecemos a confiança! 🚗`;
    },
  },
  encerrado: {
    titulo: '✔️ Sinistro Encerrado',
    mensagem: (protocolo) => `Sinistro ${protocolo} encerrado.\n\n⭐ Como foi nossa análise? Avalie pelo app!`,
  },
  cancelado: {
    titulo: '🚫 Sinistro Cancelado',
    mensagem: (protocolo) => `Sinistro ${protocolo} foi cancelado.\n\nSe foi engano, entre em contato.`,
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
        
        // Mapear status para template Meta
        const primeiroNome = associado.nome?.split(' ')[0] || 'Associado';
        let templateName: string;
        let templateParams: string[];
        
        if (status === 'comunicado') {
          templateName = 'comunicacao_sinistro';
          templateParams = [
            associado.nome || primeiroNome,
            extras?.tipo_label || 'sinistro',
            sinistro.protocolo,
            extras?.plano_nome || 'seu plano',
            extras?.cota_percentual || 'conforme contrato',
            extras?.valor_fipe || '',
            extras?.valor_cota || '',
            extras?.link_evento || '',
          ];
        } else {
          templateName = 'sinistro_atualizado';
          templateParams = [primeiroNome, sinistro.protocolo, titulo.replace(/[*]/g, '').substring(0, 200)];
        }
        
        await supabase.functions.invoke('whatsapp-send-text', {
          body: {
            telefone: telefone.replace(/\D/g, ''),
            mensagem: mensagemWhatsApp,
            template_name: templateName,
            template_params: templateParams,
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
