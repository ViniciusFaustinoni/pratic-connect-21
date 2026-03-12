import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

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
        JSON.stringify({ error: 'Nao autorizado' }),
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
        JSON.stringify({ error: 'Nao autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1. Receber FormData
    const formData = await req.formData()
    const arquivo = formData.get('arquivo') as File
    const planoId = formData.get('plano_id') as string
    const linhaSlug = formData.get('linha_slug') as string
    const modo = (formData.get('modo') as string) || 'adicionar'

    if (!arquivo || !planoId || !linhaSlug) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatorios: arquivo, plano_id, linha_slug' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Ler Excel
    const bytes = await arquivo.arrayBuffer()
    const workbook = XLSX.read(bytes, { type: 'array' })

    // 3. Localizar aba Elegibilidade
    const abaNome = workbook.SheetNames.find(
      (n: string) => n.trim().toLowerCase() === 'elegibilidade'
    )
    if (!abaNome) {
      return new Response(
        JSON.stringify({
          error: 'Aba "Elegibilidade" nao encontrada',
          abas_encontradas: workbook.SheetNames
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const sheet = workbook.Sheets[abaNome]
    const linhas: string[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
    }) as string[][]

    if (linhas.length < 2) {
      return new Response(
        JSON.stringify({ error: 'Planilha vazia ou sem dados alem do cabecalho' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Validar cabeçalho
    const cabecalho = linhas[0].map((c: any) => String(c).trim().toUpperCase())
    const cabecalhoValido = COLUNAS_ESPERADAS.every(
      (col, i) => cabecalho[i] === col
    )
    if (!cabecalhoValido) {
      return new Response(
        JSON.stringify({
          error: 'Cabecalho invalido',
          esperado: COLUNAS_ESPERADAS.join(' | '),
          recebido: cabecalho.join(' | ')
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5. Parsear linhas de dados
    const erros: string[] = []
    const registros: Record<string, unknown>[] = []

    for (let i = 1; i < linhas.length; i++) {
      const linha = linhas[i]
      // Ignorar linhas completamente vazias
      if (linha.every((c: any) => c === '' || c === null || c === undefined)) continue

      const [marca, modelo, anoMinRaw, anoMaxRaw, combustivel, status, observacao] = linha

      const anoMin = parseInt(String(anoMinRaw))
      const anoMax = anoMaxRaw === '' || anoMaxRaw === null
        ? null
        : parseInt(String(anoMaxRaw))

      const combustivelNorm = String(combustivel).trim().toLowerCase()
      const statusNorm = String(status).trim().toLowerCase()

      if (!marca || !modelo) {
        erros.push(`Linha ${i + 1}: MARCA e MODELO sao obrigatorios`)
        continue
      }
      if (isNaN(anoMin)) {
        erros.push(`Linha ${i + 1}: ANO_MIN invalido — "${anoMinRaw}"`)
        continue
      }
      if (anoMax !== null && isNaN(anoMax)) {
        erros.push(`Linha ${i + 1}: ANO_MAX invalido — "${anoMaxRaw}"`)
        continue
      }
      if (!COMBUSTIVEIS_VALIDOS.includes(combustivelNorm)) {
        erros.push(`Linha ${i + 1}: COMBUSTIVEL invalido — "${combustivel}" (validos: ${COMBUSTIVEIS_VALIDOS.join(', ')})`)
        continue
      }
      if (!STATUS_VALIDOS.includes(statusNorm)) {
        erros.push(`Linha ${i + 1}: STATUS invalido — "${status}" (validos: aceito, limitado, negado)`)
        continue
      }

      registros.push({
        plano_id: planoId,
        linha_slug: linhaSlug,
        marca: String(marca).trim().toUpperCase(),
        modelo: String(modelo).trim().toUpperCase(),
        ano_min: anoMin,
        ano_max: anoMax,
        combustivel: combustivelNorm,
        status: statusNorm,
        observacao: observacao && String(observacao).trim() !== ''
          ? String(observacao).trim()
          : null,
        is_active: true,
      })
    }

    // Erros bloqueiam importação inteira
    if (erros.length > 0) {
      return new Response(
        JSON.stringify({
          error: 'Erros de validacao — nenhum registro importado',
          erros,
          total_linhas: linhas.length - 1,
          total_erros: erros.length,
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (registros.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Nenhum registro valido encontrado na planilha' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 6. Inserir no banco
    if (modo === 'substituir') {
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

    // 7. Retorno de sucesso com preview
    return new Response(
      JSON.stringify({
        sucesso: true,
        plano_id: planoId,
        linha_slug: linhaSlug,
        modo,
        total_importados: registros.length,
        registros: registros.slice(0, 50),
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
