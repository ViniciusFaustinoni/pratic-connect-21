import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Calcula a distância entre dois pontos usando a fórmula de Haversine
 * Retorna a distância em quilômetros
 */
function calcularDistanciaKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Raio da Terra em km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Verifica se um serviço pode ser atribuído no momento atual
 * Regras:
 * - Serviços com permite_encaixe = true podem ser atribuídos a qualquer momento
 * - Serviços normais de HOJE só podem ser atribuídos após o hora_agendada
 * - Serviços de datas futuras (amanhã) podem ser atribuídos normalmente
 */
function podeSerAtribuido(
  servico: { data_agendada: string; hora_agendada: string | null; permite_encaixe: boolean },
  agora: Date,
  hojeStr: string
): boolean {
  // Encaixes podem ser atribuídos livremente
  if (servico.permite_encaixe) return true;
  
  // Serviços de datas futuras podem ser atribuídos (amanhã)
  if (servico.data_agendada > hojeStr) return true;
  
  // Serviços de HOJE com hora específica
  if (servico.data_agendada === hojeStr && servico.hora_agendada) {
    const horaAtual = agora.toTimeString().slice(0, 5); // "HH:MM"
    return horaAtual >= servico.hora_agendada;
  }
  
  // Sem hora específica = pode ser atribuído
  return true;
}

/**
 * Verifica se o profissional tem tarefas agendadas dentro da janela de horas configurada
 * CORRIGIDO: Usa APENAS a tabela SERVICOS como fonte única de verdade
 */
async function temTarefasNaJanela(
  supabase: any,
  profissionalId: string,
  janelaHoras: number
): Promise<boolean> {
  const agora = new Date();
  const limiteJanela = new Date(agora.getTime() + janelaHoras * 60 * 60 * 1000);
  const hojeStr = agora.toISOString().split('T')[0];
  const limiteJanelaStr = limiteJanela.toISOString().split('T')[0];
  const horaAtual = agora.toTimeString().slice(0, 5); // "HH:MM"
  const horaLimite = limiteJanela.toTimeString().slice(0, 5);

  // ✅ CORRIGIDO: Buscar tarefas APENAS da tabela SERVICOS (fonte única de verdade)
  const { data: tarefasAtribuidas, error } = await supabase
    .from('servicos')
    .select('id, data_agendada, hora_agendada, tipo, status')
    .eq('profissional_id', profissionalId)
    .in('status', ['agendada', 'em_rota', 'em_andamento'])
    .gte('data_agendada', hojeStr)
    .lte('data_agendada', limiteJanelaStr);

  if (error) {
    console.error('[temTarefasNaJanela] Erro ao buscar tarefas do profissional:', error);
    return false;
  }

  // Filtrar apenas tarefas DENTRO da janela de tempo
  const tarefasNaJanela = (tarefasAtribuidas || []).filter((tarefa: any) => {
    // Se é de um dia futuro (dentro do limite), conta
    if (tarefa.data_agendada > hojeStr && tarefa.data_agendada <= limiteJanelaStr) {
      return true;
    }
    
    // Se é de hoje, verificar se está dentro da janela de horas
    if (tarefa.data_agendada === hojeStr) {
      // Se não tem hora específica, considera que está na janela
      if (!tarefa.hora_agendada) return true;
      
      // Verificar se a hora está entre agora e o limite
      return tarefa.hora_agendada >= horaAtual && tarefa.hora_agendada <= horaLimite;
    }
    
    return false;
  });

  console.log(`[temTarefasNaJanela] Profissional ${profissionalId}: ${tarefasNaJanela.length} tarefas nas próximas ${janelaHoras}h`);
  return tarefasNaJanela.length > 0;
}

interface ServicoDisponivel {
  id: string;
  tipo: string;
  data_agendada: string;
  hora_agendada: string | null;
  latitude: number | null;
  longitude: number | null;
  permite_encaixe: boolean;
  confirmacao_whatsapp: string | null;
  periodo: string | null;
  status: string;
  associado_id: string | null;
  associado_nome: string;
  associado_telefone: string;
  associado_whatsapp: string;
  veiculo_id: string | null;
  veiculo_placa: string;
  veiculo_marca: string;
  veiculo_modelo: string;
  veiculo_cor: string;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
}

interface ServicoComDistancia extends ServicoDisponivel {
  distancia_km: number;
  is_hoje: boolean;
  is_amanha: boolean;
  is_encaixe_futuro: boolean;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Token não fornecido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decode JWT to get user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authUserId = user.id;

    // ✅ CORRIGIDO: Buscar perfil pelo user_id (auth), não pelo id do profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, nome, ativo')
      .eq('user_id', authUserId)
      .single();

