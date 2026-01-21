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

    // 3. PADRÃO DO BANCO: vendedor_id armazena profiles.id (não auth.users.id)
    // Isso é consistente com 80+ FKs no banco que apontam para profiles(id)
    let vendedorIdFinal: string | null = null;
    const vendedorIdOriginal = vendedor_id || cotacao.vendedor_id;

    if (vendedorIdOriginal) {
      // Primeiro: verificar se já é um profiles.id válido
      const { data: profileById } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', vendedorIdOriginal)
        .maybeSingle();
      
      if (profileById) {
        vendedorIdFinal = profileById.id;
        console.log(`vendedor_id já é profiles.id válido: ${vendedorIdFinal}`);
      } else {
        // Talvez seja um auth.users.id, converter para profiles.id
        const { data: profileByUserId } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', vendedorIdOriginal)
          .maybeSingle();
        
        if (profileByUserId) {
          vendedorIdFinal = profileByUserId.id;
          console.log(`Convertido user_id ${vendedorIdOriginal} -> profiles.id ${vendedorIdFinal}`);
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
        console.log('Usando diretor como fallback (profiles.id):', vendedorIdFinal);
      } else {
        // Último recurso: qualquer funcionário ativo
        const { data: funcionarioFallback } = await supabase
          .from('profiles')
          .select('id')
          .eq('ativo', true)
          .limit(1)
          .maybeSingle();
        
        vendedorIdFinal = funcionarioFallback?.id || null;
        console.log('Usando funcionário fallback (profiles.id):', vendedorIdFinal);
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
    let veiculoId: string | null = null;
    
    const cpfLimpo = cpfFinal.replace(/\D/g, '');
    const { data: associadoExistente } = await supabase
      .from('associados')
      .select('id')
      .eq('cpf', cpfLimpo)
      .maybeSingle();
    
    if (associadoExistente) {
      associadoId = associadoExistente.id;
      console.log('Associado existente encontrado pelo CPF:', associadoId);
      
      // CORREÇÃO: Buscar ou criar veículo para associado existente
      const placaLimpa = cotacao.veiculo_placa?.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      
      if (placaLimpa) {
        // Tentar encontrar veículo existente pela placa
        const { data: veiculoExistente } = await supabase
          .from('veiculos')
          .select('id')
          .eq('placa', placaLimpa)
          .maybeSingle();
        
        if (veiculoExistente) {
          veiculoId = veiculoExistente.id;
          console.log('Veículo existente encontrado pela placa:', veiculoId);
        } else {
          // Criar novo veículo para associado existente
          const { data: novoVeiculoExistente, error: veiculoExistenteError } = await supabase
            .from('veiculos')
            .insert({
              associado_id: associadoId,
              placa: placaLimpa,
              marca: cotacao.veiculo_marca,
              modelo: cotacao.veiculo_modelo,
              ano_fabricacao: cotacao.veiculo_ano,
              ano_modelo: cotacao.veiculo_ano,
              cor: cotacao.veiculo_cor || null,
              valor_fipe: cotacao.valor_fipe || null,
              codigo_fipe: cotacao.codigo_fipe || null,
              status: 'em_analise',
              cobertura_roubo_furto: false,
              cobertura_total: false,
            })
            .select('id')
            .single();
          
          if (veiculoExistenteError) {
            console.error('Erro ao criar veículo para associado existente:', veiculoExistenteError);
            throw new Error(`Falha ao criar veículo: ${veiculoExistenteError.message}`);
          }
          
          veiculoId = novoVeiculoExistente.id;
          console.log('Novo veículo criado para associado existente:', veiculoId);
        }
      }
    } else if (emailFinal) {
      const { data: byEmail } = await supabase
        .from('associados')
        .select('id')
        .eq('email', emailFinal)
        .maybeSingle();
      
      if (byEmail) {
        associadoId = byEmail.id;
        console.log('Associado existente encontrado pelo email:', associadoId);
        
        // CORREÇÃO: Buscar ou criar veículo para associado encontrado por email
        const placaLimpa = cotacao.veiculo_placa?.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        
        if (placaLimpa) {
          const { data: veiculoExistente } = await supabase
            .from('veiculos')
            .select('id')
            .eq('placa', placaLimpa)
            .maybeSingle();
          
          if (veiculoExistente) {
            veiculoId = veiculoExistente.id;
            console.log('Veículo existente encontrado pela placa:', veiculoId);
          } else {
            const { data: novoVeiculoEmail, error: veiculoEmailError } = await supabase
              .from('veiculos')
              .insert({
                associado_id: associadoId,
                placa: placaLimpa,
                marca: cotacao.veiculo_marca,
                modelo: cotacao.veiculo_modelo,
                ano_fabricacao: cotacao.veiculo_ano,
                ano_modelo: cotacao.veiculo_ano,
                cor: cotacao.veiculo_cor || null,
                valor_fipe: cotacao.valor_fipe || null,
                codigo_fipe: cotacao.codigo_fipe || null,
                status: 'em_analise',
                cobertura_roubo_furto: false,
                cobertura_total: false,
              })
              .select('id')
              .single();
            
            if (veiculoEmailError) {
              console.error('Erro ao criar veículo para associado existente (email):', veiculoEmailError);
              throw new Error(`Falha ao criar veículo: ${veiculoEmailError.message}`);
            }
            
            veiculoId = novoVeiculoEmail.id;
            console.log('Novo veículo criado para associado existente (email):', veiculoId);
          }
        }
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
          // Campos de endereço da cotação
          logradouro: cotacao.cliente_logradouro || null,
          numero: cotacao.cliente_numero || null,
          complemento: cotacao.cliente_complemento || null,
          bairro: cotacao.cliente_bairro || null,
          cidade: cotacao.cliente_cidade || null,
          uf: cotacao.cliente_uf || null,
          cep: cotacao.cliente_cep || null,
          data_nascimento: cotacao.cliente_data_nascimento || null,
        })
        .select('id')
        .single();

      if (associadoError) {
        console.error('Erro ao criar associado:', associadoError);
        throw new Error(`Erro ao criar associado: ${associadoError.message}`);
      }
      
      associadoId = novoAssociado.id;
      console.log('Novo associado criado:', associadoId);

      // Criar VEÍCULO vinculado ao novo associado (status em_analise)
      const { data: novoVeiculo, error: veiculoError } = await supabase
        .from('veiculos')
        .insert({
          associado_id: associadoId,
          placa: cotacao.veiculo_placa,
          marca: cotacao.veiculo_marca,
          modelo: cotacao.veiculo_modelo,
          ano_fabricacao: cotacao.veiculo_ano,
          ano_modelo: cotacao.veiculo_ano,
          cor: cotacao.veiculo_cor || null,
          valor_fipe: cotacao.valor_fipe || null,
          codigo_fipe: cotacao.codigo_fipe || null,
          status: 'em_analise',
          cobertura_roubo_furto: false,
          cobertura_total: false,
        })
        .select('id')
        .single();

      if (veiculoError) {
        console.error('Erro CRÍTICO ao criar veículo:', veiculoError);
        throw new Error(`Falha ao criar veículo: ${veiculoError.message}`);
      }
      
      veiculoId = novoVeiculo.id;
      console.log('Novo veículo criado:', veiculoId);
    }

    // 8. Criar o contrato
    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const numeroTemp = `CTR-${timestamp}-${random}`;
    
        // Gerar link_token para permitir acesso público ao contrato (satisfaz RLS)
        const linkToken = crypto.randomUUID();

        const { data: contrato, error: contratoError } = await supabase
          .from('contratos')
          .insert({
            numero: numeroTemp,
            cotacao_id,
            lead_id: leadId, // Usa o lead original se existir (não cria mais retroativamente)
            associado_id: associadoId,
            veiculo_id: veiculoId, // CORREÇÃO: Vincular veículo ao contrato
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
            veiculo_cor: cotacao.veiculo_cor,
            
            // Dados do cliente
            cliente_nome: nomeFinal,
            cliente_email: emailFinal,
            cliente_telefone: telefoneFinal,
            cliente_cpf: cpfFinal,
            
            // Link público para satisfazer RLS em acesso anônimo
            link_token: linkToken,
            link_gerado_em: new Date().toISOString(),
            
            // NOVO: token público da cotação para acesso anon via RLS
            cotacao_token_publico: cotacao.token_publico || null,
            
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
