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

    const { instalacao_id, prestador_id } = await req.json()

    if (!instalacao_id || !prestador_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'instalacao_id e prestador_id são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Buscar dados da instalação com associado
    const { data: instalacao, error: instErr } = await supabase
      .from('instalacoes')
      .select(`
        id, data_agendada, periodo, logradouro, numero, complemento, bairro, cidade, uf, cep,
        associados:associado_id(id, nome, telefone)
      `)
      .eq('id', instalacao_id)
      .single()

    if (instErr || !instalacao) {
      return new Response(
        JSON.stringify({ success: false, error: 'Instalação não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Buscar dados do prestador
    const { data: prestador, error: prestErr } = await supabase
      .from('prestadores_assistencia')
      .select('id, razao_social, nome_fantasia, whatsapp, telefone')
      .eq('id', prestador_id)
      .single()

    if (prestErr || !prestador) {
      return new Response(
        JSON.stringify({ success: false, error: 'Prestador não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Inserir link tokenizado
    const { data: link, error: linkErr } = await supabase
      .from('instalacao_prestador_links')
      .insert({
        instalacao_id,
        prestador_id,
      })
      .select('id, token')
      .single()

    if (linkErr) {
      console.error('Erro ao criar link:', linkErr)
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao gerar link' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const baseUrl = 'https://pratic-connect-21.lovable.app'
    const url = `${baseUrl}/prestador/instalacao/${link.token}`

    // Montar endereço
    const endereco = [
      instalacao.logradouro,
      instalacao.numero ? `nº ${instalacao.numero}` : null,
      instalacao.bairro,
      instalacao.cidade,
      instalacao.uf,
    ].filter(Boolean).join(', ')

    const nomePrestador = prestador.nome_fantasia || prestador.razao_social
    const nomeAssociado = (instalacao.associados as any)?.nome || 'Associado'
    const whatsappPrestador = prestador.whatsapp || prestador.telefone

    // Tentar enviar WhatsApp via Meta API
    if (whatsappPrestador) {
      const telefoneLimpo = whatsappPrestador.replace(/\D/g, '')
      const telefoneFormatado = telefoneLimpo.startsWith('55') ? telefoneLimpo : `55${telefoneLimpo}`

      // Montar mensagem para o template
      const dataAgendada = instalacao.data_agendada
        ? new Date(instalacao.data_agendada).toLocaleDateString('pt-BR')
        : 'A definir'

      try {
        await supabase.functions.invoke('whatsapp-send-text', {
          body: {
            telefone: telefoneFormatado,
            template_nome: 'prestador_nova_instalacao_v1',
            variaveis: {
              '1': nomePrestador,
              '2': nomeAssociado,
              '3': instalacao.cidade || 'município',
              '4': endereco,
              '5': dataAgendada,
              '6': url,
            },
            // Fallback message caso template não aprovado
            mensagem_fallback: `Olá ${nomePrestador}! Nova instalação em ${instalacao.cidade || 'município'}.\n\nAssociado: ${nomeAssociado}\nEndereço: ${endereco}\nData: ${dataAgendada}\n\nAcesse os detalhes e confirme pelo link:\n${url}`,
          },
        })
      } catch (whatsErr) {
        console.error('Erro ao enviar WhatsApp (não bloqueante):', whatsErr)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        token: link.token,
        url,
        prestador_nome: nomePrestador,
        whatsapp_enviado: !!whatsappPrestador,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Erro geral:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
