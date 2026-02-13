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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const formData = await req.formData()
    const token = formData.get('token') as string
    const documentoId = formData.get('documento_id') as string
    const arquivo = formData.get('arquivo') as File

    if (!token || !documentoId || !arquivo) {
      return new Response(
        JSON.stringify({ error: 'Token, documento_id e arquivo são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validar token
    const { data: sinistro, error: sinistroError } = await supabase
      .from('sinistros')
      .select('id, protocolo, upload_token_expires_at, associado_id')
      .eq('upload_token', token)
      .maybeSingle()

    if (sinistroError || !sinistro) {
      return new Response(
        JSON.stringify({ error: 'Token inválido ou sinistro não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verificar expiração
    if (sinistro.upload_token_expires_at && new Date(sinistro.upload_token_expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Este link expirou' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verificar que o documento pertence ao sinistro
    const { data: documento, error: docError } = await supabase
      .from('sinistro_documentos')
      .select('id, tipo, status')
      .eq('id', documentoId)
      .eq('sinistro_id', sinistro.id)
      .maybeSingle()

    if (docError || !documento) {
      return new Response(
        JSON.stringify({ error: 'Documento não encontrado para este sinistro' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (documento.status !== 'pendente') {
      return new Response(
        JSON.stringify({ error: 'Este documento já foi enviado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Upload para o bucket
    const ext = arquivo.name.split('.').pop() || 'jpg'
    const filePath = `${sinistro.id}/${documento.tipo}_${Date.now()}.${ext}`
    const arrayBuffer = await arquivo.arrayBuffer()

    const { error: uploadError } = await supabase.storage
      .from('sinistros')
      .upload(filePath, arrayBuffer, {
        contentType: arquivo.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Erro upload:', uploadError)
      return new Response(
        JSON.stringify({ error: 'Erro ao fazer upload do arquivo' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Gerar URL do arquivo
    const { data: urlData } = supabase.storage
      .from('sinistros')
      .getPublicUrl(filePath)

    // Atualizar documento como enviado
    const { error: updateError } = await supabase
      .from('sinistro_documentos')
      .update({
        arquivo_url: urlData.publicUrl,
        status: 'enviado',
      })
      .eq('id', documentoId)

    if (updateError) {
      console.error('Erro ao atualizar documento:', updateError)
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar documento' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verificar se todos os documentos pendentes foram enviados
    const { data: pendentes } = await supabase
      .from('sinistro_documentos')
      .select('id')
      .eq('sinistro_id', sinistro.id)
      .eq('status', 'pendente')

    const todosConcluidos = !pendentes || pendentes.length === 0

    if (todosConcluidos) {
      // Expirar o token e voltar status para em_analise
      await supabase
        .from('sinistros')
        .update({
          upload_token_expires_at: new Date().toISOString(),
          status: 'em_analise',
          updated_at: new Date().toISOString(),
        })
        .eq('id', sinistro.id)

      // Registrar no histórico
      await supabase
        .from('sinistro_historico')
        .insert({
          sinistro_id: sinistro.id,
          status_anterior: 'documentacao_pendente',
          status_novo: 'em_analise',
          observacao: 'Todos os documentos solicitados foram enviados pelo associado via link público.',
        })
    }

    return new Response(
      JSON.stringify({
        success: true,
        todosEnviados: todosConcluidos,
        message: todosConcluidos
          ? 'Todos os documentos foram enviados com sucesso!'
          : 'Documento enviado com sucesso.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Erro geral:', err)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
