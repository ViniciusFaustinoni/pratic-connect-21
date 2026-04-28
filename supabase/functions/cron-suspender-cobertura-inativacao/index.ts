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

    // 1) Carregar prazo (h) configurado pela diretoria (default 72h)
    const { data: cfg } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'prazo_instalacao_autovistoria_horas')
      .maybeSingle();
    const prazoHoras = Math.max(1, parseInt(cfg?.valor ?? '72', 10) || 72);
    const limite = new Date(Date.now() - prazoHoras * 60 * 60 * 1000).toISOString();

    // 2) Buscar TODOS os contratos assinados/ativos há mais que o prazo,
    //    sem liberação manual de reagendamento — independente de tipo_vistoria.
    //    Regra (memória suspensao-cobertura-48h): cobre todo contrato cuja instalação
    //    não foi concluída no prazo após assinatura.
    const { data: contratos, error: errContratos } = await supabase
      .from('contratos')
      .select('id, veiculo_id, associado_id, data_assinatura, liberado_reagendamento_em, status, tipo_vistoria')
      .in('status', ['assinado', 'ativo'])
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
    const detalhes: Array<{ veiculo_id: string; contrato_id: string; placa?: string }> = [];
    const ignorados: Array<{ contrato_id: string; motivo: string }> = [];

    for (const contrato of contratos) {
      if (!contrato.veiculo_id) {
        ignorados.push({ contrato_id: contrato.id, motivo: 'sem veiculo_id' });
        continue;
      }

      // Fonte de verdade: tabela `instalacoes`.
      // Se já existe instalação concluída OU dispensada de rastreador, pular.
      const { data: instalacaoConcluida } = await supabase
        .from('instalacoes')
        .select('id, status, concluida_em, dispensa_rastreador')
        .eq('contrato_id', contrato.id)
        .or('status.eq.concluida,concluida_em.not.is.null,dispensa_rastreador.eq.true')
        .limit(1);

      if ((instalacaoConcluida?.length ?? 0) > 0) {
        ignorados.push({ contrato_id: contrato.id, motivo: 'instalacao concluida ou dispensada' });
        continue;
      }

      // Fallback retrocompatibilidade: checar `servicos` (caminho antigo)
      const { data: servicoConcluido } = await supabase
        .from('servicos')
        .select('id')
        .eq('veiculo_id', contrato.veiculo_id)
        .eq('tipo', 'instalacao')
        .eq('status', 'concluida')
        .limit(1);
      if ((servicoConcluido?.length ?? 0) > 0) {
        ignorados.push({ contrato_id: contrato.id, motivo: 'servico instalacao concluido' });
        continue;
      }

      const { data: veiculo } = await supabase
        .from('veiculos')
        .select('id, placa, modelo, cobertura_suspensa')
        .eq('id', contrato.veiculo_id)
        .maybeSingle();
      if (!veiculo) {
        ignorados.push({ contrato_id: contrato.id, motivo: 'veiculo nao encontrado' });
        continue;
      }
      if (veiculo.cobertura_suspensa) {
        ignorados.push({ contrato_id: contrato.id, motivo: 'cobertura ja suspensa' });
        continue;
      }

      await supabase
        .from('veiculos')
        .update({
          cobertura_suspensa: true,
          cobertura_suspensa_motivo: `Instalação não realizada no prazo de ${prazoHoras}h após assinatura`,
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
            `A cobertura do seu veículo *${veiculo.placa ?? veiculo.modelo ?? ''}* foi *suspensa temporariamente* porque a instalação do rastreador não foi realizada dentro do prazo de ${prazoHoras}h após a assinatura do contrato.\n\n` +
            `🚫 Você está *sem cobertura de roubo e furto* enquanto a instalação não for concluída.\n\n` +
            `Para reativar sua proteção, fale com nosso time de monitoramento. Após liberação, você poderá reagendar a vistoria/instalação pelo link de cadastro.`;

          await supabase.functions.invoke('enviar-whatsapp', {
            body: {
              telefone: assoc.telefone,
              mensagem: msg,
              associado_id: assoc.id,
              tipo: 'suspensao_instalacao_prazo',
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
        descricao: `Cobertura suspensa: instalação não realizada no prazo (${prazoHoras}h)`,
        dados_novos: {
          contrato_id: contrato.id,
          veiculo_id: contrato.veiculo_id,
          placa: veiculo.placa,
          prazo_horas: prazoHoras,
          tipo_vistoria: contrato.tipo_vistoria,
          status_contrato: contrato.status,
        },
      });

      suspensos++;
      detalhes.push({ veiculo_id: contrato.veiculo_id, contrato_id: contrato.id, placa: veiculo.placa });
    }

    return new Response(
      JSON.stringify({
        suspensos,
        prazo_horas: prazoHoras,
        total_verificados: contratos.length,
        detalhes,
        ignorados,
      }),
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
