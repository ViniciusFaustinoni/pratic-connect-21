import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const COLUNAS_ESPERADAS = [
  'MARCA', 'MODELO', 'ANO_MIN', 'ANO_MAX',
  'COMBUSTIVEL', 'STATUS', 'OBSERVACAO'
]

const STATUS_VALIDOS = ['aceito', 'limitado', 'negado']
const COMBUSTIVEIS_VALIDOS = ['qualquer', 'flex', 'diesel', 'gasolina', 'eletrico']

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Validate user
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const formData = await req.formData()
    const arquivo = formData.get('arquivo') as File
    const planoId = formData.get('plano_id') as string
    const linhaSlug = formData.get('linha_slug') as string
    const modoImportacao = (formData.get('modo') as string) || 'adicionar'

    if (!arquivo || !planoId || !linhaSlug) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios: arquivo, plano_id, linha_slug' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const bytes = await arquivo.arrayBuffer()
    const textoCompleto = extrairTextoPDF(bytes)

    const inicio = textoCompleto.indexOf('##DADOS_IMPORTACAO_INICIO##')
    const fim = textoCompleto.indexOf('##DADOS_IMPORTACAO_FIM##')

    if (inicio === -1 || fim === -1) {
      return new Response(
        JSON.stringify({
          error: 'Formato inválido',
          detalhe: 'Marcadores ##DADOS_IMPORTACAO_INICIO## e ##DADOS_IMPORTACAO_FIM## não encontrados'
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const blocoRaw = textoCompleto.substring(inicio + '##DADOS_IMPORTACAO_INICIO##'.length, fim).trim()
    const linhas = blocoRaw.split('\n').map(l => l.trim()).filter(Boolean)

    const metaLinhas: Record<string, string> = {}
    const linhasDados: string[] = []
    let cabecalhoEncontrado = false

    for (const linha of linhas) {
      if (linha.startsWith('════') || linha === '') continue

      if (linha.includes(':') && !linha.includes('|') && !cabecalhoEncontrado) {
        const [chave, ...valor] = linha.split(':')
        metaLinhas[chave.trim()] = valor.join(':').trim()
        continue
      }

      if (!cabecalhoEncontrado && linha.startsWith('MARCA|')) {
        const colunas = linha.split('|').map(c => c.trim())
        const colunasValidas = COLUNAS_ESPERADAS.every((col, i) => colunas[i] === col)
        if (!colunasValidas) {
          return new Response(
            JSON.stringify({
              error: 'Cabeçalho inválido',
              detalhe: `Esperado: ${COLUNAS_ESPERADAS.join('|')} | Recebido: ${linha}`
            }),
            { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        cabecalhoEncontrado = true
        continue
      }

      if (cabecalhoEncontrado && linha.includes('|')) {
        linhasDados.push(linha)
      }
    }

    if (!cabecalhoEncontrado) {
      return new Response(
        JSON.stringify({ error: 'Cabeçalho da tabela não encontrado no bloco de dados' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (linhasDados.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Nenhum dado encontrado no bloco de importação' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const erros: string[] = []
    const registros: Record<string, unknown>[] = []

    for (let i = 0; i < linhasDados.length; i++) {
      const partes = linhasDados[i].split('|')
      if (partes.length < 6) {
        erros.push(`Linha ${i + 2}: colunas insuficientes — "${linhasDados[i]}"`)
        continue
      }

      const [marca, modelo, anoMinStr, anoMaxStr, combustivel, status, observacao] = partes

      const anoMin = parseInt(anoMinStr.trim())
      const anoMax = anoMaxStr.trim() === '' ? null : parseInt(anoMaxStr.trim())

      if (isNaN(anoMin)) {
        erros.push(`Linha ${i + 2}: ANO_MIN inválido — "${anoMinStr}"`)
        continue
      }
      if (anoMax !== null && isNaN(anoMax)) {
        erros.push(`Linha ${i + 2}: ANO_MAX inválido — "${anoMaxStr}"`)
        continue
      }
      if (!STATUS_VALIDOS.includes(status.trim().toLowerCase())) {
        erros.push(`Linha ${i + 2}: STATUS inválido — "${status}" (válidos: aceito, limitado, negado)`)
        continue
      }
      if (!COMBUSTIVEIS_VALIDOS.includes(combustivel.trim().toLowerCase())) {
        erros.push(`Linha ${i + 2}: COMBUSTIVEL inválido — "${combustivel}"`)
        continue
      }

      registros.push({
        plano_id: planoId,
        linha_slug: linhaSlug,
        marca: marca.trim().toUpperCase(),
        modelo: modelo.trim().toUpperCase(),
        ano_min: anoMin,
        ano_max: anoMax,
        combustivel: combustivel.trim().toLowerCase(),
        status: status.trim().toLowerCase(),
        observacao: observacao?.trim() || null,
        is_active: true,
      })
    }

    if (erros.length > 0) {
      return new Response(
        JSON.stringify({
          error: 'Erros de validação — nenhum registro importado',
          erros,
          total_linhas: linhasDados.length,
          total_erros: erros.length,
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (modoImportacao === 'substituir') {
      await supabase
        .from('plano_elegibilidade_modelos')
        .update({ is_active: false })
        .eq('plano_id', planoId)
    }

    const { error: insertError } = await supabase
      .from('plano_elegibilidade_modelos')
      .insert(registros)

    if (insertError) {
      return new Response(
        JSON.stringify({ error: 'Erro ao salvar no banco', detalhe: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        sucesso: true,
        plano_id: planoId,
        linha_slug: linhaSlug,
        modo: modoImportacao,
        total_importados: registros.length,
        metadados: metaLinhas,
        registros,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Erro interno', detalhe: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function extrairTextoPDF(bytes: ArrayBuffer): string {
  const decoder = new TextDecoder('utf-8', { fatal: false })
  const texto = decoder.decode(bytes)

  const strings: string[] = []
  const regexStrings = /\(([^)]{1,500})\)/g
  let match
  while ((match = regexStrings.exec(texto)) !== null) {
    const str = match[1].replace(/\\n/g, '\n').replace(/\\r/g, '').replace(/\\\\/g, '\\')
    strings.push(str)
  }

  return strings.join('\n')
}
