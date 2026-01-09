import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface CobrancaComAssociado {
  id: string;
  asaas_id: string;
  valor: number;
  data_vencimento: string;
  boleto_url: string | null;
  pix_copia_cola: string | null;
  linha_digitavel: string | null;
  associados: {
    id: string;
    nome: string;
    email: string;
    telefone: string;
    whatsapp: string | null;
  } | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { diasAntecedencia = [3, 1, 0], incluirVencidas = true } = await req.json().catch(() => ({}));
    
    console.log('[enviar-lembretes] Iniciando verificação de lembretes');

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const datasAlvo: string[] = [];
    
    // Adicionar datas de antecedência (D-3, D-1, D-0)
    for (const dias of diasAntecedencia) {
      const data = new Date(hoje);
      data.setDate(data.getDate() + dias);
      datasAlvo.push(data.toISOString().split('T')[0]);
    }

    console.log(`[enviar-lembretes] Buscando cobranças para datas: ${datasAlvo.join(', ')}`);

    // Buscar cobranças que vencem nas datas alvo e ainda não tiveram lembrete enviado
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
        associados:associado_id (
          id,
          nome,
          email,
          telefone,
          whatsapp
        )
      `)
      .in('data_vencimento', datasAlvo)
      .eq('status', 'PENDING')
      .eq('lembrete_vencimento_enviado', false);

    if (fetchError) {
      throw new Error(`Erro ao buscar cobranças: ${fetchError.message}`);
    }

    console.log(`[enviar-lembretes] ${cobrancas?.length || 0} cobranças encontradas para lembrete`);

    const resultados = {
      total: cobrancas?.length || 0,
      enviados: 0,
      erros: 0,
      detalhes: [] as any[],
    };

    for (const cobranca of (cobrancas || []) as unknown as CobrancaComAssociado[]) {
      try {
        const associado = cobranca.associados;
        if (!associado) continue;

        const dataVenc = new Date(cobranca.data_vencimento);
        const diasParaVencer = Math.ceil((dataVenc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
        
        let tipoLembrete = 'vencimento';
        if (diasParaVencer < 0) {
          tipoLembrete = 'vencido';
        } else if (diasParaVencer === 0) {
          tipoLembrete = 'vence_hoje';
        }

        const valorFormatado = new Intl.NumberFormat('pt-BR', { 
          style: 'currency', 
          currency: 'BRL' 
        }).format(cobranca.valor);

        const dataFormatada = new Date(cobranca.data_vencimento).toLocaleDateString('pt-BR');

        // Montar mensagem WhatsApp
        let mensagem = '';
        switch (tipoLembrete) {
          case 'vence_hoje':
            mensagem = `🔔 *Lembrete de Vencimento*\n\nOlá ${associado.nome.split(' ')[0]}!\n\nSua mensalidade de *${valorFormatado}* vence *HOJE* (${dataFormatada}).\n\n`;
            break;
          case 'vencido':
            mensagem = `⚠️ *Cobrança Vencida*\n\nOlá ${associado.nome.split(' ')[0]}!\n\nSua mensalidade de *${valorFormatado}* venceu em ${dataFormatada}.\n\nRegularize para evitar suspensão.\n\n`;
            break;
          default:
            mensagem = `📋 *Lembrete de Vencimento*\n\nOlá ${associado.nome.split(' ')[0]}!\n\nSua mensalidade de *${valorFormatado}* vence em *${diasParaVencer} dias* (${dataFormatada}).\n\n`;
        }

        // Adicionar PIX ou boleto
        if (cobranca.pix_copia_cola) {
          mensagem += `💠 *PIX Copia e Cola:*\n\`${cobranca.pix_copia_cola}\`\n\n`;
        }
        if (cobranca.linha_digitavel) {
          mensagem += `📊 *Linha Digitável:*\n${cobranca.linha_digitavel}\n\n`;
        }
        if (cobranca.boleto_url) {
          mensagem += `📄 *Boleto:* ${cobranca.boleto_url}\n\n`;
        }

        mensagem += `Dúvidas? Entre em contato conosco.`;

        // Criar notificação no sistema
        await supabase.from('notificacoes').insert({
          user_id: associado.id,
          titulo: tipoLembrete === 'vencido' ? 'Cobrança Vencida' : 'Lembrete de Vencimento',
          mensagem: `Sua mensalidade de ${valorFormatado} ${tipoLembrete === 'vence_hoje' ? 'vence hoje' : tipoLembrete === 'vencido' ? 'está vencida' : `vence em ${diasParaVencer} dias`}.`,
          tipo: tipoLembrete === 'vencido' ? 'alerta' : 'info',
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

        // Registrar mensagem WhatsApp (para envio manual ou via Evolution)
        const telefone = associado.whatsapp || associado.telefone;
        if (telefone) {
          await supabase.from('whatsapp_mensagens').insert({
            associado_id: associado.id,
            telefone: telefone.replace(/\D/g, ''),
            mensagem,
            tipo: 'lembrete_vencimento',
            status: 'pendente',
          });
        }

        // Marcar lembrete como enviado
        await supabase
          .from('asaas_cobrancas')
          .update({ 
            lembrete_vencimento_enviado: true,
            notificacao_enviada: true,
            notificacao_data: new Date().toISOString(),
          })
          .eq('id', cobranca.id);

        resultados.enviados++;
        resultados.detalhes.push({
          associado: associado.nome,
          tipo: tipoLembrete,
          valor: cobranca.valor,
          vencimento: cobranca.data_vencimento,
        });

      } catch (error: any) {
        console.error(`[enviar-lembretes] Erro:`, error.message);
        resultados.erros++;
      }
    }

    console.log(`[enviar-lembretes] Resultado: ${resultados.enviados} enviados, ${resultados.erros} erros`);

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