    if (profileError || !profile) {
      console.error(`[atribuir-proxima-tarefa] ERRO: Profissional ${authUserId} (${user.email}) não tem perfil no sistema!`);
      console.error(`[atribuir-proxima-tarefa] Erro detalhado:`, JSON.stringify(profileError));
      return new Response(
        JSON.stringify({ 
          error: "Perfil não encontrado no sistema. Contate o suporte.",
          codigo: "PERFIL_INEXISTENTE",
          detalhes: `O usuário ${user.email} não possui cadastro completo.`
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!profile.ativo) {
      console.warn(`[atribuir-proxima-tarefa] Profissional ${authUserId} está INATIVO`);
      return new Response(
        JSON.stringify({ 
          error: "Seu perfil está inativo. Contate o suporte.",
          codigo: "PERFIL_INATIVO"
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ✅ profileId = profiles.id (usado em todas as tabelas que referenciam profiles)
    const profissionalId = profile.id;
    console.log(`[atribuir-proxima-tarefa] Perfil verificado: ${profile.nome} (authUserId=${authUserId}, profileId=${profissionalId})`);

    // ========== VERIFICAR STATUS DE JORNADA (ALMOÇO) ==========
    const hoje = new Date().toISOString().split('T')[0];
    const { data: turnoHoje, error: turnoError } = await supabase
      .from('turnos_profissionais')
      .select('id, status, inicio_almoco, inicio_turno, fim_almoco')
      .eq('profissional_id', profissionalId)
      .eq('data', hoje)
      .maybeSingle();

    if (turnoError) {
      console.error('[atribuir-proxima-tarefa] Erro ao buscar turno:', turnoError);
    }

    // Se está em almoço, não atribuir novas tarefas
    if (turnoHoje?.status === 'em_almoco') {
      const inicioAlmoco = new Date(turnoHoje.inicio_almoco!);
      const agora = new Date();
      const minutosEmAlmoco = Math.floor((agora.getTime() - inicioAlmoco.getTime()) / 60000);
      const minutosRestantes = Math.max(0, 60 - minutosEmAlmoco);
      const emAtraso = minutosEmAlmoco > 60;
      const minutosAtraso = emAtraso ? minutosEmAlmoco - 60 : 0;

      console.log(`[atribuir-proxima-tarefa] Profissional em almoço há ${minutosEmAlmoco} minutos. Atraso: ${minutosAtraso} min`);

      return new Response(
        JSON.stringify({
          resultado: 'em_almoco',
          mensagem: emAtraso 
            ? `Você está ${minutosAtraso} minutos atrasado do almoço. Este tempo será acrescido à sua jornada.`
            : `Você está em horário de almoço. Aguarde ${minutosRestantes} minutos para receber novas tarefas.`,
          minutos_restantes: minutosRestantes,
          em_atraso: emAtraso,
          minutos_atraso: minutosAtraso
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Forçar almoço se atingiu limite configurado sem iniciar
    if (turnoHoje && turnoHoje.status === 'ativo' && !turnoHoje.inicio_almoco && turnoHoje.inicio_turno) {
      const inicioTurno = new Date(turnoHoje.inicio_turno);
      const agora = new Date();
      const minutosTrabalhados = Math.floor((agora.getTime() - inicioTurno.getTime()) / 60000);

      // Ler limite configurável do banco (fallback 4h = 240min)
      const { data: cfgAlmoco } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'jornada_horas_ate_almoco')
        .maybeSingle();
      const limiteAlmocoMinutos = cfgAlmoco?.valor ? Math.round(parseFloat(cfgAlmoco.valor) * 60) : 240;

      if (minutosTrabalhados >= limiteAlmocoMinutos) {
        console.log(`[atribuir-proxima-tarefa] Profissional trabalhou ${minutosTrabalhados} min (limite: ${limiteAlmocoMinutos}). Forçando almoço.`);
        
        await supabase
          .from('turnos_profissionais')
          .update({ 
            status: 'em_almoco',
            inicio_almoco: new Date().toISOString()
          })
          .eq('id', turnoHoje.id);
        
        return new Response(
          JSON.stringify({
            resultado: 'almoco_iniciado',
            mensagem: 'Você completou 4 horas de trabalho. Horário de almoço iniciado automaticamente (1 hora).'
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Get request body
    const { latitude, longitude, acao } = await req.json();

    // Validate coordinates
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return new Response(
        JSON.stringify({ error: "Coordenadas inválidas. Latitude e longitude são obrigatórias." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[atribuir-proxima-tarefa] Profissional ${profissionalId} em (${latitude}, ${longitude}), ação: ${acao || 'iniciar'}`);

    // 1. Verificar se profissional já tem tarefa em andamento (usando nova RPC da tabela servicos)
    const { data: tarefaAtual } = await supabase.rpc('buscar_tarefa_atual_profissional', {
      p_profissional_id: profissionalId
    });

    if (tarefaAtual && tarefaAtual.length > 0) {
      const tarefa = tarefaAtual[0];
      console.log(`[atribuir-proxima-tarefa] Profissional já tem tarefa: ${tarefa.tipo} ${tarefa.id}`);
      
      // Calcular distância até a tarefa atual
      let distancia_km = null;
      if (tarefa.latitude && tarefa.longitude) {
        distancia_km = calcularDistanciaKm(
          latitude, longitude,
          tarefa.latitude, tarefa.longitude
        );
      }

      return new Response(
        JSON.stringify({
          resultado: 'ja_tem_tarefa',
          tarefa: {
            id: tarefa.id,
            tipo: tarefa.tipo,
            status: tarefa.status,
            data_agendada: tarefa.data_agendada,
            hora_agendada: tarefa.hora_agendada,
            cliente: {
              id: tarefa.associado_id,
              nome: tarefa.associado_nome,
              telefone: tarefa.associado_telefone,
              whatsapp: tarefa.associado_whatsapp
            },
            veiculo: {
              id: tarefa.veiculo_id,
              placa: tarefa.veiculo_placa,
              marca: tarefa.veiculo_marca,
              modelo: tarefa.veiculo_modelo,
              cor: tarefa.veiculo_cor
            },
            endereco: {
              logradouro: tarefa.logradouro,
              numero: tarefa.numero,
              bairro: tarefa.bairro,
              cidade: tarefa.cidade,
              uf: tarefa.uf,
              cep: tarefa.cep,
              latitude: tarefa.latitude,
              longitude: tarefa.longitude
            },
            local_vistoria: tarefa.local_vistoria,
            observacoes: tarefa.observacoes,
            distancia_km,
            rota_id: tarefa.rota_id
          }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ✅ NOVA LÓGICA SIMPLIFICADA: Sem restrição de raio e janela
    // Prioridade é sempre o agendamento do dia
    // Se não houver agendamento próximo, buscar encaixe (vistoriador mais próximo disponível)
    console.log(`[atribuir-proxima-tarefa] Lógica simplificada: sem limite de raio e janela`);

    // 2. Buscar serviços disponíveis (sem atribuição) da tabela UNIFICADA servicos
    // hoje já foi declarado na linha 214
    const amanha = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    // BUSCA 1: Serviços NORMAIS (hoje/amanhã)
    const { data: servicosNormais, error: servicosNormaisError } = await supabase
      .from('servicos')
      .select(`
        id,
        tipo,
        data_agendada,
        hora_agendada,
        periodo,
        latitude,
        longitude,
        permite_encaixe,
        confirmacao_whatsapp,
        status,
        logradouro,
        numero,
        bairro,
        cidade,
        uf,
        associado_id,
        veiculo_id,
        local_vistoria,
        associado:associados!servicos_associado_id_fkey(nome, telefone, whatsapp),
        veiculo:veiculos!servicos_veiculo_id_fkey(placa, marca, modelo, cor)
      `)
      .is('profissional_id', null)
      .in('status', ['pendente', 'agendada'])
      .or('local_vistoria.is.null,local_vistoria.eq.cliente')
      .gte('data_agendada', hoje)
      .lte('data_agendada', amanha)
      .order('data_agendada', { ascending: true })
      // FILTRO DE CONFIRMAÇÃO: Só atribuir serviços confirmados ou sem fluxo de confirmação
        .or('confirmacao_whatsapp.is.null,confirmacao_whatsapp.eq.confirmada');

    if (servicosNormaisError) {
      console.error('[atribuir-proxima-tarefa] Erro ao buscar serviços normais:', servicosNormaisError);
      throw servicosNormaisError;
    }

    // BUSCA 2: Serviços FUTUROS com ENCAIXE habilitado
    // ✅ NOVA LÓGICA: Sempre busca encaixes (sem verificar janela de horas)
    let servicosEncaixe: any[] = [];
    
    const { data: encaixes, error: servicosEncaixeError } = await supabase
      .from('servicos')
      .select(`
        id,
        tipo,
        data_agendada,
        hora_agendada,
        periodo,
        latitude,
        longitude,
        permite_encaixe,
        status,
        logradouro,
        numero,
        bairro,
        cidade,
        uf,
        associado_id,
        veiculo_id,
        local_vistoria,
        associado:associados!servicos_associado_id_fkey(nome, telefone, whatsapp),
        veiculo:veiculos!servicos_veiculo_id_fkey(placa, marca, modelo, cor)
      `)
      .is('profissional_id', null)
      .in('status', ['pendente', 'agendada'])
      .or('local_vistoria.is.null,local_vistoria.eq.cliente')
      .gt('data_agendada', amanha)     // DATAS FUTURAS (> amanhã)
      .eq('permite_encaixe', true)      // APENAS os que aceitam encaixe
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      // FILTRO DE CONFIRMAÇÃO: Encaixes também precisam de confirmação se entraram no fluxo
      .or('confirmacao_whatsapp.is.null,confirmacao_whatsapp.eq.confirmada');

    if (servicosEncaixeError) {
      console.error('[atribuir-proxima-tarefa] Erro ao buscar serviços encaixe:', servicosEncaixeError);
    } else {
      servicosEncaixe = encaixes || [];
    }

    // Combinar as duas listas
    const todosServicos = [
      ...(servicosNormais || []),
      ...servicosEncaixe
    ];

    console.log(`[atribuir-proxima-tarefa] Serviços encontrados: ${(servicosNormais || []).length} normais + ${servicosEncaixe.length} encaixes futuros`);

    // 3. Mapear para formato comum
    const servicosDisponiveis: ServicoDisponivel[] = todosServicos.map((s: any) => ({
      id: s.id,
      tipo: s.tipo,
      data_agendada: s.data_agendada,
      hora_agendada: s.hora_agendada,
      latitude: s.latitude,
      longitude: s.longitude,
      permite_encaixe: s.permite_encaixe || false,
      periodo: s.periodo || null,
      status: s.status,
      associado_id: s.associado_id,
      associado_nome: s.associado?.nome || 'Cliente não vinculado',
      associado_telefone: s.associado?.telefone || '',
      associado_whatsapp: s.associado?.whatsapp || '',
      veiculo_id: s.veiculo_id,
      veiculo_placa: s.veiculo?.placa || 'Placa pendente',
      veiculo_marca: s.veiculo?.marca || '',
      veiculo_modelo: s.veiculo?.modelo || '',
      veiculo_cor: s.veiculo?.cor || '',
      logradouro: s.logradouro,
      numero: s.numero,
      bairro: s.bairro,
      cidade: s.cidade,
      uf: s.uf,
    }));

    console.log(`[atribuir-proxima-tarefa] ${servicosDisponiveis.length} serviços disponíveis no total`);

    // ========== GEOCODIFICAÇÃO ON-THE-FLY para serviços sem coordenadas ==========
    const servicosSemCoords = servicosDisponiveis.filter(s => !s.latitude || !s.longitude);
    if (servicosSemCoords.length > 0) {
      console.log(`[atribuir-proxima-tarefa] 📍 ${servicosSemCoords.length} serviço(s) sem coordenadas - tentando geocodificar on-the-fly...`);
      
      for (const svc of servicosSemCoords) {
        try {
          const partes = [svc.logradouro, svc.numero, svc.bairro, svc.cidade, svc.uf, 'Brasil'].filter(Boolean);
          if (partes.length < 3) {
            console.log(`[atribuir-proxima-tarefa] Dados insuficientes para geocodificar serviço ${svc.id}`);
            continue;
          }
          const query = partes.join(', ');
          const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=br&limit=1`;
          
          const geoResp = await fetch(url, {
            headers: { 'User-Agent': 'PraticConnect/1.0', 'Accept-Language': 'pt-BR' }
          });
          
          let geocoded = false;
          if (geoResp.ok) {
            const geoData = await geoResp.json();
            if (geoData.length > 0) {
              const lat = parseFloat(geoData[0].lat);
              const lon = parseFloat(geoData[0].lon);
              svc.latitude = lat;
              svc.longitude = lon;
              geocoded = true;
              
              // Persistir coordenadas
              await supabase.from('servicos').update({ latitude: lat, longitude: lon }).eq('id', svc.id);
              
              // Buscar origem para persistir lá também
              const { data: svcOrigem } = await supabase
                .from('servicos')
                .select('instalacao_origem_id, vistoria_origem_id')
                .eq('id', svc.id)
                .single();
              
              if (svcOrigem?.instalacao_origem_id) {
                await supabase.from('instalacoes').update({ endereco_latitude: lat, endereco_longitude: lon }).eq('id', svcOrigem.instalacao_origem_id);
              }
              if (svcOrigem?.vistoria_origem_id) {
                await supabase.from('vistorias').update({ endereco_latitude: lat, endereco_longitude: lon }).eq('id', svcOrigem.vistoria_origem_id);
              }
              
              console.log(`[atribuir-proxima-tarefa] 📍 Geocodificado on-the-fly: ${svc.id} -> (${lat}, ${lon})`);
            }
          } else if (geoResp.status === 429) {
            console.warn(`[atribuir-proxima-tarefa] ⚠️ Rate limited (429) ao geocodificar ${svc.id}`);
          }
          
          // Fallback: bairro + cidade
          if (!geocoded && svc.bairro && svc.cidade) {
            const fbQuery = `${svc.bairro}, ${svc.cidade}, ${svc.uf || ''}, Brasil`;
            const fbUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fbQuery)}&countrycodes=br&limit=1`;
            const fbResp = await fetch(fbUrl, { headers: { 'User-Agent': 'PraticConnect/1.0' } });
            if (fbResp.ok) {
              const fbData = await fbResp.json();
              if (fbData.length > 0) {
                const lat = parseFloat(fbData[0].lat);
                const lon = parseFloat(fbData[0].lon);
                svc.latitude = lat;
                svc.longitude = lon;
                await supabase.from('servicos').update({ latitude: lat, longitude: lon }).eq('id', svc.id);
                
                const { data: svcOrigem } = await supabase
                  .from('servicos')
                  .select('instalacao_origem_id, vistoria_origem_id')
                  .eq('id', svc.id)
                  .single();
                if (svcOrigem?.instalacao_origem_id) {
                  await supabase.from('instalacoes').update({ endereco_latitude: lat, endereco_longitude: lon }).eq('id', svcOrigem.instalacao_origem_id);
                }
                
                console.log(`[atribuir-proxima-tarefa] 📍 Geocodificado (fallback bairro): ${svc.id} -> (${lat}, ${lon})`);
              }
            }
          }
          
          // Rate limit Nominatim
          await new Promise(r => setTimeout(r, 1100));
        } catch (geoErr) {
          console.error(`[atribuir-proxima-tarefa] Erro geocodificando ${svc.id}:`, geoErr);
        }
      }
    }

    // NOVO: Filtrar serviços que ainda não podem ser atribuídos (horário futuro)
    const agora = new Date();
    const servicosFiltradosPorHorario = servicosDisponiveis.filter(s => 
      podeSerAtribuido(s, agora, hoje)
    );
    
    const bloqueadosPorHorario = servicosDisponiveis.length - servicosFiltradosPorHorario.length;
    if (bloqueadosPorHorario > 0) {
      console.log(`[atribuir-proxima-tarefa] ${servicosFiltradosPorHorario.length} serviços após filtro de horário (${bloqueadosPorHorario} bloqueados por horário futuro)`);
    }

    if (servicosFiltradosPorHorario.length === 0) {
      // ========== DEBUG: Por que não encontrou serviços? ==========
      console.log(`[atribuir-proxima-tarefa] DEBUG: Nenhum serviço disponível. Investigando motivo...`);
      
      // Buscar TODOS os serviços para entender o estado atual
      const { data: todosServicosDebug } = await supabase
        .from('servicos')
        .select('id, tipo, status, profissional_id, data_agendada, latitude, longitude, permite_encaixe, local_vistoria')
        .in('status', ['pendente', 'agendada', 'em_rota', 'em_andamento'])
        .limit(20);
      
      if (todosServicosDebug && todosServicosDebug.length > 0) {
        const resumo = todosServicosDebug.map((s: any) => ({
          id: s.id?.slice(0, 8) + '...',
          tipo: s.tipo,
          status: s.status,
          tem_profissional: !!s.profissional_id,
          data: s.data_agendada,
          tem_coords: !!(s.latitude && s.longitude),
          permite_encaixe: s.permite_encaixe,
          local: s.local_vistoria
        }));
        console.log(`[atribuir-proxima-tarefa] DEBUG: Serviços no sistema:`, JSON.stringify(resumo));
        
        // Identificar motivos de exclusão
        const jaAtribuidos = todosServicosDebug.filter((s: any) => s.profissional_id).length;
        const semCoords = todosServicosDebug.filter((s: any) => !s.latitude || !s.longitude).length;
        const naBase = todosServicosDebug.filter((s: any) => s.local_vistoria === 'base').length;
        const datasFuturas = todosServicosDebug.filter((s: any) => s.data_agendada > amanha && !s.permite_encaixe).length;
        
        console.log(`[atribuir-proxima-tarefa] DEBUG: Motivos de exclusão:`);
        console.log(`  - Já atribuídos: ${jaAtribuidos}`);
        console.log(`  - Sem coordenadas: ${semCoords}`);
        console.log(`  - Na base (não campo): ${naBase}`);
        console.log(`  - Datas futuras sem encaixe: ${datasFuturas}`);
      } else {
        console.log(`[atribuir-proxima-tarefa] DEBUG: NENHUM serviço encontrado no sistema com status pendente/agendada`);
        
        // Verificar se existem instalações não sincronizadas
        const { data: instalacoesPendentes } = await supabase
          .from('instalacoes')
          .select('id, status, data_agendada, instalador_responsavel_id')
          .in('status', ['agendada'])
          .limit(5);
          
        if (instalacoesPendentes && instalacoesPendentes.length > 0) {
          console.log(`[atribuir-proxima-tarefa] ALERTA: ${instalacoesPendentes.length} instalações não sincronizadas com tabela servicos!`);
          console.log(`[atribuir-proxima-tarefa] Instalações:`, JSON.stringify(instalacoesPendentes.map((i: any) => ({
            id: i.id?.slice(0, 8) + '...',
            status: i.status,
            data: i.data_agendada,
            tem_instalador: !!i.instalador_responsavel_id
          }))));
        }
      }
      // ========== FIM DEBUG ==========

      // Marcar profissional como em serviço mesmo sem tarefas
      await supabase
        .from('vistoriadores_localizacao')
        .upsert({
          vistoriador_id: profissionalId,
          latitude,
          longitude,
          em_servico: true,
          updated_at: new Date().toISOString()
        }, { onConflict: 'vistoriador_id' });

      return new Response(
        JSON.stringify({
          resultado: 'sem_tarefas',
          mensagem: 'Você está ativo para receber serviços. Aguarde novas tarefas próximas de você.'
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Calcular distâncias e ordenar com nova lógica de prioridades
    const servicosComDistancia: ServicoComDistancia[] = servicosFiltradosPorHorario
      .filter(s => s.latitude && s.longitude)
      .map(s => {
        const distancia_km = calcularDistanciaKm(latitude, longitude, s.latitude!, s.longitude!);
        const is_hoje = s.data_agendada === hoje;
        const is_amanha_flag = s.data_agendada === amanha;
        const is_encaixe_futuro = s.data_agendada > amanha && s.permite_encaixe;
        
        return {
          ...s,
          distancia_km,
          is_hoje,
          is_amanha: is_amanha_flag,
          is_encaixe_futuro
        };
      })
      .sort((a, b) => a.distancia_km - b.distancia_km); // Ordenar por proximidade primeiro
    
    // ✅ LÓGICA CORRETA DE ENCAIXE:
    // Encaixe SÓ acontece se NÃO há mais serviços de HOJE disponíveis
    const servicosHoje = servicosComDistancia.filter(s => s.is_hoje);
    const temServicoHoje = servicosHoje.length > 0;
    
    let servicosParaAtribuir: typeof servicosComDistancia;
    
    if (temServicoHoje) {
      // Há serviços de HOJE - BLOQUEAR encaixes, só considerar serviços de hoje
      servicosParaAtribuir = servicosHoje.sort((a, b) => a.distancia_km - b.distancia_km);
      console.log(`[atribuir-proxima-tarefa] 📅 ${servicosHoje.length} serviços de HOJE disponíveis - encaixe BLOQUEADO`);
    } else {
      // NÃO há serviços de hoje - permitir encaixe do mais próximo
      servicosParaAtribuir = servicosComDistancia.sort((a, b) => a.distancia_km - b.distancia_km);
      console.log(`[atribuir-proxima-tarefa] ⚡ Nenhum serviço de HOJE - encaixe PERMITIDO`);
    }
    
    console.log(`[atribuir-proxima-tarefa] ${servicosParaAtribuir.length} serviços após filtragem`);

    if (servicosParaAtribuir.length === 0) {
      return new Response(
        JSON.stringify({
          resultado: 'sem_tarefas',
          mensagem: 'Nenhum serviço com coordenadas disponível.'
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Tentar atribuir o serviço mais próximo
    for (const servico of servicosParaAtribuir) {
      console.log(`[atribuir-proxima-tarefa] Tentando atribuir ${servico.tipo} ${servico.id} (${servico.distancia_km.toFixed(2)} km)`);

      // ========== ENCAIXE: CONFIRMAÇÃO VIA WHATSAPP ANTES DE ATRIBUIR ==========
      if (servico.permite_encaixe && !servico.confirmacao_whatsapp) {
        console.log(`[atribuir-proxima-tarefa] ⏳ Encaixe ${servico.id} precisa de confirmação do associado`);
        
        try {
          const telefoneEncaixe = servico.associado_whatsapp || servico.associado_telefone || '';
          const nomeEncaixe = servico.associado_nome || 'Cliente';
          
          if (telefoneEncaixe && servico.associado_id) {
            const telefoneFormatado = telefoneEncaixe.replace(/\D/g, '');
            const tipoServicoEncaixe = servico.tipo === 'instalacao' ? 'instalação do rastreador' : 'vistoria veicular';
            
            const mensagemEncaixe = `Olá, *${nomeEncaixe.split(' ')[0]}*! 👋

Aqui é a *PRATIC Proteção Veicular*.

Temos um profissional disponível *próximo de você agora*! 🚗

Podemos antecipar sua *${tipoServicoEncaixe}* para *HOJE*?

✅ Responda *SIM* para confirmar o encaixe
❌ Ou *NÃO* para manter a data original

Aguardamos sua confirmação! ⚡`;

            await supabase.functions.invoke('whatsapp-send-text', {
              body: {
                telefone: telefoneFormatado,
                mensagem: mensagemEncaixe,
                template_name: 'confirmacao_agendamento_v1',
                template_params: [
                  nomeEncaixe.split(' ')[0],
                  tipoServicoEncaixe,
                  'Encaixe HOJE - profissional disponível na região',
                ],
              }
            });

            // Marcar como aguardando confirmação
            await supabase
              .from('servicos')
              .update({ confirmacao_whatsapp: 'aguardando_confirmacao_encaixe' })
              .eq('id', servico.id);

            // Criar registro para o webhook tratar a resposta
            await supabase.from('confirmacoes_agendamento').insert({
              servico_id: servico.id,
              telefone: telefoneFormatado,
              status: 'enviada',
              mensagem_enviada_em: new Date().toISOString(),
              contexto_ia: {
                nome_cliente: nomeEncaixe,
                tipo_servico: servico.tipo,
                tipo_confirmacao: 'encaixe',
                profissional_id: profissionalId,
              }
            });

            console.log(`[atribuir-proxima-tarefa] ✓ Confirmação de encaixe enviada para ${telefoneFormatado}`);
          }
        } catch (encaixeErr) {
          console.error(`[atribuir-proxima-tarefa] Erro confirmação encaixe:`, encaixeErr);
        }
        
        continue; // NÃO atribuir - aguardar confirmação
      }
      // ========== FIM ENCAIXE CONFIRMAÇÃO ==========
      
      const agora = new Date().toISOString();
      
      // Preparar dados de atualização
      const updateData: Record<string, any> = {
        profissional_id: profissionalId,
        status: 'agendada',
        updated_at: agora
      };

      // Se for ENCAIXE FUTURO, puxar para HOJE e marcar como encaixe executado
      if (servico.is_encaixe_futuro) {
        updateData.data_agendada_original = servico.data_agendada;
        updateData.data_agendada = hoje;
        updateData.encaixe_executado = true;
        console.log(`[atribuir-proxima-tarefa] ⚡ ENCAIXE EXECUTADO: Serviço ${servico.id} antecipado de ${servico.data_agendada} para ${hoje}`);
      }

      // Atualizar na tabela SERVICOS
      const { data: atualizado, error: updateError } = await supabase
        .from('servicos')
        .update(updateData)
        .eq('id', servico.id)
        .is('profissional_id', null) // Só atualiza se ainda não tiver responsável
        .select('*, instalacao_origem_id, vistoria_origem_id')
        .single();

      if (updateError) {
        // ✅ CORRIGIDO: Logar erro REAL do banco em vez de assumir concorrência
        console.error(`[atribuir-proxima-tarefa] ERRO ao atribuir serviço ${servico.id}:`, JSON.stringify({
          message: updateError.message,
          code: updateError.code,
          details: updateError.details,
          hint: updateError.hint
        }));
        
        // Identificar se é erro de concorrência ou erro técnico
        if (updateError.code === 'PGRST116' || updateError.message?.includes('0 rows')) {
          console.log(`[atribuir-proxima-tarefa] Serviço ${servico.id} já foi atribuído a outro profissional (concorrência)`);
        } else {
          console.error(`[atribuir-proxima-tarefa] ❌ ERRO TÉCNICO na atribuição: ${updateError.message}`);
        }
        continue;
      }

      if (atualizado) {
        console.log(`[atribuir-proxima-tarefa] ✓ Serviço ${servico.id} atribuído ao profissional ${profissionalId}`);
        
        // 6. SINCRONIZAR COM TABELA DE ORIGEM (instalacoes ou vistorias)
        if (atualizado.instalacao_origem_id) {
          console.log(`[atribuir-proxima-tarefa] Sincronizando com instalacoes ${atualizado.instalacao_origem_id}`);
          
          // Buscar dados do cliente/veículo da instalação de origem
          const { data: instalacaoOrigem } = await supabase
            .from('instalacoes')
            .select('associado_id, veiculo_id')
            .eq('id', atualizado.instalacao_origem_id)
            .single();
          
          // Atualizar status na instalação de origem
          const instalacaoUpdate: Record<string, any> = {
            instalador_responsavel_id: profissionalId,
            status: 'agendada'
          };
          
          // Se for encaixe, sincronizar data também na tabela de origem
          if (servico.is_encaixe_futuro) {
            instalacaoUpdate.data_agendada_original = servico.data_agendada;
            instalacaoUpdate.data_agendada = hoje;
            instalacaoUpdate.encaixe_executado = true;
          }
          
          await supabase
            .from('instalacoes')
            .update(instalacaoUpdate)
            .eq('id', atualizado.instalacao_origem_id);
          
          // Copiar associado_id e veiculo_id para o servico se não tiver
          if (instalacaoOrigem && (!servico.associado_id || !servico.veiculo_id)) {
            const updateData: any = {};
            if (!servico.associado_id && instalacaoOrigem.associado_id) {
              updateData.associado_id = instalacaoOrigem.associado_id;
            }
            if (!servico.veiculo_id && instalacaoOrigem.veiculo_id) {
              updateData.veiculo_id = instalacaoOrigem.veiculo_id;
            }
            if (Object.keys(updateData).length > 0) {
              console.log(`[atribuir-proxima-tarefa] Copiando dados cliente/veículo da instalação de origem`);
              await supabase
                .from('servicos')
                .update(updateData)
                .eq('id', servico.id);
            }
          }
        }
        
        if (atualizado.vistoria_origem_id) {
          console.log(`[atribuir-proxima-tarefa] Sincronizando com vistorias ${atualizado.vistoria_origem_id}`);
          
          const vistoriaUpdate: Record<string, any> = {
            vistoriador_id: profissionalId,
            status: 'agendada'
          };
          
          // Se for encaixe, sincronizar data também na tabela de origem
          if (servico.is_encaixe_futuro) {
            vistoriaUpdate.data_agendada_original = servico.data_agendada;
            vistoriaUpdate.data_agendada = hoje;
            vistoriaUpdate.encaixe_executado = true;
          }
          
          await supabase
            .from('vistorias')
            .update(vistoriaUpdate)
            .eq('id', atualizado.vistoria_origem_id);
        }
        
        // 7. Criar ou atualizar rota do dia
        const { data: rotaExistente } = await supabase
          .from('rotas')
          .select('id')
          .eq('instalador_id', profissionalId)
          .eq('data', hoje)
          .maybeSingle();

        let rotaId = rotaExistente?.id;

        if (!rotaId) {
          const { data: novaRota, error: rotaError } = await supabase
            .from('rotas')
            .insert({
              instalador_id: profissionalId,
              data: hoje,
              status: 'em_andamento',
              tipo: 'automatica'
            })
            .select('id')
            .single();

          if (rotaError) {
            console.error('[atribuir-proxima-tarefa] Erro ao criar rota:', rotaError);
          } else {
            rotaId = novaRota.id;
          }
        }

        // Vincular serviço à rota
        if (rotaId) {
          await supabase
            .from('servicos')
            .update({ rota_id: rotaId })
            .eq('id', servico.id);
            
          // Também vincular instalacao/vistoria de origem à rota
          if (atualizado.instalacao_origem_id) {
            await supabase
              .from('instalacoes')
              .update({ rota_id: rotaId })
              .eq('id', atualizado.instalacao_origem_id);
          }
        }

        // Salvar localização atual do profissional
        await supabase
          .from('vistoriadores_localizacao')
          .upsert({
            vistoriador_id: profissionalId,
            latitude,
            longitude,
            em_servico: true,
            updated_at: new Date().toISOString()
          }, { onConflict: 'vistoriador_id' });

        // 8. Enviar notificação push para o profissional
        try {
          const tipoLabel = servico.tipo === 'instalacao' ? 'Instalação' : 'Vistoria';
          const localLabel = servico.bairro || servico.cidade || 'Local não informado';
          const clienteLabel = servico.associado_nome || 'Cliente';
          
          await supabase.functions.invoke('send-push-profissional', {
            body: {
              profissional_id: profissionalId,
              notification: {
                title: `Nova Tarefa: ${tipoLabel}`,
                body: `${clienteLabel} - ${localLabel}`,
                tag: `tarefa-${servico.id}`,
                data: {
                  url: '/instalador',
                  tarefa_id: servico.id,
                  tipo: servico.tipo
                }
              }
            }
          });
          console.log(`[atribuir-proxima-tarefa] ✓ Push notification enviada para profissional ${profissionalId}`);
        } catch (pushError) {
          console.error('[atribuir-proxima-tarefa] Erro ao enviar push notification:', pushError);
          // Não bloqueia o fluxo principal
        }

        // 9. Notificação "técnico a caminho" removida daqui — agora é enviada apenas
        // quando o instalador clica "Iniciar Rota" (via notificar-inicio-rota)

        // 10. NOTIFICAR VISTORIADOR via WhatsApp com dados do cliente
        try {
          // Buscar telefone do profissional
          const { data: profissionalTel } = await supabase
            .from('profiles')
            .select('nome, whatsapp, telefone')
            .eq('id', profissionalId)
            .single();
          
          const telefoneProfissional = profissionalTel?.whatsapp || profissionalTel?.telefone;
          
          if (telefoneProfissional) {
            // ✅ GUARD: Não enviar WhatsApp ao profissional se telefone = telefone do cliente
            // Evita confusão quando profissional e associado compartilham número (teste ou representante)
            const telProfNorm = telefoneProfissional.replace(/\D/g, '');
            const telClienteRaw = servico.associado_whatsapp || servico.associado_telefone || '';
            const telClienteNorm = telClienteRaw.replace(/\D/g, '');
            
            // Comparar últimos 10-11 dígitos (ignora código de país)
            const telProfSuffix = telProfNorm.slice(-11);
            const telClienteSuffix = telClienteNorm.slice(-11);
            
            if (telProfSuffix && telClienteSuffix && telProfSuffix === telClienteSuffix) {
              console.log(`[atribuir-proxima-tarefa] ⚠️ Telefone do profissional = telefone do cliente (${telProfSuffix}). WhatsApp do vistoriador SUPRIMIDO para evitar confusão. Push já foi enviado.`);
            } else {
              const tipoServicoLabelWhats = servico.tipo === 'instalacao' 
                ? 'INSTALAÇÃO' 
                : 'VISTORIA';
              
              const telefoneCliente = servico.associado_whatsapp || servico.associado_telefone;
              const linkWhatsAppCliente = telefoneCliente 
                ? `https://wa.me/55${telefoneCliente.replace(/\D/g, '')}` 
                : 'Não informado';
              
              const enderecoVist = [
                servico.logradouro,
                servico.numero,
                servico.bairro,
                servico.cidade
              ].filter(Boolean).join(', ') || 'Endereço cadastrado';
              
              const periodoLabelVist = servico.periodo === 'manha' 
                ? 'Manhã (08:00-12:00)' 
                : servico.periodo === 'tarde'
                  ? 'Tarde (14:00-18:00)'
                  : 'A definir';

              const mensagemVistoriador = `📋 *NOVA TAREFA ATRIBUÍDA*

🔧 *Tipo:* ${tipoServicoLabelWhats}
📍 *Endereço:* ${enderecoVist}
⏰ *Período:* ${periodoLabelVist}

👤 *DADOS DO CLIENTE:*
• Nome: ${servico.associado_nome || 'Não informado'}
• Telefone: ${telefoneCliente || 'Não informado'}

🚗 *VEÍCULO:*
• Placa: ${servico.veiculo_placa || 'Não informada'}
• ${servico.veiculo_marca || ''} ${servico.veiculo_modelo || ''}

📱 *Link direto para WhatsApp do cliente:*
${linkWhatsAppCliente}

⚠️ Entre em contato para confirmar sua chegada!`;

              // ✅ CORRIGIDO: Usar texto livre (allow_text) em vez de template de CLIENTE
              // Template assistencia_confirmada é de cliente e gerava nomes invertidos
              await supabase.functions.invoke('whatsapp-send-text', {
                body: {
                  telefone: telProfNorm,
                  mensagem: mensagemVistoriador,
                  template_name: 'sinistro_atualizado',
                  template_params: [
                    profissionalTel?.nome?.split(' ')[0] || 'Vistoriador',
                    tipoServicoLabelWhats,
                    `${servico.associado_nome || 'Cliente'} - ${servico.veiculo_placa || ''}`,
                  ],
                },
              });
              
              console.log(`[atribuir-proxima-tarefa] ✓ Vistoriador ${profissionalId} notificado via WhatsApp (texto livre)`);
            }
          } else {
            console.log(`[atribuir-proxima-tarefa] Profissional sem WhatsApp cadastrado`);
          }
        } catch (vistWhatsError) {
          console.error('[atribuir-proxima-tarefa] Erro ao notificar vistoriador via WhatsApp:', vistWhatsError);
          // Não bloqueia o fluxo principal
        }

        return new Response(
          JSON.stringify({
            resultado: 'atribuida',
            tarefa: {
              id: servico.id,
              tipo: servico.tipo,
              status: 'em_rota',
              data_agendada: servico.data_agendada,
              hora_agendada: servico.hora_agendada,
              cliente: {
                id: servico.associado_id,
                nome: servico.associado_nome,
                telefone: servico.associado_telefone
              },
              veiculo: {
                id: servico.veiculo_id,
                placa: servico.veiculo_placa,
                marca: servico.veiculo_marca,
                modelo: servico.veiculo_modelo
              },
              endereco: {
                logradouro: servico.logradouro,
                numero: servico.numero,
                bairro: servico.bairro,
                cidade: servico.cidade,
                uf: servico.uf,
                latitude: servico.latitude,
                longitude: servico.longitude
              },
              distancia_km: servico.distancia_km,
              rota_id: rotaId
            }
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Se chegou aqui, nenhum serviço disponível
    await supabase
      .from('vistoriadores_localizacao')
      .upsert({
        vistoriador_id: profissionalId,
        latitude,
        longitude,
        em_servico: true,
        updated_at: new Date().toISOString()
      }, { onConflict: 'vistoriador_id' });

    return new Response(
      JSON.stringify({
        resultado: 'sem_tarefas',
        mensagem: 'Você está ativo para receber serviços. Aguarde novas tarefas próximas de você.'
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[atribuir-proxima-tarefa] Erro:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno do servidor";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
