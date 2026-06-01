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
    const body = await req.json();
    const { placa, placa_nova } = body || {};
    const placaLimpa = String(placa || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (!placaLimpa || placaLimpa.length < 6) return json(400, { error: 'Placa inválida' });
    const placaNovaLimpa = String(placa_nova || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase() || null;
    if (placaNovaLimpa && !/^[A-Z]{3}[0-9][0-9A-Z][0-9]{2}$/.test(placaNovaLimpa)) {
      return json(400, { error: 'Placa nova inválida' });
    }

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

    // Se SGA retornou transitório, NÃO afirmamos "não encontrado" — pedimos retry
    if (sga?.erro_transitorio) {
      return json(503, {
        error: 'API SGA temporariamente indisponível. Tente novamente em instantes.',
        erro_transitorio: true,
        motivo: sga.motivo || null,
      });
    }

    let veiculoSga: any = null;
    let associadoSgaInfo: any = null;
    let codigoAssociadoSga: number | null = null;
    let cpf = '';

    if (sga?.encontrado) {
      veiculoSga = (sga.veiculos || []).find((v: any) => String(v.placa).toUpperCase() === placaLimpa)
        || sga.veiculos?.[0];
      if (!veiculoSga) return json(404, { error: 'Veículo SGA sem placa correspondente' });
      associadoSgaInfo = sga.associado;
      codigoAssociadoSga = sga.codigo_associado || null;
      cpf = String(sga.associado?.cpf || '').replace(/\D/g, '');
    } else {
      // FALLBACK: SGA não tem (instabilidade ou veículo local não sincronizado).
      // Resolve via base local: veiculos.placa → associado_id → associados.cpf.
      const placaComHifen = `${placaLimpa.slice(0, 3)}-${placaLimpa.slice(3)}`;
      const { data: vLocal, error: vLocalErr } = await admin
        .from('veiculos')
        .select('id, placa, marca, modelo, ano_modelo, ano_fabricacao, chassi, renavam, associado_id, codigo_hinova, associados(id, nome, cpf, email, telefone, codigo_hinova)')
        .in('placa', [placaLimpa, placaComHifen])
        .maybeSingle();
      if (vLocalErr) {
        console.error('[criar-solicitacao-substituicao] erro fallback local:', vLocalErr);
        return json(500, { error: 'Erro ao consultar base local: ' + vLocalErr.message });
      }
      if (!vLocal || !vLocal.associados) {
        return json(404, { error: 'Veículo não localizado no SGA nem na base local para a placa informada' });
      }
      const aLocal: any = vLocal.associados;
      veiculoSga = {
        codigo_veiculo: vLocal.codigo_hinova ? Number(vLocal.codigo_hinova) : null,
        placa: vLocal.placa,
        marca: vLocal.marca,
        modelo: vLocal.modelo,
        ano: vLocal.ano_modelo || vLocal.ano_fabricacao || null,
        chassi: vLocal.chassi,
        renavam: vLocal.renavam,
        saldo_devedor: 0,
        boletos_abertos: [],
      };
      associadoSgaInfo = { nome: aLocal.nome, cpf: aLocal.cpf, email: aLocal.email, telefone: aLocal.telefone };
      codigoAssociadoSga = aLocal.codigo_hinova ? Number(aLocal.codigo_hinova) : null;
      cpf = String(aLocal.cpf || '').replace(/\D/g, '');
    }

    if (cpf.length !== 11) return json(400, { error: 'CPF do associado inválido (SGA/local)' });

    // 2. Importa associado para base local (idempotente)
    // IMPORTANTE: importar-associado-sga exige Authorization (JWT de usuário).
    // supabase-js functions.invoke() sobrescreve Authorization com a chave do client
    // (service-role), então usamos fetch direto para garantir o JWT do usuário.
    const authHeader = req.headers.get('Authorization') || '';
    const impHttp = await fetch(`${SUPABASE_URL}/functions/v1/importar-associado-sga`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: ANON_KEY,
        Authorization: authHeader || `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({ cpf }),
    });
    const impText = await impHttp.text();
    if (!impHttp.ok) {
      return json(502, { error: `Falha ao importar associado do SGA (${impHttp.status}): ${impText.slice(0, 300)}` });
    }
    let impData: any = {};
    try { impData = JSON.parse(impText); } catch { /* ignore */ }
    const associadoLocalId = impData?.associado_id as string | null;
    if (!associadoLocalId) return json(500, { error: 'Import SGA não retornou associado_id' });

    // Localiza veículo local pela placa (após import)
    const { data: veiculoLocal } = await admin
      .from('veiculos')
      .select('id, placa')
      .eq('placa', placaLimpa)
      .maybeSingle();

    // 3. Snapshots
    const associadoSnapshot = {
      ...(associadoSgaInfo || {}),
      codigo_associado: codigoAssociadoSga,
      saldo_devedor_total: sga?.saldo_devedor_total ?? 0,
      tem_debito: sga?.tem_debito ?? false,
      origem: sga?.encontrado ? 'sga' : 'local_fallback',
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
        sga_codigo_associado: codigoAssociadoSga,
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
