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
        plano:planos!cotacoes_plano_escolhido_id_fkey (
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

    // 2. Verificar se cotação está pronta para gerar contrato
    const isFluxoVendedor = cotacao.status === 'aceita';
    const statusContratacaoValidos = ['dados_preenchidos', 'documentos_ok', 'vistoria_ok'];
    const isFluxoPublico = statusContratacaoValidos.includes(cotacao.status_contratacao || '');
    const isRascunhoSemLead = cotacao.status === 'rascunho' && !cotacao.lead_id;
    
    if (!isFluxoVendedor && !isFluxoPublico && !isRascunhoSemLead) {
      throw new Error(`Cotação não está pronta para gerar contrato. Status: ${cotacao.status}, Status Contratação: ${cotacao.status_contratacao}`);
    }
    
    console.log(`Gerando contrato via fluxo: ${isFluxoVendedor ? 'vendedor' : isFluxoPublico ? 'público' : 'rascunho'}`);

    // 3. CORREÇÃO: Converter vendedor_id (auth.users.id) para profiles.id
    // O campo vendedor_id nas cotações armazena auth.users.id, mas contratos espera profiles.id
    let vendedorIdFinal: string | null = null;
    const vendedorIdOriginal = vendedor_id || cotacao.vendedor_id;

    if (vendedorIdOriginal) {
      // Tentar buscar profile pelo user_id (auth.users.id)
      const { data: profileByUserId } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', vendedorIdOriginal)
        .maybeSingle();
      
      if (profileByUserId) {
        vendedorIdFinal = profileByUserId.id;
        console.log(`Convertido vendedor user_id ${vendedorIdOriginal} -> profile.id ${vendedorIdFinal}`);
      } else {
        // Talvez já seja um profiles.id válido, verificar
        const { data: profileById } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', vendedorIdOriginal)
          .maybeSingle();
        
        if (profileById) {
          vendedorIdFinal = profileById.id;
          console.log(`vendedor_id já é um profile.id válido: ${vendedorIdFinal}`);
        } else {
          console.warn(`Profile não encontrado para vendedor_id ${vendedorIdOriginal}`);
        }
      }
    }

    // Fallback: buscar diretor ativo se não encontrou vendedor válido
    if (!vendedorIdFinal) {
      const { data: diretorFallback } = await supabase
        .from('profiles')
        .select('id')
        .eq('tipo', 'diretor')
        .eq('ativo', true)
        .limit(1)
        .maybeSingle();
      
      if (diretorFallback) {
        vendedorIdFinal = diretorFallback.id;
        console.log('Usando diretor como fallback:', vendedorIdFinal);
      } else {
        // Último recurso: qualquer funcionário ativo
        const { data: funcionarioFallback } = await supabase
          .from('profiles')
          .select('id')
          .eq('ativo', true)
          .limit(1)
          .maybeSingle();
        
        vendedorIdFinal = funcionarioFallback?.id || null;
        console.log('Usando funcionário fallback:', vendedorIdFinal);
      }
    }

    // 4. Verificar se já existe contrato para esta cotação
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

    // 5. Extrair dados do cliente (lead é opcional, dados podem vir direto da cotação)
    const lead = cotacao.lead;
    const leadId = cotacao.lead_id; // Manter se existir, mas não criar retroativamente
    
    const clienteNome = lead?.nome || cotacao.nome_solicitante;
    const clienteEmail = lead?.email || cotacao.email_solicitante;
    const clienteTelefone = lead?.telefone || cotacao.telefone1_solicitante;
    const clienteCpf = lead?.cpf || cotacao.cliente_cpf;

    // 6. Validar dados mínimos para criar contrato
    const cpfFinal = clienteCpf;
    const nomeFinal = clienteNome;
    const emailFinal = clienteEmail;
    const telefoneFinal = clienteTelefone;
    
    if (!cpfFinal || cpfFinal.replace(/\D/g, '').length !== 11) {
      throw new Error('CPF é obrigatório para gerar o contrato. Complete os dados antes de continuar.');
    }

    if (!nomeFinal || nomeFinal.includes('Cliente Cotação')) {
      throw new Error('Nome é obrigatório para gerar o contrato. Complete os dados antes de continuar.');
    }

    // 7. Criar ou encontrar associado
    let associadoId = null;
    
    const cpfLimpo = cpfFinal.replace(/\D/g, '');
    const { data: associadoExistente } = await supabase
      .from('associados')
      .select('id')
      .eq('cpf', cpfLimpo)
      .maybeSingle();
    
    if (associadoExistente) {
      associadoId = associadoExistente.id;
      console.log('Associado existente encontrado pelo CPF:', associadoId);
    } else if (emailFinal) {
      const { data: byEmail } = await supabase
        .from('associados')
        .select('id')
        .eq('email', emailFinal)
        .maybeSingle();
      
      if (byEmail) {
        associadoId = byEmail.id;
        console.log('Associado existente encontrado pelo email:', associadoId);
      }
    }
    
    if (!associadoId) {
      const { data: novoAssociado, error: associadoError } = await supabase
        .from('associados')
        .insert({
          nome: nomeFinal,
          email: emailFinal || `${cpfLimpo}@temp.associado.local`,
          telefone: telefoneFinal || '00000000000',
          cpf: cpfLimpo,
          plano_id: cotacao.plano_escolhido_id || cotacao.plano_id,
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

    // 8. Criar o contrato
    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const numeroTemp = `CTR-${timestamp}-${random}`;

    const { data: contrato, error: contratoError } = await supabase
      .from('contratos')
      .insert({
        numero: numeroTemp,
        cotacao_id,
        lead_id: leadId, // Usa o lead original se existir (não cria mais retroativamente)
        associado_id: associadoId,
        plano_id: cotacao.plano_escolhido_id || cotacao.plano_id,
        valor_adesao: cotacao.valor_adesao || 0,
        valor_mensal: cotacao.valor_total_mensal || cotacao.valor_mensal,
        vendedor_id: vendedorIdFinal, // CORREÇÃO: Usar profile.id validado
        status: 'rascunho',
        
        // Dados do veículo
        veiculo_marca: cotacao.veiculo_marca,
        veiculo_modelo: cotacao.veiculo_modelo,
        veiculo_ano: cotacao.veiculo_ano,
        veiculo_placa: cotacao.veiculo_placa,
        veiculo_valor_fipe: cotacao.valor_fipe,
        
        // Dados do cliente
        cliente_nome: nomeFinal,
        cliente_email: emailFinal,
        cliente_telefone: telefoneFinal,
        cliente_cpf: cpfFinal,
        
        data_inicio: new Date().toISOString().split('T')[0],
        validade_link: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        created_by: vendedorIdFinal, // CORREÇÃO: Usar profile.id validado
      })
      .select()
      .single();

    if (contratoError) {
      console.error('Erro ao criar contrato:', contratoError);
      throw new Error(`Erro ao criar contrato: ${contratoError.message}`);
    }

    console.log('Contrato criado:', contrato.numero);

    // 9. Registrar no histórico
    await supabase.from('contratos_historico').insert({
      contrato_id: contrato.id,
      evento: 'gerado_de_cotacao',
      descricao: `Contrato gerado a partir da cotação ${cotacao.numero}`,
      usuario_id: vendedorIdFinal, // CORREÇÃO: Usar profile.id validado
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

    // 12. Atualizar etapa do lead se existir (opcional, não obrigatório)
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
