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
        id, numero, sinistro_id,
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

      // Correção 3: Agendar envio com 30min de delay via sinistro_contatos_agendados
      if (telefone && os.sinistro_id) {
        const mensagem = `Olá ${nome}, seu veículo ${placa} está pronto na oficina ${oficinaInfo}. Acesse o link para confirmar a retirada: ${link}`;
        const agendadoPara30min = new Date(Date.now() + 30 * 60 * 1000).toISOString();

        await supabase.from('sinistro_contatos_agendados').insert({
          sinistro_id: os.sinistro_id,
          tipo: 'link_retirada',
          telefone,
          mensagem_enviada: mensagem,
          agendado_para: agendadoPara30min,
          status: 'agendado',
        } as any);

        // Correção 5: Agendar lembretes diários (dias 1-7) caso não retire
        for (let dia = 1; dia <= 7; dia++) {
          const agendadoParaDia = new Date(Date.now() + dia * 24 * 60 * 60 * 1000).toISOString();
          const mensagemLembrete = `Olá ${nome}! Lembrete: seu veículo ${placa} está pronto para retirada na oficina ${oficina?.nome_fantasia || oficina?.razao_social || ''}. Acesse o link: ${link}`;

          await supabase.from('sinistro_contatos_agendados').insert({
            sinistro_id: os.sinistro_id,
            tipo: 'lembrete_retirada',
            telefone,
            mensagem_enviada: mensagemLembrete,
            agendado_para: agendadoParaDia,
            status: 'agendado',
          } as any);
        }
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
