import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getConfiguracaoNumero } from '../_shared/config-helper.ts'
import { resolverDiaVencimento } from '../_shared/vencimento-utils.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function validarCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return false;
  if (/^(\d)\1+$/.test(cleaned)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(cleaned[i]) * (10 - i);
  }

  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== Number(cleaned[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += Number(cleaned[i]) * (11 - i);
  }

  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;

  return remainder === Number(cleaned[10]);
}

interface GerarContratoPayload {
  cotacao_id: string;
  vendedor_id?: string;
}

/**
 * BLOQUEIO ANTI-SEQUESTRO — exceção para troca de titularidade legítima.
 * Quando o antigo titular já assinou o termo de cancelamento, o veículo é
 * marcado com `em_troca_titularidade=true` e `troca_titularidade_id` aponta
 * para a solicitação. Se a cotação atual pertence a essa mesma solicitação,
 * permitimos prosseguir (o vínculo será efetivamente transferido depois,
 * em `efetivar-troca-titularidade`).
 */
async function placaLiberadaPorTrocaTitularidade(
  supabase: any,
  placa: string,
  cotacaoDadosExtras: any,
): Promise<boolean> {
  try {
    const { data: v } = await supabase
      .from('veiculos')
      .select('em_troca_titularidade, troca_titularidade_id, associado_id')
      .eq('placa', placa)
      .maybeSingle();
    if (!v?.em_troca_titularidade || !v?.troca_titularidade_id) return false;

    // 1) Match por solicitacao_id explícito em dados_extras (preferido)
    const solIdCot = cotacaoDadosExtras?.solicitacao_troca_id || cotacaoDadosExtras?.troca_titularidade_id;
    if (solIdCot && solIdCot === v.troca_titularidade_id) return true;

    // 2) Match por associado_antigo_id da cotação == associado_id atual do veículo
    const antigoId = cotacaoDadosExtras?.associado_antigo_id;
    if (antigoId && antigoId === v.associado_id) {
      const { data: sol } = await supabase
        .from('solicitacoes_troca_titularidade')
        .select('id, associado_antigo_id, status, termo_cancelamento_assinado_em')
        .eq('id', v.troca_titularidade_id)
        .maybeSingle();
      if (sol?.associado_antigo_id === antigoId && sol?.termo_cancelamento_assinado_em) {
        return true;
      }
    }
  } catch (e) {
    console.warn('[placaLiberadaPorTrocaTitularidade] erro:', e);
  }
  return false;
}

/**
 * Normaliza nomes para comparação: remove acentos, pontuação, espaços extras,
 * e padroniza para minúsculas. Usado para detectar colisões de identidade
 * (ex.: associado existente vs solicitante da cotação).
 */
