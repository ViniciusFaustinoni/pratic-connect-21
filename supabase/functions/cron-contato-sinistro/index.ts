import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getConfiguracaoNumero } from "../_shared/config-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

const TIPO_LABELS: Record<string, string> = {
  colisao: "colisão",
  roubo: "roubo",
  furto: "furto",
  incendio: "incêndio",
  fenomeno_natural: "fenômeno natural",
  vidros: "vidros",
  vandalismo: "vandalismo",
  terceiros: "terceiros",
  alagamento: "alagamento",
  outro: "outro",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const prazoLink = await getConfiguracaoNumero(supabase, 'prazo_link_evento_horas', 72);

    let enviados = 0;
    let erros = 0;
    let totalProcessados = 0;

    // ========== PARTE 1: Processar contatos agendados pendentes ==========
    const { data: agendamentos, error: agError } = await supabase
      .from("sinistro_contatos_agendados")
      .select("*, link:sinistro_evento_links(token)")
      .eq("status", "agendado")
      .lte("agendado_para", new Date().toISOString())
      .limit(20);

    if (agError) {
      console.error("[cron-contato-sinistro] Erro ao buscar agendamentos:", agError);
    }

    if (agendamentos && agendamentos.length > 0) {
      console.log(`[cron-contato-sinistro] ${agendamentos.length} agendamentos pendentes`);

      for (const ag of agendamentos) {
        try {
          // Verificar se é lembrete de retirada — cancelar se OS já foi entregue
          if (ag.tipo === 'lembrete_retirada') {
            const { data: osCheck } = await supabase
              .from('ordens_servico')
              .select('status')
              .eq('sinistro_id', ag.sinistro_id)
              .in('status', ['entregue', 'finalizado'])
              .limit(1);

            if (osCheck && osCheck.length > 0) {
              await supabase
                .from("sinistro_contatos_agendados")
                .update({ status: "cancelado" })
                .eq("id", ag.id);
              console.log(`[cron-contato-sinistro] Lembrete cancelado (veículo já retirado)`);
              continue;
            }
          }

          // Se mensagem_enviada já estiver preenchida, enviar com template genérico
          if (ag.mensagem_enviada && ag.telefone) {
            // Usar sinistro_atualizado como template genérico para mensagens agendadas
            const sendResponse = await fetch(`${supabaseUrl}/functions/v1/whatsapp-send-text`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({
                telefone: ag.telefone,
                mensagem: ag.mensagem_enviada,
                template_name: 'sinistro_atualizado',
                template_params: ['Associado', ag.tipo || 'atualização', ag.mensagem_enviada.substring(0, 200)],
              }),
            });

            const sendResult = await sendResponse.json();
            if (!sendResponse.ok || !sendResult.success) {
              throw new Error(sendResult.error || "Erro ao enviar WhatsApp");
            }

            await supabase
              .from("sinistro_contatos_agendados")
              .update({ status: "enviado", enviado_em: new Date().toISOString() })
              .eq("id", ag.id);

            enviados++;
            console.log(`[cron-contato-sinistro] ✓ Mensagem pré-definida enviada (${ag.tipo || 'contato'})`);
            continue;
          }

          // Buscar sinistro com associado, veículo e plano (fluxo Link 1)
          const { data: sinistro, error: sinError } = await supabase
            .from("sinistros")
            .select(`
              id, protocolo, tipo, data_ocorrencia,
              associado:associados(id, nome, telefone, whatsapp, plano_id),
              veiculo:veiculos(id, placa, marca, modelo, valor_fipe, uso_aplicativo)
            `)
            .eq("id", ag.sinistro_id)
            .single();

          if (sinError || !sinistro) {
            throw new Error(`Sinistro não encontrado: ${ag.sinistro_id}`);
          }

          const associado = sinistro.associado as any;
          const veiculo = sinistro.veiculo as any;

          if (!associado || !veiculo) {
            throw new Error("Dados de associado ou veículo incompletos");
          }

          // Buscar plano
          let planoNome = "Não informado";
          let percentual = 0;
          let minimo = 0;
          let valorCota = 0;

          if (associado.plano_id) {
            const { data: plano } = await supabase
              .from("planos")
              .select("nome, cota_participacao, cota_minima, cota_app_percent, cota_app_min")
              .eq("id", associado.plano_id)
              .single();

            if (plano) {
              planoNome = plano.nome;
              if (veiculo.uso_aplicativo && plano.cota_app_percent) {
                percentual = Number(plano.cota_app_percent);
              minimo = Number(plano.cota_app_min ?? 0);
              } else {
                percentual = Number(plano.cota_participacao ?? 0);
                minimo = Number(plano.cota_minima ?? 0);
              }
            }
          }

          const valorFipe = Number(veiculo.valor_fipe || 0);
          if (valorFipe > 0 && percentual > 0) {
            valorCota = Math.max(valorFipe * percentual / 100, minimo);
          } else {
            valorCota = minimo;
          }

          const categoriaVeiculo = veiculo.uso_aplicativo ? "Aplicativo" : "Passeio";
          const token = (ag.link as any)?.token || "";
          const siteUrl = Deno.env.get("SITE_URL") || "https://pratic-connect-21.lovable.app";

          const tipoLabel = TIPO_LABELS[sinistro.tipo] || sinistro.tipo;
          const mensagem = `Olá, ${associado.nome}! Aqui é a Pratic Car.

Recebemos a comunicação do seu sinistro de ${tipoLabel}.
Protocolo: ${sinistro.protocolo}

Sobre a cota de coparticipação:
Seu plano é ${planoNome} (${categoriaVeiculo}), com cota de ${percentual}% da FIPE.
Valor FIPE do veículo: ${formatCurrency(valorFipe)}
Sua cota de coparticipação: ${formatCurrency(valorCota)}

Próximos passos obrigatórios:
1. Realizar auto vistoria (fotos do veículo)
2. Enviar Boletim de Ocorrência
3. Relato completo do ocorrido

Prazo: você tem 30 dias a partir da data do evento para concluir o processo. O prazo já está correndo, mas fique tranquilo - vamos te auxiliar em tudo!

Já é possível dar entrada no conserto do veículo.

Acesse o link abaixo para completar as etapas:
${siteUrl}/evento/${token}

O link é válido por ${prazoLink} horas.
Em caso de dúvidas, estamos à disposição!`;

          const telefone = associado.whatsapp || associado.telefone;
          if (!telefone) {
            throw new Error("Associado sem telefone/whatsapp");
          }

          const primeiroNomeContato = associado.nome?.split(' ')[0] || 'Associado';
          const sendResponse = await fetch(`${supabaseUrl}/functions/v1/whatsapp-send-text`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              telefone,
              mensagem,
              template_name: 'comunicacao_sinistro',
              template_params: [
                primeiroNomeContato,
                tipoLabel,
                sinistro.protocolo,
                `${planoNome} (${categoriaVeiculo})`,
                `${percentual}% da FIPE`,
                formatCurrency(valorFipe),
                formatCurrency(valorCota),
                `${siteUrl}/evento/${token}`,
              ],
            }),
          });

          const sendResult = await sendResponse.json();
          if (!sendResponse.ok || !sendResult.success) {
            throw new Error(sendResult.error || "Erro ao enviar WhatsApp");
          }

          await supabase
            .from("sinistro_contatos_agendados")
            .update({
              status: "enviado",
              mensagem_enviada: mensagem,
              enviado_em: new Date().toISOString(),
            })
            .eq("id", ag.id);

          enviados++;
          console.log(`[cron-contato-sinistro] ✓ Enviado para ${associado.nome} (${sinistro.protocolo})`);
        } catch (err: any) {
          erros++;
          console.error(`[cron-contato-sinistro] ✗ Erro no agendamento ${ag.id}:`, err.message);

          await supabase
            .from("sinistro_contatos_agendados")
            .update({ status: "erro", erro_detalhes: err.message })
            .eq("id", ag.id);
        }
      }
      totalProcessados += agendamentos.length;
    }

    // ========== PARTE 2: Alerta 17h (BRT) para veículos não atualizados ==========
    const agora = new Date();
    const horaBrasilia = (agora.getUTCHours() - 3 + 24) % 24;
    const minutoBrasilia = agora.getUTCMinutes();

    // Executar apenas no minuto 0 das 17h (BRT) — margem de +-1 minuto
    if (horaBrasilia === 20 && minutoBrasilia <= 1) { // UTC 20:00 = BRT 17:00
      console.log("[cron-contato-sinistro] Verificando veículos não atualizados (17h BRT)...");

      const hoje = new Date().toISOString().split('T')[0];

      // Buscar OS em execução
      const { data: osEmExecucao } = await supabase
        .from('ordens_servico')
        .select('id, numero, sinistro_id, veiculo:veiculos(placa), oficina:oficinas(nome_fantasia)')
        .eq('status', 'em_execucao');

      if (osEmExecucao && osEmExecucao.length > 0) {
        // Buscar quais já foram atualizadas hoje
        const osIdsExecucao = osEmExecucao.map(o => o.id);
        const { data: atualizadasHoje } = await supabase
          .from('os_atualizacoes_diarias')
          .select('ordem_servico_id')
          .in('ordem_servico_id', osIdsExecucao)
          .gte('created_at', `${hoje}T00:00:00`);

        const idsAtualizados = new Set((atualizadasHoje || []).map((a: any) => a.ordem_servico_id));
        const naoAtualizados = osEmExecucao.filter(o => !idsAtualizados.has(o.id));

        if (naoAtualizados.length > 0) {
          // Criar notificação interna para o regulador
          const listaVeiculos = naoAtualizados.map((o: any) => {
            const placa = o.veiculo?.placa || '---';
            const oficina = o.oficina?.nome_fantasia || '---';
            return `• ${placa} (OS ${o.numero}) — ${oficina}`;
          }).join('\n');

          // Inserir notificação no sistema
          await supabase.from('notificacoes').insert({
            titulo: `⚠️ ${naoAtualizados.length} veículo(s) sem atualização hoje`,
            mensagem: `Os seguintes veículos em oficina não receberam atualização hoje:\n${listaVeiculos}`,
            tipo: 'alerta_oficina',
            prioridade: 'alta',
          } as any).then(() => {
            console.log(`[cron-contato-sinistro] Alerta 17h: ${naoAtualizados.length} veículos sem atualização`);
          }).catch((e: any) => {
            console.error("[cron-contato-sinistro] Erro ao criar notificação:", e.message);
          });
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, processados: totalProcessados, enviados, erros }),
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error("[cron-contato-sinistro] Erro geral:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
