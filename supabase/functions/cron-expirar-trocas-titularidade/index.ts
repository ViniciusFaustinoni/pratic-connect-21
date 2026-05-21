// Cron: expira trocas de titularidade quando o NOVO TITULAR não assina o termo
// de filiação até a meia-noite (23:59:59 BRT) do dia em que o titular antigo
// assinou o termo de cancelamento.
//
// Regra (acordada com o usuário em 2026-05-13):
// - Corte literal: 23:59:59 BRT (UTC-3) do mesmo dia da assinatura do cancelamento.
// - Ações ao expirar:
//     1. status da solicitação → 'expirada' + expirada_em + motivo
//     2. veículo do antigo → 'cancelado' (limpa em_troca_titularidade)
//     3. cotação vinculada → 'recusada' (impede continuidade no link público)
//     4. WhatsApp template 'troca_expirada' para associado antigo, novo titular
//        e vendedor (não-bloqueante).
//
// Roda via pg_cron a cada 15 minutos.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { sendMetaTemplate } from '../_shared/send-meta-template.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fim do dia BRT (UTC-3) para uma data ISO de assinatura.
// Ex.: assinou 2026-05-13T23:50:00-03:00 → corte 2026-05-13T23:59:59.999-03:00 = 2026-05-14T02:59:59.999Z
function brtEndOfDay(isoSigned: string): Date {
  const d = new Date(isoSigned);
  // Converte para componentes BRT manualmente (sem depender de TZ do runtime).
  const brtMs = d.getTime() - 3 * 60 * 60 * 1000;
  const brt = new Date(brtMs);
  const y = brt.getUTCFullYear();
  const m = brt.getUTCMonth();
  const day = brt.getUTCDate();
  // 23:59:59.999 BRT = 02:59:59.999 do dia seguinte em UTC
  return new Date(Date.UTC(y, m, day, 23, 59, 59, 999) + 3 * 60 * 60 * 1000);
}

