import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessarReprovacaoRequest {
  tipo: 'vistoria_reprovada' | 'proposta_reprovada';
  veiculo_id?: string;
  contrato_id?: string;
  cotacao_id?: string;
  associado_id?: string;
  motivo: string;
  justificativa?: string;
  usuario_id?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: ProcessarReprovacaoRequest = await req.json();
    const { tipo, veiculo_id, contrato_id, cotacao_id, associado_id, motivo, justificativa, usuario_id } = body;

    console.log('=== PROCESSANDO REPROVAÇÃO ===');
    console.log('Tipo:', tipo);
    console.log('Veículo ID:', veiculo_id);
    console.log('Contrato ID:', contrato_id);
    console.log('Associado ID:', associado_id);

    // 1. Buscar dados do veículo para pegar a placa
    let placa = '';
    let chassi = '';
    let finalAssociadoId = associado_id;

    if (veiculo_id) {
      const { data: veiculo } = await supabase
        .from('veiculos')
        .select('placa, chassi, associado_id')
        .eq('id', veiculo_id)
        .single();

      if (veiculo) {
        placa = veiculo.placa || '';
        chassi = veiculo.chassi || '';
        if (!finalAssociadoId) {
          finalAssociadoId = veiculo.associado_id;
        }
      }
    }

    // 2. ADICIONAR NA BLACKLIST
    console.log('Adicionando na blacklist...');
    const { error: blacklistError } = await supabase
      .from('blacklist_veiculos')
      .insert({
        placa: placa.toUpperCase().replace(/[^A-Z0-9]/g, ''),
        chassi,
        motivo,
        justificativa,
        tipo_reprovacao: tipo,
        veiculo_id,
        associado_id: finalAssociadoId,
        contrato_id,
        cotacao_id,
        adicionado_por: usuario_id,
        ativo: true,
      });

    if (blacklistError) {
      console.error('Erro ao adicionar na blacklist:', blacklistError);
      // Não bloqueia o fluxo, apenas loga
    } else {
      console.log('✓ Veículo adicionado na blacklist');
    }

    // 3. CANCELAR DOCUMENTO NO AUTENTIQUE (se houver)
    let autentiqueResult = null;
    if (contrato_id) {
      const { data: contrato } = await supabase
        .from('contratos')
        .select('autentique_documento_id')
        .eq('id', contrato_id)
        .single();

      if (contrato?.autentique_documento_id) {
        console.log('Cancelando documento no Autentique...');
        try {
          const { data, error } = await supabase.functions.invoke('autentique-cancel', {
            body: {
              documentId: contrato.autentique_documento_id,
              contratoId: contrato_id,
            },
          });
          
          if (error) {
            console.error('Erro ao cancelar Autentique:', error);
          } else {
            autentiqueResult = data;
            console.log('✓ Documento cancelado no Autentique');
          }
        } catch (e) {
          console.error('Erro ao invocar autentique-cancel:', e);
        }
      }
    }

    // 4. ESTORNAR PAGAMENTO NO ASAAS (se houver)
    let asaasResult = null;
    if (finalAssociadoId || contrato_id) {
      // Buscar cobrança de adesão paga
      let cobrancaQuery = supabase
        .from('asaas_cobrancas')
        .select('id, asaas_id, status, forma_pagamento')
        .eq('tipo', 'adesao')
        .in('status', ['RECEIVED', 'CONFIRMED']);

      if (finalAssociadoId) {
        cobrancaQuery = cobrancaQuery.eq('associado_id', finalAssociadoId);
      } else if (contrato_id) {
        cobrancaQuery = cobrancaQuery.eq('contrato_id', contrato_id);
      }

      const { data: cobrancas } = await cobrancaQuery.limit(1);

      if (cobrancas && cobrancas.length > 0) {
        const cobranca = cobrancas[0];
        console.log('Estornando pagamento no ASAAS...', cobranca.asaas_id);

        try {
          // Buscar credenciais do ASAAS
          const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
          const ASAAS_ENV = Deno.env.get('ASAAS_ENV') || 'sandbox';
          const baseUrl = ASAAS_ENV === 'production' 
            ? 'https://api.asaas.com/v3'
            : 'https://sandbox.asaas.com/api/v3';

          if (ASAAS_API_KEY) {
            const refundResponse = await fetch(`${baseUrl}/payments/${cobranca.asaas_id}/refund`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'access_token': ASAAS_API_KEY,
              },
              body: JSON.stringify({
                description: `Estorno por reprovação: ${motivo}`,
              }),
            });

            const refundData = await refundResponse.json();

            if (refundResponse.ok) {
              console.log('✓ Pagamento estornado no ASAAS');
              asaasResult = refundData;

              // Atualizar status da cobrança no banco
              await supabase
                .from('asaas_cobrancas')
                .update({
                  status: 'REFUNDED',
                  motivo_cancelamento: `Reprovação: ${motivo}`,
                })
                .eq('id', cobranca.id);
            } else {
              console.error('Erro no estorno ASAAS:', refundData);
            }
          }
        } catch (e) {
          console.error('Erro ao estornar ASAAS:', e);
        }
      }
    }

    // 5. BLOQUEAR ASSOCIADO
    if (finalAssociadoId) {
      console.log('Bloqueando associado...');
      const { error: bloqueioError } = await supabase
        .from('associados')
        .update({
          status: 'bloqueado',
          bloqueado: true,
          motivo_bloqueio: 'VEICULO_REPROVADO',
          data_bloqueio: new Date().toISOString(),
        })
        .eq('id', finalAssociadoId);

      if (bloqueioError) {
        console.error('Erro ao bloquear associado:', bloqueioError);
      } else {
        console.log('✓ Associado bloqueado');
      }

      // Registrar no histórico
      await supabase.from('associados_historico').insert({
        associado_id: finalAssociadoId,
        tipo: 'status_alterado',
        descricao: `Associado bloqueado por reprovação: ${motivo}`,
        dados_novos: {
          status: 'bloqueado',
          motivo_bloqueio: 'VEICULO_REPROVADO',
          tipo_reprovacao: tipo,
        },
        usuario_id,
      });
    }

    // 6. ATUALIZAR STATUS DO CONTRATO
    if (contrato_id) {
      await supabase
        .from('contratos')
        .update({
          status: 'cancelado',
        })
        .eq('id', contrato_id);
      console.log('✓ Contrato cancelado');
    }

    // 7. ATUALIZAR STATUS DA COTAÇÃO
    if (cotacao_id) {
      await supabase
        .from('cotacoes')
        .update({
          status_contratacao: 'reprovada',
        })
        .eq('id', cotacao_id);
      console.log('✓ Cotação atualizada');
    }

    console.log('=== REPROVAÇÃO PROCESSADA COM SUCESSO ===');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Reprovação processada com sucesso',
        blacklist: !blacklistError,
        autentique: !!autentiqueResult,
        asaas: !!asaasResult,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Erro ao processar reprovação:', errorMessage);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
