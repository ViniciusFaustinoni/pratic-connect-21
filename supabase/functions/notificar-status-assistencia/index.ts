import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Labels para tipos de assistência
const TIPO_LABELS: Record<string, string> = {
  guincho: 'Guincho/Reboque',
  pane_seca: 'Pane Seca (Combustível)',
  chaveiro: 'Chaveiro',
  troca_pneu: 'Troca de Pneu',
  bateria: 'Auxílio Bateria',
  outros: 'Outros',
};

// Configuração de notificações por status
interface NotificacaoConfig {
  titulo: string;
  mensagem: string;
  enviar_contato?: boolean;
  enviar_link_avaliacao?: boolean;
}

const NOTIFICACOES_POR_STATUS: Record<string, NotificacaoConfig> = {
  aberto: {
    titulo: '✅ Chamado Registrado!',
    mensagem: `Olá, {nome}!

Seu chamado de *{tipo_servico}* foi registrado com sucesso.

📋 *Protocolo:* {protocolo}
📍 *Local:* {endereco}

Em breve um prestador será acionado para atendê-lo. Aguarde nossa confirmação.

⏰ Previsão de atendimento: 30-45 minutos`,
  },
  aguardando_prestador: {
    titulo: '🚗 Prestador Acionado!',
    mensagem: `Olá, {nome}!

Temos boas notícias! O prestador *{prestador_nome}* foi acionado para atendê-lo.

📋 *Protocolo:* {protocolo}
📱 *Telefone:* {prestador_telefone}

Em breve ele entrará em contato ou já estará a caminho. Previsão: 30-45 minutos.`,
  },
  prestador_despachado: {
    titulo: '🚚 Prestador Despachado!',
    mensagem: `Olá, {nome}!

O prestador *{prestador_nome}* foi despachado e está se preparando para ir até você.

📋 *Protocolo:* {protocolo}
📱 *Telefone:* {prestador_telefone}

Aguarde, em breve ele estará a caminho!`,
  },
  prestador_a_caminho: {
    titulo: '🚚 Prestador a Caminho!',
    mensagem: `Olá, {nome}!

O prestador *{prestador_nome}* está a caminho do local!

📋 *Protocolo:* {protocolo}
📱 *Telefone:* {prestador_telefone}
⏰ *Previsão de chegada:* 15-25 minutos

Fique atento, ele pode entrar em contato para confirmar o local exato.`,
    enviar_contato: true,
  },
  em_atendimento: {
    titulo: '🔧 Atendimento Iniciado!',
    mensagem: `Olá, {nome}!

O prestador *{prestador_nome}* chegou ao local e iniciou o atendimento do seu chamado.

📋 *Protocolo:* {protocolo}

Qualquer dúvida, entre em contato com o prestador.`,
  },
  concluido: {
    titulo: '✅ Atendimento Concluído!',
    mensagem: `Olá, {nome}!

Seu chamado *{protocolo}* foi concluído com sucesso!

🔧 *Serviço:* {tipo_servico}
👤 *Prestador:* {prestador_nome}

Como foi o atendimento? Sua opinião é muito importante!

⭐ *Avalie agora:* {link_avaliacao}

Obrigado por confiar na PRATIC!`,
    enviar_link_avaliacao: true,
  },
  cancelado_sistema: {
    titulo: '❌ Chamado Cancelado',
    mensagem: `Olá, {nome}!

Seu chamado *{protocolo}* foi cancelado pelo sistema.

📝 *Motivo:* {motivo}

Se precisar de assistência, abra um novo chamado pelo app ou ligue para nossa central.`,
  },
  cancelado_associado: {
    titulo: '❌ Chamado Cancelado',
    mensagem: `Olá, {nome}!

Seu chamado *{protocolo}* foi cancelado conforme solicitado.

Se precisar de assistência novamente, estamos à disposição!`,
  },
};

// Substitui placeholders na mensagem
function renderTemplate(template: string, dados: Record<string, unknown>): string {
  let result = template;
  for (const [key, value] of Object.entries(dados)) {
    result = result.replaceAll(`{${key}}`, String(value ?? ''));
  }
  return result;
}

interface NotificarStatusRequest {
  chamado_id: string;
  status_novo: string;
  observacao?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: NotificarStatusRequest = await req.json();
    const { chamado_id, status_novo, observacao } = payload;

    console.log(`[notificar-status-assistencia] Notificando status ${status_novo} para chamado ${chamado_id}`);

    // Buscar dados completos do chamado
    const { data: chamado, error: chamadoError } = await supabase
      .from('chamados_assistencia')
      .select(`
        *,
        associado:associados!chamados_assistencia_associado_id_fkey(
          id, nome, telefone, whatsapp, email, user_id
        ),
        veiculo:veiculos!chamados_assistencia_veiculo_id_fkey(
          id, placa, marca, modelo
        )
      `)
      .eq('id', chamado_id)
      .single();

