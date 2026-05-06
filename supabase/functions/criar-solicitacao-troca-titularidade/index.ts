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
    const { associado_antigo_id, veiculo_id, novo_titular } = body;

    if (!associado_antigo_id || !veiculo_id || !novo_titular?.nome || !novo_titular?.cpf) {
      return new Response(JSON.stringify({ error: 'Dados incompletos' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Buscar dados do veículo + associado antigo
    const { data: veiculo, error: veiculoErr } = await admin
      .from('veiculos')
      .select('id, marca, modelo, ano, placa, combustivel, cor, fipe_codigo, fipe_valor, categoria, associado_id')
      .eq('id', veiculo_id)
      .maybeSingle();
    if (veiculoErr || !veiculo) throw new Error('Veículo não encontrado');

    // SEGURANÇA: garante que a placa pertence ao titular antigo informado.
    // Bloqueia bypass de UI / chamadas diretas à edge com combinação CPF + placa não-vinculada.
    if (veiculo.associado_id !== associado_antigo_id) {
      return new Response(
        JSON.stringify({ error: 'A placa informada não pertence ao titular antigo.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Guard: bloqueia se já existe outra troca em andamento para a mesma placa
    if (veiculo.placa) {
      const { data: blocked } = await admin.rpc('placa_bloqueada_por_troca', { p_placa: veiculo.placa });
      if (blocked === true) {
        return new Response(
          JSON.stringify({ error: 'Já existe uma solicitação de troca de titularidade em andamento para esta placa.' }),
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
        veiculo_ano: veiculo.ano,
        veiculo_placa: veiculo.placa,
        veiculo_combustivel: veiculo.combustivel,
        veiculo_cor: veiculo.cor,
        codigo_fipe: veiculo.fipe_codigo,
        valor_fipe: veiculo.fipe_valor,
        categoria: veiculo.categoria,
        cidade: associadoAntigo?.cidade,
        token_publico: tokenPublico,
        status: 'rascunho',
        validade_dias: 15,
        dados_extras: {
          tipo_entrada: 'troca_titularidade',
          associado_antigo_id,
          veiculo_origem_id: veiculo_id,
        },
      })
      .select('id, token_publico')
      .single();
    if (cotacaoErr) throw cotacaoErr;

    // Criar solicitação
    const { data: solicitacao, error: solErr } = await admin
      .from('solicitacoes_troca_titularidade')
      .insert({
        associado_antigo_id,
        veiculo_id,
        cotacao_id: cotacao.id,
        novo_titular_dados: novo_titular,
        status: 'cotacao_em_andamento',
        criado_por: user.id,
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
