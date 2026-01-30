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
        associado:associados!sinistros_associado_id_fkey(id, nome, telefone, whatsapp),
        veiculo:veiculos!sinistros_veiculo_id_fkey(placa, marca, modelo)
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

    // Atualizar status para 'em_analise'
    const { error: updateError } = await supabase
      .from('sinistros')
      .update({
        status: 'em_analise',
        updated_at: new Date().toISOString(),
      })
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
        status_novo: 'em_analise',
        observacao: observacao || 'Sinistro aprovado para análise pelo diretor',
      });

    if (histError) {
      console.error('[aprovar-sinistro] Erro ao registrar histórico:', histError);
    }

    // Enviar notificação WhatsApp
    const telefone = (sinistro.associado as any)?.whatsapp || (sinistro.associado as any)?.telefone;
    if (telefone) {
      const veiculo = sinistro.veiculo as any;
      const mensagem = `✅ *Sinistro Aprovado para Análise*

📋 *Protocolo:* ${sinistro.protocolo}
🚗 *Veículo:* ${veiculo?.placa || ''} - ${veiculo?.marca || ''} ${veiculo?.modelo || ''}

Seu sinistro foi aprovado e está em análise. Nossa equipe entrará em contato para os próximos passos.

⏰ *Próximas etapas:*
1. Análise técnica do caso
2. Possível agendamento de vistoria
3. Parecer final

Fique tranquilo! Estamos cuidando de tudo. 💙`;

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
