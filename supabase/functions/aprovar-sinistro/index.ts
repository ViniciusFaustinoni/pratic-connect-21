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
              .select('valor_fipe, uso_aplicativo')
              .eq('id', veiculoId)
              .single(),
          ]);

          if (plano && veiculoFull?.valor_fipe) {
            let percentual = plano.cota_participacao || 6;
            let minimo = plano.cota_minima || 1200;

            if (veiculoFull.uso_aplicativo && plano.cota_app_percent) {
              percentual = plano.cota_app_percent;
              minimo = plano.cota_app_min || minimo;
            }

            valorCotaCalculado = Math.max(
              veiculoFull.valor_fipe * percentual / 100,
              minimo
            );
            console.log('[aprovar-sinistro] Cota calculada:', {
              valor_fipe: veiculoFull.valor_fipe,
              percentual,
              minimo,
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
