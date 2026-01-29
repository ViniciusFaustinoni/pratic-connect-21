import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validar autenticação
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: claims, error: authError } = await supabaseAuth.auth.getUser(token)
    if (authError || !claims?.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { telefone, limit = 100, sincronizar = false, instancia_id } = await req.json()

    if (!telefone) {
      return new Response(
        JSON.stringify({ success: false, error: 'Telefone é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[whatsapp-find-messages] Buscando mensagens para telefone: ${telefone}`)

    // Normalizar telefone - garantir formato correto
    const telefoneLimpo = telefone.replace(/\D/g, '')
    const telefoneComDDI = telefoneLimpo.startsWith('55') ? telefoneLimpo : `55${telefoneLimpo}`

    // 1. Primeiro buscar mensagens locais do banco
    const { data: mensagensLocais, error: dbError } = await supabase
      .from('whatsapp_mensagens')
      .select('*')
      .or(`telefone.eq.${telefoneComDDI},telefone.eq.${telefoneLimpo}`)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (dbError) {
      console.error('[whatsapp-find-messages] Erro ao buscar mensagens locais:', dbError)
    }

    // 2. Se sincronizar = true, buscar da Evolution API
    let mensagensEvolution: any[] = []
    let evolutionError: string | null = null
    
    if (sincronizar) {
      const apiKey = Deno.env.get('EVOLUTION_API_KEY')
      if (!apiKey) {
        console.warn('[whatsapp-find-messages] EVOLUTION_API_KEY não configurada')
        evolutionError = 'EVOLUTION_API_KEY não configurada'
      } else {
        // Buscar instância (específica ou principal)
        const { data: instancia, error: instError } = await supabase
          .from('whatsapp_instancias')
          .select('*')
          .eq(instancia_id ? 'id' : 'principal', instancia_id || true)
          .eq('ativa', true)
          .single()

        if (instError || !instancia) {
          console.error('[whatsapp-find-messages] Instância não encontrada:', instError)
          evolutionError = 'Instância WhatsApp não encontrada'
        } else if (instancia.status !== 'open') {
          console.warn('[whatsapp-find-messages] Instância não está conectada:', instancia.status)
          evolutionError = 'WhatsApp não está conectado'
        } else {
          // Formatar JID do WhatsApp
          const jid = `${telefoneComDDI}@s.whatsapp.net`
          console.log(`[whatsapp-find-messages] Buscando na Evolution API - JID: ${jid}`)

          try {
            const response = await fetch(
              `${instancia.api_url}/chat/findMessages/${instancia.instance_name}`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': apiKey,
                },
                body: JSON.stringify({
                  where: {
                    key: { remoteJid: jid },
                  },
                }),
              }
            )

            if (response.ok) {
              const evolutionData = await response.json()
              console.log(`[whatsapp-find-messages] Evolution retornou ${Array.isArray(evolutionData) ? evolutionData.length : 0} mensagens`)
              
              if (Array.isArray(evolutionData)) {
                mensagensEvolution = evolutionData

                // Sincronizar mensagens novas com o banco local
                let novasMensagens = 0
                for (const msg of evolutionData) {
                  // Verificar se mensagem já existe pelo message_id
                  const messageId = msg.key?.id
                  if (!messageId) continue

                  const { data: existe } = await supabase
                    .from('whatsapp_mensagens')
                    .select('id')
                    .eq('message_id', messageId)
                    .maybeSingle()

                  if (!existe) {
                    // Inserir nova mensagem
                    const direcao = msg.key?.fromMe ? 'saida' : 'entrada'
                    const tipoMensagem = msg.messageType || 'text'
                    const conteudo = msg.message?.conversation || 
                                     msg.message?.extendedTextMessage?.text ||
                                     msg.message?.imageMessage?.caption ||
                                     msg.message?.documentMessage?.caption ||
                                     '[Mídia]'

                    const { error: insertError } = await supabase
                      .from('whatsapp_mensagens')
                      .insert({
                        instancia_id: instancia.id,
                        telefone: telefoneComDDI,
                        nome_contato: msg.pushName || null,
                        tipo: tipoMensagem,
                        mensagem: conteudo,
                        direcao,
                        status: 'entregue',
                        message_id: messageId,
                        created_at: msg.messageTimestamp 
                          ? new Date(msg.messageTimestamp * 1000).toISOString()
                          : new Date().toISOString(),
                      })

                    if (!insertError) {
                      novasMensagens++
                    }
                  }
                }

                console.log(`[whatsapp-find-messages] ${novasMensagens} novas mensagens sincronizadas`)
              }
            } else {
              const errorText = await response.text()
              console.error('[whatsapp-find-messages] Erro Evolution API:', response.status, errorText)
              evolutionError = `Erro Evolution API: ${response.status}`
            }
          } catch (fetchError) {
            console.error('[whatsapp-find-messages] Erro ao chamar Evolution API:', fetchError)
            evolutionError = 'Erro ao conectar com Evolution API'
          }
        }
      }
    }

    // 3. Se sincronizou, buscar novamente as mensagens locais atualizadas
    let mensagensFinais = mensagensLocais || []
    if (sincronizar) {
      const { data: mensagensAtualizadas } = await supabase
        .from('whatsapp_mensagens')
        .select('*')
        .or(`telefone.eq.${telefoneComDDI},telefone.eq.${telefoneLimpo}`)
        .order('created_at', { ascending: true })
        .limit(limit)
      
      mensagensFinais = mensagensAtualizadas || []
    }

    // 4. Registrar log
    await supabase
      .from('whatsapp_logs')
      .insert({
        tipo: 'find_messages',
        evento: 'consulta_historico',
        payload: { 
          telefone: telefoneComDDI, 
          limit, 
          sincronizar,
          mensagens_locais: mensagensLocais?.length || 0,
          mensagens_evolution: mensagensEvolution.length,
        },
        resposta: { 
          total: mensagensFinais.length,
          evolution_error: evolutionError,
        },
      })

    return new Response(
      JSON.stringify({
        success: true,
        mensagens: mensagensFinais,
        total: mensagensFinais.length,
        sincronizado: sincronizar && !evolutionError,
        evolution_error: evolutionError,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[whatsapp-find-messages] Erro:', error)
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
