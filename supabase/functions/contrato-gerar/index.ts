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

// Palavras-chave para detectar motos a partir de marca/modelo
const MOTO_KEYWORDS = [
  'honda', 'yamaha', 'suzuki', 'kawasaki', 'harley', 'triumph', 'ducati', 'bmw motorrad',
  'nxr', 'bros', 'cg', 'biz', 'pop', 'xre', 'cb ', 'cbr', 'cbx', 'pcx', 'sh ',
  'fazer', 'ybr', 'factor', 'crosser', 'lander', 'tenere', 'mt-', 'xt ',
  'gsx', 'intruder', 'burgman', 'v-strom', 'hayabusa',
  'ninja', 'z900', 'z800', 'versys', 'vulcan',
  'motocicleta', 'moto ', 'scooter', 'triciclo',
];

function detectarCategoriaVeiculo(marca?: string, modelo?: string, categoriaExistente?: string): string {
  // Se já tem categoria definida (ex: aplicativo, taxi), usar ela
  if (categoriaExistente && categoriaExistente !== 'nenhuma') return categoriaExistente;
  
  const texto = `${marca || ''} ${modelo || ''}`.toLowerCase();
  const isMoto = MOTO_KEYWORDS.some(kw => texto.includes(kw));
  return isMoto ? 'Motocicleta' : 'Automóvel';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('[CONTRATO-GERAR] ====== INICIANDO FUNÇÃO ======');
    console.log('[CONTRATO-GERAR] Timestamp:', new Date().toISOString());
    
    const { cotacao_id, vendedor_id } = await req.json() as GerarContratoPayload;
    console.log('[CONTRATO-GERAR] Payload recebido:', { cotacao_id, vendedor_id });

    if (!cotacao_id) {
      throw new Error('cotacao_id é obrigatório');
    }

    console.log('[CONTRATO-GERAR] Gerando contrato para cotação:', cotacao_id);

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

    // 4. Verificar se já existe contrato ATIVO para esta cotação (idempotência)
    // Priorizar contratos assinados/ativos, depois pendentes
    const { data: contratosExistentes } = await supabase
      .from('contratos')
      .select('id, numero, status, validade_link, valor_mensal')
      .eq('cotacao_id', cotacao_id)
      .not('status', 'in', '("cancelado","expirado")')
      .order('created_at', { ascending: false });

    // Priorizar contrato assinado/ativo se existir
    const contratoExistente = contratosExistentes?.find(
      (c: any) => c.status === 'assinado' || c.status === 'ativo'
    ) || contratosExistentes?.[0];

    if (contratoExistente) {
      console.log('[CONTRATO-GERAR] Contrato já existe para esta cotação:', contratoExistente.numero, 'status:', contratoExistente.status);
      
      // ═══════════════════════════════════════════════════════════════
      // IMPORTANTE: Mesmo com contrato existente, sincronizar email/telefone do associado
      // Isso corrige casos onde o associado foi criado com dados desatualizados
      // ═══════════════════════════════════════════════════════════════
      const lead = cotacao.lead;
      const clienteEmail = lead?.email || cotacao.email_solicitante;
      const clienteTelefone = lead?.telefone || cotacao.telefone1_solicitante;
      const clienteCpf = lead?.cpf || cotacao.cliente_cpf;
      
      if (clienteCpf) {
        const cpfLimpo = clienteCpf.replace(/\D/g, '');
        console.log('[SYNC-EXISTENTE] Verificando sincronização para CPF:', cpfLimpo);
        
        const { data: associadoExistente } = await supabase
          .from('associados')
          .select('id, email, telefone')
          .eq('cpf', cpfLimpo)
          .maybeSingle();
        
        if (associadoExistente) {
          const updateData: Record<string, string> = {};
          
          if (clienteEmail && clienteEmail.trim() !== '' && clienteEmail !== associadoExistente.email) {
            updateData.email = clienteEmail;
          }
          
          if (clienteTelefone && clienteTelefone.trim() !== '' && clienteTelefone !== associadoExistente.telefone) {
            updateData.telefone = clienteTelefone;
          }
          
          if (Object.keys(updateData).length > 0) {
            await supabase
              .from('associados')
              .update(updateData)
              .eq('id', associadoExistente.id);
            console.log('[SYNC-EXISTENTE] ✅ Dados sincronizados:', Object.keys(updateData));
          }
        }
      }

      // Se cotação não aponta para contrato correto, corrigir
      if (cotacao.contrato_gerado_id !== contratoExistente.id) {
        console.log('[CONTRATO-GERAR] Corrigindo contrato_gerado_id na cotação');
        await supabase
          .from('cotacoes')
          .update({ contrato_gerado_id: contratoExistente.id })
          .eq('id', cotacao_id);
      }
      
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
      .select('id, email, telefone')
      .eq('cpf', cpfLimpo)
      .maybeSingle();
    
    if (associadoExistente) {
      associadoId = associadoExistente.id;
      console.log('[CONTRATO-GERAR] Associado existente encontrado pelo CPF:', associadoId);
      
      // ═══════════════════════════════════════════════════════════════
      // DEBUG: Valores para comparação de sincronização
      // ═══════════════════════════════════════════════════════════════
      console.log('[DEBUG-SYNC] Dados para sincronização:', {
        associadoId,
        email_banco: associadoExistente.email,
        email_cotacao: emailFinal,
        email_cotacao_length: emailFinal?.length,
        email_cotacao_trimmed: emailFinal?.trim(),
        emails_diferentes: emailFinal !== associadoExistente.email,
        telefone_banco: associadoExistente.telefone,
        telefone_cotacao: telefoneFinal,
        telefones_diferentes: telefoneFinal !== associadoExistente.telefone,
      });

      // ═══════════════════════════════════════════════════════════════
      // SINCRONIZAÇÃO SEGURA: Atualiza email e telefone se diferentes
      // Endereço e outros dados NÃO são sobrescritos automaticamente
      // ═══════════════════════════════════════════════════════════════
      const updateData: Record<string, string | null> = {};

      // EMAIL: só atualiza se cotação tem valor novo e diferente
      if (emailFinal && emailFinal.trim() !== '' && emailFinal !== associadoExistente.email) {
        updateData.email = emailFinal;
        console.log(
          `[AUDITORIA] Email do associado ${associadoId} será atualizado: ` +
          `"${associadoExistente.email || '(vazio)'}" → "${emailFinal}" ` +
          `(cotação ${cotacao_id})`
        );
      } else {
        console.log('[DEBUG-SYNC] Email NÃO será atualizado:', {
          motivo: !emailFinal ? 'emailFinal vazio/null' : 
                  emailFinal.trim() === '' ? 'emailFinal só whitespace' : 
                  emailFinal === associadoExistente.email ? 'emails iguais' : 'desconhecido'
        });
      }

      // TELEFONE: só atualiza se cotação tem valor novo e diferente
      if (telefoneFinal && telefoneFinal.trim() !== '' && telefoneFinal !== associadoExistente.telefone) {
        updateData.telefone = telefoneFinal;
        console.log(
          `[AUDITORIA] Telefone do associado ${associadoId} será atualizado: ` +
          `"${associadoExistente.telefone || '(vazio)'}" → "${telefoneFinal}" ` +
          `(cotação ${cotacao_id})`
        );
      }

      // RG: sincronizar se disponível na cotação
      if (cotacao.cliente_rg && cotacao.cliente_rg.trim() !== '') {
        updateData.rg = cotacao.cliente_rg;
      }

      console.log('[DEBUG-SYNC] updateData a ser aplicado:', updateData);

      // Executar atualização se houver mudanças
      if (Object.keys(updateData).length > 0) {
        console.log('[DEBUG-SYNC] Executando UPDATE no associado...');
        const { error: updateAssociadoError } = await supabase
          .from('associados')
          .update(updateData)
          .eq('id', associadoId);

        if (updateAssociadoError) {
          console.error('[ERRO] Falha ao sincronizar dados do associado:', {
            error: updateAssociadoError,
            message: updateAssociadoError.message,
            code: updateAssociadoError.code,
            details: updateAssociadoError.details,
            hint: updateAssociadoError.hint,
            updateData,
            associadoId
          });
          // ⚠️ Não interrompe o fluxo — apenas loga
        } else {
          console.log('[OK] Dados do associado sincronizados com sucesso:', Object.keys(updateData).join(', '));
        }
      } else {
        console.log('[DEBUG-SYNC] Nenhum dado para atualizar (updateData vazio)');
      }
      
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
          const categoriaFlags = {
            flag_placa_vermelha: cotacao.categoria === 'placa_vermelha',
            flag_ex_taxi: cotacao.categoria === 'ex_taxi',
            flag_taxi_ativo: cotacao.categoria === 'taxi',
            flag_chassi_remarcado: cotacao.categoria === 'chassi_remarcado',
            flag_leilao: cotacao.categoria === 'leilao',
            flag_ex_ressarcido: cotacao.categoria === 'ressarcimento_integral',
          };
          const { data: novoVeiculoExistente, error: veiculoExistenteError } = await supabase
            .from('veiculos')
            .insert({
              associado_id: associadoId,
              placa: placaLimpa,
              marca: cotacao.veiculo_marca,
              modelo: cotacao.veiculo_modelo,
              ano_fabricacao: cotacao.veiculo_ano_fabricacao || cotacao.veiculo_ano,
              ano_modelo: cotacao.veiculo_ano,
              cor: cotacao.veiculo_cor || null,
              combustivel: cotacao.veiculo_combustivel || null,
              valor_fipe: cotacao.valor_fipe || null,
              codigo_fipe: cotacao.codigo_fipe || null,
              chassi: cotacao.veiculo_chassi || null,
              renavam: cotacao.veiculo_renavam || null,
              status: 'em_analise',
              cobertura_roubo_furto: false,
              cobertura_total: false,
              ...categoriaFlags,
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
        .select('id, email, telefone')
        .eq('email', emailFinal)
        .maybeSingle();
      
      if (byEmail) {
        associadoId = byEmail.id;
        console.log('Associado existente encontrado pelo email:', associadoId);

        // ═══════════════════════════════════════════════════════════════
        // SINCRONIZAÇÃO SEGURA: Atualiza telefone se diferente
        // (Email já é igual, pois foi encontrado por email)
        // ═══════════════════════════════════════════════════════════════
        if (telefoneFinal && telefoneFinal.trim() !== '' && telefoneFinal !== byEmail.telefone) {
          const { error: updateTelError } = await supabase
            .from('associados')
            .update({ telefone: telefoneFinal })
            .eq('id', associadoId);

          if (updateTelError) {
            console.error('[ERRO] Falha ao sincronizar telefone do associado:', updateTelError);
          } else {
            console.log(
              `[AUDITORIA] Telefone do associado ${associadoId} atualizado: ` +
              `"${byEmail.telefone || '(vazio)'}" → "${telefoneFinal}" ` +
              `(cotação ${cotacao_id})`
            );
          }
        }
        
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
            const categoriaFlagsEmail = {
              flag_placa_vermelha: cotacao.categoria === 'placa_vermelha',
              flag_ex_taxi: cotacao.categoria === 'ex_taxi',
              flag_taxi_ativo: cotacao.categoria === 'taxi',
              flag_chassi_remarcado: cotacao.categoria === 'chassi_remarcado',
              flag_leilao: cotacao.categoria === 'leilao',
              flag_ex_ressarcido: cotacao.categoria === 'ressarcimento_integral',
            };
            const { data: novoVeiculoEmail, error: veiculoEmailError } = await supabase
              .from('veiculos')
              .insert({
                associado_id: associadoId,
                placa: placaLimpa,
                marca: cotacao.veiculo_marca,
                modelo: cotacao.veiculo_modelo,
                ano_fabricacao: cotacao.veiculo_ano_fabricacao || cotacao.veiculo_ano,
                ano_modelo: cotacao.veiculo_ano,
                cor: cotacao.veiculo_cor || null,
                combustivel: cotacao.veiculo_combustivel || null,
                valor_fipe: cotacao.valor_fipe || null,
                codigo_fipe: cotacao.codigo_fipe || null,
                chassi: cotacao.veiculo_chassi || null,
                renavam: cotacao.veiculo_renavam || null,
                status: 'em_analise',
                cobertura_roubo_furto: false,
                cobertura_total: false,
                ...categoriaFlagsEmail,
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
        status: 'pendente_vistoria',
        data_adesao: new Date().toISOString().split('T')[0],
        dia_vencimento: cotacao.dia_vencimento ? Math.min(Math.max(Number(cotacao.dia_vencimento), 1), 31) : 10,
          // Campos de endereço da cotação
          logradouro: cotacao.cliente_logradouro || null,
          numero: cotacao.cliente_numero || null,
          complemento: cotacao.cliente_complemento || null,
          bairro: cotacao.cliente_bairro || null,
          cidade: cotacao.cliente_cidade || null,
          uf: cotacao.cliente_uf || null,
          cep: cotacao.cliente_cep || null,
          data_nascimento: cotacao.cliente_data_nascimento || null,
          rg: cotacao.cliente_rg || null,
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
      const categoriaFlagsNovo = {
        flag_placa_vermelha: cotacao.categoria === 'placa_vermelha',
        flag_ex_taxi: cotacao.categoria === 'ex_taxi',
        flag_taxi_ativo: cotacao.categoria === 'taxi',
        flag_chassi_remarcado: cotacao.categoria === 'chassi_remarcado',
        flag_leilao: cotacao.categoria === 'leilao',
        flag_ex_ressarcido: cotacao.categoria === 'ressarcimento_integral',
      };
      const { data: novoVeiculo, error: veiculoError } = await supabase
        .from('veiculos')
        .insert({
          associado_id: associadoId,
          placa: cotacao.veiculo_placa,
          marca: cotacao.veiculo_marca,
          modelo: cotacao.veiculo_modelo,
          ano_fabricacao: cotacao.veiculo_ano_fabricacao || cotacao.veiculo_ano,
          ano_modelo: cotacao.veiculo_ano,
          cor: cotacao.veiculo_cor || null,
          combustivel: cotacao.veiculo_combustivel || null,
          valor_fipe: cotacao.valor_fipe || null,
          codigo_fipe: cotacao.codigo_fipe || null,
          chassi: cotacao.veiculo_chassi || null,
          renavam: cotacao.veiculo_renavam || null,
          status: 'em_analise',
          cobertura_roubo_furto: false,
          cobertura_total: false,
          ...categoriaFlagsNovo,
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
            valor_adicional: cotacao.valor_adicional || 0,
            vendedor_id: vendedorIdFinal, // CORREÇÃO: Usar profile.id validado
            status: 'rascunho',
            
            // Dados do veículo (snapshot completo)
            veiculo_marca: cotacao.veiculo_marca,
            veiculo_modelo: cotacao.veiculo_modelo,
            veiculo_ano: cotacao.veiculo_ano,
            veiculo_placa: cotacao.veiculo_placa,
            veiculo_valor_fipe: cotacao.valor_fipe,
            veiculo_cor: cotacao.veiculo_cor,
            veiculo_combustivel: cotacao.veiculo_combustivel || null,
            veiculo_ano_fabricacao: cotacao.veiculo_ano_fabricacao || cotacao.veiculo_ano || null,
            
            // Campos para Termo de Afiliação (Autentique)
            codigo_fipe: cotacao.codigo_fipe || null,
            uso_aplicativo: cotacao.uso_aplicativo || false,
            veiculo_categoria: cotacao.veiculo_categoria || detectarCategoriaVeiculo(cotacao.veiculo_marca, cotacao.veiculo_modelo, cotacao.categoria),
            
            // Dados obrigatórios para SGA Hinova e Termo de Afiliação (extraídos do CRLV via OCR)
            veiculo_chassi: cotacao.veiculo_chassi || null,
            veiculo_renavam: cotacao.veiculo_renavam || null,
            
            // Dados do cliente (snapshot completo)
            cliente_nome: nomeFinal,
            cliente_email: emailFinal,
            cliente_telefone: telefoneFinal,
            cliente_cpf: cpfFinal,
            
            // NOVOS CAMPOS: Dados de documentos pessoais (extraídos via OCR)
            cliente_rg: cotacao.cliente_rg || null,
            cliente_rg_orgao: cotacao.cliente_rg_orgao || null,
            cliente_cnh: cotacao.cliente_cnh || null,
            cliente_cnh_validade: cotacao.cliente_cnh_validade || null,
            cliente_cnh_categoria: cotacao.cliente_cnh_categoria || null,
            cliente_data_nascimento: cotacao.cliente_data_nascimento || null,
            
            // NOVOS CAMPOS: Endereço detalhado (snapshot)
            cliente_logradouro: cotacao.cliente_logradouro || null,
            cliente_numero: cotacao.cliente_numero || null,
            cliente_bairro: cotacao.cliente_bairro || null,
            cliente_complemento: cotacao.cliente_complemento || null,
            
            // Link público para satisfazer RLS em acesso anônimo
            link_token: linkToken,
            link_gerado_em: new Date().toISOString(),
            
            // NOVO: token público da cotação para acesso anon via RLS
            cotacao_token_publico: cotacao.token_publico || null,
            
            // Snapshot de cota/cobertura contextual (pode diferir do plano base para uso app)
            cota_participacao: cotacao.cota_participacao ?? null,
            cota_minima: cotacao.cota_minima ?? null,
            cobertura_fipe: cotacao.cobertura_fipe ?? null,
            
            dia_vencimento: cotacao.dia_vencimento ? Math.min(Math.max(Number(cotacao.dia_vencimento), 1), 31) : 10,
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

    // 8.1 Propagar adicionais selecionados da cotação para o contrato e associado
    const adicionaisSelecionados = cotacao.adicionais_selecionados;
    if (adicionaisSelecionados && Array.isArray(adicionaisSelecionados) && adicionaisSelecionados.length > 0) {
      console.log('[CONTRATO-GERAR] Propagando adicionais selecionados:', adicionaisSelecionados.length);
      
      // Salvar snapshot no contrato
      const { error: updateAdicionaisError } = await supabase
        .from('contratos')
        .update({ adicionais_selecionados: adicionaisSelecionados })
        .eq('id', contrato.id);
      
      if (updateAdicionaisError) {
        console.error('[CONTRATO-GERAR] Erro ao salvar adicionais no contrato:', updateAdicionaisError);
      } else {
        console.log('[CONTRATO-GERAR] ✅ Adicionais salvos no contrato');
      }

      // Criar registros em associados_beneficios_adicionais
      if (associadoId) {
        const registros = adicionaisSelecionados.map((adicional: any) => ({
          associado_id: associadoId,
          contrato_id: contrato.id,
          beneficio_adicional_id: adicional.id || adicional.beneficio_id,
          valor_contratado: adicional.preco || adicional.valor || 0,
          ativo: true,
          data_inicio: new Date().toISOString().split('T')[0],
        })).filter((r: any) => r.beneficio_adicional_id);

        if (registros.length > 0) {
          const { error: registrosError } = await supabase
            .from('associados_beneficios_adicionais')
            .insert(registros);
          
          if (registrosError) {
            console.error('[CONTRATO-GERAR] Erro ao criar registros de adicionais do associado:', registrosError);
          } else {
            console.log(`[CONTRATO-GERAR] ✅ ${registros.length} adicionais vinculados ao associado`);
          }
        }
      }
    }

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
