import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getConfiguracaoNumero } from "../_shared/config-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * CRON: Expirar confirmações de agendamento não respondidas
 * Verifica confirmações pendentes (aguardando_confirmacao_manha / aguardando_confirmacao_encaixe)
 * e, se ultrapassado o prazo configurável, marca como expirada e notifica o associado.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[cron-expirar-confirmacoes] Iniciando verificação...");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Ler prazo configurável (padrão: 4 horas)
    const prazoHoras = await getConfiguracaoNumero(supabase, 'prazo_confirmacao_agendamento_horas', 4);
    console.log(`[cron-expirar-confirmacoes] Prazo configurado: ${prazoHoras}h`);

    // 2. Calcular threshold
    const agora = new Date();
    const threshold = new Date(agora.getTime() - prazoHoras * 60 * 60 * 1000);

    // 3. Buscar confirmações pendentes que ultrapassaram o prazo
    const { data: pendentes, error: pendentesError } = await supabase
      .from('confirmacoes_agendamento')
      .select('id, servico_id, telefone, status, mensagem_enviada_em, contexto_ia')
      .in('status', ['enviada', 'aguardando_confirmacao_manha', 'aguardando_confirmacao_encaixe', 'aguardando_confirmacao_vespera'])
      .lt('mensagem_enviada_em', threshold.toISOString());

    if (pendentesError) {
      console.error("[cron-expirar-confirmacoes] Erro ao buscar pendentes:", pendentesError);
      throw pendentesError;
    }

    console.log(`[cron-expirar-confirmacoes] Encontradas ${pendentes?.length || 0} confirmações expiradas`);

    if (!pendentes || pendentes.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Nenhuma confirmação expirada", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resultados: { id: string; sucesso: boolean; erro?: string }[] = [];

    for (const conf of pendentes) {
      try {
        // Buscar dados do serviço
        const { data: servico } = await supabase
          .from('servicos')
          .select('id, tipo, data_agendada, hora_agendada, status, confirmacao_whatsapp')
          .eq('id', conf.servico_id)
          .maybeSingle();

        if (!servico) {
          console.log(`[cron-expirar-confirmacoes] Serviço ${conf.servico_id} não encontrado, pulando`);
          resultados.push({ id: conf.id, sucesso: false, erro: 'Serviço não encontrado' });
          continue;
        }

        // Pular se serviço já foi confirmado/cancelado por outro fluxo
        if (servico.confirmacao_whatsapp === 'confirmada' || servico.status === 'cancelada') {
          console.log(`[cron-expirar-confirmacoes] Serviço ${servico.id} já tratado (${servico.confirmacao_whatsapp}/${servico.status})`);
          // Apenas atualizar a confirmação
          await supabase
            .from('confirmacoes_agendamento')
            .update({ status: 'expirada' })
            .eq('id', conf.id);
          resultados.push({ id: conf.id, sucesso: true });
          continue;
        }

        // Atualizar serviço como expirado
        await supabase
          .from('servicos')
          .update({
            confirmacao_whatsapp: 'expirada',
            status: 'cancelada',
          })
          .eq('id', conf.servico_id);

        // Atualizar confirmação
        await supabase
          .from('confirmacoes_agendamento')
          .update({ status: 'expirada' })
          .eq('id', conf.id);

        // Montar dados para mensagem
        const ctx = conf.contexto_ia as any;
        const nomeCliente = ctx?.nome_cliente || 'Cliente';
        const tipoServico = servico.tipo === 'instalacao' ? 'instalação'
          : servico.tipo === 'vistoria' ? 'vistoria'
          : servico.tipo === 'remocao' ? 'remoção' : 'serviço';
        const dataFormatada = servico.data_agendada || 'agendada';

        // Enviar WhatsApp informando expiração
        if (conf.telefone) {
          const mensagem = `Olá, *${nomeCliente.split(' ')[0]}*! 👋

Informamos que seu agendamento de *${tipoServico}* para o dia *${dataFormatada}* não foi confirmado dentro do prazo.

O agendamento foi *cancelado automaticamente*.

Para reagendar, entre em contato conosco:
📞 Ligue ou envie mensagem por aqui mesmo.

Estamos à disposição! 🚗`;

          await supabase.functions.invoke('whatsapp-send-text', {
            body: {
              telefone: conf.telefone,
              mensagem,
              template_name: 'notificacao_geral_v1',
              template_params: [
                nomeCliente.split(' ')[0],
                `Seu agendamento de ${tipoServico} para ${dataFormatada} não foi confirmado no prazo e foi cancelado. Entre em contato para reagendar.`
              ],
            }
          });

          console.log(`[cron-expirar-confirmacoes] ✅ Notificação de expiração enviada para ${conf.telefone} (serviço ${servico.id})`);
        }

        // Criar notificação interna para coordenador
        await supabase.from('notificacoes').insert({
          tipo: 'alerta',
          titulo: `Confirmação expirada - ${tipoServico}`,
          mensagem: `O associado ${nomeCliente} não confirmou o agendamento de ${tipoServico} para ${dataFormatada} dentro do prazo de ${prazoHoras}h. Serviço cancelado automaticamente.`,
          destino_perfil: 'coordenador_vistoria',
          dados: { servico_id: servico.id, tipo: servico.tipo },
        });

        resultados.push({ id: conf.id, sucesso: true });
      } catch (err: any) {
        console.error(`[cron-expirar-confirmacoes] Erro ao processar ${conf.id}:`, err);
        resultados.push({ id: conf.id, sucesso: false, erro: err.message });
      }
    }

    const sucessos = resultados.filter(r => r.sucesso).length;
    const falhas = resultados.filter(r => !r.sucesso).length;

    console.log(`[cron-expirar-confirmacoes] Concluído: ${sucessos} expiradas, ${falhas} falhas`);

    return new Response(
      JSON.stringify({ success: true, expiradas: sucessos, falhas, detalhes: resultados }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[cron-expirar-confirmacoes] Erro geral:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
