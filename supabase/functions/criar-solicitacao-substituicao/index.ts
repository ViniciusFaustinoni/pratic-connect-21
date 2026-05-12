// Cria uma Solicitação de Substituição de Placa a partir da placa antiga.
// - Busca veículo + associado no SGA via sga-buscar-associado-completo
// - Importa associado para a base local (idempotente) via importar-associado-sga
// - Snapshota dados do veículo e do associado (jsonb) para uso na UI / termo
// - Cria registro em solicitacoes_substituicao_placa com status 'aguardando_termo'
// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { placa } = await req.json();
    const placaLimpa = String(placa || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (!placaLimpa || placaLimpa.length < 6) return json(400, { error: 'Placa inválida' });

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Identificar usuário (criado_por / consultor)
    let userId: string | null = null;
    try {
      const auth = req.headers.get('Authorization') || '';
      const token = auth.replace(/^Bearer\s+/i, '');
      if (token) {
        const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
        const { data } = await userClient.auth.getUser();
        userId = data?.user?.id || null;
      }
    } catch { /* ignore */ }

    // 1. Busca SGA (veículo + associado + boletos)
    const sgaResp = await admin.functions.invoke('sga-buscar-associado-completo', {
      body: { placa: placaLimpa },
    });
    if (sgaResp.error) {
      return json(502, { error: 'Falha ao consultar SGA: ' + sgaResp.error.message });
    }
    const sga = sgaResp.data as any;
    if (!sga?.encontrado) {
      return json(404, { error: 'Veículo não localizado no SGA para a placa informada' });
    }
    const veiculoSga = (sga.veiculos || []).find((v: any) => String(v.placa).toUpperCase() === placaLimpa)
      || sga.veiculos?.[0];
    if (!veiculoSga) return json(404, { error: 'Veículo SGA sem placa correspondente' });

    const cpf = String(sga.associado?.cpf || '').replace(/\D/g, '');
    if (cpf.length !== 11) return json(400, { error: 'CPF do associado SGA inválido' });

    // 2. Importa associado para base local (idempotente)
    const impResp = await admin.functions.invoke('importar-associado-sga', { body: { cpf } });
    if (impResp.error) {
      return json(502, { error: 'Falha ao importar associado do SGA: ' + impResp.error.message });
    }
    const associadoLocalId = (impResp.data as any)?.associado_id as string | null;
    if (!associadoLocalId) return json(500, { error: 'Import SGA não retornou associado_id' });

    // Localiza veículo local pela placa (após import)
    const { data: veiculoLocal } = await admin
      .from('veiculos')
      .select('id, placa')
      .eq('placa', placaLimpa)
      .maybeSingle();

    // 3. Snapshots
    const associadoSnapshot = {
      ...sga.associado,
      codigo_associado: sga.codigo_associado,
      saldo_devedor_total: sga.saldo_devedor_total,
      tem_debito: sga.tem_debito,
    };
    const veiculoSnapshot = {
      ...veiculoSga,
      boletos_abertos: veiculoSga.boletos_abertos || [],
    };

    // 4. Reaproveita solicitação aberta para a mesma placa, se houver
    const { data: existente } = await admin
      .from('solicitacoes_substituicao_placa')
      .select('id, status')
      .eq('veiculo_antigo_placa', placaLimpa)
      .in('status', ['aguardando_termo', 'termo_enviado', 'termo_assinado', 'cotacao_criada'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existente) {
      return json(200, { id: existente.id, reutilizada: true, status: existente.status });
    }

    // 5. Cria
    const { data: criada, error: insErr } = await admin
      .from('solicitacoes_substituicao_placa')
      .insert({
        associado_id: associadoLocalId,
        sga_codigo_associado: sga.codigo_associado || null,
        sga_codigo_veiculo: veiculoSga.codigo_veiculo || null,
        veiculo_antigo_id: veiculoLocal?.id || null,
        veiculo_antigo_placa: placaLimpa,
        veiculo_antigo_snapshot: veiculoSnapshot,
        associado_snapshot: associadoSnapshot,
        status: 'aguardando_termo',
        criado_por: userId,
        consultor_id: userId,
      })
      .select('id')
      .single();
    if (insErr) return json(500, { error: 'Erro ao criar solicitação: ' + insErr.message });

    return json(200, { id: criada.id, reutilizada: false, status: 'aguardando_termo' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro';
    console.error('[criar-solicitacao-substituicao]', e);
    return json(500, { error: msg });
  }
});
