import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Verificar horário comercial (Brasília UTC-3)
function dentroHorarioComercial(): boolean {
  const agora = new Date();
  const brasiliaOffset = -3 * 60;
  const localOffset = agora.getTimezoneOffset();
  const brasilia = new Date(agora.getTime() + (localOffset - brasiliaOffset) * 60 * 1000);
  
  const hora = brasilia.getHours();
  const dia = brasilia.getDay();
  
  if (dia === 0) return false; // Domingo
  if (dia === 6) return hora >= 9 && hora < 14; // Sábado
  return hora >= 8 && hora < 20; // Seg-Sex
}

interface CobrancaComAssociado {
  id: string;
  asaas_id: string;
  valor: number;
  data_vencimento: string;
  boleto_url: string | null;
  pix_copia_cola: string | null;
  linha_digitavel: string | null;
  lembrete_vencimento_enviado: boolean;
  lembrete_d1_enviado: boolean | null;
  lembrete_d3_enviado: boolean | null;
  lembrete_d5_enviado: boolean | null;
  associados: {
    id: string;
    nome: string;
    email: string;
    telefone: string;
    whatsapp: string | null;
  } | null;
}

// Tipos de lembrete com seu tom adequado
function getMensagemLembrete(
  tipo: string, 
  nome: string, 
  valor: string, 
  data: string,
  diasParaVencer: number,
  pix: string | null,
  boletoUrl: string | null,
  linhaDigitavel: string | null
): { mensagem: string; titulo: string } {
  const nomeAbreviado = nome.split(' ')[0];
  let mensagem = '';
  let titulo = '';
  
  // Montar bloco de pagamento
  let blocoPagamento = '';
  if (pix) {
    blocoPagamento += `\n💠 *PIX Copia e Cola:*\n\`${pix}\`\n`;
  }
  if (linhaDigitavel) {
    blocoPagamento += `\n📊 *Linha Digitável:*\n${linhaDigitavel}\n`;
  }
  if (boletoUrl) {
    blocoPagamento += `\n📄 *Boleto:* ${boletoUrl}\n`;
  }

  switch (tipo) {
    case 'vencimento_3d':
      titulo = '📋 Lembrete Amigável';
      mensagem = `📋 *Lembrete Amigável* 👋

Olá ${nomeAbreviado}!

Sua mensalidade de *${valor}* vence em *3 dias* (${data}).

💡 *Dica:* Pague via PIX e libere na hora!
${blocoPagamento}
Qualquer dúvida, estamos aqui! 😊`;
      break;

    case 'vencimento_1d':
      titulo = '⏰ Vence Amanhã!';
      mensagem = `⏰ *Vence Amanhã!*

Olá ${nomeAbreviado}!

Sua mensalidade de *${valor}* vence *AMANHÃ* (${data}).

Pague agora e evite juros e multa!
${blocoPagamento}
📱 Copie o PIX e pague em segundos!`;
      break;

    case 'vence_hoje':
      titulo = '🔔 VENCE HOJE!';
      mensagem = `🔔 *VENCE HOJE!*

Olá ${nomeAbreviado}!

Sua mensalidade de *${valor}* vence *HOJE*!

⏰ Pague agora e evite juros e multa.
${blocoPagamento}
📱 Basta copiar o código PIX e colar no seu banco!`;
      break;

    case 'vencido_1d':
      titulo = '⚠️ Pagamento em Atraso';
      mensagem = `⚠️ *Atenção: Pagamento em Atraso*

Olá ${nomeAbreviado}!

Sua mensalidade de *${valor}* venceu ontem (${data}).

Ainda dá tempo de regularizar sem grandes acréscimos!
${blocoPagamento}
🤝 Dificuldades? Vamos conversar! Entre em contato conosco.`;
      break;

    case 'vencido_3d':
      titulo = '⚠️ Cobrança Vencida há 3 dias';
      mensagem = `⚠️ *Cobrança Vencida*

Olá ${nomeAbreviado}!

Sua mensalidade de *${valor}* está vencida há *3 dias* (venceu em ${data}).

⚠️ Regularize para evitar suspensão do serviço.
${blocoPagamento}
🤝 Precisa de um acordo? Entre em contato!`;
      break;

    case 'vencido_5d':
      titulo = '🚨 Suspensão em 48h';
      mensagem = `🚨 *ATENÇÃO URGENTE*

Olá ${nomeAbreviado},

Sua mensalidade de *${valor}* está em atraso há *5 dias*.

⚠️ *Sua proteção veicular será SUSPENSA em 48h se não for regularizada.*

Regularize agora:
${blocoPagamento}
🤝 Precisa de um acordo? Entre em contato *imediatamente*.`;
      break;

    default:
      // Genérico para vencidas antigas
      titulo = 'Cobrança Vencida';
      const diasVencido = Math.abs(diasParaVencer);
      mensagem = `⚠️ *Cobrança Vencida*

Olá ${nomeAbreviado}!

Sua mensalidade de *${valor}* venceu há ${diasVencido} dia${diasVencido > 1 ? 's' : ''} (${data}).

Regularize para evitar suspensão.
${blocoPagamento}
Dúvidas? Entre em contato conosco.`;
  }

  return { mensagem, titulo };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { 
      diasAntecedencia = [3, 1, 0], 
      diasPosVencimento = [1, 3, 5],
      incluirVencidas = true,
      ignorarHorarioComercial = false 
    } = await req.json().catch(() => ({}));
    
    console.log('[enviar-lembretes] Iniciando verificação de lembretes');
    
    // Verificar horário comercial
    if (!ignorarHorarioComercial && !dentroHorarioComercial()) {
      console.log('[enviar-lembretes] Fora do horário comercial. Adiando envio.');
      return new Response(
        JSON.stringify({ 
          success: true, 
          adiado: true, 
          mensagem: 'Fora do horário comercial (Seg-Sex 8h-20h, Sáb 9h-14h)' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    // Estrutura para armazenar datas e seus tipos
    const datasConfig: { data: string; tipo: string; diasOffset: number }[] = [];
    
    // Adicionar datas de antecedência (D-3, D-1, D-0)
    for (const dias of diasAntecedencia) {
      const data = new Date(hoje);
      data.setDate(data.getDate() + dias);
      const tipoLembrete = dias === 0 ? 'vence_hoje' : 
                           dias === 1 ? 'vencimento_1d' : 
                           dias === 3 ? 'vencimento_3d' : `vencimento_${dias}d`;
      datasConfig.push({
        data: data.toISOString().split('T')[0],
        tipo: tipoLembrete,
        diasOffset: dias,
      });
    }
    
    // Adicionar datas pós-vencimento (D+1, D+3, D+5)
    for (const dias of diasPosVencimento) {
      const data = new Date(hoje);
      data.setDate(data.getDate() - dias);
      datasConfig.push({
        data: data.toISOString().split('T')[0],
        tipo: `vencido_${dias}d`,
        diasOffset: -dias,
      });
    }

    const datasAlvo = datasConfig.map(d => d.data);
    console.log(`[enviar-lembretes] Buscando cobranças para datas: ${datasAlvo.join(', ')}`);

    // Buscar cobranças que vencem nas datas alvo
    const { data: cobrancas, error: fetchError } = await supabase
      .from('asaas_cobrancas')
      .select(`
        id,
        asaas_id,
        valor,
        data_vencimento,
        boleto_url,
        pix_copia_cola,
        linha_digitavel,
        lembrete_vencimento_enviado,
        lembrete_d1_enviado,
        lembrete_d3_enviado,
        lembrete_d5_enviado,
        associados:associado_id (
          id,
          nome,
          email,
          telefone,
          whatsapp
        )
      `)
      .in('data_vencimento', datasAlvo)
      .in('status', ['PENDING', 'OVERDUE']);

    if (fetchError) {
      throw new Error(`Erro ao buscar cobranças: ${fetchError.message}`);
    }

    console.log(`[enviar-lembretes] ${cobrancas?.length || 0} cobranças encontradas`);

    const resultados = {
      total: cobrancas?.length || 0,
      enviados: 0,
      jaEnviados: 0,
      erros: 0,
      detalhes: [] as any[],
    };

    for (const cobranca of (cobrancas || []) as unknown as CobrancaComAssociado[]) {
      try {
        const associado = cobranca.associados;
        if (!associado) continue;

        // Determinar tipo de lembrete baseado na data
        const configData = datasConfig.find(d => d.data === cobranca.data_vencimento);
        if (!configData) continue;
        
        const tipoLembrete = configData.tipo;
        const diasParaVencer = configData.diasOffset;
        
        // Verificar se já enviou este tipo específico de lembrete
        let jaEnviado = false;
        if (tipoLembrete.startsWith('vencimento') || tipoLembrete === 'vence_hoje') {
          jaEnviado = cobranca.lembrete_vencimento_enviado === true;
        } else if (tipoLembrete === 'vencido_1d') {
          jaEnviado = cobranca.lembrete_d1_enviado === true;
        } else if (tipoLembrete === 'vencido_3d') {
          jaEnviado = cobranca.lembrete_d3_enviado === true;
        } else if (tipoLembrete === 'vencido_5d') {
          jaEnviado = cobranca.lembrete_d5_enviado === true;
        }
        
        if (jaEnviado) {
          resultados.jaEnviados++;
          continue;
        }

        const valorFormatado = new Intl.NumberFormat('pt-BR', { 
          style: 'currency', 
          currency: 'BRL' 
        }).format(cobranca.valor);

        const dataFormatada = new Date(cobranca.data_vencimento).toLocaleDateString('pt-BR');

        // Obter mensagem apropriada
        const { mensagem, titulo } = getMensagemLembrete(
          tipoLembrete,
          associado.nome,
          valorFormatado,
          dataFormatada,
          diasParaVencer,
          cobranca.pix_copia_cola,
          cobranca.boleto_url,
          cobranca.linha_digitavel
        );

        // Criar notificação no sistema
        await supabase.from('notificacoes').insert({
          user_id: associado.id,
          titulo,
          mensagem: mensagem.replace(/\*/g, '').replace(/`/g, '').substring(0, 500),
          tipo: diasParaVencer < 0 ? 'alerta' : 'info',
        });

        // Enviar email
        if (associado.email) {
          try {
            await supabase.functions.invoke('send-email', {
              body: {
                template: 'lembrete-vencimento',
                to: associado.email,
                data: {
                  nome: associado.nome,
                  valor: valorFormatado,
                  dataVencimento: dataFormatada,
                  tipoLembrete,
                  boletoUrl: cobranca.boleto_url,
                  pixCopiaCola: cobranca.pix_copia_cola,
                }
              }
            });
          } catch (emailError) {
            console.error(`[enviar-lembretes] Erro ao enviar email para ${associado.email}:`, emailError);
          }
        }

        // Enviar mensagem via WhatsApp
        const telefone = associado.whatsapp || associado.telefone;
        if (telefone) {
          const telefoneFormatado = telefone.replace(/\D/g, '');
          
          try {
            const { data: sendResult, error: sendError } = await supabase.functions.invoke('whatsapp-send-text', {
              body: {
                telefone: telefoneFormatado,
                mensagem,
                delay_ms: 500,
              },
            });
            
            if (sendError) {
              throw sendError;
            }
            
            if (sendResult?.success === false) {
              throw new Error(sendResult.error || 'Erro ao enviar WhatsApp');
            }
            
            console.log(`[enviar-lembretes] WhatsApp enviado para ${telefoneFormatado} (${tipoLembrete})`);
            
            // Registrar mensagem
            await supabase.from('whatsapp_mensagens').insert({
              associado_id: associado.id,
              telefone: telefoneFormatado,
              mensagem,
              tipo: 'lembrete_vencimento',
              direcao: 'saida',
              status: 'enviada',
              message_id: sendResult?.message_id,
            });
            
          } catch (whatsError: any) {
            console.error(`[enviar-lembretes] Erro WhatsApp para ${telefoneFormatado}:`, whatsError);
            
            await supabase.from('whatsapp_mensagens').insert({
              associado_id: associado.id,
              telefone: telefoneFormatado,
              mensagem,
              tipo: 'lembrete_vencimento',
              direcao: 'saida',
              status: 'erro',
              erro_mensagem: whatsError.message || 'Erro desconhecido',
            });
          }
        }

        // Marcar lembrete específico como enviado
        const updateFields: Record<string, any> = {
          notificacao_enviada: true,
          notificacao_data: new Date().toISOString(),
        };
        
        if (tipoLembrete.startsWith('vencimento') || tipoLembrete === 'vence_hoje') {
          updateFields.lembrete_vencimento_enviado = true;
        } else if (tipoLembrete === 'vencido_1d') {
          updateFields.lembrete_d1_enviado = true;
        } else if (tipoLembrete === 'vencido_3d') {
          updateFields.lembrete_d3_enviado = true;
        } else if (tipoLembrete === 'vencido_5d') {
          updateFields.lembrete_d5_enviado = true;
        }
        
        await supabase
          .from('asaas_cobrancas')
          .update(updateFields)
          .eq('id', cobranca.id);

        resultados.enviados++;
        resultados.detalhes.push({
          associado: associado.nome,
          tipo: tipoLembrete,
          valor: cobranca.valor,
          vencimento: cobranca.data_vencimento,
          diasParaVencer,
        });

      } catch (error: any) {
        console.error(`[enviar-lembretes] Erro:`, error.message);
        resultados.erros++;
      }
    }

    console.log(`[enviar-lembretes] Resultado: ${resultados.enviados} enviados, ${resultados.jaEnviados} já enviados, ${resultados.erros} erros`);

    return new Response(JSON.stringify(resultados), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[enviar-lembretes] Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
