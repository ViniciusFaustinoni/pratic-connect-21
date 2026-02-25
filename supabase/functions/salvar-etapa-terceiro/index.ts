import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { token, acao, dados } = await req.json()

    if (!token || !acao) {
      return new Response(JSON.stringify({ success: false, error: 'Token e ação são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Validar token
    const { data: terceiro, error: terceiroError } = await supabase
      .from('sinistro_terceiros')
      .select('*')
      .eq('token', token)
      .maybeSingle()

    if (terceiroError || !terceiro) {
      return new Response(JSON.stringify({ success: false, error: 'Token inválido' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Obter IP do request
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown'

    let updateData: Record<string, any> = {}
    let newStatus: string | null = null

    switch (acao) {
      case 'assinar_termo': {
        const { nome_assinatura } = dados || {}
        if (!nome_assinatura) {
          return new Response(JSON.stringify({ success: false, error: 'Nome de assinatura é obrigatório' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        updateData = {
          termo_assinado_em: new Date().toISOString(),
          termo_assinatura_ip: ip,
          termo_assinatura_nome: nome_assinatura,
          status: 'termo_assinado',
        }
        newStatus = 'termo_assinado'
        break
      }

      case 'escolher_oficina': {
        const { tipo, nome, endereco, telefone } = dados || {}
        if (!tipo || !['credenciada', 'propria'].includes(tipo)) {
          return new Response(JSON.stringify({ success: false, error: 'Tipo de oficina inválido' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        updateData = {
          oficina_tipo: tipo,
          oficina_nome: nome || null,
          oficina_endereco: endereco || null,
          oficina_telefone: telefone || null,
          status: 'oficina_definida',
        }
        newStatus = 'oficina_definida'
        break
      }

      case 'responder_acordo': {
        const { aceitar } = dados || {}
        if (typeof aceitar !== 'boolean') {
          return new Response(JSON.stringify({ success: false, error: 'Resposta do acordo é obrigatória' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        updateData = {
          acordo_status: aceitar ? 'aceito' : 'recusado',
          acordo_respondido_em: new Date().toISOString(),
          status: aceitar ? 'acordo_aceito' : 'acordo_recusado',
        }
        newStatus = aceitar ? 'acordo_aceito' : 'acordo_recusado'
        break
      }

      case 'confirmar_documentos': {
        updateData = {
          status: 'documentacao_enviada',
        }
        newStatus = 'documentacao_enviada'
        break
      }

      default:
        return new Response(JSON.stringify({ success: false, error: `Ação desconhecida: ${acao}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    // Atualizar terceiro
    const { error: updateError } = await supabase
      .from('sinistro_terceiros')
      .update(updateData)
      .eq('id', terceiro.id)

    if (updateError) {
      console.error('Erro ao atualizar terceiro:', updateError)
      return new Response(JSON.stringify({ success: false, error: 'Erro ao salvar' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true, status: newStatus }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Erro:', err)
    return new Response(JSON.stringify({ success: false, error: 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
