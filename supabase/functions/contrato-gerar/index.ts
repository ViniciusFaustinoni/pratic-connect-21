import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GerarContratoPayload {
  cotacao_id: string;
  // vendedor_id não é mais necessário - resolvemos pelo token
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { cotacao_id } = await req.json() as GerarContratoPayload;

    if (!cotacao_id) {
      throw new Error('cotacao_id é obrigatório');
    }

    console.log('Gerando contrato para cotação:', cotacao_id);

    // 1. Resolver vendedor_id a partir do token de autorização
    let vendedor_id: string | null = null;
    const authHeader = req.headers.get('Authorization');
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (user && !authError) {
        // Buscar profile.id correspondente ao auth.users.id
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .single();
        
        if (profile && !profileError) {
          vendedor_id = profile.id;
          console.log('Vendedor resolvido pelo token:', vendedor_id);
        } else {
          console.log('Profile não encontrado para user:', user.id, profileError?.message);
        }
      } else if (authError) {
        console.log('Erro ao validar token:', authError.message);
      }
    }

    // 2. Buscar dados da cotação com lead
    const { data: cotacao, error: cotacaoError } = await supabase
      .from('cotacoes')
      .select(`
        *,
        lead:leads!fk_cotacoes_lead_id (
          id, nome, email, telefone, cpf
        ),
        plano:planos (
          id, nome, coberturas
        )
      `)
      .eq('id', cotacao_id)
      .maybeSingle();

    if (cotacaoError) {
      console.error('Erro ao buscar cotação:', cotacaoError);
      throw new Error(`Erro ao buscar cotação: ${cotacaoError.message}`);
    }

    if (!cotacao) {
      throw new Error('Cotação não encontrada');
    }

    console.log('Cotação encontrada:', cotacao.numero);

    // 3. Verificar se cotação está aceita
    if (cotacao.status !== 'aceita') {
      throw new Error(`Cotação não está com status "aceita". Status atual: ${cotacao.status}`);
    }

    // 4. Verificar se já existe contrato para esta cotação
    const { data: contratoExistente } = await supabase
      .from('contratos')
      .select('id, numero')
      .eq('cotacao_id', cotacao_id)
      .maybeSingle();

    if (contratoExistente) {
      throw new Error(`Já existe contrato ${contratoExistente.numero} para esta cotação`);
    }

    // 5. Se não encontrou vendedor pelo token, tentar usar o da cotação (se existir em profiles)
    if (!vendedor_id && cotacao.vendedor_id) {
      // Verificar se o vendedor_id da cotação existe em profiles
      const { data: vendedorProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', cotacao.vendedor_id)
        .maybeSingle();
      
      if (vendedorProfile) {
        vendedor_id = cotacao.vendedor_id;
        console.log('Vendedor resolvido pela cotação:', vendedor_id);
      } else {
        console.log('vendedor_id da cotação não existe em profiles, será null');
      }
    }

    // 6. Montar endereço completo
    const lead = cotacao.lead;
    const dadosExtras = cotacao.dados_extras as Record<string, any> | null;
    const cliente = dadosExtras?.cliente || {};
    const endereco = [
      cliente.endereco,
      cliente.bairro,
      cliente.cidade || cotacao.cidade,
      cliente.estado,
      cliente.cep
    ].filter(Boolean).join(', ');

    // 7. Criar o contrato
    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const numeroTemp = `CTR-${timestamp}-${random}`;

    console.log('Criando contrato com vendedor_id:', vendedor_id);

    const { data: contrato, error: contratoError } = await supabase
      .from('contratos')
      .insert({
        numero: numeroTemp,
        cotacao_id,
        lead_id: cotacao.lead_id,
        associado_id: cotacao.associado_id,
        plano_id: cotacao.plano_id,
        valor_adesao: cotacao.valor_adesao || 0,
        valor_mensal: cotacao.valor_total_mensal,
        vendedor_id: vendedor_id, // Pode ser null se não encontrar
        status: 'rascunho',
        validade_link: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        created_by: vendedor_id, // Pode ser null se não encontrar
      })
      .select()
      .single();

    if (contratoError) {
      console.error('Erro ao criar contrato:', contratoError);
      throw new Error(`Erro ao criar contrato: ${contratoError.message}`);
    }

    console.log('Contrato criado:', contrato.numero);

    // 8. Registrar no histórico
    await supabase.from('contratos_historico').insert({
      contrato_id: contrato.id,
      evento: 'gerado_de_cotacao',
      descricao: `Contrato gerado a partir da cotação ${cotacao.numero}`,
      usuario_id: vendedor_id,
      dados: { 
        cotacao_id, 
        cotacao_numero: cotacao.numero,
        valor_mensal: cotacao.valor_total_mensal 
      },
    });

    // 9. Atualizar status da cotação para "convertida"
    const { error: updateCotacaoError } = await supabase
      .from('cotacoes')
      .update({ status: 'convertida' })
      .eq('id', cotacao_id);

    if (updateCotacaoError) {
      console.warn('Erro ao atualizar status da cotação:', updateCotacaoError);
    }

    // 10. Atualizar etapa do lead para "proposta_enviada" ou "fechado"
    if (lead?.id) {
      await supabase
        .from('leads')
        .update({ etapa: 'proposta_enviada', updated_at: new Date().toISOString() })
        .eq('id', lead.id);
    }

    console.log('Contrato gerado com sucesso:', contrato.numero);

    return new Response(
      JSON.stringify({ 
        success: true, 
        contrato: {
          id: contrato.id,
          numero: contrato.numero,
          status: contrato.status,
          valor_mensal: contrato.valor_mensal,
          validade_link: contrato.validade_link,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})
