import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AprovarRequest {
  sinistro_id: string;
  observacao?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { sinistro_id, observacao } = await req.json() as AprovarRequest;

    if (!sinistro_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'sinistro_id é obrigatório' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('[aprovar-sinistro] Aprovando sinistro:', sinistro_id);

    // Buscar sinistro
    const { data: sinistro, error: sinistroError } = await supabase
      .from('sinistros')
      .select(`
        id, protocolo, status, tipo,
        associado:associados!sinistros_associado_id_fkey(id, nome, telefone, whatsapp, email),
        veiculo:veiculos!sinistros_veiculo_id_fkey(id, placa, marca, modelo)
      `)
      .eq('id', sinistro_id)
      .single();

    if (sinistroError || !sinistro) {
      console.error('[aprovar-sinistro] Erro ao buscar sinistro:', sinistroError);
      return new Response(
        JSON.stringify({ success: false, error: 'Sinistro não encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    const statusAnterior = sinistro.status;

    // Calcular cota de coparticipação com base no plano do associado
    let valorCotaCalculado: number | null = null;
    try {
      const associadoId = (sinistro.associado as any)?.id;
      const veiculoId = (sinistro.veiculo as any)?.id;

      if (associadoId) {
        const { data: associadoData } = await supabase
          .from('associados')
          .select('plano_id')
          .eq('id', associadoId)
          .single();

        if (associadoData?.plano_id) {
          const [{ data: plano }, { data: veiculoFull }] = await Promise.all([
            supabase
              .from('planos')
              .select('cota_participacao, cota_minima, cota_app_percent, cota_app_min')
              .eq('id', associadoData.plano_id)
              .single(),
            supabase
              .from('veiculos')
              .select('valor_fipe, uso_aplicativo, combustivel')
              .eq('id', veiculoId)
              .single(),
          ]);

          if (plano && veiculoFull?.valor_fipe) {
            if (plano.cota_participacao == null || plano.cota_minima == null) {
              console.warn('[aprovar-sinistro] ATENÇÃO: plano sem cota_participacao/cota_minima configurados. Verifique o cadastro do plano.');
            }
            // Buscar defaults do banco
            const { data: cfgCota } = await supabase.from('configuracoes').select('valor').eq('chave', 'cota_participacao_default').single();
            const { data: cfgMin } = await supabase.from('configuracoes').select('valor').eq('chave', 'cota_minima_default').single();
            const cotaDefault = cfgCota ? parseFloat(cfgCota.valor) : 6;
            const minimoDefault = cfgMin ? parseFloat(cfgMin.valor) : 1200;
            
            let percentual = plano.cota_participacao ?? cotaDefault;
            let minimo = plano.cota_minima ?? minimoDefault;

            // Determinar categoria do veículo para lookup na tabela
            let categoriaVeiculo = 'passeio';
            if (veiculoFull.uso_aplicativo) categoriaVeiculo = 'aplicativo';
            else if (veiculoFull.combustivel?.toLowerCase() === 'diesel') categoriaVeiculo = 'diesel';

            // 1º: Buscar override na tabela planos_cotas_categoria
            const { data: cotaCategoria } = await supabase
              .from('planos_cotas_categoria')
              .select('cota_percentual, cota_minima_valor')
              .eq('plano_id', associadoData.plano_id)
              .eq('categoria_veiculo', categoriaVeiculo)
              .maybeSingle();

            if (cotaCategoria) {
              percentual = cotaCategoria.cota_percentual ?? percentual;
              minimo = cotaCategoria.cota_minima_valor ?? minimo;
              console.log(`[aprovar-sinistro] Override categoria '${categoriaVeiculo}': ${percentual}% mín R$${minimo}`);
            } else if (veiculoFull.uso_aplicativo && plano.cota_app_percent) {
              // 2º: Fallback para campos do plano (app)
              percentual = plano.cota_app_percent;
              minimo = plano.cota_app_min ?? minimo;
            }

            // Regra: cota_minima = 0 significa sem mínimo
            valorCotaCalculado = minimo === 0
              ? veiculoFull.valor_fipe * percentual / 100
              : Math.max(veiculoFull.valor_fipe * percentual / 100, minimo);

            console.log('[aprovar-sinistro] Cota calculada:', {
              valor_fipe: veiculoFull.valor_fipe,
              percentual,
              minimo,
              categoria: categoriaVeiculo,
              uso_app: veiculoFull.uso_aplicativo,
              valor_cota: valorCotaCalculado,
            });
          }
        }
      }
    } catch (cotaErr) {
      console.error('[aprovar-sinistro] Erro ao calcular cota:', cotaErr);
    }

    if (valorCotaCalculado === null) {
      console.warn('[aprovar-sinistro] ⚠️ ATENÇÃO: valorCotaCalculado ficou null! O cálculo da cota falhou. Verifique se o veículo tem valor_fipe e o associado tem plano_id configurado.');
    }

    // Atualizar status para 'aprovado'
    const updateData: Record<string, any> = {
      status: 'aprovado',
      updated_at: new Date().toISOString(),
    };
    if (valorCotaCalculado !== null) {
      updateData.valor_cota_participacao = valorCotaCalculado;
    }

    const { error: updateError } = await supabase
      .from('sinistros')
      .update(updateData)
      .eq('id', sinistro_id);

    if (updateError) {
      console.error('[aprovar-sinistro] Erro ao atualizar status:', updateError);
      throw updateError;
    }

    // Registrar histórico
    const { error: histError } = await supabase
      .from('sinistro_historico')
      .insert({
        sinistro_id,
        status_anterior: statusAnterior,
        status_novo: 'aprovado',
        observacao: observacao || 'Sinistro aprovado pelo diretor',
      });

    if (histError) {
      console.error('[aprovar-sinistro] Erro ao registrar histórico:', histError);
    }

    // Criar Termo de Entrada de Evento via Autentique
    try {
      const { data: termoData, error: termoError } = await supabase.functions.invoke('autentique-evento-create', {
        body: { sinistro_id }
      });
      if (termoError) {
        console.error('[aprovar-sinistro] Erro ao criar termo Autentique:', termoError);
      } else {
        console.log('[aprovar-sinistro] Termo Autentique criado:', termoData);
      }
    } catch (termoErr) {
      console.error('[aprovar-sinistro] Erro ao invocar autentique-evento-create:', termoErr);
    }

    // Enviar notificação WhatsApp informando aprovação + termo por email
    const telefone = (sinistro.associado as any)?.whatsapp || (sinistro.associado as any)?.telefone;
    const emailAssociado = (sinistro.associado as any)?.email;
    if (telefone) {
      const veiculo = sinistro.veiculo as any;
      const mensagem = `🎉 *Ótimas notícias!*

O reparo do seu evento (protocolo *${sinistro.protocolo}*) foi *APROVADO*! ✅

🚗 *Veículo:* ${veiculo?.placa || ''} - ${veiculo?.marca || ''} ${veiculo?.modelo || ''}

📧 Enviamos um e-mail${emailAssociado ? ` para *${emailAssociado}*` : ''} com o *Termo de Entrada de Evento*.
Por favor, abra o e-mail e *assine o documento* para dar continuidade ao processo.

⏳ Após a assinatura, nossa equipe dará andamento aos próximos passos.

Qualquer dúvida, estamos à disposição! 💙`;

      try {
        await supabase.functions.invoke('whatsapp-send-text', {
          body: {
            telefone: telefone.replace(/\D/g, ''),
            mensagem,
          },
        });
        console.log('[aprovar-sinistro] WhatsApp enviado');
      } catch (whatsErr) {
        console.error('[aprovar-sinistro] Erro ao enviar WhatsApp:', whatsErr);
      }

      // Agendar mensagem 15min após aprovação — peças em cotação
      const primeiroNome = (sinistro.associado as any)?.nome?.split(' ')[0] || 'Associado';
      const placa = (sinistro.veiculo as any)?.placa || '';
      const agendadoPara = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      const mensagem15 = `${primeiroNome}, aqui é a equipe Pratic Car novamente! 😊\n\nEnquanto aguardamos a assinatura do termo e o pagamento da cota, já estamos adiantando o processo! 🚀\n\n🔧 As peças necessárias para o reparo do seu veículo ${placa} já estão em *fase de cotação* com nossos auto centers parceiros.\n\nNosso objetivo é agilizar ao máximo para que, assim que tudo estiver regularizado, o reparo comece o mais rápido possível! ⚡\n\nVocê será informado sobre cada etapa. Qualquer dúvida, estamos aqui! 💙\n\nABP PraticCar`;

      try {
        await supabase.from('sinistro_contatos_agendados').insert({
          sinistro_id,
          tipo: 'pos_aprovacao_cotacao',
          telefone: telefone.replace(/\D/g, ''),
          agendado_para: agendadoPara,
          mensagem_enviada: mensagem15,
          status: 'agendado',
        });
        console.log('[aprovar-sinistro] Mensagem 15min agendada para:', agendadoPara);
      } catch (e) {
        console.error('[aprovar-sinistro] Erro ao agendar mensagem 15min:', e);
      }
    }

    console.log('[aprovar-sinistro] Sinistro aprovado com sucesso');

    return new Response(
      JSON.stringify({ success: true, message: 'Sinistro aprovado com sucesso' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[aprovar-sinistro] Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
