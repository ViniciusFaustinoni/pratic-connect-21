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

    const { ordem_servico_id } = await req.json();

    // Gerar token único
    const token = crypto.randomUUID();
    const expira = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(); // 72h

    // Salvar token na OS
    const { error: updateErr } = await supabase
      .from('ordens_servico')
      .update({
        token_retirada: token,
        token_retirada_expira: expira,
      })
      .eq('id', ordem_servico_id);

    if (updateErr) throw updateErr;

    // Buscar dados para notificação
    const { data: os } = await supabase
      .from('ordens_servico')
      .select(`
        id, numero,
        veiculo:veiculos(placa),
        associado:associados(nome, telefone, whatsapp),
        oficina:oficinas(nome_fantasia, razao_social, logradouro, numero, bairro, cidade, estado)
      `)
      .eq('id', ordem_servico_id)
      .single();

    if (os) {
      const associado = os.associado as any;
      const veiculo = os.veiculo as any;
      const oficina = os.oficina as any;
      const telefone = associado?.whatsapp || associado?.telefone;
      const nome = associado?.nome?.split(' ')[0] || 'Associado';
      const placa = veiculo?.placa || '---';
      const oficinaInfo = oficina ? `${oficina.nome_fantasia || oficina.razao_social} — ${oficina.logradouro || ''}, ${oficina.numero || ''}, ${oficina.bairro || ''}, ${oficina.cidade || ''}/${oficina.estado || ''}` : '';

      // Determinar URL base
      const siteUrl = Deno.env.get('SITE_URL') || 'https://pratic-connect-21.lovable.app';
      const link = `${siteUrl}/retirada/${token}`;

      if (telefone) {
        const mensagem = `Olá ${nome}, seu veículo ${placa} está pronto na oficina ${oficinaInfo}. Acesse o link para confirmar a retirada: ${link}`;
        await supabase.functions.invoke('whatsapp-send-text', {
          body: { telefone, mensagem },
        });
      }
    }

    return new Response(JSON.stringify({ success: true, token }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
