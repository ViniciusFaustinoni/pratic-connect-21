import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    const body = await req.json().catch(() => ({}));
    const dias = Math.min(Math.max(Number(body.dias ?? 28), 1), 90);
    const batchSize = Math.min(Math.max(Number(body.batch_size ?? 20), 1), 80);
    const dryRun = body.dry_run === true;
    const delayMs = Math.min(Math.max(Number(body.delay_ms ?? 300), 50), 3000);
    const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();

    await supabase
      .from('sga_sync_queue')
      .update({
        status: 'pendente',
        proximo_reenvio_em: new Date().toISOString(),
        erro_ultimo: 'Reaberto pela reconciliação automática SGA: processamento travado antigo',
      })
      .eq('status', 'processando')
      .lt('ultima_tentativa_em', new Date(Date.now() - 10 * 60 * 1000).toISOString());

    await supabase
      .from('sga_sync_queue')
      .update({
        status: 'pendente',
        proximo_reenvio_em: new Date().toISOString(),
        erro_ultimo: 'Reaberto pela reconciliação automática SGA: falha recuperável',
      })
      .eq('status', 'falha_permanente')
      .or([
        'erro_ultimo.ilike.%Placa duplicada%',
        'erro_ultimo.ilike.%HTML%',
        'erro_ultimo.ilike.%502%',
        'erro_ultimo.ilike.%rate%',
        'erro_ultimo.ilike.%token%',
        'erro_ultimo.ilike.%autorizado%',
        'erro_ultimo.ilike.%autentica%',
        'erro_ultimo.ilike.%restri%hor%',
        'erro_ultimo.ilike.%401%',
      ].join(','));

    const { data: candidatosBase, error } = await supabase
      .from('veiculos')
      .select(`
        id, placa, codigo_hinova, sincronizado_hinova, status_sga, cobertura_roubo_furto, cobertura_total, created_at,
        associados:associado_id!inner(id, nome, codigo_hinova, sincronizado_hinova),
        instalacoes:instalacoes(id, status, concluida_em)
      `)
      .not('associados.codigo_hinova', 'is', null)
      .or(`created_at.gte.${desde},updated_at.gte.${desde}`)
      .order('updated_at', { ascending: false })
      .limit(batchSize * 3);

    if (error) throw error;

    const { data: filaAberta } = await supabase
      .from('sga_sync_queue')
      .select('veiculo_id')
      .in('status', ['pendente', 'processando', 'falha_permanente'])
      .limit(batchSize * 3);

    const { data: instalacoesRecentes } = await supabase
      .from('instalacoes')
      .select('veiculo_id')
      .eq('status', 'concluida')
      .gte('concluida_em', desde)
      .limit(batchSize * 3);

    const idsExtras = Array.from(new Set([
      ...((filaAberta || []).map((i: any) => i.veiculo_id).filter(Boolean)),
      ...((instalacoesRecentes || []).map((i: any) => i.veiculo_id).filter(Boolean)),
    ]));

    const idsJaCarregados = new Set((candidatosBase || []).map((v: any) => v.id));
    const idsParaCarregar = idsExtras.filter((id) => !idsJaCarregados.has(id));

    const { data: candidatosExtras } = idsParaCarregar.length
      ? await supabase
          .from('veiculos')
          .select(`
            id, placa, codigo_hinova, sincronizado_hinova, status_sga, cobertura_roubo_furto, cobertura_total, created_at,
            associados:associado_id!inner(id, nome, codigo_hinova, sincronizado_hinova),
            instalacoes:instalacoes(id, status, concluida_em)
          `)
          .in('id', idsParaCarregar)
          .not('associados.codigo_hinova', 'is', null)
      : { data: [] };

    const candidatos = [...(candidatosBase || []), ...(candidatosExtras || [])];

    const selecionados = (candidatos || [])
      .map((v: any) => {
        const instalacaoConcluida = (v.instalacoes || []).some((i: any) => i.status === 'concluida' || i.concluida_em);
        const exigeSga = v.cobertura_roubo_furto === true || v.cobertura_total === true || instalacaoConcluida;
        const semVeiculoSga = !v.codigo_hinova || v.sincronizado_hinova !== true;
        const travado = ['erro_sincronizacao', 'sincronizando'].includes(String(v.status_sga || ''));
        // Destino: instalação concluída OU cobertura_total → ativo; só R/F sem instalação → pendente
        const destino = (v.cobertura_total === true || instalacaoConcluida) ? 'ativo' : 'pendente';
        return { ...v, instalacaoConcluida, exigeSga, semVeiculoSga, travado, destino };
      })
      .filter((v: any) => v.exigeSga && (v.semVeiculoSga || v.travado || body.force_resync_media === true))
      .slice(0, batchSize);

    if (dryRun) {
      return json(200, {
        success: true,
        dry_run: true,
        dias,
        total_candidatos: candidatos.length,
        selecionados: selecionados.map((v: any) => ({
          veiculo_id: v.id,
          associado_id: v.associados?.id,
          nome: v.associados?.nome,
          placa: v.placa,
          status_sga: v.status_sga,
          codigo_veiculo_hinova: v.codigo_hinova,
          destino: v.destino,
          instalacao_concluida: v.instalacaoConcluida,
        })),
      });
    }

    let disparados = 0;
    let erros = 0;
    const resultados: unknown[] = [];

    for (const v of selecionados as any[]) {
      try {
        const { data, error: invokeError } = await supabase.functions.invoke('sga-hinova-sync', {
          body: {
            veiculo_id: v.id,
            associado_id: v.associados.id,
            status_sga_destino: v.destino,
            force_resync_media: true,
            etapa_origem: 'sga-reprocessar-cotacoes-ativacoes',
            motivo_decisao: v.destino === 'ativo'
              ? 'Reconciliação automática: veículo com Proteção 360/Roubo-Furto deve estar ativo no SGA.'
              : 'Reconciliação automática: instalação/conversão recente deve ter veículo, fotos e documentos no SGA.',
          },
        });
        if (invokeError) throw invokeError;
        disparados++;
        resultados.push({ veiculo_id: v.id, placa: v.placa, status: data?.status || 'invocado' });
      } catch (e: any) {
        erros++;
        resultados.push({ veiculo_id: v.id, placa: v.placa, erro: String(e?.message || e) });
      }
      await sleep(delayMs);
    }

    return json(200, { success: true, dias, avaliados: candidatos.length, selecionados: selecionados.length, disparados, erros, resultados });
  } catch (err: any) {
    console.error('[sga-reprocessar-cotacoes-ativacoes] erro:', err);
    return json(500, { success: false, error: String(err?.message || err) });
  }
});