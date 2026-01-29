import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ComandoRequest {
  rastreador_id: string;
  tipo_comando: 'bloquear' | 'desbloquear' | 'localizar_agora';
  motivo: string;
  origem?: 'monitoramento' | 'sinistro' | 'assistencia' | 'diretoria';
  origem_id?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Autenticar usuário
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Erro de autenticação:', authError);
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar perfil do usuário
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, nome, tipo')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile || profile.tipo !== 'funcionario') {
      console.error('Usuário não autorizado:', profileError);
      return new Response(
        JSON.stringify({ error: 'Acesso negado. Apenas funcionários podem enviar comandos.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: ComandoRequest = await req.json();
    const { rastreador_id, tipo_comando, motivo, origem = 'monitoramento', origem_id } = body;

    // Validar campos obrigatórios
    if (!rastreador_id || !tipo_comando || !motivo) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios: rastreador_id, tipo_comando, motivo' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['bloquear', 'desbloquear', 'localizar_agora'].includes(tipo_comando)) {
      return new Response(
        JSON.stringify({ error: 'Tipo de comando inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[COMANDO] ${tipo_comando} solicitado por ${profile.nome} para rastreador ${rastreador_id}`);

    // Buscar dados do rastreador
    const { data: rastreadorData, error: rastreadorError } = await supabase
      .from('rastreadores')
      .select(`
        id, codigo, plataforma, veiculo_id, status, bloqueado,
        veiculos(id, placa, associados(id, nome, telefone))
      `)
      .eq('id', rastreador_id)
      .maybeSingle();

    if (rastreadorError || !rastreadorData) {
      console.error('Rastreador não encontrado:', rastreadorError);
      return new Response(
        JSON.stringify({ error: 'Rastreador não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalizar dados do rastreador
    const veiculoData = rastreadorData.veiculos as unknown;
    const veiculoObj = veiculoData as { id: string; placa: string; associados: { id: string; nome: string; telefone: string }[] } | null;
    const rastreador = {
      ...rastreadorData,
      veiculos: veiculoObj,
    };

    // Verificar se rastreador está instalado
    if (rastreador.status !== 'instalado') {
      return new Response(
        JSON.stringify({ error: 'Rastreador não está instalado em um veículo' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar configuração da plataforma
    const { data: configPlataforma } = await supabase
      .from('rastreadores_config_plataformas')
      .select('suporta_bloqueio')
      .eq('plataforma', rastreador.plataforma)
      .single();

    const suportaBloqueio = configPlataforma?.suporta_bloqueio ?? false;
    const metodoEnvio = suportaBloqueio ? 'api' : 'manual';

    console.log(`[COMANDO] Plataforma: ${rastreador.plataforma}, Suporta bloqueio: ${suportaBloqueio}, Método: ${metodoEnvio}`);

    // Registrar comando ANTES de enviar (auditoria)
    const { data: comando, error: insertError } = await supabase
      .from('rastreadores_comandos')
      .insert({
        rastreador_id,
        veiculo_id: rastreador.veiculo_id,
        plataforma: rastreador.plataforma,
        tipo_comando,
        origem,
        origem_id,
        solicitado_por: profile.id,
        solicitado_por_nome: profile.nome,
        status: 'pendente',
        metodo_envio: metodoEnvio,
        motivo,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Erro ao registrar comando:', insertError);
      return new Response(
        JSON.stringify({ error: 'Erro ao registrar comando' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[COMANDO] Comando registrado com ID: ${comando.id}`);

    let statusFinal = 'pendente';
    let erroMensagem: string | null = null;
    let apiResponse: Record<string, unknown> | null = null;

    // Se a plataforma suporta bloqueio via API, tentar enviar
    if (suportaBloqueio) {
      try {
        // Aqui seria a integração real com a API da plataforma
        // Por enquanto, Softruck não suporta comandos via API pública
        // Quando suportar, adicionar a lógica aqui
        
        if (rastreador.plataforma === 'softruck') {
          // Softruck: API pública não suporta comandos
          // Marcar como manual para execução externa
          statusFinal = 'pendente';
          apiResponse = { 
            info: 'API Softruck não suporta comandos. Execute manualmente no painel.',
            plataforma: 'softruck'
          };
        } else if (rastreador.plataforma === 'rede_veiculos') {
          // Rede Veículos: verificar se há endpoint disponível
          statusFinal = 'pendente';
          apiResponse = { 
            info: 'Implementação pendente para Rede Veículos',
            plataforma: 'rede_veiculos'
          };
        }
      } catch (error) {
        console.error('Erro ao enviar comando via API:', error);
        statusFinal = 'erro';
        erroMensagem = error instanceof Error ? error.message : 'Erro desconhecido';
      }
    } else {
      // Plataforma não suporta bloqueio via API
      // Registrar para execução manual
      statusFinal = 'pendente';
      apiResponse = {
        info: `Plataforma ${rastreador.plataforma} não suporta comandos via API. Execute manualmente.`,
        instrucoes: tipo_comando === 'bloquear' 
          ? 'Acesse o painel da plataforma e envie o comando de bloqueio.'
          : 'Acesse o painel da plataforma e envie o comando de desbloqueio.'
      };
    }

    // Atualizar comando com resultado
    const { error: updateError } = await supabase
      .from('rastreadores_comandos')
      .update({
        status: statusFinal,
        api_response: apiResponse,
        erro_mensagem: erroMensagem,
        ...(statusFinal === 'confirmado' ? { confirmado_em: new Date().toISOString() } : {}),
      })
      .eq('id', comando.id);

    if (updateError) {
      console.error('Erro ao atualizar status do comando:', updateError);
    }

    // Criar alerta no sistema
    const { error: alertaError } = await supabase
      .from('rastreador_alertas')
      .insert({
        rastreador_id,
        tipo: tipo_comando === 'bloquear' ? 'comando_bloqueio' : 'comando_desbloqueio',
        severidade: tipo_comando === 'bloquear' ? 'alta' : 'media',
        titulo: tipo_comando === 'bloquear' 
          ? 'Comando de Bloqueio Solicitado'
          : 'Comando de Desbloqueio Solicitado',
        mensagem: `${profile.nome} solicitou ${tipo_comando} do veículo. Motivo: ${motivo}`,
        dados_extras: {
        comando_id: comando.id,
          tipo_comando,
          motivo,
          solicitante: profile.nome,
          placa: rastreador.veiculos?.placa || null,
          metodo_envio: metodoEnvio,
        },
      });

    if (alertaError) {
      console.error('Erro ao criar alerta:', alertaError);
    }

    // Registrar log
    const { error: logError } = await supabase
      .from('rastreadores_logs')
      .insert({
        rastreador_id,
        plataforma: rastreador.plataforma,
        operacao: `comando_${tipo_comando}`,
        request: { tipo_comando, motivo, origem },
        response: apiResponse,
        status: statusFinal === 'confirmado' ? 'sucesso' : (statusFinal === 'erro' ? 'erro' : 'sucesso'),
        erro_mensagem: erroMensagem,
      });

    if (logError) {
      console.error('Erro ao registrar log:', logError);
    }

    const response = {
      success: true,
      comando_id: comando.id,
      status: statusFinal,
      metodo_envio: metodoEnvio,
      mensagem: suportaBloqueio 
        ? (statusFinal === 'confirmado' ? 'Comando enviado com sucesso' : 'Comando registrado, aguardando processamento')
        : `Comando registrado. A plataforma ${rastreador.plataforma} não suporta comandos via API. Execute manualmente no painel da plataforma.`,
      requer_acao_manual: !suportaBloqueio || statusFinal === 'pendente',
      instrucoes: apiResponse,
    };

    console.log(`[COMANDO] Resposta:`, response);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro geral:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
