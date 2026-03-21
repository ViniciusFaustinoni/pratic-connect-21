import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * CRON: Confirmação Matinal de Serviços via WhatsApp
 * Executa às 7h (dias úteis) ou 8h (sábados) - dispara mensagem para TODOS
 * os clientes com serviço agendado para o dia (vistoria, instalação, manutenção, remoção)
 * 
 * Fluxo:
 * 1. Busca todos os serviços do dia com status 'agendada' ou 'pendente'
 * 2. Envia mensagem de confirmação via WhatsApp
 * 3. Marca confirmacao_whatsapp = 'aguardando_confirmacao_manha'
 * 4. Cria registro em confirmacoes_agendamento
 * 
 * O cliente precisa responder "SIM" para que o serviço seja atribuído
 * automaticamente ao profissional mais próximo.
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[confirmar-manha-cron] Iniciando disparo matinal de confirmação...");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Obter data/hora atual em Brasília
    const agora = new Date();
    const agoraBrasilia = new Date(agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const hojeStr = agoraBrasilia.toISOString().split('T')[0];
    const horaAtual = agoraBrasilia.getHours();
    const diaSemana = agoraBrasilia.getDay(); // 0 = domingo, 6 = sábado

    console.log(`[confirmar-manha-cron] Data: ${hojeStr}, Hora: ${horaAtual}h, Dia: ${diaSemana}`);

    // Não executar aos domingos
    if (diaSemana === 0) {
      console.log("[confirmar-manha-cron] Domingo - sem serviços");
      return new Response(
        JSON.stringify({ success: true, message: "Domingo - sem serviços", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar TODOS os serviços agendados para HOJE que ainda não receberam confirmação
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
        associado:associados!associado_id(id, nome, telefone, whatsapp),
        cotacao:cotacoes(id, nome, telefone)
      `)
      .eq('data_agendada', hojeStr)
      .in('status', ['agendada', 'pendente'])
      .is('confirmacao_whatsapp', null); // Ainda não entrou no fluxo de confirmação

    if (servicosError) {
      console.error("[confirmar-manha-cron] Erro ao buscar serviços:", servicosError);
      throw servicosError;
    }

    console.log(`[confirmar-manha-cron] Encontrados ${servicos?.length || 0} serviços para confirmar`);

    if (!servicos || servicos.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Nenhum serviço para confirmar", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resultados: { servicoId: string; tipo: string; sucesso: boolean; erro?: string }[] = [];

    for (const servico of servicos) {
      try {
        // Determinar telefone do cliente
        let telefone: string | null = null;
        let nomeCliente: string = "Cliente";

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
          console.log(`[confirmar-manha-cron] Serviço ${servico.id} (${servico.tipo}): telefone não encontrado`);
          resultados.push({ servicoId: servico.id, tipo: servico.tipo, sucesso: false, erro: "Telefone não encontrado" });
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
        const horaFormatada = servico.hora_agendada?.slice(0, 5) || servico.periodo || "a confirmar";

        // Formatar data
        const dataObj = new Date(servico.data_agendada + 'T12:00:00');
        const dataFormatada = dataObj.toLocaleDateString('pt-BR', {
          weekday: 'long',
          day: '2-digit',
          month: '2-digit'
        });

        // Tipo de serviço formatado (mensagem longa)
        const tipoServicoDescritivo = servico.tipo === 'instalacao' ? 'instalação do rastreador' : 
                           servico.tipo === 'vistoria' ? 'vistoria veicular' : 
                           servico.tipo === 'remocao' ? 'remoção do rastreador' :
                           servico.tipo === 'manutencao' ? 'manutenção do rastreador' : 'serviço';

        // Label curto para template Meta
        const tipoLabel = servico.tipo === 'instalacao' ? 'instalação' : 
                          servico.tipo === 'vistoria' ? 'vistoria' : 
                          servico.tipo === 'remocao' ? 'remoção' :
                          servico.tipo === 'manutencao' ? 'manutenção' : 'serviço';

        // Período formatado para template
        const periodoLabel = servico.periodo === 'manha' ? 'pela manhã' : 
                            servico.periodo === 'tarde' ? 'pela tarde' : 
                            horaFormatada !== 'a confirmar' ? `às ${horaFormatada}` : 'hoje';

        // Montar mensagem de confirmação matinal (fallback texto livre)
        const mensagem = `Bom dia, *${nomeCliente.split(' ')[0]}*! ☀️

Lembramos que sua *${tipoServicoDescritivo}* está agendada para *HOJE*:

📅 ${dataFormatada}
🕐 ${horaFormatada}
📍 ${endereco}

Por favor, confirme sua disponibilidade:
✅ Responda *SIM* para confirmar
📅 Ou informe se precisa *reagendar*

Aguardamos sua confirmação! 🚗
*PRATIC Proteção Veicular*`;

        const nomeAbrev = nomeCliente.split(' ')[0];

        // Enviar mensagem via whatsapp-send-text
        const { data: sendResult, error: sendError } = await supabase.functions.invoke('whatsapp-send-text', {
          body: {
            telefone: telefoneFormatado,
            mensagem,
            template_name: 'confirmacao_servico_v1',
            template_params: [nomeAbrev, tipoLabel, periodoLabel],
            fallback_template: 'sinistro_atualizado',
            fallback_params: [nomeAbrev, tipoLabel, `${tipoLabel} agendada para hoje. Confirme sua presença.`],
          }
        });

        if (sendError) {
          console.error(`[confirmar-manha-cron] Erro ao enviar para ${telefoneFormatado}:`, sendError);
          resultados.push({ servicoId: servico.id, tipo: servico.tipo, sucesso: false, erro: sendError.message });
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
            nome_tecnico: (servico.profissional as any)?.nome || 'Técnico',
            disparo_matinal: true,
            hora_disparo: horaAtual
          }
        });

        // Atualizar serviço com novo status de confirmação matinal
        await supabase
          .from('servicos')
          .update({ confirmacao_whatsapp: 'aguardando_confirmacao_manha' })
          .eq('id', servico.id);

        console.log(`[confirmar-manha-cron] ✅ Confirmação enviada para ${telefoneFormatado} (${servico.tipo} - ${servico.id})`);
        resultados.push({ servicoId: servico.id, tipo: servico.tipo, sucesso: true });

      } catch (err: any) {
        console.error(`[confirmar-manha-cron] Erro no serviço ${servico.id}:`, err);
        resultados.push({ servicoId: servico.id, tipo: servico.tipo, sucesso: false, erro: err.message });
      }
    }

    const sucessos = resultados.filter(r => r.sucesso).length;
    const falhas = resultados.filter(r => !r.sucesso).length;

    console.log(`[confirmar-manha-cron] Concluído: ${sucessos} enviadas, ${falhas} falhas`);

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
    console.error("[confirmar-manha-cron] Erro geral:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});