// Margem de segurança contra clock skew do runtime Deno vs Postgres.
// Supabase Edge Runtime é NTP-sync (skew em ms), mas mantemos defesa em profundidade
// de 5 minutos. Acordado com o usuário em 2026-05-21.
const GRACE_PERIOD_MS = 5 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const stats = { candidatas: 0, expiradas: 0, ainda_no_prazo: 0, dentro_margem: 0, erros: 0, ids: [] as string[] };

  try {
    const { data: candidatas, error } = await admin
      .from('solicitacoes_troca_titularidade')
      .select(`
        id, status, cotacao_id, veiculo_id, associado_antigo_id, novo_titular_dados,
        termo_cancelamento_assinado_em
      `)
      .not('termo_cancelamento_assinado_em', 'is', null)
      .in('status', [
        'aguardando_cadastro',
        'aguardando_monitoramento',
        'aguardando_vistoria',
        'aguardando_manutencao',
        'liberada_para_assinatura',
      ])
      .limit(500);
    if (error) throw error;

    const agora = new Date();

    for (const s of candidatas || []) {
      stats.candidatas++;
      try {
        const corte = brtEndOfDay(s.termo_cancelamento_assinado_em as string);
        const deltaMs = agora.getTime() - corte.getTime();
        const corteComMargem = corte.getTime() + GRACE_PERIOD_MS;

        // Log estruturado por candidato (auditável via Edge Function logs)
        console.log(JSON.stringify({
          tag: '[cron-expirar-trocas:eval]',
          solicitacao_id: s.id,
          termo_assinado_em: s.termo_cancelamento_assinado_em,
          corte_brt_iso: corte.toISOString(),
          agora_iso: agora.toISOString(),
          delta_ms: deltaMs,
          grace_period_ms: GRACE_PERIOD_MS,
          dentro_prazo: agora.getTime() <= corte.getTime(),
          dentro_margem: agora.getTime() > corte.getTime() && agora.getTime() <= corteComMargem,
        }));

        if (agora.getTime() <= corte.getTime()) {
          stats.ainda_no_prazo++;
          continue;
        }
        if (agora.getTime() <= corteComMargem) {
          // Dentro da janela de margem — não cancela ainda (defesa contra clock skew)
          stats.dentro_margem++;
          continue;
        }

        // Verifica se NOVO titular já assinou o termo de filiação.
        // Sinal canônico: contrato vinculado à cotação com status assinado/posterior.
        let novoJaAssinou = false;
        if (s.cotacao_id) {
          const { data: contratoNovo } = await admin
            .from('contratos')
            .select('id, status')
            .eq('cotacao_id', s.cotacao_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (contratoNovo) {
            const st = String(contratoNovo.status || '').toLowerCase();
            // Considera assinado se já saiu de pré-assinatura
            novoJaAssinou = !['rascunho', 'aguardando_assinatura', 'pendente'].includes(st);
          }
        }
        if (novoJaAssinou) {
          stats.ainda_no_prazo++;
          continue;
        }

        // 1) Marcar solicitação como expirada
        const motivo = 'Prazo de assinatura do novo titular expirado (meia-noite do dia da assinatura do cancelamento).';
        await admin
          .from('solicitacoes_troca_titularidade')
          .update({
            status: 'expirada',
            expirada_em: agora.toISOString(),
            motivo_reprovacao: motivo,
          })
          .eq('id', s.id);

        // 1.1) Auditoria persistente (logs_auditoria)
        try {
          await admin.from('logs_auditoria').insert({
            acao: 'cancelar',
            modulo: 'cotacoes',
            tabela: 'solicitacoes_troca_titularidade',
            registro_id: s.id,
            descricao: 'Cron expirou troca de titularidade por prazo (meia-noite BRT + 5min margem)',
            dados_anteriores: { status: s.status },
            dados_novos: {
              status: 'expirada',
              corte_brt: corte.toISOString(),
              agora: agora.toISOString(),
              delta_ms: deltaMs,
              grace_period_ms: GRACE_PERIOD_MS,
              cotacao_id: s.cotacao_id,
              veiculo_id: s.veiculo_id,
            },
          });
        } catch (auditErr) {
          console.warn('[cron-expirar-trocas] audit insert falhou (não bloqueante):', auditErr);
        }

        // 2) Cancelar veículo do antigo (termo de cancelamento já honrado)
        if (s.veiculo_id) {
          await admin
            .from('veiculos')
            .update({
              status: 'cancelado',
              em_troca_titularidade: false,
            })
            .eq('id', s.veiculo_id);
        }

        // 3) Bloquear cotação para o novo titular não conseguir assinar tarde
        if (s.cotacao_id) {
          await admin
            .from('cotacoes')
            .update({ status: 'recusada' })
            .eq('id', s.cotacao_id);
        }

        // 4) WhatsApp (não-bloqueante)
        try {
          const novoTitular = (s.novo_titular_dados || {}) as any;
          const [{ data: assoc }, { data: veic }] = await Promise.all([
            s.associado_antigo_id
              ? admin.from('associados').select('nome, telefone').eq('id', s.associado_antigo_id).maybeSingle()
              : Promise.resolve({ data: null }),
            s.veiculo_id
              ? admin.from('veiculos').select('marca, modelo, placa').eq('id', s.veiculo_id).maybeSingle()
              : Promise.resolve({ data: null }),
          ]);
          const veicLabel = veic ? `${veic.marca || ''} ${veic.modelo || ''} (${veic.placa || ''})`.trim() : 'veículo';

          // associado antigo
          if (assoc?.telefone) {
            await sendMetaTemplate({
              supabase: admin,
              telefone: assoc.telefone,
              templateName: 'troca_expirada',
              templateParams: [String(assoc.nome || '').split(' ')[0] || 'Associado', veicLabel],
              referenciaTipo: 'troca_titularidade',
              referenciaId: s.id,
              tag: '[cron-expirar-troca:antigo]',
            });
          }
          // novo titular
          if (novoTitular?.telefone) {
            await sendMetaTemplate({
              supabase: admin,
              telefone: novoTitular.telefone,
              templateName: 'troca_expirada',
              templateParams: [String(novoTitular.nome || '').split(' ')[0] || 'Cliente', veicLabel],
              referenciaTipo: 'troca_titularidade',
              referenciaId: s.id,
              tag: '[cron-expirar-troca:novo]',
            });
          }
        } catch (waErr) {
          console.warn('[cron-expirar-trocas] whatsapp falhou (não bloqueante):', waErr);
        }

        stats.expiradas++;
        stats.ids.push(s.id as string);
      } catch (e) {
        stats.erros++;
        console.error('[cron-expirar-trocas] item falhou:', s.id, e);
      }
    }

    return new Response(JSON.stringify({ ok: true, stats }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e), stats }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
