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
    const formData = await req.formData()
    const token = formData.get('token') as string
    const tipo = formData.get('tipo') as string
    const arquivo = formData.get('arquivo') as File

    if (!token || !tipo || !arquivo) {
      return new Response(JSON.stringify({ success: false, error: 'Token, tipo e arquivo são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Validar tamanho (10MB)
    if (arquivo.size > 10 * 1024 * 1024) {
      return new Response(JSON.stringify({ success: false, error: 'Arquivo muito grande (máx 10MB)' }), {
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
      .select('id, sinistro_id')
      .eq('token', token)
      .maybeSingle()

    if (terceiroError || !terceiro) {
      return new Response(JSON.stringify({ success: false, error: 'Token inválido' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Gerar nome único para o arquivo
    const ext = arquivo.name.split('.').pop() || 'bin'
    const timestamp = Date.now()
    const storagePath = `${terceiro.id}/${tipo}/${timestamp}.${ext}`

    // Upload para o bucket
    const arrayBuffer = await arquivo.arrayBuffer()
    const { error: uploadError } = await supabase.storage
      .from('sinistro-terceiros')
      .upload(storagePath, arrayBuffer, {
        contentType: arquivo.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Erro upload:', uploadError)
      return new Response(JSON.stringify({ success: false, error: 'Erro ao fazer upload' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Gerar URL pública
    const { data: urlData } = supabase.storage
      .from('sinistro-terceiros')
      .getPublicUrl(storagePath)

    // Criar registro do documento
    const { data: doc, error: docError } = await supabase
      .from('sinistro_terceiro_documentos')
      .insert({
        terceiro_id: terceiro.id,
        tipo,
        nome: arquivo.name,
        url: urlData.publicUrl,
        status: 'pendente',
      })
      .select()
      .single()

    if (docError) {
      console.error('Erro ao registrar documento:', docError)
      return new Response(JSON.stringify({ success: false, error: 'Erro ao registrar documento' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Atualizar status do terceiro se necessário
    await supabase
      .from('sinistro_terceiros')
      .update({ status: 'documentacao_pendente' })
      .eq('id', terceiro.id)
      .eq('status', 'cadastrado')

    return new Response(JSON.stringify({
      success: true,
      documento: {
        id: doc.id,
        tipo: doc.tipo,
        nome: doc.nome,
        url: doc.url,
        status: doc.status,
      },
    }), {
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
