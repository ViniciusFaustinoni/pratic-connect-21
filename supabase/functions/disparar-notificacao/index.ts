import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Templates de notificação por tipo e subtipo
const TEMPLATES: Record<string, Record<string, { titulo: string; mensagem: string; prioridade: string }>> = {
  boleto: {
    gerado: {
      titulo: 'Boleto Disponível',
      mensagem: 'Seu boleto de {mes} no valor de R$ {valor} está disponível para pagamento.',
      prioridade: 'normal'
    },
    vencendo_3d: {
      titulo: 'Boleto Vence em 3 Dias',
      mensagem: 'Seu boleto de R$ {valor} vence em {data}. Evite atrasos!',
      prioridade: 'alta'
    },
    vencendo_1d: {
      titulo: 'Boleto Vence Amanhã',
      mensagem: 'Seu boleto de R$ {valor} vence amanhã ({data}). Pague agora!',
      prioridade: 'alta'
    },
    vencido: {
      titulo: 'Boleto Vencido',
      mensagem: 'Seu boleto de R$ {valor} venceu. Regularize para evitar suspensão.',
      prioridade: 'urgente'
    },
    pago: {
      titulo: '✅ Pagamento Confirmado!',
      mensagem: 'Pagamento de R$ {valor} confirmado com sucesso! Obrigado pela confiança. 🙏',
      prioridade: 'normal'
    }
  },
  cobranca: {
    aviso_atraso: {
      titulo: '⚠️ Cobrança em Atraso',
      mensagem: 'Olá! Sua mensalidade de R$ {valor} está em atraso há {dias_atraso} dias. Regularize para evitar suspensão.',
      prioridade: 'alta'
    },
    suspensao_iminente: {
      titulo: '🚨 Suspensão em 48h',
      mensagem: 'ATENÇÃO: Sua conta será suspensa em 48h por inadimplência. Valor pendente: R$ {valor}. Regularize agora!',
      prioridade: 'urgente'
    },
    suspensao: {
      titulo: '❌ Conta Suspensa',
      mensagem: 'Sua conta foi suspensa por inadimplência. Valor pendente: R$ {valor}. Regularize para reativar sua proteção.',
      prioridade: 'urgente'
    },
    acordo_criado: {
      titulo: '🤝 Acordo Disponível!',
      mensagem: 'Boa notícia! Seu acordo de R$ {valor_acordo} em {parcelas}x de R$ {valor_parcela} foi criado. Primeira parcela: {data_primeira}.',
      prioridade: 'alta'
    },
    parcela_vencendo: {
      titulo: '📅 Parcela do Acordo Vence Amanhã',
      mensagem: 'Lembrete: A parcela {numero}/{total} do seu acordo vence amanhã. Valor: R$ {valor}.',
      prioridade: 'normal'
    },
    parcela_paga: {
      titulo: '✅ Parcela Paga!',
      mensagem: 'Parcela {numero}/{total} do seu acordo foi paga. Valor: R$ {valor}. Continue assim! 💪',
      prioridade: 'normal'
    },
    reativacao: {
      titulo: '🎉 Conta Reativada!',
      mensagem: 'Sua conta foi reativada com sucesso! Sua proteção veicular está ativa novamente.',
      prioridade: 'alta'
    },
    cancelamento: {
      titulo: 'Cancelamento Processado',
      mensagem: 'Olá! Seu cancelamento na Praticcar foi processado. Termo de cancelamento enviado para assinatura. {complemento_boleto}Obrigado por ter sido nosso associado!',
      prioridade: 'alta'
    }
  },
  sinistro: {
    aberto: {
      titulo: 'Sinistro Registrado',
      mensagem: 'Seu sinistro #{protocolo} foi registrado com sucesso. Acompanhe pelo app.',
      prioridade: 'alta'
    },
    doc_aprovado: {
      titulo: 'Documento Aprovado ✓',
      mensagem: 'O documento "{tipo_doc}" do sinistro #{protocolo} foi aprovado.',
      prioridade: 'normal'
    },
    doc_reprovado: {
      titulo: 'Documento Reprovado',
      mensagem: 'O documento "{tipo_doc}" precisa ser reenviado. Motivo: {motivo}',
      prioridade: 'alta'
    },
    nova_mensagem: {
      titulo: 'Nova Mensagem',
      mensagem: 'O analista enviou uma mensagem no sinistro #{protocolo}.',
      prioridade: 'normal'
    },
    vistoria: {
      titulo: 'Vistoria Agendada',
      mensagem: 'Sua vistoria foi agendada para {data} às {hora}.',
      prioridade: 'alta'
    },
    aprovado: {
      titulo: 'Sinistro Aprovado! 🎉',
      mensagem: 'Seu sinistro #{protocolo} foi aprovado! Valor: R$ {valor}',
      prioridade: 'alta'
    },
    negado: {
      titulo: 'Sinistro Negado',
      mensagem: 'Seu sinistro #{protocolo} foi negado. Veja o parecer no app.',
      prioridade: 'alta'
    },
    em_analise: {
      titulo: 'Sinistro em Análise',
      mensagem: 'Todos os documentos foram recebidos. Seu sinistro #{protocolo} está em análise.',
      prioridade: 'normal'
    }
  },
  assistencia: {
    aberto: {
      titulo: 'Chamado Registrado',
      mensagem: 'Seu chamado de {tipo_assistencia} foi registrado. Aguarde o prestador.',
      prioridade: 'alta'
    },
    prestador_caminho: {
      titulo: 'Prestador a Caminho',
      mensagem: 'O prestador está a caminho. Previsão: {tempo} minutos.',
      prioridade: 'alta'
    },
    concluido: {
      titulo: 'Atendimento Concluído',
      mensagem: 'Seu chamado foi concluído. Avalie o atendimento!',
      prioridade: 'normal'
    }
  },
  rastreamento: {
    cerca_virtual: {
      titulo: 'Alerta de Cerca Virtual',
      mensagem: 'Veículo {placa} saiu da cerca "{nome_cerca}" às {hora}.',
      prioridade: 'urgente'
    },
    ignicao: {
      titulo: 'Ignição Fora do Horário',
      mensagem: 'Veículo {placa} foi ligado às {hora} fora do horário configurado.',
      prioridade: 'alta'
    },
    velocidade: {
      titulo: 'Alerta de Velocidade',
      mensagem: 'Veículo {placa} atingiu {velocidade} km/h.',
      prioridade: 'alta'
    },
    bateria_baixa: {
      titulo: 'Bateria Baixa',
      mensagem: 'A bateria do rastreador do veículo {placa} está baixa.',
      prioridade: 'normal'
    }
  },
  sistema: {
    boas_vindas: {
      titulo: 'Bem-vindo à PRATIC!',
      mensagem: 'Sua proteção veicular está ativa. Explore o app e conheça seus benefícios.',
      prioridade: 'normal'
    },
    atualizacao: {
      titulo: 'Atualização Disponível',
      mensagem: 'Uma nova versão do app está disponível. Atualize para ter acesso às novidades.',
      prioridade: 'baixa'
    },
    manutencao: {
      titulo: 'Manutenção Programada',
      mensagem: 'O sistema passará por manutenção em {data} das {hora_inicio} às {hora_fim}.',
      prioridade: 'normal'
    }
  }
};

