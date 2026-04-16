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

    const { ordem_servico_id, etapa_concluida, proxima_etapa, tipo, tipo_problema, descricao_problema } = await req.json();

    // Buscar OS com veículo e associado
    const { data: os, error: osErr } = await supabase
      .from('ordens_servico')
      .select(`
        id, numero, status,
        veiculo:veiculos(placa, marca, modelo),
        associado:associados(nome, telefone, whatsapp),
        oficina:oficinas(nome_fantasia, razao_social, logradouro, numero, bairro, cidade, estado)
      `)
      .eq('id', ordem_servico_id)
      .single();

    if (osErr || !os) throw new Error('OS não encontrada');

    const veiculo = os.veiculo as any;
    const associado = os.associado as any;
    const oficina = os.oficina as any;
    const nome = associado?.nome?.split(' ')[0] || 'Associado';
    const placa = veiculo?.placa || '---';
    const telefone = associado?.whatsapp || associado?.telefone;

    if (!telefone) {
      return new Response(JSON.stringify({ success: false, error: 'Sem telefone' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let mensagem = '';

    const mensagensEtapa: Record<string, string> = {
      'Lanternagem': `Olá ${nome}, a etapa de lanternagem do seu ${placa} foi concluída! Próxima: ${proxima_etapa || 'finalização'}.`,
      'Pintura': `Olá ${nome}, seu ${placa} saiu da pintura! Resultado excelente. Próxima: ${proxima_etapa || 'finalização'}.`,
      'Mecânica': `Olá ${nome}, reparos mecânicos do ${placa} finalizados. Tudo funcionando. Próxima: ${proxima_etapa || 'finalização'}.`,
      'Elétrica': `Olá ${nome}, parte elétrica do ${placa} restaurada. Componentes testados. Próxima: ${proxima_etapa || 'finalização'}.`,
      'Polimento': `Olá ${nome}, polimento do ${placa} concluído. Brilho de zero! Próxima: ${proxima_etapa || 'finalização'}.`,
      'Lavagem': `Olá ${nome}, ÓTIMA NOTÍCIA! Seu ${placa} está sendo lavado — esta é a última etapa! Assim que concluir, entraremos em contato para combinar a retirada. Fique atento!`,
    };

    if (tipo === 'etapa_concluida') {
      mensagem = mensagensEtapa[etapa_concluida] || 
        `Olá ${nome}, a etapa "${etapa_concluida}" do seu ${placa} foi concluída! ${proxima_etapa ? `Próxima: ${proxima_etapa}.` : 'Estamos finalizando!'}`;
    } else if (tipo === 'problema') {
      mensagem = `Olá ${nome}, informamos que houve um imprevisto no reparo do seu ${placa}: ${tipo_problema || 'atraso'}. ${descricao_problema || ''} Estamos trabalhando para resolver o mais rápido possível.`;
    } else if (tipo === 'conclusao') {
      const oficinaEndereco = oficina ? `${oficina.nome_fantasia || oficina.razao_social} — ${oficina.logradouro || ''}, ${oficina.numero || ''}, ${oficina.bairro || ''}, ${oficina.cidade || ''}/${oficina.estado || ''}` : '';
      mensagem = `Olá ${nome}, seu veículo ${placa} está pronto na oficina ${oficinaEndereco}. Em breve enviaremos o link para confirmar a retirada!`;
    } else if (tipo === 'retirada_pronta') {
      const { link } = await req.json().catch(() => ({}));
      mensagem = `Olá ${nome}, seu veículo ${placa} está pronto! Acesse o link para confirmar a retirada: ${link}`;
    } else if (tipo === 'retirada_confirmada') {
      mensagem = `Olá ${nome}, confirmamos a retirada do seu ${placa}. Garantia de 90 dias ativa a partir de hoje. Problemas relacionados ao reparo? Entre em contato imediatamente.`;
    }

    if (mensagem) {
      await supabase.functions.invoke('whatsapp-send-text', {
        body: {
          telefone,
          mensagem,
          template_name: 'sinistro_atualizado',
          template_params: [nome, placa, mensagem.substring(0, 200)],
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
