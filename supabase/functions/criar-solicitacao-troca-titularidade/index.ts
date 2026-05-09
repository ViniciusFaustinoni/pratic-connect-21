// Cria uma nova solicitação de Troca de Titularidade + cotação base vinculada
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NovoTitularDados {
  nome: string;
  cpf: string;
  email?: string;
  telefone?: string;
}

interface RequestBody {
  associado_antigo_id: string;
  veiculo_id?: string;
  veiculo_placa?: string; // fallback quando o UUID local está desatualizado
  novo_titular: NovoTitularDados;
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
    const { associado_antigo_id, veiculo_id, veiculo_placa, novo_titular } = body;

    if (!associado_antigo_id || (!veiculo_id && !veiculo_placa) || !novo_titular?.nome || !novo_titular?.cpf) {
      return new Response(JSON.stringify({ error: 'Dados incompletos' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Buscar veículo: prioriza UUID; fallback por placa+associado (resolve cache stale do front).
    const colunas = 'id, marca, modelo, ano_modelo, ano_fabricacao, placa, combustivel, cor, codigo_fipe, valor_fipe, associado_id';
    let veiculo: any = null;
    let veiculoErr: any = null;
    if (veiculo_id) {
      const r = await admin.from('veiculos').select(colunas).eq('id', veiculo_id).maybeSingle();
      veiculo = r.data; veiculoErr = r.error;
    }
    if (!veiculo && veiculo_placa) {
      const placaUp = veiculo_placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      const r = await admin
        .from('veiculos')
        .select(colunas)
        .eq('associado_id', associado_antigo_id)
        .ilike('placa', placaUp)
        .maybeSingle();
      veiculo = r.data; veiculoErr = r.error || veiculoErr;
    }
    if (!veiculo) {
      console.error('[criar-solicitacao-troca] veículo não localizado', { veiculo_id, veiculo_placa, associado_antigo_id, dbError: veiculoErr });
      return new Response(
        JSON.stringify({ error: 'Veículo não encontrado para o titular informado. Atualize a página e tente novamente.', debug: veiculoErr?.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // FIPE atualizada: mesma busca da cotação. Se o veículo antigo não tem
    // valor_fipe / codigo_fipe (cadastros legados), consulta a edge `fipe-lookup`
    // para que o card em /cadastro/veiculos e a cotação do novo titular já
    // exibam o valor correto. Falhas não bloqueiam a criação da troca.
    const precisaLookupFipe = !veiculo.valor_fipe || Number(veiculo.valor_fipe) <= 0 || !veiculo.codigo_fipe;
    if (precisaLookupFipe && veiculo.marca && veiculo.modelo) {
      try {
        // Deduz o tipo (carros/motos/caminhoes) a partir de marcas_modelos
        let tipo = 'carros';
        try {
          const { data: mm } = await admin
            .from('marcas_modelos')
            .select('tipo_veiculo')
            .ilike('marca', String(veiculo.marca))
            .ilike('modelo', String(veiculo.modelo))
            .limit(1)
            .maybeSingle();
          const tv = String((mm as any)?.tipo_veiculo || '').toLowerCase();
          if (tv.includes('moto')) tipo = 'motos';
          else if (tv.includes('caminh')) tipo = 'caminhoes';
        } catch (_) { /* default carros */ }

        const ano = String(veiculo.ano_modelo || veiculo.ano_fabricacao || '');
        const params = new URLSearchParams({
          action: 'buscar-por-nome',
          tipo,
          marca: String(veiculo.marca),
          modelo: String(veiculo.modelo),
        });
        if (ano) params.set('ano', ano);

        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 8000);
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/fipe-lookup?${params}`, {
          headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, apikey: SUPABASE_ANON_KEY },
          signal: ctrl.signal,
        }).finally(() => clearTimeout(t));

        if (resp.ok) {
          const json: any = await resp.json();
          const valor = Number(json?.data?.valorNumerico) || 0;
          const codigo = json?.data?.codigoFipe || null;
          if (valor > 0) {
            await admin.from('veiculos').update({
              valor_fipe: valor,
              codigo_fipe: codigo || veiculo.codigo_fipe || null,
            }).eq('id', veiculo.id);
            veiculo.valor_fipe = valor;
            if (codigo) veiculo.codigo_fipe = codigo;
            console.log(`[criar-solicitacao-troca] FIPE atualizada via lookup: R$ ${valor} (${codigo})`);
          } else {
            console.warn('[criar-solicitacao-troca] FIPE lookup retornou sem valor', json);
          }
        } else {
          console.warn('[criar-solicitacao-troca] FIPE lookup falhou', resp.status);
        }
      } catch (e) {
        console.warn('[criar-solicitacao-troca] erro no FIPE lookup (ignorado):', (e as Error).message);
      }
    }

    // SEGURANÇA: garante que a placa pertence ao titular antigo informado.
    // Bloqueia bypass de UI / chamadas diretas à edge com combinação CPF + placa não-vinculada.
    if (veiculo.associado_id !== associado_antigo_id) {
      return new Response(
        JSON.stringify({ error: 'A placa informada não pertence ao titular antigo.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Guard: bloqueia se já existe outra troca em andamento para a mesma placa.
    // Retorna detalhes da solicitação bloqueante para o operador poder cancelá-la
    // pela UI sem precisar consultar o banco.
    if (veiculo.placa) {
      const placaNorm = String(veiculo.placa).toUpperCase().replace(/[^A-Z0-9]/g, '');
      const { data: bloqueantes } = await admin
        .from('solicitacoes_troca_titularidade')
        .select('id, status, created_at, novo_titular_dados, veiculo_id')
        .in('status', ['cotacao_em_andamento','aguardando_cadastro','aguardando_monitoramento','aguardando_vistoria','liberada_para_assinatura'])
        .order('created_at', { ascending: false });

      const conflito = (bloqueantes || []).find((s: any) => {
        // checa via veículo (mesmo id) — placa pode ter normalização diferente
        return s.veiculo_id === veiculo.id;
      });

      if (conflito) {
        const nomeBloq = (conflito.novo_titular_dados as any)?.nome || 'titular não informado';
        return new Response(
          JSON.stringify({
            error: `Já existe uma solicitação de troca em andamento para a placa ${veiculo.placa} (status: ${conflito.status}, novo titular: ${nomeBloq}, criada em ${new Date(conflito.created_at).toLocaleString('pt-BR')}). Cancele a solicitação anterior antes de criar uma nova.`,
            code: 'TROCA_EM_ANDAMENTO',
            solicitacao_bloqueante: {
              id: conflito.id,
              status: conflito.status,
              created_at: conflito.created_at,
              nome_novo_titular: nomeBloq,
            },
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    const { data: associadoAntigo } = await admin
      .from('associados')
      .select('id, nome, cidade, estado')
      .eq('id', associado_antigo_id)
      .maybeSingle();

    // Criar cotação base com tipo_entrada=troca_titularidade em dados_extras
    const tokenPublico = crypto.randomUUID().replace(/-/g, '');
    const { data: cotacao, error: cotacaoErr } = await admin
      .from('cotacoes')
      .insert({
        nome_solicitante: novo_titular.nome,
        cliente_cpf: novo_titular.cpf,
        email_solicitante: novo_titular.email || null,
        telefone1_solicitante: novo_titular.telefone || null,
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
        cidade: associadoAntigo?.cidade,
        token_publico: tokenPublico,
        status: 'rascunho',
        validade_dias: 15,
        dados_extras: {
          tipo_entrada: 'troca_titularidade',
          associado_antigo_id,
          veiculo_origem_id: veiculo.id,
        },
      })
      .select('id, token_publico')
      .single();
    if (cotacaoErr) throw cotacaoErr;

    // criado_por referencia profiles.id (não auth.users.id)
    const { data: profileRow } = await admin
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    const criadoPorProfileId = profileRow?.id ?? null;

    // Criar solicitação
    const { data: solicitacao, error: solErr } = await admin
      .from('solicitacoes_troca_titularidade')
      .insert({
        associado_antigo_id,
        veiculo_id: veiculo.id,
        cotacao_id: cotacao.id,
        novo_titular_dados: novo_titular,
        status: 'cotacao_em_andamento',
        criado_por: criadoPorProfileId,
      })
      .select('id, token_publico')
      .single();
    if (solErr) throw solErr;

    // Disparo automático do termo de cancelamento (best-effort, NÃO bloqueia criação).
    // Reaproveita 100% a edge `enviar-termo-cancelamento-troca`. Timeout de 12s
    // para não travar a UI caso Autentique/WhatsApp estejam lentos.
    let termo_enviado_automaticamente = false;
    let termo_envio_erro: string | null = null;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 12000);
      const resp = await admin.functions.invoke('enviar-termo-cancelamento-troca', {
        body: { solicitacao_id: solicitacao.id },
      });
      clearTimeout(t);
      if (resp.error) throw resp.error;
      if ((resp.data as any)?.error) throw new Error((resp.data as any).error);
      termo_enviado_automaticamente = true;
    } catch (envErr) {
      termo_envio_erro = envErr instanceof Error ? envErr.message : 'Falha desconhecida';
      console.error('[criar-solicitacao-troca] envio automático do termo falhou:', termo_envio_erro);
    }

    return new Response(
      JSON.stringify({
        success: true,
        solicitacao_id: solicitacao.id,
        cotacao_id: cotacao.id,
        cotacao_token: cotacao.token_publico,
        solicitacao_token: solicitacao.token_publico,
        termo_enviado_automaticamente,
        termo_envio_erro,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('[criar-solicitacao-troca]', e);
    const msg = e instanceof Error ? e.message : 'erro';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
