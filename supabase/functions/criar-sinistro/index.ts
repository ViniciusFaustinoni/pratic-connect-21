import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Labels para tipos de sinistro
const TIPO_LABELS: Record<string, string> = {
  colisao: 'Colisão',
  roubo: 'Roubo',
  furto: 'Furto',
  incendio: 'Incêndio',
  fenomeno_natural: 'Fenômeno Natural',
  terceiros: 'Terceiros',
  vidros: 'Vidros',
  vandalismo: 'Vandalismo',
  outro: 'Outro',
};

// Documentos obrigatórios por tipo de sinistro
const DOCUMENTOS_OBRIGATORIOS: Record<string, Array<{tipo: string; nome: string; obrigatorio: boolean}>> = {
  colisao: [
    { tipo: 'cnh', nome: 'CNH do Condutor', obrigatorio: true },
    { tipo: 'crlv', nome: 'CRLV do Veículo', obrigatorio: true },
    { tipo: 'foto_dano', nome: 'Fotos dos Danos', obrigatorio: true },
    { tipo: 'foto_local', nome: 'Fotos do Local', obrigatorio: false },
    { tipo: 'bo', nome: 'Boletim de Ocorrência', obrigatorio: false },
  ],
  // GAP 4: Roubo NÃO exige declaração de chaves (condutor estava presente)
  roubo: [
    { tipo: 'cnh', nome: 'CNH do Condutor', obrigatorio: true },
    { tipo: 'crlv', nome: 'CRLV do Veículo', obrigatorio: true },
    { tipo: 'bo', nome: 'Boletim de Ocorrência', obrigatorio: true },
  ],
  // Furto EXIGE declaração de chaves (veículo levado sem presença do condutor)
  furto: [
    { tipo: 'cnh', nome: 'CNH do Condutor', obrigatorio: true },
    { tipo: 'crlv', nome: 'CRLV do Veículo', obrigatorio: true },
    { tipo: 'bo', nome: 'Boletim de Ocorrência', obrigatorio: true },
    { tipo: 'chaves', nome: 'Declaração das Chaves', obrigatorio: true },
  ],
  incendio: [
    { tipo: 'cnh', nome: 'CNH do Condutor', obrigatorio: true },
    { tipo: 'crlv', nome: 'CRLV do Veículo', obrigatorio: true },
    { tipo: 'bo', nome: 'Boletim de Ocorrência', obrigatorio: true },
    { tipo: 'laudo_bombeiros', nome: 'Laudo dos Bombeiros', obrigatorio: true },
    { tipo: 'foto_dano', nome: 'Fotos do Veículo', obrigatorio: true },
  ],
  fenomeno_natural: [
    { tipo: 'cnh', nome: 'CNH do Condutor', obrigatorio: true },
    { tipo: 'crlv', nome: 'CRLV do Veículo', obrigatorio: true },
    { tipo: 'foto_dano', nome: 'Fotos dos Danos', obrigatorio: true },
    { tipo: 'comprovante_evento', nome: 'Comprovante do Evento (notícia/defesa civil)', obrigatorio: false },
  ],
  vandalismo: [
    { tipo: 'cnh', nome: 'CNH do Condutor', obrigatorio: true },
    { tipo: 'crlv', nome: 'CRLV do Veículo', obrigatorio: true },
    { tipo: 'bo', nome: 'Boletim de Ocorrência', obrigatorio: true },
    { tipo: 'foto_dano', nome: 'Fotos dos Danos', obrigatorio: true },
  ],
  terceiros: [
    { tipo: 'cnh', nome: 'CNH do Condutor', obrigatorio: true },
    { tipo: 'crlv', nome: 'CRLV do Veículo', obrigatorio: true },
    { tipo: 'foto_dano', nome: 'Fotos dos Danos', obrigatorio: true },
    { tipo: 'dados_terceiro', nome: 'Dados do Terceiro', obrigatorio: true },
  ],
  vidros: [
    { tipo: 'cnh', nome: 'CNH do Condutor', obrigatorio: true },
    { tipo: 'crlv', nome: 'CRLV do Veículo', obrigatorio: true },
    { tipo: 'foto_dano', nome: 'Fotos dos Danos', obrigatorio: true },
  ],
  outro: [
    { tipo: 'cnh', nome: 'CNH do Condutor', obrigatorio: true },
    { tipo: 'crlv', nome: 'CRLV do Veículo', obrigatorio: true },
    { tipo: 'foto_dano', nome: 'Fotos do Ocorrido', obrigatorio: false },
  ],
};

