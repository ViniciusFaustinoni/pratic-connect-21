import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * CRON: Confirmação de Serviços via WhatsApp — Baseado em Turno
 *
 * Disparo MANHÃ (7h Brasília / 10h UTC):
 *   - Busca serviços de HOJE com periodo = 'manha', confirmacao_whatsapp IS NULL, permite_encaixe = false
 *   - Envia template confirmacao_agendamento_v1
 *   - Marca confirmacao_whatsapp = 'aguardando_confirmacao_manha'
 *
 * Disparo TARDE (13h Brasília / 16h UTC):
 *   - Busca serviços de HOJE com periodo = 'tarde', confirmacao_whatsapp IS NULL, permite_encaixe = false
 *   - Envia template confirmacao_agendamento_v1
 *   - Marca confirmacao_whatsapp = 'aguardando_confirmacao_tarde'
 *
 * Encaixes (permite_encaixe=true) NÃO são incluídos — já receberam confirmação na criação.
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Hora atual em Brasília
    const agora = new Date();
    const agoraBrasilia = new Date(agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const horaAtual = agoraBrasilia.getHours();
    const diaSemana = agoraBrasilia.getDay();

    // Aceitar parâmetro explícito ou detectar pela hora
    let body: any = {};
    try { body = await req.json(); } catch { /* sem body */ }
    
    const tipoDisparo: 'manha' | 'tarde' =
      body.tipo_disparo || (horaAtual < 12 ? 'manha' : 'tarde');

    const periodoAlvo = tipoDisparo; // 'manha' ou 'tarde'
    const logPrefix = `[confirmar-${tipoDisparo}]`;

    console.log(`${logPrefix} Iniciando disparo ${tipoDisparo}. Hora Brasília: ${horaAtual}h, Dia: ${diaSemana}`);

    // Não executar aos domingos
    if (diaSemana === 0) {
      return jsonResp({ success: true, message: "Domingo", count: 0 });
    }

    // Data-alvo: HOJE
    const dataAlvo = agoraBrasilia.toISOString().split('T')[0];
    console.log(`${logPrefix} Data alvo: ${dataAlvo}, período: ${periodoAlvo}`);

    // Buscar serviços NORMAIS (não-encaixe) do período, sem confirmação enviada ainda
    const { data: servicos, error: servicosError } = await supabase
      .from('servicos')
      .select(`
        id, tipo, data_agendada, hora_agendada, periodo,
        profissional_id, associado_id, contrato_id, cotacao_id,
        confirmacao_whatsapp, permite_encaixe, logradouro, numero, bairro, cidade, uf,
        profissional:profiles!profissional_id(nome),
        associado:associados!associado_id(id, nome, telefone, whatsapp),
        cotacao:cotacoes!cotacao_id(id, lead:leads!cotacoes_lead_id_fkey(nome, telefone))
      `)
      .eq('data_agendada', dataAlvo)
      .eq('periodo', periodoAlvo)
      .eq('permite_encaixe', false)
      .is('confirmacao_whatsapp', null)
      .in('status', ['agendada', 'pendente']);

    if (servicosError) {
      console.error(`${logPrefix} Erro ao buscar serviços:`, servicosError);
      throw servicosError;
    }

    console.log(`${logPrefix} Encontrados ${servicos?.length || 0} serviços normais do período ${periodoAlvo}`);

    if (!servicos || servicos.length === 0) {
      return jsonResp({ success: true, message: "Nenhum serviço", tipo_disparo: tipoDisparo, count: 0 });
    }

    const templateName = 'confirmacao_agendamento_v1';
    const statusConfirmacao = `aguardando_confirmacao_${tipoDisparo}`;

    const resultados: { servicoId: string; tipo: string; sucesso: boolean; erro?: string }[] = [];

    for (const servico of servicos) {
      try {
        // Telefone do cliente
        let telefone: string | null = null;
        let nomeCliente = "Cliente";

        const associadoData = servico.associado as any;
        const cotacaoData = servico.cotacao as any;

        if (associadoData) {
          telefone = associadoData.whatsapp || associadoData.telefone;
          nomeCliente = associadoData.nome || "Cliente";
        } else if (cotacaoData?.lead) {
          telefone = (cotacaoData.lead as any).telefone;
          nomeCliente = (cotacaoData.lead as any).nome || "Cliente";
        }

        if (!telefone) {
          resultados.push({ servicoId: servico.id, tipo: servico.tipo, sucesso: false, erro: "Telefone não encontrado" });
          continue;
        }

        const telefoneFormatado = telefone.replace(/\D/g, "");

        // Tipo de serviço
        const tipoLabel = servico.tipo === 'instalacao' ? 'instalação'
          : servico.tipo === 'vistoria' ? 'vistoria'
          : servico.tipo === 'remocao' ? 'remoção'
          : servico.tipo === 'manutencao' ? 'manutenção' : 'serviço';

        // Período
        const periodoLabel = periodoAlvo === 'manha' ? 'pela manhã' : 'pela tarde';
        const horaFormatada = servico.hora_agendada?.slice(0, 5) || periodoLabel;

        // Data formatada
        const dataObj = new Date(servico.data_agendada + 'T12:00:00');
        const dataFormatada = dataObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });

        // Endereço
        const endereco = [servico.logradouro, servico.numero, servico.bairro, servico.cidade]
          .filter(Boolean).join(", ") || "endereço agendado";

        const nomeAbrev = nomeCliente.split(' ')[0];
        const param3 = `${periodoLabel}`.trim();

        // Mensagem fallback
        const saudacao = periodoAlvo === 'manha' ? `Bom dia, *${nomeAbrev}*! ☀️` : `Boa tarde, *${nomeAbrev}*! 👋`;
        const mensagem = `${saudacao}

Lembramos que seu(sua) *${tipoLabel}* está agendado(a) para *HOJE* ${periodoLabel}:
📍 ${endereco}

✅ Responda *SIM* para confirmar
📅 Ou informe se precisa *reagendar*

*PRATIC Proteção Veicular*`;

        // Enviar
        const { error: sendError } = await supabase.functions.invoke('whatsapp-send-text', {
          body: {
            telefone: telefoneFormatado,
            mensagem,
            template_name: templateName,
            template_params: [nomeAbrev, tipoLabel, param3],
          }
        });

        if (sendError) {
          resultados.push({ servicoId: servico.id, tipo: servico.tipo, sucesso: false, erro: sendError.message });
          continue;
        }

        // Registro de confirmação
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
            disparo: `turno_${tipoDisparo}`,
          }
        });

        // Atualizar status no serviço
        await supabase.from('servicos')
          .update({ confirmacao_whatsapp: statusConfirmacao })
          .eq('id', servico.id);

        console.log(`${logPrefix} ✅ ${telefoneFormatado} (${servico.tipo} - ${servico.id})`);
        resultados.push({ servicoId: servico.id, tipo: servico.tipo, sucesso: true });

      } catch (err: any) {
        console.error(`${logPrefix} Erro no serviço ${servico.id}:`, err);
        resultados.push({ servicoId: servico.id, tipo: servico.tipo, sucesso: false, erro: err.message });
      }
    }

    const sucessos = resultados.filter(r => r.sucesso).length;
    const falhas = resultados.filter(r => !r.sucesso).length;
    console.log(`${logPrefix} Concluído: ${sucessos} enviadas, ${falhas} falhas`);

    return jsonResp({ success: true, tipo_disparo: tipoDisparo, periodo: periodoAlvo, enviadas: sucessos, falhas, detalhes: resultados });

  } catch (error: any) {
    console.error("[confirmar-cron] Erro geral:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function jsonResp(body: any) {
  return new Response(JSON.stringify(body), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