// Substitui placeholders na mensagem
function renderTemplate(template: string, dados: Record<string, unknown>): string {
  let result = template;
  for (const [key, value] of Object.entries(dados)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value ?? ''));
  }
  return result;
}

interface NotificacaoRequest {
  user_id?: string;
  associado_id?: string;
  tipo: 'boleto' | 'cobranca' | 'sinistro' | 'assistencia' | 'rastreamento' | 'sistema';
  subtipo: string;
  dados?: Record<string, unknown>;
  link?: string;
  referencia_tipo?: string;
  referencia_id?: string;
  forcar_envio?: boolean; // Ignora preferências
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: NotificacaoRequest = await req.json();
    const { tipo, subtipo, dados = {}, link, referencia_tipo, referencia_id, forcar_envio } = payload;

    // Buscar user_id se apenas associado_id foi fornecido
    let userId = payload.user_id;
    let associadoId = payload.associado_id;

    if (!userId && associadoId) {
      const { data: assoc } = await supabase
        .from('associados')
        .select('user_id')
        .eq('id', associadoId)
        .single();
      userId = assoc?.user_id;
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'user_id ou associado_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar associado_id se não foi fornecido
    if (!associadoId) {
      const { data: assoc } = await supabase
        .from('associados')
        .select('id')
        .eq('user_id', userId)
        .single();
      associadoId = assoc?.id;
    }

    // Buscar template
    const template = TEMPLATES[tipo]?.[subtipo];
    if (!template) {
      console.error(`[disparar-notificacao] Template não encontrado: ${tipo}/${subtipo}`);
      return new Response(
        JSON.stringify({ error: `Template não encontrado: ${tipo}/${subtipo}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Renderizar título e mensagem
    const titulo = renderTemplate(template.titulo, dados);
    const mensagem = renderTemplate(template.mensagem, dados);

    // Verificar preferências do usuário (se não forçar envio)
    let canaisAtivos = {
      sistema: true,
      push: false,
      whatsapp: false,
      email: false
    };

    if (!forcar_envio && associadoId) {
      const { data: prefs } = await supabase
        .from('notificacoes_preferencias')
        .select('*')
        .eq('associado_id', associadoId)
        .single();

      if (prefs) {
        // Verificar preferência por tipo
        const prefField = tipo === 'boleto' ? 'notif_financeiro' :
                          tipo === 'sinistro' ? 'notif_sinistros' :
                          tipo === 'assistencia' ? 'notif_assistencia' :
                          tipo === 'rastreamento' ? 'notif_rastreamento' : true;

        if (typeof prefField === 'string' && !prefs[prefField]) {
          console.log(`[disparar-notificacao] Notificação ${tipo} desativada pelo usuário`);
          return new Response(
            JSON.stringify({ success: true, skipped: true, reason: 'disabled_by_user' }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        canaisAtivos = {
          sistema: true, // Sempre ativo no app
          push: prefs.push_ativo ?? false,
          whatsapp: prefs.whatsapp_ativo ?? false,
          email: prefs.email_ativo ?? false
        };
      }
    }

    // Determinar ícone baseado no tipo
    const iconeMap: Record<string, string> = {
      boleto: 'receipt',
      sinistro: 'alert-triangle',
      assistencia: 'phone-call',
      rastreamento: 'map-pin',
      sistema: 'info'
    };

    // Inserir notificação na tabela
    const { data: notificacao, error: insertError } = await supabase
      .from('notificacoes')
      .insert({
        user_id: userId,
        titulo,
        mensagem,
        tipo,
        subtipo,
        categoria: tipo,
        prioridade: template.prioridade,
        icone: iconeMap[tipo] || 'bell',
        link,
        referencia_tipo,
        referencia_id,
        dados,
        canal_sistema: true,
        canal_push: canaisAtivos.push,
        canal_whatsapp: canaisAtivos.whatsapp,
        canal_email: canaisAtivos.email,
        lida: false
      })
      .select()
      .single();

    if (insertError) {
      console.error('[disparar-notificacao] Erro ao inserir:', insertError);
      throw insertError;
    }

    const canaisEnviados: string[] = ['sistema'];

    // Enviar por WhatsApp se ativo e configurado
    if (canaisAtivos.whatsapp && template.prioridade !== 'baixa') {
      try {
        // Buscar telefone do associado
        const { data: associado } = await supabase
          .from('associados')
          .select('whatsapp, telefone, nome')
          .eq('id', associadoId)
          .single();

        const telefone = associado?.whatsapp || associado?.telefone;
        if (telefone) {
          await supabase.functions.invoke('enviar-whatsapp', {
            body: {
              telefone,
              mensagem: `*${titulo}*\n\n${mensagem}`,
              tipo: 'notificacao'
            }
          });
          canaisEnviados.push('whatsapp');
        }
      } catch (whatsappError) {
        console.error('[disparar-notificacao] Erro WhatsApp:', whatsappError);
      }
    }

    // Enviar por email se ativo e prioridade alta/urgente
    if (canaisAtivos.email && ['alta', 'urgente'].includes(template.prioridade)) {
      try {
        const { data: associado } = await supabase
          .from('associados')
          .select('email, nome')
          .eq('id', associadoId)
          .single();

        if (associado?.email) {
          await supabase.functions.invoke('enviar-email', {
            body: {
              para: associado.email,
              assunto: titulo,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #333;">${titulo}</h2>
                  <p style="color: #666; font-size: 16px;">${mensagem}</p>
                  ${link ? `<a href="${link}" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 6px;">Ver no App</a>` : ''}
                  <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;">
                  <p style="color: #999; font-size: 12px;">PRATIC - Proteção Veicular</p>
                </div>
              `
            }
          });
          canaisEnviados.push('email');
        }
      } catch (emailError) {
        console.error('[disparar-notificacao] Erro Email:', emailError);
      }
    }

    console.log(`[disparar-notificacao] Notificação ${tipo}/${subtipo} enviada para user ${userId} via: ${canaisEnviados.join(', ')}`);

    return new Response(
      JSON.stringify({
        success: true,
        notificacao_id: notificacao.id,
        canais_enviados: canaisEnviados,
        titulo,
        mensagem
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('[disparar-notificacao] Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
