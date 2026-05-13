// Cria (idempotente) a cotação vinculada a uma solicitação de Troca de Titularidade.
// Disparada manualmente pelo botão "Realizar Cotação" do modal de detalhes da troca,
// somente após o termo de cancelamento ter sido assinado pelo titular antigo.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  solicitacao_id: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: RequestBody = await req.json();
    const { solicitacao_id } = body;
    if (!solicitacao_id) {
      return new Response(JSON.stringify({ error: 'solicitacao_id obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1) Carregar solicitação
    const { data: sol, error: solErr } = await admin
      .from('solicitacoes_troca_titularidade')
      .select('id, status, cotacao_id, veiculo_id, novo_titular_dados, associado_antigo_id, termo_cancelamento_assinado_em')
      .eq('id', solicitacao_id)
      .maybeSingle();
    if (solErr) throw solErr;
    if (!sol) {
      return new Response(JSON.stringify({ error: 'Solicitação não encontrada' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Idempotência: se já existe cotação, retorna ela
    if (sol.cotacao_id) {
      const { data: cotEx } = await admin
        .from('cotacoes')
        .select('id, token_publico')
        .eq('id', sol.cotacao_id)
        .maybeSingle();
      if (cotEx) {
        return new Response(JSON.stringify({
          success: true,
          cotacao_id: cotEx.id,
          cotacao_token: cotEx.token_publico,
          already_exists: true,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Guard: termo precisa estar assinado
    if (!sol.termo_cancelamento_assinado_em) {
      return new Response(JSON.stringify({
        error: 'Termo de cancelamento ainda não foi assinado pelo titular antigo.',
        code: 'TERMO_NAO_ASSINADO',
      }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // DEPRECATED: criação de cotação avulsa antes da escolha do plano foi removida.
    // O fluxo correto agora abre o `CotacaoFormDialog` padrão e vincula via
    // `vincular-cotacao-troca`. Esta edge só responde no modo idempotente
    // (cotação já existente — tratado no bloco acima).
    return new Response(JSON.stringify({
      error: 'Criação de cotação avulsa de troca foi descontinuada. Use o formulário padrão de cotação.',
      code: 'FLUXO_DESCONTINUADO',
    }), { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // 2) Carregar veículo e enriquecer (FIPE/placa) se faltar dado
    const colunas = 'id, marca, modelo, ano_modelo, ano_fabricacao, placa, combustivel, cor, codigo_fipe, valor_fipe';
    const { data: veiculo, error: vErr } = await admin
      .from('veiculos').select(colunas).eq('id', sol.veiculo_id).maybeSingle();
    if (vErr) throw vErr;
    if (!veiculo) {
      return new Response(JSON.stringify({ error: 'Veículo não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const faltaAlgo =
      !veiculo.cor || !veiculo.combustivel ||
      !veiculo.valor_fipe || Number(veiculo.valor_fipe) <= 0 || !veiculo.codigo_fipe ||
      !veiculo.ano_modelo || !veiculo.ano_fabricacao;

    if (faltaAlgo) {
      try {
        let tipo = 'carros';
        if (veiculo.marca && veiculo.modelo) {
          try {
            const { data: mm } = await admin
              .from('marcas_modelos')
              .select('tipo_veiculo')
              .ilike('marca', String(veiculo.marca))
              .ilike('modelo', String(veiculo.modelo))
              .limit(1).maybeSingle();
            const tv = String((mm as any)?.tipo_veiculo || '').toLowerCase();
            if (tv.includes('moto')) tipo = 'motos';
            else if (tv.includes('caminh')) tipo = 'caminhoes';
          } catch (_) { /* default carros */ }
        }
        const ano = String(veiculo.ano_modelo || veiculo.ano_fabricacao || '');
        const placaUp = String(veiculo.placa || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

        const ctrlA = new AbortController();
        const tA = setTimeout(() => ctrlA.abort(), 8000);
        const platePromise = placaUp
          ? fetch(`${SUPABASE_URL}/functions/v1/plate-lookup`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
              body: JSON.stringify({ placa: placaUp }),
              signal: ctrlA.signal,
            }).finally(() => clearTimeout(tA)).catch((e) => { console.warn('[criar-cotacao-troca] plate-lookup err:', (e as Error).message); return null; })
          : Promise.resolve(null);

        const ctrlB = new AbortController();
        const tB = setTimeout(() => ctrlB.abort(), 8000);
        const params = new URLSearchParams({ action: 'buscar-por-nome', tipo });
        if (veiculo.marca) params.set('marca', String(veiculo.marca));
        if (veiculo.modelo) params.set('modelo', String(veiculo.modelo));
        if (ano) params.set('ano', ano);
        const fipePromise = (veiculo.marca && veiculo.modelo)
          ? fetch(`${SUPABASE_URL}/functions/v1/fipe-lookup?${params}`, {
              headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, apikey: SUPABASE_ANON_KEY },
              signal: ctrlB.signal,
            }).finally(() => clearTimeout(tB)).catch((e) => { console.warn('[criar-cotacao-troca] fipe-lookup err:', (e as Error).message); return null; })
          : Promise.resolve(null);

        const [plateResp, fipeResp] = await Promise.all([platePromise, fipePromise]);
        const updates: Record<string, any> = {};
        if (plateResp && plateResp.ok) {
          try {
            const j: any = await plateResp.json();
            const vd = j?.vehicleData || {};
            const fd = j?.fipeData || null;
            if (!veiculo.cor && vd.cor) updates.cor = String(vd.cor).trim();
            if (!veiculo.combustivel && vd.combustivel) updates.combustivel = String(vd.combustivel).trim();
            if (!veiculo.ano_modelo && vd.ano_modelo) updates.ano_modelo = Number(vd.ano_modelo) || null;
            if (!veiculo.ano_fabricacao && vd.ano_fabricacao) updates.ano_fabricacao = Number(vd.ano_fabricacao) || null;
            if (fd && (!veiculo.valor_fipe || Number(veiculo.valor_fipe) <= 0)) {
              const valorNum = Number(String(fd.valor || '').replace(/[^\d,]/g, '').replace(',', '.'));
              if (valorNum > 0) updates.valor_fipe = valorNum;
              if (!veiculo.codigo_fipe && fd.codigo) updates.codigo_fipe = fd.codigo;
            }
          } catch (e) { console.warn('[criar-cotacao-troca] parse plate falhou:', (e as Error).message); }
        }
        if (fipeResp && fipeResp.ok) {
          try {
            const j: any = await fipeResp.json();
            const valor = Number(j?.data?.valorNumerico) || 0;
            const codigo = j?.data?.codigoFipe || null;
            const valorFipeAtual = updates.valor_fipe ?? veiculo.valor_fipe;
            if (valor > 0 && (!valorFipeAtual || Number(valorFipeAtual) <= 0)) updates.valor_fipe = valor;
            if (codigo && !(updates.codigo_fipe || veiculo.codigo_fipe)) updates.codigo_fipe = codigo;
          } catch (e) { console.warn('[criar-cotacao-troca] parse fipe falhou:', (e as Error).message); }
        }
        if (Object.keys(updates).length > 0) {
          await admin.from('veiculos').update(updates).eq('id', veiculo.id);
          Object.assign(veiculo, updates);
        }
      } catch (e) {
        console.warn('[criar-cotacao-troca] enriquecimento ignorado:', (e as Error).message);
      }
    }

    const { data: assocAntigo } = await admin
      .from('associados').select('cidade, estado').eq('id', sol.associado_antigo_id).maybeSingle();

    const novo = (sol.novo_titular_dados as any) || {};
    const tokenPublico = crypto.randomUUID().replace(/-/g, '');

    // 3) Criar cotação (rascunho)
    const { data: cotacao, error: cotErr } = await admin
      .from('cotacoes')
      .insert({
        nome_solicitante: novo.nome,
        cliente_cpf: novo.cpf,
        email_solicitante: novo.email || null,
        telefone1_solicitante: novo.telefone || null,
        veiculo_marca: veiculo.marca,
        veiculo_modelo: veiculo.modelo,
        veiculo_ano: veiculo.ano_modelo || veiculo.ano_fabricacao,
        veiculo_placa: veiculo.placa,
        veiculo_combustivel: veiculo.combustivel,
        veiculo_cor: veiculo.cor,
        codigo_fipe: veiculo.codigo_fipe,
        valor_fipe: veiculo.valor_fipe,
        valor_cota: 0,
        valor_adesao: 0,
        valor_total_mensal: 0,
        cidade: assocAntigo?.cidade,
        token_publico: tokenPublico,
        status: 'rascunho',
        validade_dias: 15,
        dados_extras: {
          tipo_entrada: 'troca_titularidade',
          associado_antigo_id: sol.associado_antigo_id,
          veiculo_origem_id: veiculo.id,
          solicitacao_troca_id: sol.id,
        },
      })
      .select('id, token_publico')
      .single();
    if (cotErr) throw cotErr;

    // 4) Vincular na solicitação
    await admin
      .from('solicitacoes_troca_titularidade')
      .update({ cotacao_id: cotacao.id })
      .eq('id', sol.id);

    return new Response(JSON.stringify({
      success: true,
      cotacao_id: cotacao.id,
      cotacao_token: cotacao.token_publico,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('[criar-cotacao-troca]', e);
    const msg = e instanceof Error ? e.message : 'erro';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
