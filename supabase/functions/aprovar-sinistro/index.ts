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

    // Atualizar status para 'aprovado'
    const { error: updateError } = await supabase
      .from('sinistros')
      .update({
        status: 'aprovado',
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