function normalizarNome(nome?: string | null): string {
  if (!nome) return '';
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-zA-Z\s]/g, '')      // remove pontuação/números
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** True se os dois nomes pertencem (provavelmente) à mesma pessoa. */
function nomesCoincidem(a?: string | null, b?: string | null): boolean {
  const na = normalizarNome(a);
  const nb = normalizarNome(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // tokens em comum: se ambos compartilham primeiro nome + algum sobrenome, aceita
  const tokensA = new Set(na.split(' ').filter(t => t.length >= 3));
  const tokensB = new Set(nb.split(' ').filter(t => t.length >= 3));
  if (tokensA.size === 0 || tokensB.size === 0) return false;
  let intersecao = 0;
  for (const t of tokensA) if (tokensB.has(t)) intersecao++;
  // exige pelo menos 2 tokens em comum (geralmente nome + sobrenome)
  return intersecao >= 2;
}

// Keywords de modelo como fallback de último recurso (sem marcas hardcoded)
const MOTO_MODEL_KEYWORDS = [
  'nxr', 'bros', 'cg', 'biz', 'pop', 'xre', 'cb ', 'cbr', 'cbx', 'pcx', 'sh ',
  'fazer', 'ybr', 'factor', 'crosser', 'lander', 'tenere', 'mt-', 'xt ',
  'gsx', 'intruder', 'burgman', 'v-strom', 'hayabusa',
  'ninja', 'z900', 'z800', 'versys', 'vulcan',
  'motocicleta', 'moto ', 'scooter', 'triciclo',
  'elite', 'adv', 'lead', 'xadv', 'x-adv', 'transalp', 'nmax', 'xtz', 'xj6',
  'duke', 'apache', 'jet', 'kansas', 'mirage', 'horizon', 'sahara',
];

// Marcas exclusivamente automotivas — espelhado de src/data/vistoriaConfigCompleta.ts.
// Usadas para sanity-check: se uma `categoriaExistente='moto'` chega de uma cotação
// poluída mas a marca está aqui, ignoramos a string e detectamos do zero.
const CARRO_BRANDS_LOCAL = new Set([
  'CHEVROLET', 'GM', 'GENERAL MOTORS',
  'VOLKSWAGEN', 'VW',
  'FIAT', 'FORD', 'TOYOTA', 'HYUNDAI', 'RENAULT', 'PEUGEOT',
  'CITROEN', 'CITROËN', 'JEEP', 'NISSAN', 'MITSUBISHI', 'KIA',
  'AUDI', 'MERCEDES-BENZ', 'MERCEDES', 'VOLVO', 'LAND ROVER', 'PORSCHE',
  'SUBARU', 'MAZDA', 'CHERY', 'CAOA', 'CAOA CHERY', 'RAM', 'DODGE',
  'JAGUAR', 'MINI', 'LEXUS', 'JAC', 'GWM', 'BYD', 'SMART', 'TROLLER', 'IVECO',
]);

/** Detecção dinâmica via banco (3 regras), com fallback para keywords de modelo */
async function detectarCategoriaVeiculo(
  supabase: any,
  marca?: string,
  modelo?: string,
  categoriaExistente?: string
): Promise<string> {
  const marcaNorm = (marca || '').trim().toUpperCase();
  const modeloNorm = (modelo || '').trim().toUpperCase();

  // Sanity-check: se a categoria existente diz "moto" mas a marca é
  // notoriamente de carro (e o modelo não tem keyword de moto), ignoramos
  // a string poluída e detectamos do zero.
  const categoriaIndicaMoto = categoriaExistente
    ? /moto|motocicleta|ciclomotor|triciclo/i.test(categoriaExistente)
    : false;
  const marcaEhCarro = marcaNorm ? CARRO_BRANDS_LOCAL.has(marcaNorm) : false;
  const modeloTemKeywordMoto = modeloNorm
    ? MOTO_MODEL_KEYWORDS.some(kw => modeloNorm.toLowerCase().includes(kw))
    : false;
  const categoriaPoluida = categoriaIndicaMoto && marcaEhCarro && !modeloTemKeywordMoto;

  if (!categoriaPoluida && categoriaExistente && categoriaExistente !== 'nenhuma') {
    return categoriaExistente;
  }
  if (categoriaPoluida) {
    console.warn('[detectarCategoriaVeiculo] Ignorando categoria poluída', {
      marca, modelo, categoriaExistente,
    });
  }

  // Sanity-check: se chegou aqui (carro com categoria poluída), o resultado vem
  // direto da regra 3 (keywords de modelo) — força "Automóvel" se a marca é de carro.
  if (categoriaPoluida && marcaEhCarro && !modeloTemKeywordMoto) {
    return 'Automóvel';
  }

  // Regra 1: Marcas exclusivas de moto (tabela configuracoes)
  if (marcaNorm) {
    const { data: configData } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'marcas_exclusivas_moto')
      .maybeSingle();

    if (configData?.valor) {
      try {
        const raw = configData.valor.trim();
        const marcasList: string[] = raw.startsWith('[')
          ? JSON.parse(raw).map((m: string) => m.toUpperCase().trim())
          : raw.split(',').map((m: string) => m.toUpperCase().trim());
        if (marcasList.some(m => marcaNorm.includes(m) || m.includes(marcaNorm))) {
          return 'Motocicleta';
        }
      } catch { /* ignora parse error */ }
    }
  }

  // Regra 2: Marca mista → consulta marcas_modelos (tabela unificada)
  if (marcaNorm && modeloNorm) {
    const firstToken = modeloNorm.split(' ')[0];
    const { data } = await supabase
      .from('marcas_modelos')
      .select('modelo')
      .ilike('marca', marcaNorm)
      .ilike('modelo', `%${firstToken}%`)
      .eq('ativo', true)
      .limit(5);

    // Se encontrou na marcas_modelos, é um veículo catalogado.
    // A detecção de moto depende das marcas exclusivas (regra 1) e keywords (regra 3).
    // Não é conclusivo aqui, segue para fallback.
  }

  // Regra 3: Fallback — keywords de modelo apenas
  const texto = `${modelo || ''}`.toLowerCase();
  const isMoto = MOTO_MODEL_KEYWORDS.some(kw => texto.includes(kw));
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
    const cpfLimpo = cpfFinal?.replace(/\D/g, '') || '';
    
    if (!cpfLimpo || cpfLimpo.length !== 11) {
      throw new Error('CPF é obrigatório para gerar o contrato. Complete os dados antes de continuar.');
    }

    if (!validarCPF(cpfLimpo)) {
      throw new Error('O CPF informado nesta cotação é inválido. Corrija os dígitos do CPF antes de gerar o contrato.');
    }

    if (!nomeFinal || nomeFinal.includes('Cliente Cotação')) {
      throw new Error('Nome é obrigatório para gerar o contrato. Complete os dados antes de continuar.');
    }

    // 6.1 GATE DE DÉBITOS — para INCLUSÃO de novo veículo, verificar SGA antes de gerar contrato
    // Evita bypass (URL direta) do gate da UI. Hard fail se houver boletos abertos.
    const _tipoEntradaPre = (cotacao as any).tipo_entrada
      || ((cotacao as any).dados_extras?.tipo_entrada)
      || 'adesao';
    if (_tipoEntradaPre === 'inclusao') {
      try {
        const { data: bloqueioCfg } = await supabase
          .from('configuracoes')
          .select('valor')
          .eq('chave', 'inclusao_bloqueio_debito_ativo')
          .maybeSingle();
        const bloqueioAtivo = bloqueioCfg?.valor !== 'false' && bloqueioCfg?.valor !== '0';

        if (bloqueioAtivo) {
          const sgaResp = await fetch(`${supabaseUrl}/functions/v1/sga-buscar-associado-completo`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ cpf: cpfLimpo }),
          });
          if (sgaResp.ok) {
            const sgaData = await sgaResp.json();
            const veiculosSga: any[] = Array.isArray(sgaData?.veiculos) ? sgaData.veiculos : [];
            const debitos = veiculosSga.flatMap((v) => Array.isArray(v?.boletos_abertos) ? v.boletos_abertos : []);
            const saldoTotal = veiculosSga.reduce((acc, v) => acc + (Number(v?.saldo_devedor) || 0), 0);
            if (debitos.length > 0) {
              console.warn(`[CONTRATO-GERAR] BLOQUEIO INCLUSÃO por débitos SGA: cpf=${cpfLimpo} cotacao=${cotacao_id} boletos=${debitos.length} saldo=${saldoTotal}`);
              return new Response(JSON.stringify({
                success: false,
                code: 'DEBITO_PENDENTE',
                error: 'Associado possui débitos em aberto. Inclusão bloqueada.',
                saldo_total: saldoTotal,
                qtd_boletos: debitos.length,
              }), {
                status: 409,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }
          } else {
            console.warn(`[CONTRATO-GERAR] sga-buscar-associado-completo falhou (status=${sgaResp.status}) — seguindo sem bloquear (gate front já validou)`);
          }
        }
      } catch (gateErr) {
        console.warn('[CONTRATO-GERAR] Erro no gate de débitos (não bloqueante):', gateErr);
      }
    }

    // 7. Criar ou encontrar associado
    let associadoId = null;
    let veiculoId: string | null = null;
    
    const cpfNormalizado = cpfLimpo;
    const { data: associadoExistente } = await supabase
      .from('associados')
      .select('id, nome, email, telefone')
      .eq('cpf', cpfNormalizado)
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
      // PROTEÇÃO ANTI-COLISÃO: só sincroniza PII se o nome do solicitante
      // realmente bate com o nome do associado existente. Evita poluir o
      // cadastro de outra pessoa quando dois titulares compartilham CPF
      // por engano (ex.: digitação errada do operador).
      // ═══════════════════════════════════════════════════════════════
      const mesmoTitular = nomesCoincidem(associadoExistente.nome, nomeFinal);
      if (!mesmoTitular) {
        console.warn(
          `[ALERTA-COLISAO] CPF=${cpfNormalizado} associado_id=${associadoId} ` +
          `nome_db="${associadoExistente.nome}" nome_cot="${nomeFinal}" ` +
          `(cotação ${cotacao_id}) — PII NÃO será sincronizada.`
        );
      }

      const updateData: Record<string, string | null> = {};

      // EMAIL: só atualiza se nomes coincidem E cotação tem valor novo e diferente
      if (mesmoTitular && emailFinal && emailFinal.trim() !== '' && emailFinal !== associadoExistente.email) {
        updateData.email = emailFinal;
        console.log(
          `[AUDITORIA] Email do associado ${associadoId} será atualizado: ` +
          `"${associadoExistente.email || '(vazio)'}" → "${emailFinal}" ` +
          `(cotação ${cotacao_id})`
        );
      }

      // TELEFONE: só atualiza se nomes coincidem E cotação tem valor novo e diferente
      if (mesmoTitular && telefoneFinal && telefoneFinal.trim() !== '' && telefoneFinal !== associadoExistente.telefone) {
        updateData.telefone = telefoneFinal;
        console.log(
          `[AUDITORIA] Telefone do associado ${associadoId} será atualizado: ` +
          `"${associadoExistente.telefone || '(vazio)'}" → "${telefoneFinal}" ` +
          `(cotação ${cotacao_id})`
        );
      }

      // RG: sincronizar somente se nomes coincidem
      if (mesmoTitular && cotacao.cliente_rg && cotacao.cliente_rg.trim() !== '') {
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
      // Suporta carros 0km (sem placa) usando placeholder
      const placaLimpa = cotacao.veiculo_placa?.replace(/[^A-Za-z0-9]/g, '').toUpperCase() || null;
      const placaParaInsert = placaLimpa || ('0KM' + crypto.randomUUID().replace(/-/g, '').slice(0, 5).toUpperCase());

      let veiculoExistente: { id: string } | null = null;
      if (placaLimpa) {
        const { data } = await supabase
          .from('veiculos')
          .select('id, associado_id')
          .eq('placa', placaLimpa)
          .maybeSingle();

        // BLOQUEIO ANTI-SEQUESTRO: a placa já existe sob OUTRO associado.
        // Exceção: troca de titularidade legítima (termo de cancelamento já assinado).
        if (data && data.associado_id && data.associado_id !== associadoId) {
          const liberadoPorTroca = await placaLiberadaPorTrocaTitularidade(
            supabase, placaLimpa, (cotacao as any).dados_extras,
          );
          if (!liberadoPorTroca) {
            console.error(
              `[BLOQUEIO-DONO] Placa ${placaLimpa} já está vinculada ao associado ${data.associado_id}, ` +
              `mas o solicitante atual é ${associadoId} (cotação ${cotacao_id}).`
            );
            return new Response(
              JSON.stringify({
                success: false,
                error: `A placa ${placaLimpa} já está vinculada a outro associado no sistema. ` +
                       `Use o fluxo de Substituição/Troca de Titularidade ou verifique se a placa foi digitada corretamente.`,
                code: 'PLACA_DE_OUTRO_ASSOCIADO',
              }),
              { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            );
          }
          console.log(`[BLOQUEIO-DONO] Liberado por troca de titularidade legítima: placa=${placaLimpa} (veículo será reaproveitado e transferido em efetivar-troca-titularidade)`);
        }

        veiculoExistente = data ? { id: data.id } : null;
      } else {
        const { data } = await supabase
          .from('veiculos')
          .select('id')
          .eq('associado_id', associadoId)
          .eq('marca', cotacao.veiculo_marca)
          .eq('modelo', cotacao.veiculo_modelo)
          .ilike('placa', '0KM%')
          .maybeSingle();
        veiculoExistente = data;
      }

      if (veiculoExistente) {
        veiculoId = veiculoExistente.id;
        console.log('Veículo existente encontrado:', veiculoId);
      } else {
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
            placa: placaParaInsert,
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
            numero_motor: cotacao.veiculo_motor || null,
            status: 'em_analise',
            cobertura_roubo_furto: false,
            cobertura_total: false,
            // 0KM: marca aguardando_placa_definitiva para SGA Hinova dispensar RENAVAM
            // e Softruck enviar chassi como plate/vin. Ver mem://logic/quotation/cotacao-0km-fluxo-canonico
            aguardando_placa_definitiva: (cotacao as any).veiculo_zero_km === true || !placaLimpa,
            ...categoriaFlags,
          })
          .select('id')
          .single();

        if (veiculoExistenteError) {
          console.error('Erro ao criar veículo para associado existente:', veiculoExistenteError);
          throw new Error(`Falha ao criar veículo: ${veiculoExistenteError.message}`);
        }

        veiculoId = novoVeiculoExistente.id;
        console.log('Novo veículo criado para associado existente:', veiculoId, 'placa:', placaParaInsert);
      }
    } else if (emailFinal) {
      const { data: byEmail } = await supabase
        .from('associados')
        .select('id, nome, email, telefone, cpf')
        .eq('email', emailFinal)
        .maybeSingle();
      
      if (byEmail) {
        associadoId = byEmail.id;
        console.log('Associado existente encontrado pelo email:', associadoId);

        // PROTEÇÃO ANTI-COLISÃO: emails podem ser compartilhados entre familiares.
        // Só sincronizar se o nome bater. Se não bater, o cadastro existente é
        // de outra pessoa e este fluxo deve criar um novo associado.
        const mesmoTitularEmail = nomesCoincidem(byEmail.nome, nomeFinal);
        if (!mesmoTitularEmail) {
          console.warn(
            `[ALERTA-COLISAO] email=${emailFinal} associado_id=${associadoId} ` +
            `nome_db="${byEmail.nome}" cpf_db=${byEmail.cpf} nome_cot="${nomeFinal}" cpf_cot=${cpfNormalizado} ` +
            `(cotação ${cotacao_id}) — não reaproveitando associado, será criado um novo.`
          );
          associadoId = null; // força queda no branch de criação
        } else if (telefoneFinal && telefoneFinal.trim() !== '' && telefoneFinal !== byEmail.telefone) {
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
        
        // CORREÇÃO: Buscar ou criar veículo (suporta 0km sem placa)
        // Só executa se ainda tivermos associado válido (não foi descartado por colisão de nome)
        if (associadoId) {
        const placaLimpaEmail = cotacao.veiculo_placa?.replace(/[^A-Za-z0-9]/g, '').toUpperCase() || null;
        const placaParaInsertEmail = placaLimpaEmail || ('0KM' + crypto.randomUUID().replace(/-/g, '').slice(0, 5).toUpperCase());

        let veiculoExistenteEmail: { id: string } | null = null;
        if (placaLimpaEmail) {
          const { data } = await supabase
            .from('veiculos')
            .select('id, associado_id')
            .eq('placa', placaLimpaEmail)
            .maybeSingle();

          // BLOQUEIO ANTI-SEQUESTRO (branch email) — exceção para troca de titularidade
          if (data && data.associado_id && data.associado_id !== associadoId) {
            const liberadoPorTroca = await placaLiberadaPorTrocaTitularidade(
              supabase, placaLimpaEmail, (cotacao as any).dados_extras,
            );
            if (!liberadoPorTroca) {
              console.error(
                `[BLOQUEIO-DONO] Placa ${placaLimpaEmail} já está vinculada ao associado ${data.associado_id}, ` +
                `mas o solicitante atual é ${associadoId} (cotação ${cotacao_id}).`
              );
              return new Response(
                JSON.stringify({
                  success: false,
                  error: `A placa ${placaLimpaEmail} já está vinculada a outro associado no sistema. ` +
                         `Use o fluxo de Substituição/Troca de Titularidade ou verifique se a placa foi digitada corretamente.`,
                  code: 'PLACA_DE_OUTRO_ASSOCIADO',
                }),
                { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
              );
            }
            console.log(`[BLOQUEIO-DONO] Liberado por troca de titularidade legítima: placa=${placaLimpaEmail}`);
          }

          veiculoExistenteEmail = data ? { id: data.id } : null;
        } else {
          const { data } = await supabase
            .from('veiculos')
            .select('id')
            .eq('associado_id', associadoId)
            .eq('marca', cotacao.veiculo_marca)
            .eq('modelo', cotacao.veiculo_modelo)
            .ilike('placa', '0KM%')
            .maybeSingle();
          veiculoExistenteEmail = data;
        }

        if (veiculoExistenteEmail) {
          veiculoId = veiculoExistenteEmail.id;
          console.log('Veículo existente encontrado (email):', veiculoId);
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
              placa: placaParaInsertEmail,
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
              numero_motor: cotacao.veiculo_motor || null,
              status: 'em_analise',
              cobertura_roubo_furto: false,
              cobertura_total: false,
              aguardando_placa_definitiva: (cotacao as any).veiculo_zero_km === true || !placaLimpaEmail,
              ...categoriaFlagsEmail,
            })
            .select('id')
            .single();

          if (veiculoEmailError) {
            console.error('Erro ao criar veículo para associado existente (email):', veiculoEmailError);
            throw new Error(`Falha ao criar veículo: ${veiculoEmailError.message}`);
          }

          veiculoId = novoVeiculoEmail.id;
          console.log('Novo veículo criado para associado existente (email):', veiculoId, 'placa:', placaParaInsertEmail);
        }
        } // fim do guard `if (associadoId)` para criação de veículo
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
        dia_vencimento: (() => {
          const r = resolverDiaVencimento(cotacao.dia_vencimento, cotacao.created_at);
          if (r.usouFallback) {
            console.warn('[contrato-gerar] dia_vencimento ausente/invalido na cotacao', {
              cotacao_id: cotacao.id,
              dia_vencimento_recebido: cotacao.dia_vencimento,
              fallback_aplicado: r.dia,
              regra: 'calcularOpcoesVencimento(created_at)[0]',
            });
          }
          return r.dia;
        })(),
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
      // Suporta carros 0km (sem placa) usando placeholder
      const placaLimpaNovo = cotacao.veiculo_placa?.replace(/[^A-Za-z0-9]/g, '').toUpperCase() || null;
      const placaParaInsertNovo = placaLimpaNovo || ('0KM' + crypto.randomUUID().replace(/-/g, '').slice(0, 5).toUpperCase());

      // BLOQUEIO ANTI-SEQUESTRO: se a placa real já existe sob outro associado, abortar.
      // Exceção: troca de titularidade legítima — reaproveita o veículo existente.
      let reaproveitarVeiculoExistenteId: string | null = null;
      if (placaLimpaNovo) {
        const { data: placaJaExiste } = await supabase
          .from('veiculos')
          .select('id, associado_id')
          .eq('placa', placaLimpaNovo)
          .maybeSingle();
        if (placaJaExiste && placaJaExiste.associado_id && placaJaExiste.associado_id !== associadoId) {
          const liberadoPorTroca = await placaLiberadaPorTrocaTitularidade(
            supabase, placaLimpaNovo, (cotacao as any).dados_extras,
          );
          if (!liberadoPorTroca) {
            console.error(
              `[BLOQUEIO-DONO] Placa ${placaLimpaNovo} já está vinculada ao associado ${placaJaExiste.associado_id}, ` +
              `mas o solicitante novo é ${associadoId} (cotação ${cotacao_id}).`
            );
            return new Response(
              JSON.stringify({
                success: false,
                error: `A placa ${placaLimpaNovo} já está vinculada a outro associado no sistema. ` +
                       `Use o fluxo de Substituição/Troca de Titularidade ou verifique se a placa foi digitada corretamente.`,
                code: 'PLACA_DE_OUTRO_ASSOCIADO',
              }),
              { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            );
          }
          console.log(`[BLOQUEIO-DONO] Liberado por troca de titularidade legítima: placa=${placaLimpaNovo} (reaproveitando veículo ${placaJaExiste.id})`);
          reaproveitarVeiculoExistenteId = placaJaExiste.id;
        } else if (placaJaExiste?.id && placaJaExiste.associado_id === associadoId) {
          reaproveitarVeiculoExistenteId = placaJaExiste.id;
        }
      }

      if (reaproveitarVeiculoExistenteId) {
        veiculoId = reaproveitarVeiculoExistenteId;
        console.log('Veículo existente reaproveitado (troca de titularidade):', veiculoId);
      } else {
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
            placa: placaParaInsertNovo,
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
            numero_motor: cotacao.veiculo_motor || null,
            status: 'em_analise',
            cobertura_roubo_furto: false,
            cobertura_total: false,
            aguardando_placa_definitiva: (cotacao as any).veiculo_zero_km === true || !placaLimpaNovo,
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
    }

    // 8. Calcular carência dinamicamente — baseada no catálogo de coberturas do plano
    const carenciaDiasPadrao = await getConfiguracaoNumero(supabase, 'carencia_dias_padrao', 120);
    const carenciaVidrosDias = await getConfiguracaoNumero(supabase, 'carencia_beneficio_vidros_dias', 120);
    // tipo_entrada: prioriza coluna direta; faz fallback para dados_extras (registros legados)
    // Normalização: 'substituicao' (alias) -> 'substituicao_placa' (canônico do termo)
    const tipoEntradaRaw = (cotacao as any).tipo_entrada
      || ((cotacao as any).dados_extras?.tipo_entrada)
      || 'adesao';
    const tipoEntrada = tipoEntradaRaw === 'substituicao' ? 'substituicao_placa' : tipoEntradaRaw;
    const hoje = new Date().toISOString().split('T')[0];
    let dataCarenciaInicio: string | null = null;
    let dataCarenciaFim: string | null = null;

    // Buscar carências individuais do catálogo de coberturas vinculadas ao plano
    let carenciaDias = carenciaDiasPadrao;
    const planoIdCarencia = cotacao.plano_escolhido_id || cotacao.plano_id;
    if (planoIdCarencia) {
      try {
        const { data: coberturasCatalogo } = await supabase
          .from('planos_coberturas')
          .select('cobertura_id, coberturas:cobertura_id(carencia_ativa, carencia_dias)')
          .eq('plano_id', planoIdCarencia);

        if (coberturasCatalogo?.length) {
          const diasPorCobertura = coberturasCatalogo
            .map((pc: any) => {
              const cob = pc.coberturas;
              if (cob?.carencia_ativa) return cob.carencia_dias || carenciaDiasPadrao;
              return 0;
            })
            .filter((d: number) => d > 0);

          if (diasPorCobertura.length > 0) {
            carenciaDias = Math.max(...diasPorCobertura);
            console.log(`[CONTRATO-GERAR] Carência calculada do catálogo: max=${carenciaDias} dias (${diasPorCobertura.length} coberturas com carência ativa)`);
          }
        }
      } catch (err) {
        console.warn('[CONTRATO-GERAR] Erro ao buscar carências do catálogo, usando padrão:', err);
      }
    }

    // Carência de vidros — sempre calculada para todos os tipos de entrada
    let dataCarenciaVidrosInicio: string | null = hoje;
    let dataCarenciaVidrosFim: string | null = null;
    let carenciaVidrosIsenta = false;
    let carenciaVidrosMotivoIsencao: string | null = null;

    const fimVidros = new Date();
    fimVidros.setDate(fimVidros.getDate() + carenciaVidrosDias);
    dataCarenciaVidrosFim = fimVidros.toISOString().split('T')[0];

    if (['adesao', 'nova', 'inclusao'].includes(tipoEntrada)) {
      dataCarenciaInicio = hoje;
      const fim = new Date();
      fim.setDate(fim.getDate() + carenciaDias);
      dataCarenciaFim = fim.toISOString().split('T')[0];
    }
    console.log(`Carência: tipo_entrada=${tipoEntrada}, dias=${carenciaDias}, inicio=${dataCarenciaInicio}, fim=${dataCarenciaFim}`);
    console.log(`Carência vidros: dias=${carenciaVidrosDias}, inicio=${dataCarenciaVidrosInicio}, fim=${dataCarenciaVidrosFim}`);

    // 8b. Verificar migração aprovada para isenção de carência
    let carenciaIsenta = false;
    let carenciaMotivoIsencao: string | null = null;

    try {
      // Buscar migração aprovada vinculada à cotação
      let migracaoAprovada = null;
      
      const { data: migPorCotacao } = await supabase
        .from('solicitacoes_migracao')
        .select('id, status')
        .eq('cotacao_id', cotacao_id)
        .eq('status', 'aprovada')
        .limit(1)
        .maybeSingle();
      
      migracaoAprovada = migPorCotacao;

      // Fallback: buscar por CPF se não encontrou por cotacao_id
      if (!migracaoAprovada && cpfFinal) {
        const cpfLimpo = cpfFinal.replace(/\D/g, '');
        const { data: migPorCpf } = await supabase
          .from('solicitacoes_migracao')
          .select('id, status')
          .eq('cpf', cpfLimpo)
          .eq('status', 'aprovada')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        migracaoAprovada = migPorCpf;
      }

      if (migracaoAprovada) {
        console.log('Migração aprovada encontrada:', migracaoAprovada.id);
        
        // Ler config de isenção
        const { data: configIsencao } = await supabase
          .from('configuracoes')
          .select('valor')
          .eq('chave', 'migracao_isentar_carencia')
          .maybeSingle();
        
        const isencaoAtiva = configIsencao?.valor === 'true' || configIsencao?.valor === '1';
        console.log('Config migracao_isentar_carencia:', configIsencao?.valor, '-> ativa:', isencaoAtiva);

        if (isencaoAtiva) {
          // Isentar carência de vidros
          carenciaVidrosIsenta = true;
          carenciaVidrosMotivoIsencao = 'Migração aprovada';
          dataCarenciaVidrosInicio = null;
          dataCarenciaVidrosFim = null;

          // Isentar carência geral
          carenciaIsenta = true;
          carenciaMotivoIsencao = 'Migração aprovada';
          dataCarenciaInicio = null;
          dataCarenciaFim = null;

          console.log('Isenção de carência aplicada por migração aprovada');
        }
      }
    } catch (migErr) {
      console.error('Erro ao verificar migração (não bloqueia geração):', migErr);
    }

    // 9. Criar o contrato
    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const numeroTemp = `CTR-${timestamp}-${random}`;

    // Helper de defesa em profundidade: trunca strings longas para evitar erro 22001
    // (value too long for varchar(N)) caso o cliente cole textos enormes em campos de endereço.
    const cap = (v: string | null | undefined, n: number): string | null | undefined =>
      v == null ? v : (typeof v === 'string' && v.length > n ? v.slice(0, n) : v);
    
        // Gerar link_token para permitir acesso público ao contrato (satisfaz RLS)
        const linkToken = crypto.randomUUID();

        // Resolver valor mensal: cotação > plano vigente do antigo titular (troca de titularidade)
        let valorMensalFinal: number = Number(cotacao.valor_total_mensal) || 0;
        if (!valorMensalFinal || valorMensalFinal === 0) {
          // Fallback 1: troca de titularidade — buscar contrato ativo do antigo titular
          const dadosExtrasCot = (cotacao as any).dados_extras || {};
          const antigoId = dadosExtrasCot.associado_antigo_id;
          if (tipoEntrada === 'troca_titularidade' && antigoId) {
            const { data: contratoAntigo } = await supabase
              .from('contratos')
              .select('valor_mensal, valor_adesao')
              .eq('associado_id', antigoId)
              .in('status', ['ativo', 'em_analise', 'assinado'])
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            if (contratoAntigo?.valor_mensal) {
              valorMensalFinal = Number(contratoAntigo.valor_mensal);
              console.log(`[CONTRATO-GERAR] valor_mensal recuperado do contrato antigo: ${valorMensalFinal}`);
            }
          }
        }
        if (!valorMensalFinal || valorMensalFinal === 0) {
          throw new Error('valor_mensal não pôde ser determinado para o contrato. O associado precisa selecionar um plano antes de gerar o contrato.');
        }

        const { data: contrato, error: contratoError } = await supabase
          .from('contratos')
          .insert({
            numero: numeroTemp,
            cotacao_id,
            lead_id: leadId,
            associado_id: associadoId,
            veiculo_id: veiculoId,
            plano_id: cotacao.plano_escolhido_id || cotacao.plano_id,
            valor_adesao: cotacao.valor_adesao || 0,
            valor_mensal: valorMensalFinal,
            valor_adicional: cotacao.valor_adicional || 0,
            vendedor_id: vendedorIdFinal,
            status: 'rascunho',
            
            // Tipo de entrada e carência
            tipo_entrada: tipoEntrada,
            data_carencia_inicio: carenciaIsenta ? null : dataCarenciaInicio,
            data_carencia_fim: carenciaIsenta ? null : dataCarenciaFim,
            carencia_isenta: carenciaIsenta,
            carencia_motivo_isencao: carenciaMotivoIsencao,
            
            // Carência de vidros e faróis
            data_carencia_vidros_inicio: carenciaVidrosIsenta ? null : dataCarenciaVidrosInicio,
            data_carencia_vidros_fim: carenciaVidrosIsenta ? null : dataCarenciaVidrosFim,
            carencia_vidros_isenta: carenciaVidrosIsenta,
            carencia_vidros_motivo_isencao: carenciaVidrosMotivoIsencao,
            
            // Dados do veículo (snapshot completo)
            veiculo_marca: cap(cotacao.veiculo_marca, 100),
            veiculo_modelo: cap(cotacao.veiculo_modelo, 100),
            veiculo_ano: cotacao.veiculo_ano,
            veiculo_placa: cotacao.veiculo_placa,
            veiculo_valor_fipe: cotacao.valor_fipe,
            veiculo_cor: cotacao.veiculo_cor,
            veiculo_combustivel: cotacao.veiculo_combustivel || null,
            veiculo_cambio: (cotacao as any).veiculo_cambio || null,
            veiculo_ano_fabricacao: cotacao.veiculo_ano_fabricacao || cotacao.veiculo_ano || null,
            
            // Campos para Termo de Afiliação (Autentique)
            codigo_fipe: cotacao.codigo_fipe || null,
            uso_aplicativo: cotacao.uso_aplicativo || false,
            veiculo_categoria: cotacao.veiculo_categoria || await detectarCategoriaVeiculo(supabase, cotacao.veiculo_marca, cotacao.veiculo_modelo, cotacao.categoria),
            // Número de portas (snapshot do CRLV/plate-lookup) — null se ausente
            veiculo_numero_portas: cotacao.numero_portas ?? null,
            // Tipo de uso (Particular/Aluguel/Particular comercial) — propaga da cotação para o termo
            veiculo_tipo_uso: cotacao.veiculo_tipo_uso || null,
            
            // Dados obrigatórios para SGA Hinova e Termo de Afiliação (extraídos do CRLV via OCR)
            veiculo_chassi: cotacao.veiculo_chassi || null,
            veiculo_renavam: cotacao.veiculo_renavam || null,
            
            // Dados do cliente (snapshot completo)
            cliente_nome: nomeFinal,
            cliente_email: emailFinal,
            cliente_telefone: telefoneFinal,
            cliente_cpf: cpfFinal,
            
            // NOVOS CAMPOS: Dados de documentos pessoais (extraídos via OCR)
            cliente_rg: cap(cotacao.cliente_rg, 20) || null,
            cliente_rg_orgao: cap(cotacao.cliente_rg_orgao, 20) || null,
            cliente_cnh: cap(cotacao.cliente_cnh, 20) || null,
            cliente_cnh_validade: cotacao.cliente_cnh_validade || null,
            cliente_cnh_categoria: cap(cotacao.cliente_cnh_categoria, 10) || null,
            cliente_data_nascimento: cotacao.cliente_data_nascimento || null,
            
            // NOVOS CAMPOS: Endereço detalhado (snapshot)
            cliente_logradouro: cotacao.cliente_logradouro || null,
            cliente_numero: cap(cotacao.cliente_numero, 20) || null,
            cliente_bairro: cap(cotacao.cliente_bairro, 150) || null,
            cliente_complemento: cap(cotacao.cliente_complemento, 255) || null,
            
            // Link público para satisfazer RLS em acesso anônimo
            link_token: linkToken,
            link_gerado_em: new Date().toISOString(),
            
            // NOVO: token público da cotação para acesso anon via RLS
            cotacao_token_publico: cotacao.token_publico || null,
            
            // Snapshot de cota/cobertura contextual (pode diferir do plano base para uso app)
            cota_participacao: cotacao.cota_participacao ?? null,
            cota_minima: cotacao.cota_minima ?? null,
            cobertura_fipe: cotacao.cobertura_fipe ?? null,
            
            dia_vencimento: (() => {
              const r = resolverDiaVencimento(cotacao.dia_vencimento, cotacao.created_at);
              if (r.usouFallback) {
                console.warn('[contrato-gerar] dia_vencimento ausente/invalido na cotacao (contrato)', {
                  cotacao_id: cotacao.id,
                  dia_vencimento_recebido: cotacao.dia_vencimento,
                  fallback_aplicado: r.dia,
                });
              }
              return r.dia;
            })(),
            data_inicio: hoje,
            validade_link: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            created_by: vendedorIdFinal,
            // Vínculo direto com a solicitação de troca de titularidade (quando aplicável)
            // Garante que UI/regras encontrem o contrato pela solicitação sem depender da efetivação.
            origem_troca_titularidade_id:
              tipoEntrada === 'troca_titularidade'
                ? ((cotacao as any).dados_extras?.solicitacao_troca_id
                  || (cotacao as any).dados_extras?.troca_titularidade_id
                  || null)
                : null,
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
      const associadoUpdate: any = { contrato_id: contrato.id };
      // Copiar dados de CNH/sexo da cotação para o associado.
      // Buscar valores atuais para não sobrescrever edições manuais.
      const { data: assocAtual } = await supabase
        .from('associados')
        .select('cnh_numero, cnh_categoria, cnh_validade, sexo')
        .eq('id', associadoId)
        .maybeSingle();
      if (cotacao.cliente_cnh_validade && !assocAtual?.cnh_validade) {
        associadoUpdate.cnh_validade = cotacao.cliente_cnh_validade;
      }
      if ((cotacao as any).cliente_cnh && !assocAtual?.cnh_numero) {
        associadoUpdate.cnh_numero = String((cotacao as any).cliente_cnh).slice(0, 50);
      }
      if ((cotacao as any).cliente_cnh_categoria && !assocAtual?.cnh_categoria) {
        associadoUpdate.cnh_categoria = String((cotacao as any).cliente_cnh_categoria).slice(0, 10);
      }
      if ((cotacao as any).cliente_sexo && !assocAtual?.sexo) {
        const s = String((cotacao as any).cliente_sexo).trim().toUpperCase();
        if (s === 'M' || s === 'F') associadoUpdate.sexo = s;
      }
      await supabase
        .from('associados')
        .update(associadoUpdate)
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
    console.log('[CONTRATO-GERAR][TELEMETRIA]', JSON.stringify({
      cotacao_id,
      cpf_normalizado: cpfLimpo,
      nome_solicitante: nomeFinal,
      associado_resolvido_id: associadoId,
      veiculo_resolvido_id: veiculoId,
      contrato_id: contrato.id,
      numero: contrato.numero,
    }));

    // ── TROCA DE TITULARIDADE — gancho pós-geração do novo contrato ──
    // O novo contrato foi gerado e o termo de filiação será enviado por e-mail
    // ao novo titular para assinatura facial. NÃO mexemos no status da
    // solicitação aqui — mantemos `liberada_para_assinatura` para que a tela
    // pública continue exibindo o fluxo normal (assinatura → pagamento).
    //
    // A criação do serviço de vistoria de campo + flip para `aguardando_vistoria`
    // é feita pelo trigger `trg_troca_pos_assinatura_pagamento` em `cotacoes`
    // (quando `adesao_paga` vira true) ou pode ser antecipada aqui se o
    // Monitoramento já tinha solicitado vistoria explicitamente.
    try {
      const dadosExtras = (cotacao as any).dados_extras || {};
      if (tipoEntrada === 'troca_titularidade' && dadosExtras.associado_antigo_id) {
        const { data: solTroca } = await supabase
          .from('solicitacoes_troca_titularidade')
          .select('id, status, efetivada_em, associado_antigo_id, servico_vistoria_id, veiculo_id')
          .eq('cotacao_id', cotacao_id)
          .maybeSingle();

        if (solTroca && !solTroca.efetivada_em) {
          // 1) Vincular novo associado à solicitação (idempotente)
          await supabase
            .from('solicitacoes_troca_titularidade')
            .update({ novo_associado_id: associadoId })
            .eq('id', solTroca.id);

          // 2) Só criar serviço de vistoria AGORA se o Monitoramento já tinha
          //    pedido vistoria (solicitação já em `aguardando_vistoria`).
          //    Caso contrário, deixamos para o trigger pós-pagamento.
          const monitoramentoPediuVistoria = solTroca.status === 'aguardando_vistoria';
          let servicoVistoriaId: string | null = solTroca.servico_vistoria_id || null;
          if (monitoramentoPediuVistoria && !servicoVistoriaId) {
            const { data: jaExiste } = await supabase
              .from('servicos')
              .select('id')
              .eq('veiculo_id', solTroca.veiculo_id || veiculoId)
              .eq('tipo', 'vistoria_entrada')
              .in('status', ['pendente', 'agendada', 'em_rota', 'em_andamento', 'em_analise', 'reagendada'])
              .maybeSingle();
            if (jaExiste?.id) {
              servicoVistoriaId = jaExiste.id;
            } else {
              // Endereço/agendamento: prioriza vistoria_completa_* da cotação;
              // fallback para endereço do cliente; data padrão = amanhã (manhã).
              const cot: any = cotacao;
              const amanha = new Date();
              amanha.setDate(amanha.getDate() + 1);
              const dataPadrao = amanha.toISOString().split('T')[0];
              const dataAg = cot.vistoria_completa_data_agendada || dataPadrao;
              const periodoAg = (cot.vistoria_completa_periodo as 'manha' | 'tarde' | null) || 'manha';
              const horaAg = cot.vistoria_completa_horario_agendado || null;

              const { data: novoServ, error: servErr } = await supabase
                .from('servicos')
                .insert({
                  tipo: 'vistoria_entrada',
                  status: 'pendente',
                  origem: 'troca_titularidade',
                  modalidade: 'presencial',
                  associado_id: associadoId,
                  veiculo_id: solTroca.veiculo_id || veiculoId,
                  contrato_id: contrato.id,
                  cotacao_id: cotacao_id,
                  data_agendada: dataAg,
                  periodo: periodoAg,
                  hora_agendada: horaAg,
                  cep: cot.vistoria_completa_endereco_cep || cot.cliente_cep || null,
                  logradouro: cot.vistoria_completa_endereco_logradouro || cot.cliente_logradouro || null,
                  numero: cot.vistoria_completa_endereco_numero || cot.cliente_numero || null,
                  bairro: cot.vistoria_completa_endereco_bairro || cot.cliente_bairro || null,
                  cidade: cot.vistoria_completa_endereco_cidade || cot.cliente_cidade || null,
                  uf: cot.vistoria_completa_endereco_estado || cot.cliente_uf || null,
                  observacoes: `Vistoria de campo — troca de titularidade (solicitação ${solTroca.id}). Aprovação obrigatória do Monitoramento antes da efetivação.`,
                  solicitado_por_modulo: 'troca_titularidade',
                })
                .select('id')
                .single();
              if (servErr) {
                console.error('[CONTRATO-GERAR][troca] falha ao criar serviço de vistoria:', servErr);
              } else if (novoServ) {
                servicoVistoriaId = novoServ.id;
                console.log(`[CONTRATO-GERAR][troca] ✓ Serviço vistoria_entrada criado: ${novoServ.id}`);
              }
            }
          }

          // 3) Linkar serviço de vistoria (se foi criado agora) sem alterar
          //    o status da solicitação. O flip para `aguardando_vistoria`
          //    acontece só após assinatura + pagamento (trigger pós-pagto)
          //    OU já estava em `aguardando_vistoria` se o Monitoramento pediu.
          if (servicoVistoriaId && servicoVistoriaId !== solTroca.servico_vistoria_id) {
            await supabase
              .from('solicitacoes_troca_titularidade')
              .update({
                servico_vistoria_id: servicoVistoriaId,
                updated_at: new Date().toISOString(),
              })
              .eq('id', solTroca.id);
          }

          console.log(`[CONTRATO-GERAR] Troca ${solTroca.id}: contrato gerado (status mantido=${solTroca.status}); vistoria=${servicoVistoriaId || 'pendente pós-pagamento'}`);

          // 4) Notificação WhatsApp removida — fluxo de troca de titularidade
          //    é avisado em outros pontos (enviar-termo-cancelamento-troca para o
          //    associado anterior; demais marcos por triggers próprios).
        } else if (solTroca?.efetivada_em) {
          console.log(`[CONTRATO-GERAR] Troca ${solTroca.id} já estava efetivada (idempotente)`);
        }
      }
    } catch (trocaErr) {
      console.error('[CONTRATO-GERAR] gancho troca de titularidade falhou (não bloqueante):', trocaErr);
    }

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
