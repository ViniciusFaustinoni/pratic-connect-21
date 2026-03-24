import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { servico_id, tipo, profissional_id, isAdiantamento } = await req.json();

    if (!servico_id || !tipo || !profissional_id) {
      return new Response(JSON.stringify({ success: false, error: 'Parâmetros obrigatórios: servico_id, tipo, profissional_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[solicitar-encaixe] Início: servico=${servico_id}, tipo=${tipo}, profissional=${profissional_id}, adiantamento=${isAdiantamento}`);

    // 1. Buscar dados do profissional
    const { data: profissional } = await supabase
      .from('profiles')
      .select('nome')
      .eq('id', profissional_id)
      .single();

    const nomeProfissional = profissional?.nome || 'profissional';

    // 2. Buscar dados do serviço e associado
    let telefone: string | null = null;
    let nomeCliente: string | null = null;
    let tipoServicoLabel = '';
    let servicoDbId: string | null = null;

    if (tipo === 'instalacao') {
      const { data: inst } = await supabase
        .from('instalacoes')
        .select('id, servico_id, associado:associados(nome, telefone)')
        .eq('id', servico_id)
        .single();

      nomeCliente = (inst as any)?.associado?.nome || null;
      telefone = (inst as any)?.associado?.telefone || null;
      servicoDbId = inst?.servico_id || null;
      tipoServicoLabel = 'instalação do rastreador';
    } else if (tipo === 'vistoria') {
      const { data: vist } = await supabase
        .from('vistorias')
        .select('id, servico_id, tipo, associado:associados(nome, telefone)')
        .eq('id', servico_id)
        .single();

      nomeCliente = (vist as any)?.associado?.nome || null;
      telefone = (vist as any)?.associado?.telefone || null;
      servicoDbId = vist?.servico_id || null;
      tipoServicoLabel = 'vistoria';
    } else if (tipo === 'vistoria_evento') {
      const { data: ve } = await supabase
        .from('vistorias_evento')
        .select('id, servico_id, sinistro:sinistros(associado:associados(nome, telefone))')
        .eq('id', servico_id)
        .single();

      nomeCliente = (ve as any)?.sinistro?.associado?.nome || null;
      telefone = (ve as any)?.sinistro?.associado?.telefone || null;
      servicoDbId = ve?.servico_id || null;
      tipoServicoLabel = 'vistoria de evento';
    }

    if (!telefone) {
      return new Response(JSON.stringify({ success: false, error: 'Associado sem telefone cadastrado' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Formatar telefone
    const telefoneLimpo = telefone.replace(/\D/g, '');
    const telefoneFormatado = telefoneLimpo.startsWith('55') ? telefoneLimpo : `55${telefoneLimpo}`;
    const primeiroNome = (nomeCliente || 'Cliente').split(' ')[0];

    // 3. Verificar se já existe confirmação pendente para este serviço
    if (servicoDbId) {
      const { data: confExistente } = await supabase
        .from('confirmacoes_agendamento')
        .select('id, status')
        .eq('servico_id', servicoDbId)
        .in('status', ['enviada', 'aguardando_confirmacao_encaixe'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (confExistente) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Já existe uma confirmação pendente para este serviço. Aguarde a resposta do cliente.' 
        }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 4. Enviar WhatsApp de confirmação
    const mensagem = `Olá, *${primeiroNome}*! 👋

Aqui é a *PRATIC Proteção Veicular*.

Temos um profissional (*${nomeProfissional}*) disponível *próximo de você agora*! 🚗

Podemos ${isAdiantamento ? 'antecipar' : 'realizar'} sua *${tipoServicoLabel}* para *HOJE*?

✅ Responda *SIM* para confirmar
❌ Ou *NÃO* para manter a data original

Aguardamos sua confirmação! ⚡`;

    await supabase.functions.invoke('whatsapp-send-text', {
      body: {
        telefone: telefoneFormatado,
        mensagem,
        template_name: 'confirmacao_agendamento_v1',
        template_params: [
          primeiroNome,
          tipoServicoLabel,
          'Encaixe HOJE - profissional disponível na região',
        ],
      }
    });

    console.log(`[solicitar-encaixe] WhatsApp enviado para ${telefoneFormatado}`);

    // 5. Marcar serviço como aguardando confirmação
    if (servicoDbId) {
      await supabase
        .from('servicos')
        .update({ confirmacao_whatsapp: 'aguardando_confirmacao_encaixe' })
        .eq('id', servicoDbId);
    }

    // 6. Criar registro em confirmacoes_agendamento
    if (servicoDbId) {
      await supabase.from('confirmacoes_agendamento').insert({
        servico_id: servicoDbId,
        telefone: telefoneFormatado,
        status: 'enviada',
        mensagem_enviada_em: new Date().toISOString(),
        contexto_ia: {
          nome_cliente: nomeCliente,
          tipo_servico: tipo,
          tipo_confirmacao: 'encaixe',
          profissional_id,
          profissional_nome: nomeProfissional,
          is_adiantamento: !!isAdiantamento,
          id_original: servico_id,
        }
      });
    }

    console.log(`[solicitar-encaixe] ✓ Confirmação de encaixe registrada para serviço ${servicoDbId || servico_id}`);

    return new Response(JSON.stringify({ 
      success: true, 
      status: 'aguardando_confirmacao',
      message: 'Confirmação enviada ao cliente via WhatsApp'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[solicitar-encaixe] Erro:', error);
    return new Response(JSON.stringify({ success: false, error: error.message || 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