// Status considerados como "sinistro em aberto"
const STATUS_ABERTOS = [
  'comunicado',
  'em_analise',
  'documentacao_pendente',
  'em_regulacao',
];

interface CriarSinistroRequest {
  veiculo_id: string;
  tipo_sinistro: string;
  data_evento: string;
  hora_evento?: string;
  endereco_evento: string;
  cidade_evento: string;
  estado_evento: string;
  latitude?: number;
  longitude?: number;
  descricao: string;
  numero_bo?: string;
  delegacia_bo?: string;
  fotos?: string[];
  envolveu_terceiros?: boolean;
  necessita_reboque?: boolean;
  peca_danificada?: string; // GAP 1: peça danificada para sinistros de vidros
}

// Gerar protocolo único
function gerarProtocolo(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  return `SIN-${year}${month}${day}-${random}`;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Cliente com service role para operações administrativas
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Cliente com anon key para validar JWT do usuário
    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

    // ============================================
    // 1. VALIDAR AUTENTICAÇÃO
    // ============================================
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[criar-sinistro] Token não fornecido');
      return new Response(
        JSON.stringify({ success: false, error: 'Token de autenticação não fornecido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(token);

    if (authError || !user) {
      console.error('[criar-sinistro] Erro de autenticação:', authError);
      return new Response(
        JSON.stringify({ success: false, error: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[criar-sinistro] Usuário autenticado:', user.id);

    // ============================================
    // 2. BUSCAR ASSOCIADO VINCULADO AO USUÁRIO
    // ============================================
    const { data: associado, error: assocError } = await supabaseAdmin
      .from('associados')
      .select('id, nome, telefone, whatsapp, email, user_id, status, bloqueado')
      .eq('user_id', user.id)
      .single();

    if (assocError || !associado) {
      console.error('[criar-sinistro] Associado não encontrado:', assocError);
      return new Response(
        JSON.stringify({ success: false, error: 'Associado não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se associado está bloqueado
    if (associado.bloqueado) {
      console.error('[criar-sinistro] Associado bloqueado:', associado.id);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Sua conta está bloqueada. Entre em contato com a central.' 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[criar-sinistro] Associado encontrado:', associado.nome);

    // ============================================
    // 3. PARSEAR E VALIDAR PAYLOAD
    // ============================================
    const payload: CriarSinistroRequest = await req.json();
    console.log('[criar-sinistro] Payload recebido:', JSON.stringify(payload, null, 2));

    // Validar campos obrigatórios
    if (!payload.veiculo_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Veículo não informado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!payload.tipo_sinistro) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tipo de sinistro não informado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!payload.data_evento) {
      return new Response(
        JSON.stringify({ success: false, error: 'Data do evento não informada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!payload.descricao || payload.descricao.trim().length < 10) {
      return new Response(
        JSON.stringify({ success: false, error: 'Descrição muito curta. Detalhe o ocorrido.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================
    // 4. VERIFICAR SE VEÍCULO PERTENCE AO ASSOCIADO
    // ============================================
    const { data: veiculo, error: veicError } = await supabaseAdmin
      .from('veiculos')
      .select('id, placa, marca, modelo, ano_modelo, cor, status, cobertura_roubo_furto, cobertura_total')
      .eq('id', payload.veiculo_id)
      .eq('associado_id', associado.id)
      .single();

    if (veicError || !veiculo) {
      console.error('[criar-sinistro] Veículo não encontrado:', veicError);
      return new Response(
        JSON.stringify({ success: false, error: 'Veículo não encontrado ou não pertence ao associado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================
    // 4.1 BUSCAR RASTREADOR E POSIÇÃO ATUAL (EVIDÊNCIA)
    // ============================================
    const { data: rastreador } = await supabaseAdmin
      .from('rastreadores')
      .select('id, codigo, plataforma, ultima_posicao_lat, ultima_posicao_lng, ultima_comunicacao')
      .eq('veiculo_id', payload.veiculo_id)
      .eq('status', 'instalado')
      .maybeSingle();
    
    console.log('[criar-sinistro] Rastreador encontrado:', rastreador?.codigo || 'Nenhum');
    
    // Variáveis para posição do rastreador no momento do sinistro
    let rastreadorLatMomento = rastreador?.ultima_posicao_lat || null;
    let rastreadorLngMomento = rastreador?.ultima_posicao_lng || null;
    let rastreadorPosicaoCapturadaEm = rastreador?.ultima_comunicacao || null;
    
    // Tentar buscar posição em tempo real para evidência (Softruck ou Rede Veículos)
    if (rastreador && (rastreador.plataforma === 'softruck' || rastreador.plataforma === 'rede_veiculos')) {
      try {
        console.log('[criar-sinistro] Buscando posição em tempo real via posicao-veiculo para:', rastreador.plataforma);
        
        const posicaoResult = await fetch(
          `${supabaseUrl}/functions/v1/posicao-veiculo`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ veiculo_id: payload.veiculo_id }),
          }
        );
        
        const posicaoData = await posicaoResult.json();
        
        if (posicaoData.success && posicaoData.posicao) {
          rastreadorLatMomento = posicaoData.posicao.latitude;
          rastreadorLngMomento = posicaoData.posicao.longitude;
          rastreadorPosicaoCapturadaEm = posicaoData.posicao.data_posicao || posicaoData.posicao.data_hora || new Date().toISOString();
          console.log('[criar-sinistro] Posição tempo real obtida:', rastreadorLatMomento, rastreadorLngMomento);
        } else {
          console.warn('[criar-sinistro] API retornou sem posição, usando cache do banco');
        }
      } catch (err) {
        console.error('[criar-sinistro] Erro ao buscar posição tempo real (usando cache):', err);
      }
    }

    // ============================================
    // 4.2 VALIDAÇÃO DE COBERTURA (NOVA LÓGICA)
    // ============================================
    const isRouboOuFurto = ['roubo', 'furto'].includes(payload.tipo_sinistro);
    const temCoberturaRouboFurto = veiculo.cobertura_roubo_furto === true;
    const temCoberturaTotal = veiculo.cobertura_total === true;
    
    // Flag para alerta especial
    let alertaRecemAtivado = false;
    
    // Labels amigáveis para status do veículo
    const statusLabels: Record<string, string> = {
      instalacao_pendente: 'aguardando instalação do rastreador',
      inativo: 'inativo',
      cancelado: 'cancelado',
      bloqueado: 'bloqueado',
      suspenso: 'suspenso',
    };
    
    // Lógica de validação baseada em cobertura
    if (veiculo.status === 'ativo' && temCoberturaTotal) {
      console.log('[criar-sinistro] ✓ Veículo ativo com cobertura total - permitido qualquer sinistro');
    } else if (temCoberturaRouboFurto && isRouboOuFurto) {
      console.log('[criar-sinistro] ✓ Cobertura roubo/furto ativa - permitido sinistro de', payload.tipo_sinistro);
      
      if (veiculo.status === 'instalacao_pendente' || !temCoberturaTotal) {
        alertaRecemAtivado = true;
        console.log('[criar-sinistro] ⚠️ Sinistro de roubo/furto SEM rastreador instalado - alerta ativado');
      }
    } else if (veiculo.status !== 'ativo') {
      const statusLabel = statusLabels[veiculo.status] || veiculo.status;
      console.error('[criar-sinistro] Veículo não está ativo:', veiculo.status);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Não é possível registrar sinistro: veículo ${statusLabel}. Entre em contato com a central.` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (!isRouboOuFurto && !temCoberturaTotal) {
      console.error('[criar-sinistro] Cobertura insuficiente para tipo:', payload.tipo_sinistro);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Sua cobertura atual permite apenas sinistros de roubo e furto. Aguarde a instalação do rastreador para cobertura total.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================
    // 4.2.1 GAP 1: VALIDAÇÃO CARÊNCIA 120d E LIMITE 12 MESES PARA VIDROS
    // ============================================
    if (payload.tipo_sinistro === 'vidros') {
      // Buscar contrato ativo do associado para verificar carência
      const { data: contrato } = await supabaseAdmin
        .from('contratos')
        .select('data_ativacao')
        .eq('associado_id', associado.id)
        .eq('status', 'ativo')
        .maybeSingle();

      if (contrato?.data_ativacao) {
        const dataAtivacao = new Date(contrato.data_ativacao);
        const hoje = new Date();
        const diffMs = hoje.getTime() - dataAtivacao.getTime();
        const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDias < 120) {
          const dataDisponivel = new Date(dataAtivacao);
          dataDisponivel.setDate(dataDisponivel.getDate() + 120);
          const dataFormatada = dataDisponivel.toLocaleDateString('pt-BR');

          console.warn('[criar-sinistro] Carência de vidros não cumprida:', diffDias, 'dias');
          return new Response(
            JSON.stringify({
              success: false,
              error: `Benefício de vidros possui carência de 120 dias. Disponível a partir de ${dataFormatada}.`,
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Verificar limite de 1 uso por peça a cada 12 meses
      if (payload.peca_danificada) {
        const dozeMesesAtras = new Date();
        dozeMesesAtras.setMonth(dozeMesesAtras.getMonth() - 12);

        const { data: sinistrosVidro } = await supabaseAdmin
          .from('sinistros')
          .select('id, protocolo, peca_danificada, created_at')
          .eq('veiculo_id', payload.veiculo_id)
          .eq('tipo', 'vidros')
          .eq('peca_danificada', payload.peca_danificada)
          .gte('created_at', dozeMesesAtras.toISOString())
          .not('status', 'in', '("cancelado","negado")');

        if (sinistrosVidro && sinistrosVidro.length > 0) {
          const sinistroAnterior = sinistrosVidro[0];
          console.warn('[criar-sinistro] Limite de vidros atingido para peça:', payload.peca_danificada);
          return new Response(
            JSON.stringify({
              success: false,
              error: `Já existe um sinistro de vidros para ${payload.peca_danificada} nos últimos 12 meses (protocolo ${sinistroAnterior.protocolo}). Limite: 1 utilização por peça a cada 12 meses.`,
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      console.log('[criar-sinistro] ✓ Validações de vidros OK');
    }

    // ============================================
    // 4.3 VERIFICAR STATUS E ADIMPLÊNCIA NA PLATAFORMA REDE VEÍCULOS
    // ============================================
    // GAP 2: Inadimplência registra alerta em vez de bloquear
    let alertaInadimplente = false;

    if (rastreador?.plataforma === 'rede_veiculos') {
      try {
        console.log('[criar-sinistro] Verificando status na plataforma Rede Veículos...');
        
        const statusResponse = await fetch(
          `${supabaseUrl}/functions/v1/rede-veiculos-obter-status-veiculo`,
          {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ veiculoId: payload.veiculo_id }),
          }
        );
        
        const statusData = await statusResponse.json();
        console.log('[criar-sinistro] Resposta status plataforma:', statusData);
        
        if (statusData.success) {
          // Verificar se veículo está ativo na plataforma
          if (statusData.dados?.statusPlataforma === 'inativo') {
            console.warn('[criar-sinistro] Veículo inativo na plataforma');
            return new Response(
              JSON.stringify({
                success: false,
                error: 'Veículo inativo na plataforma de rastreamento. Entre em contato com a central para regularização.',
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          // GAP 2: Inadimplência NÃO bloqueia mais - registra alerta
          if (statusData.dados?.adimplente === false) {
            alertaInadimplente = true;
            console.warn('[criar-sinistro] ⚠️ Cliente inadimplente - sinistro será criado com alerta');
          }
          
          console.log('[criar-sinistro] Status plataforma OK:', statusData.dados?.statusPlataforma);
        } else {
          console.warn('[criar-sinistro] Não foi possível verificar status na plataforma:', statusData.erro);
        }
      } catch (err) {
        console.warn('[criar-sinistro] Erro ao verificar status na plataforma (não bloqueante):', err);
      }
    }

    console.log('[criar-sinistro] Veículo validado:', veiculo.placa);

    // ============================================
    // 5. VERIFICAR SE JÁ EXISTE SINISTRO EM ABERTO
    // ============================================
    const { data: sinistroExistente } = await supabaseAdmin
      .from('sinistros')
      .select('id, protocolo, status, created_at')
      .eq('veiculo_id', payload.veiculo_id)
      .in('status', STATUS_ABERTOS)
      .limit(1)
      .maybeSingle();

    if (sinistroExistente) {
      console.log('[criar-sinistro] Sinistro já existe:', sinistroExistente.protocolo);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Já existe um sinistro em aberto para este veículo`,
          sinistro_existente: {
            id: sinistroExistente.id,
            protocolo: sinistroExistente.protocolo,
            status: sinistroExistente.status,
          }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================
    // 6. GERAR PROTOCOLO E CRIAR SINISTRO
    // ============================================
    const protocolo = gerarProtocolo();
    const dataCriacao = new Date().toISOString();

    // Formatar data/hora do evento
    let dataHoraOcorrencia = payload.data_evento;
    if (payload.hora_evento) {
      const [ano, mes, dia] = payload.data_evento.split('-');
      dataHoraOcorrencia = `${ano}-${mes}-${dia}T${payload.hora_evento}:00`;
    }

    const { data: sinistro, error: insertError } = await supabaseAdmin
      .from('sinistros')
      .insert({
        associado_id: associado.id,
        veiculo_id: payload.veiculo_id,
        protocolo: protocolo,
        tipo: payload.tipo_sinistro,
        data_ocorrencia: dataHoraOcorrencia,
        local_ocorrencia: payload.endereco_evento || '',
        cidade_ocorrencia: payload.cidade_evento || '',
        estado_ocorrencia: payload.estado_evento || '',
        descricao: payload.descricao,
        bo_numero: payload.numero_bo || null,
        status: 'comunicado',
        canal: 'app',
        necessita_reboque: payload.necessita_reboque || false,
        peca_danificada: payload.peca_danificada || null,
        // ===== FLAG DE ALERTA RECÉM-ATIVADO =====
        alerta_recem_ativado: alertaRecemAtivado,
        // ===== GAP 2: FLAG DE INADIMPLÊNCIA =====
        alerta_inadimplente: alertaInadimplente,
        // ===== CAMPOS DE POSIÇÃO (EVIDÊNCIA - TEMPO REAL QUANDO POSSÍVEL) =====
        latitude_informada: payload.latitude || null,
        longitude_informada: payload.longitude || null,
        rastreador_lat_momento: rastreadorLatMomento,
        rastreador_lng_momento: rastreadorLngMomento,
        rastreador_posicao_capturada_em: rastreadorPosicaoCapturadaEm,
      })
      .select()
      .single();
    
    console.log('[criar-sinistro] Posições gravadas:', {
      informada: payload.latitude && payload.longitude ? `${payload.latitude}, ${payload.longitude}` : 'N/A',
      rastreador: rastreadorLatMomento ? `${rastreadorLatMomento}, ${rastreadorLngMomento}` : 'N/A',
      tempo_real: rastreador ? (rastreador.plataforma === 'softruck' || rastreador.plataforma === 'rede_veiculos') : false,
      alerta_recem_ativado: alertaRecemAtivado,
      alerta_inadimplente: alertaInadimplente,
    });

    if (insertError) {
      console.error('[criar-sinistro] Erro ao inserir sinistro:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao criar sinistro. Tente novamente.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[criar-sinistro] Sinistro criado:', sinistro.id, protocolo, alertaRecemAtivado ? '⚠️ ALERTA RECÉM-ATIVADO' : '', alertaInadimplente ? '⚠️ ALERTA INADIMPLENTE' : '');

    // ============================================
    // 6.1 GAP 3: FLUXO SIMPLIFICADO PARA VIDROS
    // ============================================
    if (payload.tipo_sinistro === 'vidros') {
      // Vidros pula direto para "em_analise" (não precisa vistoria presencial)
      const { error: updateError } = await supabaseAdmin
        .from('sinistros')
        .update({
          status: 'em_analise',
          fluxo_simplificado: true,
        })
        .eq('id', sinistro.id);

      if (updateError) {
        console.error('[criar-sinistro] Erro ao ativar fluxo simplificado:', updateError);
      } else {
        console.log('[criar-sinistro] ✓ Fluxo simplificado de vidros ativado - status: em_analise');
      }
    }

    // ============================================
    // 7. REGISTRAR NO HISTÓRICO
    // ============================================
    const alertas: string[] = [];
    if (alertaRecemAtivado) alertas.push('⚠️ ALERTA: Associado recém-ativado (sem rastreador)');
    if (alertaInadimplente) alertas.push('⚠️ ALERTA: Associado com pendências financeiras no momento da comunicação');

    const observacaoHistorico = [
      `Sinistro comunicado via app - ${TIPO_LABELS[payload.tipo_sinistro] || payload.tipo_sinistro}`,
      ...alertas,
    ].join('\n');
    
    await supabaseAdmin.from('sinistro_historico').insert({
      sinistro_id: sinistro.id,
      status_novo: 'comunicado',
      usuario_id: user.id,
      observacao: observacaoHistorico,
    });

    // Se vidros, registrar transição para em_analise também
    if (payload.tipo_sinistro === 'vidros') {
      await supabaseAdmin.from('sinistro_historico').insert({
        sinistro_id: sinistro.id,
        status_anterior: 'comunicado',
        status_novo: 'em_analise',
        observacao: 'Fluxo simplificado de vidros - encaminhado automaticamente para análise',
      });
    }

    console.log('[criar-sinistro] Histórico registrado');

    // ============================================
    // 7.1 CRIAR CHAMADO DE REBOQUE (SE NECESSÁRIO)
    // ============================================
    let chamadoReboqueId: string | null = null;
    let chamadoReboqueProtocolo: string | null = null;

    if (payload.necessita_reboque) {
      try {
        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const rndAss = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
        const protocoloAss = `ASS-${dateStr}-${rndAss}`;

        const { data: chamadoReboque, error: chamadoError } = await supabaseAdmin
          .from('chamados_assistencia')
          .insert({
            protocolo: protocoloAss,
            associado_id: associado.id,
            veiculo_id: payload.veiculo_id,
            tipo_servico: 'guincho',
            descricao: `Reboque solicitado junto ao sinistro ${protocolo}`,
            origem_endereco: payload.endereco_evento || null,
            origem_lat: payload.latitude || null,
            origem_lng: payload.longitude || null,
            canal: 'app',
            status: 'aberto',
            data_abertura: new Date().toISOString(),
          })
          .select('id, protocolo')
          .single();

        if (chamadoError) {
          console.error('[criar-sinistro] Erro ao criar chamado de reboque:', chamadoError);
        } else {
          chamadoReboqueId = chamadoReboque.id;
          chamadoReboqueProtocolo = chamadoReboque.protocolo;

          await supabaseAdmin
            .from('sinistros')
            .update({ chamado_assistencia_id: chamadoReboque.id })
            .eq('id', sinistro.id);

          console.log('[criar-sinistro] Chamado de reboque criado:', chamadoReboqueProtocolo);
        }
      } catch (rebError) {
        console.error('[criar-sinistro] Erro ao criar reboque (não bloqueante):', rebError);
      }
    }

    // ============================================
    // 8. CRIAR DOCUMENTOS PENDENTES
    // ============================================
    const documentosPendentes = DOCUMENTOS_OBRIGATORIOS[payload.tipo_sinistro] || DOCUMENTOS_OBRIGATORIOS.outro;

    const docsToUpsert = documentosPendentes.map(doc => ({
      sinistro_id: sinistro.id,
      tipo: doc.tipo,
      nome: doc.nome,
      obrigatorio: doc.obrigatorio,
      status: 'pendente',
    }));

    await supabaseAdmin.from('sinistro_documentos')
      .upsert(docsToUpsert, { onConflict: 'sinistro_id,tipo', ignoreDuplicates: true });

    console.log('[criar-sinistro] Documentos pendentes criados:', documentosPendentes.length);

    // ============================================
    // 9. NOTIFICAR ANALISTAS DE SINISTROS
    // ============================================
    try {
      const { data: analistas } = await supabaseAdmin
        .from('user_roles')
        .select('user_id')
        .eq('role', 'analista_sinistros');

      let destinatarios = analistas || [];
      if (destinatarios.length === 0) {
        const { data: diretores } = await supabaseAdmin
          .from('user_roles')
          .select('user_id')
          .eq('role', 'diretor');
        destinatarios = diretores || [];
      }

      // Título com alertas especiais
      let tituloNotificacao = '🆕 Novo Sinistro Registrado';
      if (alertaRecemAtivado) tituloNotificacao = '🆕⚠️ Sinistro Recém-Ativado (sem rastreador)';
      if (alertaInadimplente) tituloNotificacao = '🆕⚠️ Sinistro com Pendência Financeira';
      if (alertaRecemAtivado && alertaInadimplente) tituloNotificacao = '🆕⚠️⚠️ Sinistro com Alertas Múltiplos';

      for (const dest of destinatarios) {
        await supabaseAdmin.from('notificacoes').insert({
          user_id: dest.user_id,
          titulo: tituloNotificacao,
          mensagem: `Sinistro ${protocolo} - ${TIPO_LABELS[payload.tipo_sinistro] || payload.tipo_sinistro} - Veículo ${veiculo.placa}${alertaInadimplente ? ' ⚠️ INADIMPLENTE' : ''}`,
          tipo: 'alerta',
          categoria: 'sinistros',
          referencia_tipo: 'sinistro',
          referencia_id: sinistro.id,
          link: `/sinistros/${sinistro.id}`,
          lida: false,
        });
      }

      console.log('[criar-sinistro] Notificações enviadas para', destinatarios.length, 'analistas');

      // Enviar email para equipe de sinistros
      await supabaseAdmin.functions.invoke('send-email', {
        body: {
          to: 'sinistros@praticprotect.com.br',
          subject: alertaInadimplente
            ? `⚠️ Sinistro INADIMPLENTE: ${protocolo} - ${veiculo.placa}`
            : alertaRecemAtivado 
              ? `⚠️ Sinistro Recém-Ativado: ${protocolo} - ${veiculo.placa}`
              : `Novo Sinistro: ${protocolo} - ${veiculo.placa}`,
          html: `
            <h2>${alertaRecemAtivado ? '⚠️ Sinistro de Associado Recém-Ativado' : alertaInadimplente ? '⚠️ Sinistro com Pendência Financeira' : 'Novo Sinistro Registrado'}</h2>
            ${alertaRecemAtivado ? '<p style="color: #d97706; font-weight: bold;">ATENÇÃO: Este sinistro foi aberto por associado que ainda não possui rastreador instalado. Requer análise especial.</p>' : ''}
            ${alertaInadimplente ? '<p style="background: #fef3c7; color: #92400e; padding: 8px 12px; border-radius: 4px; font-weight: bold;">⚠️ ATENÇÃO: Associado com pendências financeiras no momento da comunicação do sinistro. A decisão de aprovação/negação fica a critério do analista.</p>' : ''}
            <p><strong>Protocolo:</strong> ${protocolo}</p>
            <p><strong>Tipo:</strong> ${TIPO_LABELS[payload.tipo_sinistro] || payload.tipo_sinistro}</p>
            <p><strong>Associado:</strong> ${associado.nome}</p>
            <p><strong>Veículo:</strong> ${veiculo.placa} - ${veiculo.marca} ${veiculo.modelo}</p>
            <p><strong>Local:</strong> ${payload.cidade_evento || 'Não informado'}/${payload.estado_evento || ''}</p>
            <p><strong>Data do evento:</strong> ${payload.data_evento}</p>
            <br>
            <p><strong>Descrição:</strong></p>
            <p>${payload.descricao}</p>
          `,
        }
      });

      console.log('[criar-sinistro] Email enviado para equipe');
    } catch (notifError) {
      console.error('[criar-sinistro] Erro ao enviar notificações (não bloqueante):', notifError);
    }

    // ============================================
    // 10. NOTIFICAR ASSOCIADO
    // ============================================
    if (associado.user_id) {
      await supabaseAdmin.from('notificacoes').insert({
        user_id: associado.user_id,
        titulo: '✅ Sinistro Registrado',
        mensagem: `Seu sinistro foi registrado com sucesso. Protocolo: ${protocolo}. Em breve iniciaremos a análise.`,
        tipo: 'info',
        categoria: 'sinistros',
        referencia_tipo: 'sinistro',
        referencia_id: sinistro.id,
        link: `/app/sinistros/${sinistro.id}`,
        lida: false,
      });
    }

    // Notificar via edge function se houver
    try {
      await supabaseAdmin.functions.invoke('notificar-sinistro', {
        body: {
          sinistro_id: sinistro.id,
          status: payload.tipo_sinistro === 'vidros' ? 'em_analise' : 'comunicado',
        }
      });
    } catch (e) {
      console.log('[criar-sinistro] Notificação adicional não enviada:', e);
    }

    // ============================================
    // 10.1 AGENDAR CONTATO AUTOMÁTICO (TODOS OS TIPOS)
    // ============================================
    try {
      console.log('[criar-sinistro] Agendando contato D+1 para tipo:', payload.tipo_sinistro);
      const agendarResult = await supabaseAdmin.functions.invoke('agendar-contato-sinistro', {
        body: { sinistro_id: sinistro.id },
      });
      console.log('[criar-sinistro] Contato agendado:', agendarResult.data);
    } catch (e) {
      console.error('[criar-sinistro] Erro ao agendar contato (não bloqueante):', e);
    }

    // ============================================
    // 11. RETORNAR RESPOSTA DE SUCESSO
    // ============================================
    console.log('[criar-sinistro] Sucesso! Protocolo:', protocolo);

    return new Response(
      JSON.stringify({
        success: true,
        sinistro_id: sinistro.id,
        numero_sinistro: protocolo,
        status: payload.tipo_sinistro === 'vidros' ? 'em_analise' : 'comunicado',
        documentos_pendentes: documentosPendentes,
        analista_responsavel: null,
        mensagem_confirmacao: chamadoReboqueProtocolo
          ? `Sinistro registrado com sucesso! Protocolo: ${protocolo}. Reboque solicitado: ${chamadoReboqueProtocolo}.`
          : `Sinistro registrado com sucesso! Protocolo: ${protocolo}. Em breve iniciaremos a análise.`,
        veiculo: {
          placa: veiculo.placa,
          modelo: `${veiculo.marca} ${veiculo.modelo}`,
        },
        data_criacao: dataCriacao,
        alerta_recem_ativado: alertaRecemAtivado,
        alerta_inadimplente: alertaInadimplente,
        fluxo_simplificado: payload.tipo_sinistro === 'vidros',
        chamado_reboque_id: chamadoReboqueId,
        chamado_reboque_protocolo: chamadoReboqueProtocolo,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[criar-sinistro] Erro geral:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Erro interno ao processar sinistro. Tente novamente.' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
