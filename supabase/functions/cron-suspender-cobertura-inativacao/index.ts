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

    // 1) Carregar prazos (h) configurados pela diretoria (default + regionais RJ/SP)
    const { data: cfgs } = await supabase
      .from('configuracoes')
      .select('chave, valor')
      .in('chave', [
        'prazo_instalacao_autovistoria_horas',
        'prazo_instalacao_horas_rj',
        'prazo_instalacao_horas_sp',
      ]);
    const cfgMap = Object.fromEntries((cfgs ?? []).map(c => [c.chave, c.valor]));
    const prazoDefault = Math.max(1, parseInt(cfgMap['prazo_instalacao_autovistoria_horas'] ?? '72', 10) || 72);
    const prazoRJ = Math.max(1, parseInt(cfgMap['prazo_instalacao_horas_rj'] ?? '48', 10) || 48);
    const prazoSP = Math.max(1, parseInt(cfgMap['prazo_instalacao_horas_sp'] ?? '72', 10) || 72);
    const prazoPorUf = (uf?: string | null) => {
      const u = (uf || '').trim().toUpperCase();
      if (u === 'RJ') return prazoRJ;
      if (u === 'SP') return prazoSP;
      return prazoDefault;
    };
    // Pré-filtragem ampla: contratos assinados/ativos sem liberação manual.
    // O cálculo do prazo agora usa a DATA DO AGENDAMENTO da instalação/vistoria
    // (instalacoes.data_agendada + hora_agendada) — a data de assinatura é apenas
    // fallback para contratos antigos sem instalação registrada.
    const { data: contratos, error: errContratos } = await supabase
      .from('contratos')
      .select('id, veiculo_id, associado_id, data_assinatura, liberado_reagendamento_em, status, tipo_vistoria')
      .in('status', ['assinado', 'ativo'])
      .is('liberado_reagendamento_em', null);

    if (errContratos) throw errContratos;
    if (!contratos?.length) {
      return new Response(JSON.stringify({
        message: 'Nenhum contrato a verificar',
        prazos: { default: prazoDefault, RJ: prazoRJ, SP: prazoSP },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let suspensos = 0;
    const detalhes: Array<{ veiculo_id: string; contrato_id: string; placa?: string; uf?: string; prazo_horas: number }> = [];
    const ignorados: Array<{ contrato_id: string; motivo: string }> = [];

    for (const contrato of contratos) {
      if (!contrato.veiculo_id) {
        ignorados.push({ contrato_id: contrato.id, motivo: 'sem veiculo_id' });
        continue;
      }

      // Carregar UF do associado para escolher o prazo correto
      const { data: assocUf } = await supabase
        .from('associados')
        .select('uf')
        .eq('id', contrato.associado_id)
        .maybeSingle();
      const uf = (assocUf?.uf || '').toUpperCase() || null;
      const prazoHoras = prazoPorUf(uf);

      // Validar se realmente expirou para a UF deste contrato (a query inicial usa o menor prazo)
      const assinadoEm = new Date(contrato.data_assinatura).getTime();
      const expirouEm = assinadoEm + prazoHoras * 60 * 60 * 1000;
      if (expirouEm > Date.now()) {
        ignorados.push({ contrato_id: contrato.id, motivo: `prazo regional ${uf ?? 'default'} (${prazoHoras}h) ainda não venceu` });
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
          // Template aprovado: suspensao_cobertura_nao_instalacao_v1
          // Vars: [nomePrimeiro, placaOuModelo, prazoHoras]
          const nomePrimeiro = assoc.nome?.split(' ')[0] ?? 'Associado';
          const placaRef = veiculo.placa ?? veiculo.modelo ?? '---';
          await supabase.functions.invoke('whatsapp-send-text', {
            body: {
              telefone: assoc.telefone,
              mensagem: `Olá ${nomePrimeiro}! ⚠️ A cobertura (Roubo e Furto) do seu veículo ${placaRef} foi suspensa porque a instalação do rastreador não foi realizada em ${prazoHoras}h. Concluindo a instalação, a cobertura volta automaticamente.`,
              template_name: 'suspensao_cobertura_nao_instalacao_v1',
              template_params: [nomePrimeiro, String(placaRef), String(prazoHoras)],
              referencia_tipo: 'contrato',
              referencia_id: contrato.id,
            },
          });
        }
      } catch (e) {
        console.error('[cron-suspender] Falha ao notificar WhatsApp', e);
      }

      // Auditoria — logs_auditoria + associados_historico
      await supabase.from('logs_auditoria').insert({
        acao: 'suspensao_automatica',
        modulo: 'monitoramento',
        descricao: `Cobertura suspensa: instalação não realizada no prazo (${prazoHoras}h, UF=${uf ?? 'N/D'})`,
        dados_novos: {
          contrato_id: contrato.id,
          veiculo_id: contrato.veiculo_id,
          placa: veiculo.placa,
          prazo_horas: prazoHoras,
          uf,
          tipo_vistoria: contrato.tipo_vistoria,
          status_contrato: contrato.status,
        },
      });

      try {
        await supabase.from('associados_historico').insert({
          associado_id: contrato.associado_id,
          tipo: 'suspensao_cobertura_instalacao',
          descricao: `Cobertura suspensa automaticamente: instalação não realizada no prazo de ${prazoHoras}h (UF=${uf ?? 'N/D'})`,
          dados_novos: {
            contrato_id: contrato.id,
            veiculo_id: contrato.veiculo_id,
            placa: veiculo.placa,
            prazo_horas: prazoHoras,
            uf,
            origem: 'cron',
          },
        });
      } catch (e) {
        console.error('[cron-suspender] Falha ao registrar historico', e);
      }

      suspensos++;
      detalhes.push({ veiculo_id: contrato.veiculo_id, contrato_id: contrato.id, placa: veiculo.placa, uf: uf ?? undefined, prazo_horas: prazoHoras });
    }

    return new Response(
      JSON.stringify({
        suspensos,
        prazos: { default: prazoDefault, RJ: prazoRJ, SP: prazoSP },
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
