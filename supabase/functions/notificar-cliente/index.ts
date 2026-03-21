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
    titulo: '🛡️ Proteção 360º Ativada!',
    mensagem: `Parabéns {nome}! Seu veículo *{placa}* agora está com *PROTEÇÃO 360º* ativa! ✅

*O que está incluso na sua cobertura:*
🔐 Roubo e Furto
💥 Colisão
🔥 Incêndio
🌧️ Fenômenos Naturais
🚗 Assistência 24h (guincho, pane seca, chaveiro e mais)
📍 Rastreamento em tempo real

Acesse o App PRATIC para acompanhar seu veículo e solicitar assistência quando precisar.

Bem-vindo à família PRATIC! 💙`,
    emailTemplate: 'generico',
  },
  documentos_solicitados: {
    titulo: '📄 Documentação Pendente',
    mensagem: `Olá {nome}! Para dar continuidade à sua filiação na PRATIC, precisamos dos seguintes documentos:

{documentos}

{observacoes}

📲 *Envie agora mesmo pelo link:*
🔗 {link_acompanhamento}

⏰ Você tem *7 dias* para enviar. Após esse prazo, a solicitação pode ser cancelada.

Qualquer dúvida, responda esta mensagem!`,
    emailTemplate: 'generico',
  },
  documento_aprovado: {
    titulo: '✅ Documento Aprovado',
    mensagem: 'Olá {nome}! O documento "{tipo_documento}" foi aprovado com sucesso. {mensagem_adicional}',
    emailTemplate: 'generico',
  },
  documento_reprovado: {
    titulo: '⚠️ Documento Precisa de Ajuste',
    mensagem: 'Olá {nome}! O documento "{tipo_documento}" precisa ser reenviado. Motivo: {motivo}. Acesse o link de acompanhamento para enviar novamente.',
    emailTemplate: 'generico',
  },
  cadastro_aprovado: {
    titulo: '🎉 Cadastro Aprovado!',
    mensagem: 'Parabéns {nome}! Seu cadastro foi aprovado. Em breve entraremos em contato para agendar a instalação do rastreador e ativar sua proteção. Bem-vindo à PRATIC!',
    emailTemplate: 'generico',
  },
  lembrete_documentos: {
    titulo: '📋 Lembrete: Documentos Pendentes',
    mensagem: 'Olá {nome}! Lembramos que ainda aguardamos o envio dos documentos: {documentos}. Acesse o link de acompanhamento para enviar. Faltam {dias_restantes} dias para o prazo.',
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
  proposta_aprovada_roubo_furto: {
    titulo: '🎉 Bem-vindo à PRATIC!',
    mensagem: `Parabéns {nome}! Seu cadastro foi aprovado! 🚗

📋 *Veículo Protegido:*
{placa} - {marca} {modelo}

🛡️ *Cobertura Ativa:* Roubo e Furto
⏳ *Próximo Passo:* Instalação do rastreador

📱 Acesse o link abaixo para criar sua conta no app PRATIC:
🔗 {link_acompanhamento}

Após a instalação, sua *Proteção 360º* será ativada automaticamente!

Para qualquer dúvida sobre sua cobertura, você pode falar com nossa IA diretamente pelo app ou por aqui no WhatsApp! 🤖

Bem-vindo à família PRATIC! 💙`,
    emailTemplate: 'generico',
  },
  proposta_aprovada_cobertura_total: {
    titulo: '🎉 Bem-vindo à PRATIC!',
    mensagem: `Parabéns {nome}! Seu cadastro foi aprovado! 🚗

📋 *Veículo Protegido:*
{placa} - {marca} {modelo}

🛡️ *Cobertura Ativa:* Proteção 360º (Roubo, Furto, Colisão, Incêndio e mais)

✅ *Próximo Passo:* Crie sua senha e acesse o App PRATIC

📱 Acesse o link abaixo para criar sua conta:
🔗 {link_acompanhamento}

Para qualquer dúvida sobre sua cobertura, assistência 24h ou sinistros, você pode falar com nossa IA diretamente pelo app ou por aqui no WhatsApp! 🤖

Bem-vindo à família PRATIC! 💙`,
    emailTemplate: 'generico',
  },
  tecnico_em_rota: {
    titulo: '🚗 Técnico a Caminho!',
    mensagem: `Olá {nome}! Nosso técnico está a caminho do seu endereço para realizar a {tipo_servico}.

👤 *Técnico:* {tecnico_nome}
📞 *Contato:* {tecnico_telefone}
💬 *WhatsApp:* {tecnico_whatsapp_link}
📍 *Endereço:* {endereco}
⏰ *Período:* {periodo}

Você pode entrar em contato com o técnico se precisar de mais informações!`,
    emailTemplate: 'generico',
  },
  veiculo_negado_orientacoes: {
    titulo: '📋 Atualização sobre seu veículo',
    mensagem: `Olá {nome}! 😊

Passamos para te atualizar sobre a avaliação do seu veículo *{placa}*.

Nosso técnico identificou uma pendência que precisa ser resolvida antes de seguirmos com a proteção:

{orientacoes_resolucao}

✅ *Como prosseguir:*
Assim que resolver, você pode fazer uma *nova cotação* pelo nosso app ou entrando em contato conosco. Como os valores de proteção são atualizados mensalmente com base na tabela FIPE, será necessário gerar uma nova cotação — e pode ser até mais vantajoso! 💰

Estamos aqui para te ajudar. Qualquer dúvida, é só responder esta mensagem! 💙`,
    emailTemplate: 'generico',
  },
  followup_recusa_dia3: {
    titulo: '💙 Ainda estamos aqui para te ajudar!',
    mensagem: `Olá {nome}! 😊

Vimos que ainda não retornou sobre a pendência do seu veículo *{placa}*.

Sabemos que pode parecer complicado, mas estamos aqui para te ajudar! Lembre-se:

{orientacoes_resolucao}

Quando estiver pronto, faça uma *nova cotação* pelo app ou fale conosco. Queremos te ver protegido! 🛡️`,
    emailTemplate: 'generico',
  },
  followup_recusa_dia7: {
    titulo: '🛡️ Sua proteção está esperando por você!',
    mensagem: `Olá {nome}!

Sua proteção veicular está esperando por você! 🚗

Já resolveu a pendência do veículo *{placa}*? Se sim, é só fazer uma nova cotação pelo app ou falar com a gente.

Estamos torcendo para te ver protegido em breve! 💙`,
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

    // 2. Enviar por WhatsApp usando whatsapp-send-text
    const telefone = associado.whatsapp || associado.telefone;
    if (telefone) {
      try {
        const whatsappMsg = `${titulo}\n\n${mensagem}`;
        const telefoneLimpo = telefone.replace(/\D/g, '');

        // Verificar se provedor Meta está ativo para usar templates
        const { data: metaConfig } = await supabase
          .from('whatsapp_meta_config')
          .select('ativo')
          .limit(1)
          .maybeSingle();

        const isMetaAtivo = metaConfig?.ativo === true;

        // Buscar link_token do contrato ativo para URL do botão
        const { data: contratoLink } = await supabase
          .from('contratos')
          .select('link_token')
          .eq('associado_id', associado.id)
          .in('status', ['ativo', 'assinado', 'pendente_assinatura'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const linkToken = contratoLink?.link_token || null;
        console.log(`[notificar-cliente] linkToken para botão: ${linkToken} (contrato encontrado: ${!!contratoLink})`);

        // Mapear tipos de notificação para templates aprovados da Meta
        // REGRA: cadastro_aprovado_botao usa 5 body params + 1 button param (link_token)
        // O botão URL é /acompanhar/{{1}} → {{1}} DEVE ser contratos.link_token
        const META_TEMPLATE_MAP: Record<string, { template_name: string; getParams: () => string[]; getButtonParams?: () => string[] | null }> = {
          cadastro_aprovado: {
            template_name: 'cadastro_aprovado_botao',
            getParams: () => {
              const placa = (dados?.placa as string) || 'N/A';
              const marcaModelo = [dados?.marca, dados?.modelo].filter(Boolean).join(' ') || 'seu veículo';
              const cobertura = (dados?.cobertura as string) || 'Roubo e Furto';
              return [primeiroNome, placa, marcaModelo, cobertura, 'Instalação do rastreador'];
            },
            getButtonParams: () => linkToken ? [linkToken] : null,
          },
          proposta_aprovada_roubo_furto: {
            template_name: 'cadastro_aprovado_botao',
            getParams: () => {
              const placa = (dados?.placa as string) || 'N/A';
              const marcaModelo = [dados?.marca, dados?.modelo].filter(Boolean).join(' ') || 'seu veículo';
              return [primeiroNome, placa, marcaModelo, 'Roubo e Furto', 'Instalação do rastreador'];
            },
            getButtonParams: () => linkToken ? [linkToken] : null,
          },
          proposta_aprovada_cobertura_total: {
            template_name: 'cadastro_aprovado_botao',
            getParams: () => {
              const placa = (dados?.placa as string) || 'N/A';
              const marcaModelo = [dados?.marca, dados?.modelo].filter(Boolean).join(' ') || 'seu veículo';
              return [primeiroNome, placa, marcaModelo, 'Proteção 360º', 'Instalação do rastreador'];
            },
            getButtonParams: () => linkToken ? [linkToken] : null,
          },
          cobertura_total_ativada: {
            template_name: 'cobertura_total_ativada',
            getParams: () => {
              const placa = (dados?.placa as string) || 'N/A';
              const marcaModelo = [dados?.marca, dados?.modelo].filter(Boolean).join(' ') || 'seu veículo';
              return [primeiroNome, placa, marcaModelo];
            },
          },
          vistoria_aprovada: {
            template_name: 'cadastro_aprovado_botao',
            getParams: () => {
              const placa = (dados?.placa as string) || 'N/A';
              const marcaModelo = [dados?.marca, dados?.modelo].filter(Boolean).join(' ') || 'seu veículo';
              const cobertura = (dados?.cobertura as string) || 'Roubo e Furto';
              return [primeiroNome, placa, marcaModelo, cobertura, 'Aguardando instalação'];
            },
            getButtonParams: () => linkToken ? [linkToken] : null,
          },
          instalacao_concluida: {
            template_name: 'cadastro_aprovado_botao',
            getParams: () => {
              const placa = (dados?.placa as string) || 'N/A';
              const marcaModelo = [dados?.marca, dados?.modelo].filter(Boolean).join(' ') || 'seu veículo';
              return [primeiroNome, placa, marcaModelo, 'Proteção 360º', 'Proteção ativa!'];
            },
            getButtonParams: () => linkToken ? [linkToken] : null,
          },
          // Técnico a caminho → tecnico_a_caminho (7 params)
          tecnico_em_rota: {
            template_name: 'tecnico_a_caminho_1',
            getParams: () => [
              primeiroNome,
              (dados?.tecnico_nome as string) || 'Técnico PRATIC',
              (dados?.tecnico_telefone as string) || '',
              (dados?.tecnico_whatsapp_link as string) || '',
              (dados?.endereco as string) || 'Endereço a confirmar',
              (dados?.periodo as string) || 'A confirmar',
            ],
          },
          instalacao_agendada: {
            template_name: 'notificacao_geral_v1',
            getParams: () => {
              // Formatar data de ISO (2026-03-12) para dd/MM/yyyy
              let dataFormatada = 'em breve';
              const dataRaw = dados?.data as string;
              if (dataRaw && /^\d{4}-\d{2}-\d{2}/.test(dataRaw)) {
                const [ano, mes, dia] = dataRaw.split('-');
                dataFormatada = `${dia}/${mes}/${ano}`;
              } else if (dataRaw) {
                dataFormatada = dataRaw;
              }
              return [
                primeiroNome,
                'instalação',
                `Sua instalação foi agendada para ${dataFormatada}. Período: ${(dados?.periodo as string) || 'A confirmar'}. Nosso técnico entrará em contato!`,
              ];
            },
          },
          assistencia_prestador_acionado: {
            template_name: 'assistencia_confirmada',
            getParams: () => {
              // Validar que previsao é numérico
              let previsao = (dados?.previsao as string) || '30';
              if (/^\d{4}-\d{2}/.test(previsao) || isNaN(Number(previsao))) {
                console.warn(`[notificar-cliente] previsao inválida "${previsao}", usando fallback 30`);
                previsao = '30';
              }
              return [
                primeiroNome,
                (dados?.prestador_nome as string) || 'Prestador',
                previsao,
              ];
            },
          },
          // Documentação → documentacao_pendente ({{1}} nome, {{2}} documentos)
          documentos_solicitados: {
            template_name: 'documentacao_pendente',
            getParams: () => [
              primeiroNome,
              (dados?.documentos as string) || 'documentos pendentes',
            ],
          },
          lembrete_documentos: {
            template_name: 'documentacao_pendente',
            getParams: () => [
              primeiroNome,
              (dados?.documentos as string) || 'documentos pendentes',
            ],
          },
          // Vistoria → notificacao_geral_v1
          vistoria_reprovada: {
            template_name: 'notificacao_geral_v1',
            getParams: () => [
              primeiroNome,
              'vistoria',
              (dados?.motivo as string) || 'Vistoria não aprovada. Entre em contato para mais informações.',
            ],
          },
          vistoria_nova_tentativa: {
            template_name: 'notificacao_geral_v1',
            getParams: () => [
              primeiroNome,
              'vistoria',
              (dados?.motivo as string) || 'Sua vistoria precisa de ajustes. Realize uma nova pelo app.',
            ],
          },
          // Documento → sinistro_atualizado / documentacao_pendente
          documento_aprovado: {
            template_name: 'sinistro_atualizado',
            getParams: () => [
              primeiroNome,
              'documento',
              `O documento "${(dados?.tipo_documento as string) || ''}" foi aprovado com sucesso.`,
            ],
          },
          documento_reprovado: {
            template_name: 'documentacao_pendente',
            getParams: () => [
              primeiroNome,
              (dados?.tipo_documento as string) || 'documento pendente',
            ],
          },
          // Status → sinistro_atualizado
          status_atualizado: {
            template_name: 'sinistro_atualizado',
            getParams: () => [
              primeiroNome,
              'cadastro',
              `Seu cadastro foi atualizado. Status: ${(dados?.status as string) || 'atualizado'}.`,
            ],
          },
          // Veículo negado / followups → sinistro_atualizado
          veiculo_negado_orientacoes: {
            template_name: 'sinistro_atualizado',
            getParams: () => [
              primeiroNome,
              'avaliação',
              (dados?.orientacoes_resolucao as string)?.substring(0, 200) || 'Pendência identificada no veículo. Resolva e faça uma nova cotação.',
            ],
          },
          followup_recusa_dia3: {
            template_name: 'sinistro_atualizado',
            getParams: () => [
              primeiroNome,
              'avaliação',
              'Ainda não retornou sobre a pendência do seu veículo. Estamos aqui para ajudar!',
            ],
          },
          followup_recusa_dia7: {
            template_name: 'sinistro_atualizado',
            getParams: () => [
              primeiroNome,
              'proteção',
              'Sua proteção veicular está esperando por você! Resolva a pendência e faça uma nova cotação.',
            ],
          },
        };

        let sendBody: Record<string, unknown> = {
          telefone: telefoneLimpo,
          mensagem: whatsappMsg,
        };

        // Se Meta ativo, SEMPRE usar template (obrigatório)
        if (isMetaAtivo && META_TEMPLATE_MAP[tipo]) {
          const mapping = META_TEMPLATE_MAP[tipo];
          sendBody.template_name = mapping.template_name;
          sendBody.template_params = mapping.getParams();
          
          // Enviar button params explicitamente se disponível
          if (mapping.getButtonParams) {
            const btnParams = mapping.getButtonParams();
            if (btnParams) {
              sendBody.template_button_params = btnParams;
              console.log(`[notificar-cliente] template_button_params: ${JSON.stringify(btnParams)}`);
            } else {
              console.warn(`[notificar-cliente] ⚠️ Sem link_token para botão do template '${mapping.template_name}'. Botão pode não funcionar.`);
            }
          }
          
          console.log(`[notificar-cliente] Usando template Meta '${mapping.template_name}' para tipo '${tipo}'`);
        } else if (isMetaAtivo) {
          // Fallback: usar sinistro_atualizado como template genérico
          console.warn(`[notificar-cliente] ⚠️ Meta ativo mas sem template específico para tipo '${tipo}'. Usando sinistro_atualizado como fallback.`);
          sendBody.template_name = 'sinistro_atualizado';
          sendBody.template_params = [primeiroNome, tipo, titulo.replace(/[^\w\s]/g, '').substring(0, 200)];
        }

        const { data: whatsResult, error: whatsError } = await supabase.functions.invoke('whatsapp-send-text', {
          body: sendBody,
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