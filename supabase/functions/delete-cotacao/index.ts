import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Criar cliente com token do usuário para verificar autenticação
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Verificar usuário
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    
    if (userError || !user) {
      console.error('Erro ao verificar usuário:', userError)
      return new Response(
        JSON.stringify({ success: false, error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = user.id

    // Criar cliente admin para operações
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    // Verificar se é diretor
    const { data: roleData, error: roleError } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'diretor')
      .maybeSingle()

    if (roleError || !roleData) {
      console.error('Usuário não é diretor:', roleError)
      return new Response(
        JSON.stringify({ success: false, error: 'Apenas diretores podem excluir cotações com dependências' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Obter cotacaoId do body
    const { cotacaoId } = await req.json()
    if (!cotacaoId) {
      return new Response(
        JSON.stringify({ success: false, error: 'ID da cotação é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[delete-cotacao] Iniciando exclusão da cotação ${cotacaoId} por usuário ${userId}`)

    // Buscar dados da cotação para log
    const { data: cotacao, error: cotacaoError } = await adminClient
      .from('cotacoes')
      .select('numero, lead_id, vistoria_id')
      .eq('id', cotacaoId)
      .maybeSingle()

    // Se cotação não existe, retornar sucesso (idempotente - já foi excluída)
    if (cotacaoError) {
      console.error('Erro ao buscar cotação:', cotacaoError)
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao buscar cotação' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!cotacao) {
      console.log(`[delete-cotacao] Cotação ${cotacaoId} já foi excluída anteriormente`)
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Cotação já foi excluída anteriormente',
          alreadyDeleted: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Buscar contratos vinculados
    const { data: contratos } = await adminClient
      .from('contratos')
      .select('id, associado_id')
      .eq('cotacao_id', cotacaoId)

    const contratoIds = contratos?.map(c => c.id) || []
    const associadoIds = [...new Set(contratos?.map(c => c.associado_id).filter(Boolean) || [])]

    console.log(`[delete-cotacao] Encontrados ${contratoIds.length} contratos vinculados`)

    // ============================================
    // ORDEM DE EXCLUSÃO (respeitando FKs)
    // ============================================

    // 1. Excluir agendamentos_base (NO ACTION - bloqueia se não excluir)
    const { error: agendamentoError } = await adminClient
      .from('agendamentos_base')
      .delete()
      .eq('cotacao_id', cotacaoId)
    
    if (agendamentoError) {
      console.error('Erro ao excluir agendamentos_base:', agendamentoError)
    } else {
      console.log('[delete-cotacao] Agendamentos base excluídos')
    }

    // 2. Excluir servicos (SET NULL cotacao_id)
    const { error: servicosError } = await adminClient
      .from('servicos')
      .delete()
      .eq('cotacao_id', cotacaoId)
    
    if (servicosError) {
      console.error('Erro ao excluir servicos:', servicosError)
    } else {
      console.log('[delete-cotacao] Serviços excluídos')
    }

    // 3. Excluir instalacoes_pendentes_criacao vinculadas à cotação e contratos
    // CRÍTICO: Deve ser feito ANTES de excluir contratos (FK constraint)
    const { error: pendentesError } = await adminClient
      .from('instalacoes_pendentes_criacao')
      .delete()
      .eq('cotacao_id', cotacaoId)
    
    if (pendentesError) {
      console.error('Erro ao excluir instalacoes_pendentes_criacao por cotacao:', pendentesError)
    } else {
      console.log('[delete-cotacao] Instalações pendentes (por cotação) excluídas')
    }

    // 3b. Excluir instalacoes_pendentes_criacao por contrato_id
    if (contratoIds.length > 0) {
      const { error: pendentesContratoError } = await adminClient
        .from('instalacoes_pendentes_criacao')
        .delete()
        .in('contrato_id', contratoIds)
      
      if (pendentesContratoError) {
        console.error('Erro ao excluir instalacoes_pendentes_criacao por contrato:', pendentesContratoError)
      } else {
        console.log('[delete-cotacao] Instalações pendentes (por contrato) excluídas')
      }
    }

    // 4. Para cada contrato, excluir dependências
    for (const contratoId of contratoIds) {
      console.log(`[delete-cotacao] Processando contrato ${contratoId}`)

      // 4a. Excluir contratos_documentos
      await adminClient
        .from('contratos_documentos')
        .delete()
        .eq('contrato_id', contratoId)

      // 4b. Excluir contratos_historico
      await adminClient
        .from('contratos_historico')
        .delete()
        .eq('contrato_id', contratoId)

      // 4c. Excluir asaas_cobrancas
      await adminClient
        .from('asaas_cobrancas')
        .delete()
        .eq('contrato_id', contratoId)

      // 4d. Excluir instalacoes vinculadas ao contrato
      await adminClient
        .from('instalacoes')
        .delete()
        .eq('contrato_id', contratoId)

      // 4e. Excluir vistorias vinculadas ao contrato
      await adminClient
        .from('vistorias')
        .delete()
        .eq('contrato_id', contratoId)
    }

    // 4. Nullificar vistoria_id nos contratos antes de excluir vistorias
    if (contratoIds.length > 0) {
      await adminClient
        .from('contratos')
        .update({ vistoria_id: null })
        .in('id', contratoIds)
    }

    // 5. Nullificar contrato_gerado_id na cotação (FK que impede excluir contrato)
    await adminClient
      .from('cotacoes')
      .update({ contrato_gerado_id: null })
      .eq('id', cotacaoId)

    // 6. Nullificar vistoria_id na cotação
    await adminClient
      .from('cotacoes')
      .update({ vistoria_id: null })
      .eq('id', cotacaoId)

    // 6. Excluir vistorias vinculadas à cotação
    const { error: vistError } = await adminClient
      .from('vistorias')
      .delete()
      .eq('cotacao_id', cotacaoId)
    
    if (vistError) {
      console.error('Erro ao excluir vistorias:', vistError)
    }

    // 7. Excluir instalações vinculadas à cotação
    const { error: instError } = await adminClient
      .from('instalacoes')
      .delete()
      .eq('cotacao_id', cotacaoId)
    
    if (instError) {
      console.error('Erro ao excluir instalações:', instError)
    }

    // 8. Excluir contratos (após limpar dependências)
    if (contratoIds.length > 0) {
      const { error: contratoExcError } = await adminClient
        .from('contratos')
        .delete()
        .in('id', contratoIds)
      
      if (contratoExcError) {
        console.error('Erro ao excluir contratos:', contratoExcError)
        throw contratoExcError
      }
      console.log(`[delete-cotacao] ${contratoIds.length} contratos excluídos`)
    }

    // 9. Limpar referência no lead (SET NULL)
    if (cotacao.lead_id) {
      await adminClient
        .from('leads')
        .update({ cotacao_id: null })
        .eq('cotacao_id', cotacaoId)
    }

    // 10. Finalmente excluir a cotação (cotacoes_historico e cotacoes_vistoria_fotos têm CASCADE)
    const { error: deleteError } = await adminClient
      .from('cotacoes')
      .delete()
      .eq('id', cotacaoId)

    if (deleteError) {
      console.error('Erro ao excluir cotação:', deleteError)
      throw deleteError
    }

    console.log(`[delete-cotacao] Cotação ${cotacao.numero} excluída com sucesso`)

    // 11. Registrar log de auditoria
    const { data: profile } = await adminClient
      .from('profiles')
      .select('id, nome')
      .eq('user_id', userId)
      .single()

    await adminClient.from('logs_auditoria').insert({
      usuario_id: profile?.id || userId,
      usuario_nome: profile?.nome || 'Diretor',
      acao: 'excluir',
      modulo: 'cotacoes',
      descricao: `Cotação ${cotacao.numero} excluída com cascata (${contratoIds.length} contratos)`,
      registro_id: cotacaoId,
      dados_anteriores: { 
        cotacao_numero: cotacao.numero,
        contratos_excluidos: contratoIds.length,
        associados_afetados: associadoIds.length
      }
    })

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Cotação ${cotacao.numero} excluída com sucesso`,
        contratosExcluidos: contratoIds.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[delete-cotacao] Erro:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro interno ao excluir cotação'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
