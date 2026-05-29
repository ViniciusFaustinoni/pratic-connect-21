// @ts-nocheck
// Sub-etapa 1 do Cadastro: aprovação dos documentos.
// Grava `contratos.documentos_aprovados_em/_por` SEM tocar em:
// - cadastro_aprovado / aprovado_em / aprovado_por (sub-etapa 2 — aprovar-proposta)
// - associados / veiculos / instalacoes / servicos / coberturas / cotacoes
//
// Quando todas as sub-etapas terminam (aprovar-proposta), o caso sai da fila do
// Cadastro e vai para o Monitoramento. Até lá, o caso PERMANECE na fila do
// Cadastro com a sub-etapa 2 (vistoria enxuta) liberada na UI.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { insertAuditLog } from '../_shared/auditLog.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    const body = await req.json().catch(() => ({}));
    const contrato_id: string | undefined = body?.contrato_id;
    const aprovado_por: string | undefined = body?.aprovado_por;
    if (!contrato_id || !aprovado_por) {
      return json({ success: false, error: 'contrato_id e aprovado_por são obrigatórios' }, 400);
    }

    const supabase = createClient(supabaseUrl, supabaseService);

    // 1. Carregar contrato
    const { data: contrato, error: errC } = await supabase
      .from('contratos')
      .select('id, status, cadastro_aprovado, documentos_aprovados_em, tipo_entrada, origem_troca_titularidade_id')
      .eq('id', contrato_id)
      .maybeSingle();
    if (errC) return json({ success: false, error: errC.message }, 500);
    if (!contrato) return json({ success: false, error: 'Contrato não encontrado' }, 404);

    // 2. Troca de titularidade NÃO usa este fluxo — segue por aprovar-proposta direto.
    if (contrato.origem_troca_titularidade_id || contrato.tipo_entrada === 'troca_titularidade') {
      return json({
        success: false,
        codigo: 'fluxo_troca_titularidade',
        error: 'Troca de titularidade não usa sub-etapas — aprove direto via aprovar-proposta.',
      }, 409);
    }

    // 3. Idempotência
    if (contrato.documentos_aprovados_em) {
      return json({ success: true, jaAprovado: true, mensagem: 'Documentos já aprovados anteriormente.' });
    }

    if (contrato.cadastro_aprovado === true) {
      return json({ success: true, jaAprovado: true, mensagem: 'Contrato já aprovado integralmente pelo Cadastro.' });
    }

    if (contrato.status !== 'assinado') {
      return json({ success: false, error: `Contrato precisa estar 'assinado' (atual: ${contrato.status}).` }, 409);
    }

    // 4. Valida que TODOS os documentos do contrato estão aprovados.
    //    Mesma regra que a UI usa para liberar o botão.
    const { data: docsContrato, error: errDocs } = await supabase
      .from('contratos_documentos')
      .select('id, tipo_documento, status')
      .eq('contrato_id', contrato_id);
    if (errDocs) return json({ success: false, error: errDocs.message }, 500);

    const pendentes = (docsContrato || []).filter(
      (d: any) => d.status !== 'aprovado' && d.status !== 'aprovado_ressalvas',
    );
    if ((docsContrato || []).length === 0) {
      return json({
        success: false,
        codigo: 'sem_documentos',
        error: 'Nenhum documento anexado ao contrato.',
      }, 409);
    }
    if (pendentes.length > 0) {
      return json({
        success: false,
        codigo: 'documentos_pendentes',
        error: 'Há documentos ainda não aprovados.',
        pendentes: pendentes.map((p: any) => ({ id: p.id, tipo: p.tipo_documento, status: p.status })),
      }, 409);
    }

    // 5. Grava sub-etapa 1
    const agora = new Date().toISOString();
    const { error: errUpd } = await supabase
      .from('contratos')
      .update({
        documentos_aprovados_em: agora,
        documentos_aprovados_por: aprovado_por,
        updated_at: agora,
      })
      .eq('id', contrato_id)
      .is('documentos_aprovados_em', null);
    if (errUpd) return json({ success: false, error: errUpd.message }, 500);

    // 6. Auditoria (acao canônica 'criar' por causa do CHECK; descrição rastreia)
    try {
      await insertAuditLog(supabase as any, {
        usuario_id: aprovado_por,
        acao: 'aprovar_documentos_cadastro',
        modulo: 'cadastro',
        tabela: 'contratos',
        registro_id: contrato_id,
        descricao: 'Sub-etapa 1 do Cadastro concluída (documentos aprovados). Sub-etapa 2 (vistoria enxuta) liberada.',
        dados_novos: { documentos_aprovados_em: agora, documentos_aprovados_por: aprovado_por },
      });
    } catch (e) {
      console.warn('[aprovar-documentos-cadastro] log opcional falhou:', (e as Error).message);
    }

    return json({
      success: true,
      contrato_id,
      documentos_aprovados_em: agora,
      mensagem: 'Documentos aprovados. Agora analise a vistoria enxuta para concluir o Cadastro.',
    });
  } catch (e) {
    console.error('[aprovar-documentos-cadastro] erro:', e);
    return json({ success: false, error: (e as Error).message || 'Erro interno' }, 500);
  }
});
