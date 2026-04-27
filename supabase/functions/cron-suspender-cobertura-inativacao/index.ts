// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1) Carregar prazo (h) configurado pela diretoria
    const { data: cfg } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'prazo_instalacao_autovistoria_horas')
      .maybeSingle();
    const prazoHoras = Math.max(1, parseInt(cfg?.valor ?? '72', 10) || 72);
    const limite = new Date(Date.now() - prazoHoras * 60 * 60 * 1000).toISOString();

    // 2) Buscar contratos AUTO-VISTORIA ativos, assinados há mais que o prazo,
    //    sem liberação manual de reagendamento
    const { data: contratos, error: errContratos } = await supabase
      .from('contratos')
      .select('id, veiculo_id, associado_id, data_assinatura, liberado_reagendamento_em')
      .eq('tipo_vistoria', 'autovistoria')
      .eq('status', 'ativo')
      .not('data_assinatura', 'is', null)
      .lte('data_assinatura', limite)
      .is('liberado_reagendamento_em', null);

    if (errContratos) throw errContratos;
    if (!contratos?.length) {
      return new Response(JSON.stringify({ message: 'Nenhum contrato a verificar', prazo_horas: prazoHoras }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let suspensos = 0;
    const detalhes: Array<{ veiculo_id: string; contrato_id: string }> = [];

    for (const contrato of contratos) {
      if (!contrato.veiculo_id) continue;

      // Já tem instalação concluída?
      const { data: instalado } = await supabase
        .from('servicos')
        .select('id')
        .eq('veiculo_id', contrato.veiculo_id)
        .eq('tipo', 'instalacao')
        .eq('status', 'concluida')
        .limit(1);
      if ((instalado?.length ?? 0) > 0) continue;

      const { data: veiculo } = await supabase
        .from('veiculos')
        .select('id, placa, modelo, cobertura_suspensa')
        .eq('id', contrato.veiculo_id)
        .maybeSingle();
      if (!veiculo || veiculo.cobertura_suspensa) continue;

      await supabase
        .from('veiculos')
        .update({
          cobertura_suspensa: true,
          cobertura_suspensa_motivo: 'Auto-vistoria sem instalação no prazo',
          cobertura_suspensa_em: new Date().toISOString(),
          cobertura_total: false,
          cobertura_roubo_furto: false,
        })
        .eq('id', contrato.veiculo_id);

      // Notificar via WhatsApp
      try {
        const { data: assoc } = await supabase
          .from('associados')
          .select('id, nome, telefone')
          .eq('id', contrato.associado_id)
          .maybeSingle();

        if (assoc?.telefone) {
          const msg =
            `Olá ${assoc.nome?.split(' ')[0] ?? ''}! ⚠️\n\n` +
            `A cobertura do seu veículo *${veiculo.placa ?? veiculo.modelo ?? ''}* foi *suspensa temporariamente* porque a instalação do rastreador não foi realizada dentro do prazo de ${prazoHoras}h após a auto-vistoria.\n\n` +
            `🚫 Você está *sem cobertura de roubo e furto* enquanto a instalação não for concluída.\n\n` +
            `Para reativar sua proteção, fale com nosso time de monitoramento. Após liberação, você poderá reagendar a vistoria/instalação pelo link de cadastro.`;

          await supabase.functions.invoke('enviar-whatsapp', {
            body: {
              telefone: assoc.telefone,
              mensagem: msg,
              associado_id: assoc.id,
              tipo: 'suspensao_autovistoria',
            },
          });
        }
      } catch (e) {
        console.error('[cron-suspender] Falha ao notificar WhatsApp', e);
      }

      // Auditoria
      await supabase.from('logs_auditoria').insert({
        acao: 'suspensao_automatica',
        modulo: 'monitoramento',
        descricao: `Cobertura suspensa por auto-vistoria sem instalação no prazo (${prazoHoras}h)`,
        dados_novos: { contrato_id: contrato.id, veiculo_id: contrato.veiculo_id, prazo_horas: prazoHoras },
      });

      suspensos++;
      detalhes.push({ veiculo_id: contrato.veiculo_id, contrato_id: contrato.id });
    }

    return new Response(
      JSON.stringify({ suspensos, prazo_horas: prazoHoras, total_verificados: contratos.length, detalhes }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[cron-suspender] Erro', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