    if (chamadoError || !chamado) {
      console.error('[notificar-status-assistencia] Chamado não encontrado:', chamadoError);
      return new Response(
        JSON.stringify({ success: false, error: 'Chamado não encontrado' }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se há template para o status
    const config = NOTIFICACOES_POR_STATUS[status_novo];
    if (!config) {
      console.log(`[notificar-status-assistencia] Sem template para status: ${status_novo}`);
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'no_template' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Telefone do associado
    const telefoneAssociado = (chamado.associado?.whatsapp || chamado.associado?.telefone)?.replace(/\D/g, '');
    if (!telefoneAssociado) {
      console.log('[notificar-status-assistencia] Associado sem telefone');
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'no_phone' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // URL base para avaliação
    const baseUrl = Deno.env.get("APP_URL") || "https://pratic-connect-21.lovable.app";
    const linkAvaliacao = `${baseUrl}/avaliar/assistencia/${chamado_id}`;

    // Preparar dados para template
    const dadosTemplate: Record<string, unknown> = {
      nome: chamado.associado?.nome?.split(' ')[0] || 'Associado',
      protocolo: chamado.protocolo,
      tipo_servico: TIPO_LABELS[chamado.tipo_servico] || chamado.tipo_servico,
      endereco: chamado.origem_endereco || 'Endereço não informado',
      prestador_nome: chamado.prestador_nome || 'Prestador',
      prestador_telefone: chamado.prestador_telefone || 'Não informado',
      motivo: observacao || 'Não informado',
      link_avaliacao: linkAvaliacao,
      placa: chamado.veiculo?.placa || '',
      veiculo: chamado.veiculo ? `${chamado.veiculo.marca} ${chamado.veiculo.modelo}` : '',
    };

    // Renderizar mensagem
    const mensagem = renderTemplate(config.mensagem, dadosTemplate);

    // Determinar template correto por status
    const nomeAssociado = chamado.associado?.nome?.split(' ')[0] || 'Associado';
    let templateName: string;
    let templateParams: string[];

    if (status_novo === 'prestador_a_caminho') {
      // Único status que usa assistencia_confirmada (nome, prestador, minutos)
      let tempo = String(dadosTemplate.tempo || '30');
      // Validar que tempo é numérico — se parece data ISO, usar fallback
      if (/^\d{4}-\d{2}/.test(tempo) || isNaN(Number(tempo))) {
        console.warn(`[notificar-status-assistencia] tempo inválido "${tempo}", usando fallback 30`);
        tempo = '30';
      }
      templateName = 'assistencia_confirmada';
      templateParams = [
        nomeAssociado,
        dadosTemplate.prestador_nome as string || 'Praticcar',
        tempo,
      ];
    } else {
      // Todos os outros status usam sinistro_atualizado (nome, referência, atualização)
      templateName = 'sinistro_atualizado';
      templateParams = [
        nomeAssociado,
        `assistência ${dadosTemplate.protocolo}`,
        mensagem.replace(/\*/g, '').replace(/\n/g, ' ').substring(0, 200),
      ];
    }

    try {
      const { error: whatsappError } = await supabase.functions.invoke('whatsapp-send-text', {
        body: {
          telefone: telefoneAssociado,
          mensagem,
          referencia_tipo: 'chamado_assistencia',
          referencia_id: chamado_id,
          template_name: templateName,
          template_params: templateParams,
        },
      });

      if (whatsappError) {
        console.error('[notificar-status-assistencia] Erro ao enviar WhatsApp:', whatsappError);
      } else {
        console.log('[notificar-status-assistencia] WhatsApp enviado com sucesso');
      }
    } catch (err) {
      console.error('[notificar-status-assistencia] Erro ao invocar whatsapp-send-text:', err);
    }

    // Enviar cartão de contato do prestador se configurado
    if (config.enviar_contato && chamado.prestador_nome && chamado.prestador_telefone) {
      try {
        const { error: contatoError } = await supabase.functions.invoke('whatsapp-send-contact', {
          body: {
            telefone: telefoneAssociado,
            contato: {
              fullName: chamado.prestador_nome,
              phoneNumber: chamado.prestador_telefone.replace(/\D/g, ''),
              organization: 'Prestador PRATICCAR',
            },
            referencia_tipo: 'chamado_assistencia',
            referencia_id: chamado_id,
          },
        });

        if (contatoError) {
          console.error('[notificar-status-assistencia] Erro ao enviar contato:', contatoError);
        } else {
          console.log('[notificar-status-assistencia] Contato do prestador enviado');
        }
      } catch (err) {
        console.error('[notificar-status-assistencia] Erro ao invocar whatsapp-send-contact:', err);
      }
    }

    // Criar notificação no sistema também
    if (chamado.associado?.user_id) {
      await supabase.from('notificacoes').insert({
        user_id: chamado.associado.user_id,
        titulo: config.titulo,
        mensagem: mensagem.replace(/\*/g, '').replace(/\n/g, ' ').substring(0, 200),
        tipo: 'info',
        categoria: 'assistencia',
        referencia_tipo: 'chamado_assistencia',
        referencia_id: chamado_id,
        link: `/app/assistencia/${chamado_id}`,
        lida: false,
        canal_sistema: true,
        canal_whatsapp: true,
      });
    }

    console.log(`[notificar-status-assistencia] Notificação enviada para status ${status_novo}`);

    return new Response(
      JSON.stringify({
        success: true,
        status_notificado: status_novo,
        telefone_destino: telefoneAssociado.substring(0, 4) + '****',
        contato_enviado: !!config.enviar_contato,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('[notificar-status-assistencia] Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
