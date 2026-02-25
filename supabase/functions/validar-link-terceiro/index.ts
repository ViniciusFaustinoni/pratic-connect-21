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
    const { token } = await req.json()
    if (!token) {
      return new Response(JSON.stringify({ valid: false, reason: 'Token não informado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Buscar terceiro pelo token
    const { data: terceiro, error } = await supabase
      .from('sinistro_terceiros')
      .select('*')
      .eq('token', token)
      .maybeSingle()

    if (error || !terceiro) {
      return new Response(JSON.stringify({ valid: false, reason: 'Link inválido' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verificar sinistro vinculado
    const { data: sinistro } = await supabase
      .from('sinistros')
      .select('id, protocolo, status, data_ocorrencia')
      .eq('id', terceiro.sinistro_id)
      .maybeSingle()

    if (!sinistro) {
      return new Response(JSON.stringify({ valid: false, reason: 'Evento não encontrado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const statusFinais = ['finalizado', 'cancelado', 'negado', 'reprovado', 'arquivado']
    if (statusFinais.includes(sinistro.status)) {
      const reason = sinistro.status === 'cancelado' ? 'Este processo foi cancelado.' : 'Este processo já foi finalizado.'
      return new Response(JSON.stringify({ valid: false, reason }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Buscar documentos do terceiro
    const { data: documentos } = await supabase
      .from('sinistro_terceiro_documentos')
      .select('id, tipo, nome, url, status, motivo_rejeicao, created_at')
      .eq('terceiro_id', terceiro.id)
      .order('created_at', { ascending: true })

    // Determinar etapa atual
    let etapaAtual = 1 // Documentos
    if (terceiro.status === 'documentacao_enviada' || terceiro.status === 'termo_pendente') {
      etapaAtual = 2 // Termo
    } else if (terceiro.status === 'termo_assinado' || terceiro.status === 'oficina_pendente') {
      etapaAtual = 3 // Oficina
    } else if (terceiro.status === 'acordo_proposto') {
      etapaAtual = 4 // Acordo
    } else if (['oficina_definida', 'regulagem', 'orcamento', 'pecas', 'em_reparo'].includes(terceiro.status)) {
      etapaAtual = 5 // Acompanhamento
    } else if (terceiro.status === 'concluido') {
      etapaAtual = 6 // Entrega
    } else if (terceiro.status === 'acordo_aceito') {
      etapaAtual = 7 // Acordo aceito (encerrado)
    }

    return new Response(JSON.stringify({
      valid: true,
      terceiro: {
        id: terceiro.id,
        nome: terceiro.nome,
        cpf: terceiro.cpf,
        telefone: terceiro.telefone,
        veiculo_placa: terceiro.veiculo_placa,
        veiculo_marca: terceiro.veiculo_marca,
        veiculo_modelo: terceiro.veiculo_modelo,
        veiculo_ano: terceiro.veiculo_ano,
        veiculo_cor: terceiro.veiculo_cor,
        status: terceiro.status,
        culpa: terceiro.culpa,
        oficina_tipo: terceiro.oficina_tipo,
        oficina_nome: terceiro.oficina_nome,
        oficina_endereco: terceiro.oficina_endereco,
        oficina_telefone: terceiro.oficina_telefone,
        acordo_valor: terceiro.acordo_valor,
        acordo_justificativa: terceiro.acordo_justificativa,
        acordo_status: terceiro.acordo_status,
        termo_assinado_em: terceiro.termo_assinado_em,
        reparo_concluido_em: terceiro.reparo_concluido_em,
        entrega_em: terceiro.entrega_em,
      },
      sinistro: {
        protocolo: sinistro.protocolo,
        data_ocorrencia: sinistro.data_ocorrencia,
      },
      documentos: documentos || [],
      etapaAtual,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ valid: false, reason: 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
