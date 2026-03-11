import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 1000;

function formatarTelefone(telefone: string): string {
  const numeros = telefone.replace(/\D/g, '');
  if (numeros.startsWith('55') && numeros.length >= 12) return numeros;
  return `55${numeros}`;
}

function formatarValor(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

function formatarData(data: string): string {
  return new Date(data + 'T12:00:00').toLocaleDateString('pt-BR');
}

const MESES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { fechamento_id } = await req.json();

    if (!fechamento_id) {
      return new Response(
        JSON.stringify({ error: 'fechamento_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar fechamento
    const { data: fechamento, error: fechErr } = await supabase
      .from('fechamentos_mensais')
      .select('id, mes, ano')
      .eq('id', fechamento_id)
      .single();

    if (fechErr || !fechamento) {
      return new Response(
        JSON.stringify({ error: 'Fechamento não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const mesAno = `${MESES[fechamento.mes]}/${fechamento.ano}`;

    // Buscar cobranças emitidas (com asaas_id real) que ainda não foram notificadas
    const { data: cobrancas, error: cobErr } = await supabase
      .from('asaas_cobrancas')
      .select(`
        id,
        asaas_id,
        valor,
        data_vencimento,
        boleto_url,
        pix_copia_cola,
        pix_qrcode,
        notificacao_enviada,
        associado_id,
        associados:associado_id (
          id,
          nome,
          email,
          telefone,
          whatsapp,
          user_id
        )
      `)
      .eq('fechamento_id', fechamento_id)
      .eq('notificacao_enviada', false)
      .not('asaas_id', 'like', 'LOCAL-%');

    if (cobErr) {
      throw new Error(`Erro ao buscar cobranças: ${cobErr.message}`);
    }

    console.log(`[disparar-boletos-lote] ${cobrancas?.length || 0} cobranças para notificar`);

    const resultados = {
      total: cobrancas?.length || 0,
      sucesso: 0,
      erros: 0,
      detalhes: [] as any[],
    };

    if (!cobrancas || cobrancas.length === 0) {
      return new Response(
        JSON.stringify({ ...resultados, mensagem: 'Nenhuma cobrança pendente de notificação' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Processar em lotes
    for (let i = 0; i < cobrancas.length; i += BATCH_SIZE) {
      const lote = cobrancas.slice(i, i + BATCH_SIZE);

      const promises = lote.map(async (cobranca: any) => {
        const associado = cobranca.associados;
        if (!associado) {
          resultados.erros++;
          resultados.detalhes.push({ cobranca_id: cobranca.id, erro: 'Associado não encontrado' });
          return;
        }

        const nome = associado.nome?.split(' ')[0] || 'Associado';
        const valorFmt = formatarValor(cobranca.valor);
        const dataFmt = formatarData(cobranca.data_vencimento);

        // Mensagem WhatsApp
        const mensagemWhatsApp = `📋 *Boleto Disponível!*

Olá ${nome}! 👋

Seu boleto de contribuição referente a *${mesAno}* está disponível.

💰 *Valor:* ${valorFmt}
📅 *Vencimento:* ${dataFmt}
${cobranca.pix_copia_cola ? `\n💠 *PIX Copia e Cola:*\n\`${cobranca.pix_copia_cola}\`\n` : ''}
${cobranca.boleto_url ? `📄 *Boleto:* ${cobranca.boleto_url}\n` : ''}
Acesse pelo app ou clique no link acima para pagar! 😊`;

        let whatsappOk = false;
        let emailOk = false;

        // Enviar WhatsApp
        const telefone = associado.whatsapp || associado.telefone;
        if (telefone) {
          try {
            const telFmt = formatarTelefone(telefone);
            const nomeAbrev = associado.nome?.split(' ')[0] || 'Associado';
            const { data: sendResult, error: sendErr } = await supabase.functions.invoke('whatsapp-send-text', {
              body: {
                telefone: telFmt,
                mensagem: mensagemWhatsApp,
                delay_ms: 300,
                template_name: 'cobranca_mensalidade',
                template_params: [nomeAbrev, valorFmt, dataFmt],
              },
            });

            if (!sendErr && sendResult?.success !== false) {
              whatsappOk = true;

              // Registrar mensagem
              await supabase.from('whatsapp_mensagens').insert({
                telefone: telFmt,
                mensagem: mensagemWhatsApp,
                tipo: 'text',
                direcao: 'saida',
                status: 'enviada',
                message_id: sendResult?.message_id,
                referencia_tipo: 'cobranca',
                referencia_id: cobranca.id,
              });
            }
          } catch (e: any) {
            console.error(`[disparar-boletos-lote] WhatsApp erro para ${associado.nome}:`, e.message);
          }
        }

        // Enviar Email
        if (associado.email) {
          try {
            await supabase.functions.invoke('send-email', {
              body: {
                template: 'boleto-gerado',
                to: associado.email,
                data: {
                  nome: associado.nome,
                  mesAno,
                  valor: valorFmt,
                  dataVencimento: dataFmt,
                  boletoUrl: cobranca.boleto_url,
                  pixCopiaCola: cobranca.pix_copia_cola,
                  pixQrcode: cobranca.pix_qrcode,
                },
              },
            });
            emailOk = true;
          } catch (e: any) {
            console.error(`[disparar-boletos-lote] Email erro para ${associado.email}:`, e.message);
          }
        }

        // Notificação no sistema
        if (associado.user_id) {
          try {
            await supabase.functions.invoke('disparar-notificacao', {
              body: {
                user_id: associado.user_id,
                associado_id: associado.id,
                tipo: 'boleto',
                subtipo: 'gerado',
                dados: {
                  mes: mesAno,
                  valor: valorFmt,
                },
                link: '/app/boletos',
                referencia_tipo: 'cobranca',
                referencia_id: cobranca.id,
                forcar_envio: true,
              },
            });
          } catch (e: any) {
            console.error(`[disparar-boletos-lote] Notificação erro:`, e.message);
          }
        }

        // Marcar como notificada
        await supabase
          .from('asaas_cobrancas')
          .update({
            notificacao_enviada: true,
            notificacao_data: new Date().toISOString(),
            enviada_whatsapp: whatsappOk,
            enviada_whatsapp_em: whatsappOk ? new Date().toISOString() : null,
          })
          .eq('id', cobranca.id);

        if (whatsappOk || emailOk) {
          resultados.sucesso++;
        } else {
          resultados.erros++;
        }

        resultados.detalhes.push({
          cobranca_id: cobranca.id,
          associado: associado.nome,
          whatsapp: whatsappOk,
          email: emailOk,
        });
      });

      await Promise.all(promises);

      // Delay entre lotes
      if (i + BATCH_SIZE < cobrancas.length) {
        await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
      }
    }

    console.log(`[disparar-boletos-lote] Resultado: ${resultados.sucesso} sucesso, ${resultados.erros} erros`);

    return new Response(
      JSON.stringify(resultados),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[disparar-boletos-lote] Erro:', error);
    const msg = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
