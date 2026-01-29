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

    const { instancia_id, buscar_vinculacao = true } = await req.json().catch(() => ({}))

    console.log('[whatsapp-find-chats] Buscando conversas...')

    const apiKey = Deno.env.get('EVOLUTION_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'EVOLUTION_API_KEY não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Buscar instância (específica ou principal)
    const { data: instancia, error: instError } = await supabase
      .from('whatsapp_instancias')
      .select('*')
      .eq(instancia_id ? 'id' : 'principal', instancia_id || true)
      .eq('ativa', true)
      .single()

    if (instError || !instancia) {
      return new Response(
        JSON.stringify({ success: false, error: 'Instância WhatsApp não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (instancia.status !== 'open') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'WhatsApp não está conectado',
          status: instancia.status 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Chamar Evolution API para listar conversas
    console.log(`[whatsapp-find-chats] Chamando Evolution API: ${instancia.api_url}/chat/findChats/${instancia.instance_name}`)

    const response = await fetch(
      `${instancia.api_url}/chat/findChats/${instancia.instance_name}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey,
        },
        body: JSON.stringify({}),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[whatsapp-find-chats] Erro Evolution API:', response.status, errorText)
      return new Response(
        JSON.stringify({ success: false, error: `Erro Evolution API: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const chatsData = await response.json()
    console.log(`[whatsapp-find-chats] Evolution retornou ${Array.isArray(chatsData) ? chatsData.length : 0} conversas`)

    // Processar e enriquecer conversas
    const conversas: any[] = []
    
    if (Array.isArray(chatsData)) {
      for (const chat of chatsData) {
        // Extrair telefone do remoteJid
        const remoteJid = chat.id || chat.remoteJid
        if (!remoteJid || remoteJid.includes('@g.us')) continue // Ignorar grupos
        
        const telefone = remoteJid.replace('@s.whatsapp.net', '').replace('@lid', '')
        const telefoneNormalizado = telefone.startsWith('55') ? telefone : `55${telefone}`
        
        const conversa: any = {
          id: remoteJid,
          telefone: telefoneNormalizado,
          nome: chat.name || chat.pushName || telefoneNormalizado,
          ultima_mensagem: chat.lastMessage?.conversation || 
                          chat.lastMessage?.extendedTextMessage?.text ||
                          '[Mídia]',
          data_ultima_mensagem: chat.lastMessageTimestamp 
            ? new Date(chat.lastMessageTimestamp * 1000).toISOString()
            : null,
          nao_lida: chat.unreadCount || 0,
          vinculacao: null,
        }

        // Buscar vinculação com leads/associados
        if (buscar_vinculacao) {
          // Buscar associado pelo telefone
          const { data: associado } = await supabase
            .from('associados')
            .select('id, nome, status')
            .or(`telefone.ilike.%${telefone.slice(-9)},whatsapp.ilike.%${telefone.slice(-9)}`)
            .limit(1)
            .maybeSingle()

          if (associado) {
            conversa.vinculacao = {
              tipo: 'associado',
              id: associado.id,
              nome: associado.nome,
              status: associado.status,
            }
          } else {
            // Buscar lead pelo telefone
            const { data: lead } = await supabase
              .from('leads')
              .select('id, nome, etapa')
              .ilike('telefone', `%${telefone.slice(-9)}`)
              .limit(1)
              .maybeSingle()

            if (lead) {
              conversa.vinculacao = {
                tipo: 'lead',
                id: lead.id,
                nome: lead.nome,
                etapa: lead.etapa,
              }
            }
          }
        }

        conversas.push(conversa)
      }
    }

    // Ordenar por data da última mensagem (mais recentes primeiro)
    conversas.sort((a, b) => {
      if (!a.data_ultima_mensagem) return 1
      if (!b.data_ultima_mensagem) return -1
      return new Date(b.data_ultima_mensagem).getTime() - new Date(a.data_ultima_mensagem).getTime()
    })

    // Estatísticas
    const stats = {
      total: conversas.length,
      vinculados: conversas.filter(c => c.vinculacao).length,
      nao_vinculados: conversas.filter(c => !c.vinculacao).length,
      com_mensagens_nao_lidas: conversas.filter(c => c.nao_lida > 0).length,
    }

    // Registrar log
    await supabase
      .from('whatsapp_logs')
      .insert({
        instancia_id: instancia.id,
        tipo: 'find_chats',
        evento: 'listar_conversas',
        resposta: stats,
      })

    return new Response(
      JSON.stringify({
        success: true,
        conversas,
        stats,
        instancia: {
          id: instancia.id,
          nome: instancia.nome,
          status: instancia.status,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[whatsapp-find-chats] Erro:', error)
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
