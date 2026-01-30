import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MOTIVOS_LABELS: Record<string, string> = {
  fora_cobertura: 'Evento fora da cobertura contratada',
  documentacao_invalida: 'Documentação inválida ou inconsistente',
  fraude_suspeita: 'Irregularidade identificada',
  prazo_expirado: 'Prazo para comunicação expirado',
  inadimplencia: 'Situação financeira irregular',
  carencia: 'Veículo em período de carência',
  outro: 'Conforme justificativa',
};

interface ReprovarRequest {
  sinistro_id: string;
  motivo: string;
  justificativa: string;
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

    const { sinistro_id, motivo, justificativa } = await req.json() as ReprovarRequest;

    if (!sinistro_id || !motivo || !justificativa) {
      return new Response(
        JSON.stringify({ success: false, error: 'sinistro_id, motivo e justificativa são obrigatórios' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('[reprovar-sinistro] Reprovando sinistro:', sinistro_id);

    // Buscar sinistro
    const { data: sinistro, error: sinistroError } = await supabase
      .from('sinistros')
      .select(`
        id, protocolo, status, tipo,
        associado:associados!sinistros_associado_id_fkey(id, nome, telefone, whatsapp),
        veiculo:veiculos!sinistros_veiculo_id_fkey(placa, marca, modelo)
      `)
      .eq('id', sinistro_id)
      .single();

    if (sinistroError || !sinistro) {
      console.error('[reprovar-sinistro] Erro ao buscar sinistro:', sinistroError);
      return new Response(
        JSON.stringify({ success: false, error: 'Sinistro não encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    const statusAnterior = sinistro.status;
    const motivoLabel = MOTIVOS_LABELS[motivo] || motivo;

    // Atualizar status para 'negado'
    const { error: updateError } = await supabase
      .from('sinistros')
      .update({
        status: 'negado',
        motivo_negacao: motivo,
        justificativa_negacao: justificativa,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sinistro_id);

    if (updateError) {
      console.error('[reprovar-sinistro] Erro ao atualizar status:', updateError);
      throw updateError;
    }

    // Registrar histórico
    const { error: histError } = await supabase
      .from('sinistro_historico')
      .insert({
        sinistro_id,
        status_anterior: statusAnterior,
        status_novo: 'negado',
        observacao: `Sinistro reprovado. Motivo: ${motivoLabel}. Justificativa: ${justificativa}`,
      });

    if (histError) {
      console.error('[reprovar-sinistro] Erro ao registrar histórico:', histError);
    }

    // Enviar notificação WhatsApp
    const telefone = (sinistro.associado as any)?.whatsapp || (sinistro.associado as any)?.telefone;
    if (telefone) {
      const veiculo = sinistro.veiculo as any;
      const mensagem = `❌ *Resultado da Análise do Sinistro*

📋 *Protocolo:* ${sinistro.protocolo}
🚗 *Veículo:* ${veiculo?.placa || ''} - ${veiculo?.marca || ''} ${veiculo?.modelo || ''}

Após análise criteriosa, informamos que seu sinistro *não foi aprovado*.

📌 *Motivo:* ${motivoLabel}

Se tiver dúvidas sobre essa decisão, entre em contato conosco para mais esclarecimentos.

Agradecemos sua compreensão.`;

      try {
        await supabase.functions.invoke('whatsapp-send-text', {
          body: {
            telefone: telefone.replace(/\D/g, ''),
            mensagem,
          },
        });
        console.log('[reprovar-sinistro] WhatsApp enviado');
      } catch (whatsErr) {
        console.error('[reprovar-sinistro] Erro ao enviar WhatsApp:', whatsErr);
      }
    }

    console.log('[reprovar-sinistro] Sinistro reprovado com sucesso');

    return new Response(
      JSON.stringify({ success: true, message: 'Sinistro reprovado com sucesso' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[reprovar-sinistro] Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
