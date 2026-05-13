import { supabase } from '@/integrations/supabase/client';

/**
 * Espelha a atribuição de um agendamento_base na linha de `servicos` correspondente.
 *
 * Regra (ver mem://logic/operations/realocacao-base-preserva-servico):
 * - Toda atribuição via `agendamentos_base.atendido_por` SEMPRE atualiza a
 *   `servicos` vinculada (via instalacao_origem_id ou vistoria_origem_id).
 * - O serviço fica `agendada` (fila do técnico). Só vira `em_andamento` quando
 *   o próprio técnico iniciar a execução. Isso garante que um técnico possa
 *   ter vários serviços atribuídos ao mesmo tempo, com os outros em fila.
 *
 * Idempotente e tolerante a falhas (loga e segue — não bloqueia o fluxo de UI).
 */
export async function vincularProfissionalAoServicoDoAgendamentoBase(
  agendamentoBaseId: string,
  profissionalId: string | null,
): Promise<void> {
  try {
    const { data: ag } = await supabase
      .from('agendamentos_base')
      .select('id, instalacao_id, vistoria_id, oficina_id, data_agendada, horario')
      .eq('id', agendamentoBaseId)
      .maybeSingle();

    if (!ag) return;

    const periodo: 'manha' | 'tarde' = (() => {
      const h = String(ag.horario ?? '').slice(0, 5);
      if (!h) return 'manha';
      return h < '12:00' ? 'manha' : 'tarde';
    })();

    // Localizar serviço vivo correspondente
    let servicoQuery = supabase
      .from('servicos')
      .select('id, status')
      .not('status', 'in', '(concluida,aprovada,reprovada,aprovada_ressalvas)')
      .order('created_at', { ascending: false })
      .limit(1);

    if (ag.instalacao_id) {
      servicoQuery = servicoQuery.eq('instalacao_origem_id', ag.instalacao_id);
    } else if (ag.vistoria_id) {
      servicoQuery = servicoQuery.eq('vistoria_origem_id', ag.vistoria_id);
    } else {
      return;
    }

    const { data: servico } = await servicoQuery.maybeSingle();
    if (!servico) return;

    const updates: Record<string, any> = {
      profissional_id: profissionalId,
      status: 'agendada',
      local_vistoria: 'base',
      rota_id: null,
      data_agendada: ag.data_agendada,
      periodo,
      updated_at: new Date().toISOString(),
    };

    const { error: srvErr } = await supabase
      .from('servicos')
      .update(updates as any)
      .eq('id', servico.id);
    if (srvErr) console.error('[vincular-base->servico] erro ao atualizar servicos:', srvErr);

    // Espelhar instalador na instalacoes
    if (ag.instalacao_id) {
      const { error: instErr } = await supabase
        .from('instalacoes')
        .update({
          instalador_responsavel_id: profissionalId,
          data_agendada: ag.data_agendada,
          periodo: periodo as any,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', ag.instalacao_id)
        .not('status', 'in', '(concluida,cancelada)');
      if (instErr) console.error('[vincular-base->servico] erro ao atualizar instalacoes:', instErr);
    }

    // Espelhar vistoriador na vistorias
    if (ag.vistoria_id) {
      const { error: vistErr } = await supabase
        .from('vistorias')
        .update({
          vistoriador_id: profissionalId,
          data_agendada: ag.data_agendada,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', ag.vistoria_id);
      if (vistErr) console.error('[vincular-base->servico] erro ao atualizar vistorias:', vistErr);
    }
  } catch (e) {
    console.error('[vincular-base->servico] falha inesperada:', e);
  }
}
