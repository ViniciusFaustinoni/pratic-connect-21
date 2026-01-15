import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GerarContratoPayload {
  cotacao_id: string;
  vendedor_id?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { cotacao_id, vendedor_id } = await req.json() as GerarContratoPayload;

    if (!cotacao_id) {
      throw new Error('cotacao_id é obrigatório');
    }

    console.log('Gerando contrato para cotação:', cotacao_id);

    // 1. Buscar dados da cotação com lead
    const { data: cotacao, error: cotacaoError } = await supabase
      .from('cotacoes')
      .select(`
        *,
        lead:leads!cotacoes_lead_id_fkey (
          id, nome, email, telefone, cpf
        ),
        plano:planos (
          id, nome, coberturas
        )
      `)
      .eq('id', cotacao_id)
      .single();

    if (cotacaoError || !cotacao) {
      console.error('Erro ao buscar cotação:', cotacaoError);
      throw new Error('Cotação não encontrada');
    }

    console.log('Cotação encontrada:', cotacao.numero);

    // 2. Verificar se cotação está aceita
    if (cotacao.status !== 'aceita') {
      throw new Error(`Cotação não está com status "aceita". Status atual: ${cotacao.status}`);
    }

    // 3. Verificar se já existe contrato para esta cotação
    const { data: contratoExistente } = await supabase
      .from('contratos')
      .select('id, numero, status, validade_link, valor_mensal')
      .eq('cotacao_id', cotacao_id)
      .maybeSingle();

    if (contratoExistente) {
      console.log('Contrato já existe para esta cotação:', contratoExistente.numero);
      return new Response(
        JSON.stringify({
          success: true,
          already_exists: true,
          contrato: contratoExistente,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 4. Criar lead retroativo se cotação não tem lead vinculado
    let leadId = cotacao.lead_id;
    let lead = cotacao.lead;
    
    if (!leadId && cotacao.veiculo_marca) {
      console.log('Criando lead retroativo para cotação sem lead');
      
      const { data: novoLead, error: leadError } = await supabase
        .from('leads')
        .insert({
          nome: `Cliente Cotação ${cotacao.numero}`,
          telefone: cotacao.lead?.telefone || '00000000000', // telefone é obrigatório
          origem: 'cotador', // Lead criado a partir do cotador de preços
          etapa: 'contrato_enviado',
          vendedor_id: vendedor_id || cotacao.vendedor_id,
          veiculo_marca: cotacao.veiculo_marca,
          veiculo_modelo: cotacao.veiculo_modelo,
          veiculo_ano: cotacao.veiculo_ano,
          veiculo_placa: cotacao.veiculo_placa,
          veiculo_fipe: cotacao.valor_fipe,
        })
        .select()
        .single();

      if (leadError) {
        console.warn('Erro ao criar lead retroativo:', leadError);
      } else if (novoLead) {
        leadId = novoLead.id;
        lead = novoLead;
        console.log('Lead retroativo criado:', leadId);
        
        // Atualizar cotação com o lead criado
        await supabase
          .from('cotacoes')
          .update({ lead_id: leadId })
          .eq('id', cotacao_id);
      }
    }

    // 5. Validar se lead tem dados mínimos para criar associado
    if (!lead?.cpf || lead.cpf.replace(/\D/g, '').length !== 11) {
      throw new Error('O lead precisa ter CPF cadastrado para gerar o contrato. Complete os dados do lead antes de continuar.');
    }

    if (!lead?.nome || lead.nome.includes('Cliente Cotação')) {
      throw new Error('O lead precisa ter nome cadastrado para gerar o contrato. Complete os dados do lead antes de continuar.');
    }

    // 6. Criar ou encontrar associado
    let associadoId = null;
    
    // Verificar se já existe associado com mesmo CPF
    const cpfLimpo = lead.cpf.replace(/\D/g, '');
    const { data: associadoExistente } = await supabase
      .from('associados')
      .select('id')
      .eq('cpf', cpfLimpo)
      .maybeSingle();
    
    if (associadoExistente) {
      associadoId = associadoExistente.id;
      console.log('Associado existente encontrado pelo CPF:', associadoId);
    } else {
      // Verificar por email se existir
      if (lead.email) {
        const { data: byEmail } = await supabase
          .from('associados')
          .select('id')
          .eq('email', lead.email)
          .maybeSingle();
        
        if (byEmail) {
          associadoId = byEmail.id;
          console.log('Associado existente encontrado pelo email:', associadoId);
        }
      }
    }
    
    // Se não encontrou, criar novo associado
    if (!associadoId) {
      const { data: novoAssociado, error: associadoError } = await supabase
        .from('associados')
        .insert({
          nome: lead.nome,
          email: lead.email || `${cpfLimpo}@temp.associado.local`,
          telefone: lead.telefone,
          cpf: cpfLimpo,
          plano_id: cotacao.plano_id,
          status: 'em_analise',
          data_adesao: new Date().toISOString().split('T')[0],
          dia_vencimento: 10,
        })
        .select('id')
        .single();

      if (associadoError) {
        console.error('Erro ao criar associado:', associadoError);
        throw new Error(`Erro ao criar associado: ${associadoError.message}`);
      }
      
      associadoId = novoAssociado.id;
      console.log('Novo associado criado:', associadoId);
    }

    // 7. Montar endereço completo (leads não possui colunas de endereço)
    const endereco = [
      cotacao.cidade,
      cotacao.regiao,
    ].filter(Boolean).join(' - ');

    // 8. Criar o contrato
    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const numeroTemp = `CTR-${timestamp}-${random}`;

    const { data: contrato, error: contratoError } = await supabase
      .from('contratos')
      .insert({
        numero: numeroTemp,
        cotacao_id,
        lead_id: leadId, // Usa o lead original ou o criado retroativamente
        associado_id: associadoId, // Usa o associado criado/encontrado
        plano_id: cotacao.plano_id,
        valor_adesao: cotacao.valor_adesao || 0,
        valor_mensal: cotacao.valor_total_mensal || cotacao.valor_mensal,
        vendedor_id: vendedor_id || cotacao.vendedor_id,
        status: 'rascunho',
        
        // Dados do veículo (da cotação)
        veiculo_marca: cotacao.veiculo_marca,
        veiculo_modelo: cotacao.veiculo_modelo,
        veiculo_ano: cotacao.veiculo_ano,
        veiculo_placa: cotacao.veiculo_placa,
        veiculo_valor_fipe: cotacao.valor_fipe,
        
        // Dados do cliente (do lead)
        cliente_nome: lead?.nome,
        cliente_email: lead?.email,
        cliente_telefone: lead?.telefone,
        cliente_cpf: lead?.cpf,
        
        data_inicio: new Date().toISOString().split('T')[0],
        validade_link: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 dias
        created_by: vendedor_id || cotacao.vendedor_id,
      })
      .select()
      .single();

    if (contratoError) {
      console.error('Erro ao criar contrato:', contratoError);
      throw new Error(`Erro ao criar contrato: ${contratoError.message}`);
    }

    console.log('Contrato criado:', contrato.numero);

    // 9. Registrar no histórico (trigger já faz automaticamente, mas podemos adicionar detalhes)
    await supabase.from('contratos_historico').insert({
      contrato_id: contrato.id,
      evento: 'gerado_de_cotacao',
      descricao: `Contrato gerado a partir da cotação ${cotacao.numero}`,
      usuario_id: vendedor_id || cotacao.vendedor_id,
      dados: { 
        cotacao_id, 
        cotacao_numero: cotacao.numero,
        valor_mensal: cotacao.valor_mensal 
      },
    });

    // 10. Vincular associado ao contrato
    if (associadoId) {
      await supabase
        .from('associados')
        .update({ contrato_id: contrato.id })
        .eq('id', associadoId);
      console.log('Associado vinculado ao contrato:', associadoId);
    }

    // 11. Atualizar status da cotação para "convertida"
    const { error: updateCotacaoError } = await supabase
      .from('cotacoes')
      .update({ status: 'convertida' })
      .eq('id', cotacao_id);

    if (updateCotacaoError) {
      console.warn('Erro ao atualizar status da cotação:', updateCotacaoError);
    }

    // 12. Atualizar etapa do lead para "contrato_enviado"
    if (leadId) {
      await supabase
        .from('leads')
        .update({ etapa: 'contrato_enviado', updated_at: new Date().toISOString() })
        .eq('id', leadId);
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
