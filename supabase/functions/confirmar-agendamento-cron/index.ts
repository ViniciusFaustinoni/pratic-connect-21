import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * CRON: Enviar confirmações de agendamento via WhatsApp
 * Executa a cada minuto e busca serviços agendados para ~1h à frente
 * Envia mensagem de confirmação para o cliente
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[confirmar-agendamento-cron] Iniciando verificação...");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Obter data/hora atual em Brasília
    const agora = new Date();
    const agoraBrasilia = new Date(agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    
    // Janela de 55-65 minutos à frente (para pegar ~1h)
    const windowStart = new Date(agoraBrasilia.getTime() + 55 * 60 * 1000);
    const windowEnd = new Date(agoraBrasilia.getTime() + 65 * 60 * 1000);
    
    const hojeStr = agoraBrasilia.toISOString().split('T')[0];
    const horaStart = windowStart.toTimeString().slice(0, 8);
    const horaEnd = windowEnd.toTimeString().slice(0, 8);

    console.log(`[confirmar-agendamento-cron] Data: ${hojeStr}, Janela: ${horaStart} - ${horaEnd}`);

    // Buscar serviços agendados para ~1h à frente
    const { data: servicos, error: servicosError } = await supabase
      .from('servicos')
      .select(`
        id,
        tipo,
        data_agendada,
        hora_agendada,
        periodo,
        profissional_id,
        associado_id,
        contrato_id,
        cotacao_id,
        confirmacao_whatsapp,
        logradouro,
        numero,
        bairro,
        cidade,
        uf,
        profissional:profiles!profissional_id(nome),
        associado:associados(id, nome, telefone, whatsapp),
        cotacao:cotacoes(id, nome, telefone)
      `)
      .eq('data_agendada', hojeStr)
      .in('status', ['agendada', 'em_rota'])
      .is('confirmacao_whatsapp', null)
      .gte('hora_agendada', horaStart)
      .lte('hora_agendada', horaEnd);

    if (servicosError) {
      console.error("[confirmar-agendamento-cron] Erro ao buscar serviços:", servicosError);
      throw servicosError;
    }

    console.log(`[confirmar-agendamento-cron] Encontrados ${servicos?.length || 0} serviços para confirmar`);

    if (!servicos || servicos.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Nenhum serviço para confirmar", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resultados: { servicoId: string; sucesso: boolean; erro?: string }[] = [];

    for (const servico of servicos) {
      try {
        // Determinar telefone do cliente
        let telefone: string | null = null;
        let nomeCliente: string = "Cliente";

        // O select retorna objeto quando é FK singular
        const associadoData = servico.associado as any;
        const cotacaoData = servico.cotacao as any;

        if (associadoData) {
          telefone = associadoData.whatsapp || associadoData.telefone;
          nomeCliente = associadoData.nome || "Cliente";
        } else if (cotacaoData) {
          telefone = cotacaoData.telefone;
          nomeCliente = cotacaoData.nome || "Cliente";
        }

        if (!telefone) {
          console.log(`[confirmar-agendamento-cron] Serviço ${servico.id}: telefone não encontrado`);
          resultados.push({ servicoId: servico.id, sucesso: false, erro: "Telefone não encontrado" });
          continue;
        }

        // Formatar telefone
        const telefoneFormatado = telefone.replace(/\D/g, "");
        
        // Montar endereço
        const endereco = [
          servico.logradouro,
          servico.numero,
          servico.bairro,
          servico.cidade
        ].filter(Boolean).join(", ") || "endereço agendado";

        // Formatar horário
        const horaFormatada = servico.hora_agendada?.slice(0, 5) || servico.periodo;

        // Nome do técnico
        const nomeTecnico = (servico.profissional as any)?.nome || "Técnico";

        // Tipo de serviço
        const tipoServico = servico.tipo === 'instalacao' ? 'instalação do rastreador' : 
                           servico.tipo === 'vistoria' ? 'vistoria veicular' : 
                           servico.tipo === 'remocao' ? 'remoção do rastreador' : 'serviço';

        // Montar mensagem personalizada
        const mensagem = `Olá, *${nomeCliente.split(' ')[0]}*! 👋

Aqui é a *PRATIC Proteção Veicular*.

Estamos confirmando sua *${tipoServico}* agendada para:
📅 *HOJE* às *${horaFormatada}*
📍 ${endereco}

Nosso técnico *${nomeTecnico}* está a caminho!

✅ Responda *SIM* para confirmar sua presença
📅 Ou diga se precisa *reagendar*

Aguardamos sua confirmação! 🚗`;

        // Enviar mensagem via whatsapp-send-text (com template para Meta API)
        const nomeAbrev = nomeCliente.split(' ')[0];
        const { data: sendResult, error: sendError } = await supabase.functions.invoke('whatsapp-send-text', {
          body: {
            telefone: telefoneFormatado,
            mensagem,
            template_name: 'sinistro_atualizado',
            template_params: [nomeAbrev, 'agendamento', `${tipoServico} agendada para hoje às ${horaFormatada}`],
          }
        });

        if (sendError) {
          console.error(`[confirmar-agendamento-cron] Erro ao enviar para ${telefoneFormatado}:`, sendError);
          resultados.push({ servicoId: servico.id, sucesso: false, erro: sendError.message });
          continue;
        }

        // Criar registro de confirmação
        await supabase.from('confirmacoes_agendamento').insert({
          servico_id: servico.id,
          telefone: telefoneFormatado,
          status: 'enviada',
          mensagem_enviada_em: new Date().toISOString(),
          contexto_ia: {
            nome_cliente: nomeCliente,
            tipo_servico: servico.tipo,
            hora_agendada: servico.hora_agendada,
            endereco,
            nome_tecnico: nomeTecnico
          }
        });

        // Atualizar serviço
        await supabase
          .from('servicos')
          .update({ confirmacao_whatsapp: 'enviada' })
          .eq('id', servico.id);

        console.log(`[confirmar-agendamento-cron] ✅ Confirmação enviada para ${telefoneFormatado} (serviço ${servico.id})`);
        resultados.push({ servicoId: servico.id, sucesso: true });

      } catch (err: any) {
        console.error(`[confirmar-agendamento-cron] Erro no serviço ${servico.id}:`, err);
        resultados.push({ servicoId: servico.id, sucesso: false, erro: err.message });
      }
    }

    const sucessos = resultados.filter(r => r.sucesso).length;
    const falhas = resultados.filter(r => !r.sucesso).length;

    console.log(`[confirmar-agendamento-cron] Concluído: ${sucessos} enviadas, ${falhas} falhas`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        enviadas: sucessos,
        falhas,
        detalhes: resultados
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[confirmar-agendamento-cron] Erro geral:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
