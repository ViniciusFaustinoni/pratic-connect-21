import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Buscar contatos agendados pendentes (agendado_para <= now)
    const { data: agendamentos, error: agError } = await supabase
      .from("sinistro_contatos_agendados")
      .select("*, link:sinistro_evento_links(token)")
      .eq("status", "agendado")
      .lte("agendado_para", new Date().toISOString())
      .limit(20);

    if (agError) {
      console.error("[cron-contato-sinistro] Erro ao buscar agendamentos:", agError);
      return new Response(JSON.stringify({ success: false, error: agError.message }), {
        status: 500, headers: corsHeaders,
      });
    }

    if (!agendamentos || agendamentos.length === 0) {
      return new Response(JSON.stringify({ success: true, processados: 0 }), {
        headers: corsHeaders,
      });
    }

    console.log(`[cron-contato-sinistro] ${agendamentos.length} agendamentos pendentes`);

    let enviados = 0;
    let erros = 0;

    for (const ag of agendamentos) {
      try {
        // Se mensagem_enviada já estiver preenchida, enviar direto (skip template)
        if (ag.mensagem_enviada && ag.telefone) {
          const telefone = ag.telefone;
          const mensagem = ag.mensagem_enviada;

          const sendResponse = await fetch(`${supabaseUrl}/functions/v1/whatsapp-send-text`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({ telefone, mensagem }),
          });

          const sendResult = await sendResponse.json();
          if (!sendResponse.ok || !sendResult.success) {
            throw new Error(sendResult.error || "Erro ao enviar WhatsApp");
          }

          await supabase
            .from("sinistro_contatos_agendados")
            .update({
              status: "enviado",
              enviado_em: new Date().toISOString(),
            })
            .eq("id", ag.id);

          enviados++;
          console.log(`[cron-contato-sinistro] ✓ Mensagem pré-definida enviada (${ag.tipo || 'contato'})`);
          continue;
        }

        // Buscar sinistro com associado, veículo e plano
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
              minimo = Number(plano.cota_app_min || 0);
            } else {
              percentual = Number(plano.cota_participacao || 0);
              minimo = Number(plano.cota_minima || 0);
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

        // Montar mensagem
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

O link é válido por 72 horas.
Em caso de dúvidas, estamos à disposição!`;

        // Enviar via whatsapp-send-text
        const telefone = associado.whatsapp || associado.telefone;
        if (!telefone) {
          throw new Error("Associado sem telefone/whatsapp");
        }

        const sendResponse = await fetch(`${supabaseUrl}/functions/v1/whatsapp-send-text`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ telefone, mensagem }),
        });

        const sendResult = await sendResponse.json();

        if (!sendResponse.ok || !sendResult.success) {
          throw new Error(sendResult.error || "Erro ao enviar WhatsApp");
        }

        // Atualizar agendamento como enviado
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
          .update({
            status: "erro",
            erro_detalhes: err.message,
          })
          .eq("id", ag.id);
      }
    }

    return new Response(
      JSON.stringify({ success: true, processados: agendamentos.length, enviados, erros }),
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
