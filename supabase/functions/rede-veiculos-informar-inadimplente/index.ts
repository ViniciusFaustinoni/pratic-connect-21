import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  associadoId: string;
  veiculoId?: string;
  motivo: string; // 'vencimento', 'bloqueio_diretoria', 'cobranca_judicial'
  diasAtraso?: number;
  valorPendente?: number;
}

interface InformarInadimplenteResponse {
  codigo: number;
  msg: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json() as RequestBody;
    const { associadoId, veiculoId, motivo, diasAtraso, valorPendente } = body;

    console.log('[RedeVeiculos Inadimplente] Iniciando notificação:', { associadoId, veiculoId, motivo });

    if (!associadoId) {
      throw new Error('associadoId é obrigatório');
    }

    if (!motivo) {
      throw new Error('motivo é obrigatório');
    }

    // ===== 1. Buscar associado =====
    const { data: associado, error: associadoError } = await supabase
      .from('associados')
      .select('id, nome, cpf, status')
      .eq('id', associadoId)
      .single();

    if (associadoError || !associado) {
      throw new Error(`Associado não encontrado: ${associadoError?.message || 'ID inválido'}`);
    }

    console.log('[RedeVeiculos Inadimplente] Associado encontrado:', associado.nome);

    // ===== 2. Buscar veículos do associado com rastreador Rede Veículos =====
    let veiculosQuery = supabase
      .from('veiculos')
      .select(`
        id, 
        placa, 
        rede_veiculos_veiculo_id,
        rastreadores!inner (
          id,
          codigo,
          imei,
          plataforma,
          status
        )
      `)
      .eq('associado_id', associadoId)
      .eq('ativo', true)
      .eq('rastreadores.plataforma', 'rede_veiculos')
      .eq('rastreadores.status', 'instalado');

    if (veiculoId) {
      veiculosQuery = veiculosQuery.eq('id', veiculoId);
    }

    const { data: veiculos, error: veiculosError } = await veiculosQuery;

    if (veiculosError) {
      throw new Error(`Erro ao buscar veículos: ${veiculosError.message}`);
    }

    if (!veiculos || veiculos.length === 0) {
      console.log('[RedeVeiculos Inadimplente] Nenhum veículo com rastreador Rede Veículos encontrado');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhum veículo com rastreador Rede Veículos para notificar',
          veiculos_notificados: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`[RedeVeiculos Inadimplente] Encontrados ${veiculos.length} veículos para notificar`);

    // ===== 3. Buscar configuração da plataforma =====
    const { data: plataforma, error: plataformaError } = await supabase
      .from('rastreadores_config_plataformas')
      .select('*')
      .eq('plataforma', 'rede_veiculos')
      .single();

    if (plataformaError || !plataforma) {
      throw new Error('Configuração da plataforma Rede Veículos não encontrada');
    }

    // ===== 4. Obter token de autenticação =====
    const authResponse = await fetch(
      `${supabaseUrl}/functions/v1/rastreador-auth`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ plataforma_codigo: 'rede_veiculos' })
      }
    );

    const authData = await authResponse.json();
    if (!authData.success) {
      throw new Error('Falha na autenticação com Rede Veículos: ' + authData.error);
    }

    const token = authData.token;
    const baseUrl = plataforma.ambiente_atual === 'producao'
      ? plataforma.api_url_producao
      : plataforma.api_url_sandbox;

    console.log('[RedeVeiculos Inadimplente] Autenticado, ambiente:', plataforma.ambiente_atual);

    // ===== 5. Notificar inadimplência para cada veículo =====
    const resultados: Array<{ veiculoId: string; placa: string; success: boolean; error?: string }> = [];
    const cpfCnpj = (associado.cpf || '').replace(/\D/g, '');

    // Mapear motivo para texto legível
    const motivoTexto: Record<string, string> = {
      'vencimento': 'Cobrança vencida',
      'bloqueio_diretoria': 'Bloqueio por decisão administrativa',
      'cobranca_judicial': 'Cobrança judicial em andamento',
      'suspensao_automatica': 'Suspensão automática por inadimplência',
    };

    for (const veiculo of veiculos) {
      try {
        const payload = {
          cpfCnpj,
          placa: veiculo.placa,
          motivo: motivoTexto[motivo] || motivo,
          diasAtraso: diasAtraso || 0,
          valorPendente: valorPendente || 0,
          dataInadimplencia: new Date().toISOString().split('T')[0],
        };

        console.log(`[RedeVeiculos Inadimplente] Notificando veículo ${veiculo.placa}:`, payload);

        const formData = new URLSearchParams();
        formData.append('json', JSON.stringify(payload));

        const apiResponse = await fetch(`${baseUrl}/informarVeiculoInadimplente/`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData,
        });

        const responseText = await apiResponse.text();
        console.log(`[RedeVeiculos Inadimplente] Resposta para ${veiculo.placa}:`, responseText);

        let apiResult: InformarInadimplenteResponse;
        try {
          apiResult = JSON.parse(responseText);
        } catch {
          throw new Error(`Resposta inválida da API: ${responseText}`);
        }

        // Registrar log
        const rastreador = Array.isArray(veiculo.rastreadores) 
          ? veiculo.rastreadores[0] 
          : veiculo.rastreadores;

        await supabase.from('rastreadores_api_logs').insert({
          rastreador_id: rastreador?.id,
          plataforma: 'rede_veiculos',
          operacao: 'informarVeiculoInadimplente',
          request: payload,
          response: apiResult,
          status: apiResult.codigo === 1 ? 'sucesso' : 'erro',
          erro_mensagem: apiResult.codigo !== 1 ? apiResult.msg : null,
        });

        if (apiResult.codigo === 1) {
          resultados.push({ veiculoId: veiculo.id, placa: veiculo.placa, success: true });
        } else {
          resultados.push({ 
            veiculoId: veiculo.id, 
            placa: veiculo.placa, 
            success: false, 
            error: apiResult.msg 
          });
        }
      } catch (err) {
        console.error(`[RedeVeiculos Inadimplente] Erro ao notificar ${veiculo.placa}:`, err);
        resultados.push({ 
          veiculoId: veiculo.id, 
          placa: veiculo.placa, 
          success: false, 
          error: err instanceof Error ? err.message : 'Erro desconhecido' 
        });
      }
    }

    // ===== 6. Registrar no histórico do associado =====
    await supabase.from('associados_historico').insert({
      associado_id: associadoId,
      tipo: 'inadimplencia_notificada',
      descricao: `Inadimplência notificada na Rede Veículos para ${resultados.filter(r => r.success).length} veículo(s). Motivo: ${motivoTexto[motivo] || motivo}`,
      dados_novos: { 
        veiculos_notificados: resultados,
        motivo,
        diasAtraso,
        valorPendente,
      },
    });

    const sucessos = resultados.filter(r => r.success).length;
    console.log(`[RedeVeiculos Inadimplente] Processo concluído: ${sucessos}/${resultados.length} veículos notificados`);

    return new Response(
      JSON.stringify({
        success: true,
        veiculos_notificados: sucessos,
        veiculos_total: resultados.length,
        resultados,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('[RedeVeiculos Inadimplente] Erro:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
