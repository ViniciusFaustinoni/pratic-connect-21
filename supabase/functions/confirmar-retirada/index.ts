import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { token, data_retirada, observacoes, assinatura_base64 } = await req.json();

    if (!token) throw new Error('Token obrigatório');

    // Buscar OS pelo token
    const { data: os, error: osErr } = await supabase
      .from('ordens_servico')
      .select('id, sinistro_id, token_retirada_expira, veiculo:veiculos(placa), associado:associados(nome, telefone, whatsapp)')
      .eq('token_retirada', token)
      .single();

    if (osErr || !os) throw new Error('Token inválido ou OS não encontrada');

    // Verificar expiração
    if (os.token_retirada_expira && new Date(os.token_retirada_expira) < new Date()) {
      throw new Error('Token expirado. Solicite um novo link.');
    }

    let assinaturaUrl = null;

    // Upload da assinatura se fornecida
    if (assinatura_base64) {
      const base64Data = assinatura_base64.replace(/^data:image\/\w+;base64,/, '');
      const bytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      const filePath = `retiradas/${os.id}/assinatura_${Date.now()}.png`;

      const { error: uploadErr } = await supabase.storage
        .from('sinistro-eventos')
        .upload(filePath, bytes, { contentType: 'image/png', upsert: true });

      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('sinistro-eventos').getPublicUrl(filePath);
        assinaturaUrl = urlData?.publicUrl;
      }
    }

    const dataRetirada = data_retirada || new Date().toISOString();
    const garantiaAte = new Date(dataRetirada);
    garantiaAte.setDate(garantiaAte.getDate() + 90);

    // Calcular tempo total
    const { data: osCompleta } = await supabase
      .from('ordens_servico')
      .select('data_entrada, created_at')
      .eq('id', os.id)
      .single();

    const entrada = osCompleta?.data_entrada || osCompleta?.created_at;
    const tempoTotalDias = entrada
      ? Math.ceil((new Date(dataRetirada).getTime() - new Date(entrada).getTime()) / 86400000)
      : null;

    // Atualizar OS
    const { error: updateErr } = await supabase
      .from('ordens_servico')
      .update({
        status: 'entregue' as any,
        data_retirada: dataRetirada,
        garantia_ate: garantiaAte.toISOString().split('T')[0],
        assinatura_retirada_url: assinaturaUrl,
        tempo_total_dias: tempoTotalDias,
        observacoes: observacoes || undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', os.id);

    if (updateErr) throw updateErr;

    // Registrar histórico
    await supabase.from('ordens_servico_historico').insert({
      ordem_servico_id: os.id,
      status_novo: 'entregue',
      observacao: 'Veículo retirado pelo associado',
    });

    // Atualizar sinistro para em_garantia
    if (os.sinistro_id) {
      await supabase
        .from('sinistros')
        .update({ status: 'em_garantia' as any, updated_at: new Date().toISOString() })
        .eq('id', os.sinistro_id);

      await supabase.from('sinistro_historico').insert({
        sinistro_id: os.sinistro_id,
        status_anterior: 'em_reparo',
        status_novo: 'em_garantia',
        observacao: 'Veículo retirado. Garantia de 90 dias iniciada.',
      });
    }

    // WhatsApp de confirmação
    const associado = os.associado as any;
    const veiculo = os.veiculo as any;
    const telefone = associado?.whatsapp || associado?.telefone;
    if (telefone) {
      const nome = associado?.nome?.split(' ')[0] || 'Associado';
      const placa = veiculo?.placa || '---';
      await supabase.functions.invoke('whatsapp-send-text', {
        body: {
          telefone,
          mensagem: `Olá ${nome}, confirmamos a retirada do seu ${placa}. Garantia de 90 dias ativa a partir de hoje. Problemas relacionados ao reparo? Entre em contato imediatamente.`,
          template_name: 'sinistro_atualizado',
          template_params: [nome, 'retirada', `Retirada do veículo ${placa} confirmada. Garantia de 90 dias ativa.`],
        },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
