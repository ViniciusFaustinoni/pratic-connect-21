// deno-lint-ignore-file no-explicit-any
/**
 * detectar-associado-por-cpf
 * ---------------------------
 * Recebe um cpf extraído via OCR da CNH (no fluxo público de cotação) e:
 *  1) Busca associado local por CPF.
 *  2) Se não achar, tenta no SGA via sga-buscar-associado-completo + importar-associado-sga.
 *  3) Aplica guarda anti-sequestro: nome do associado precisa "bater" com o
 *     nome do solicitante da cotação (memória no-cross-owner-vehicle-reuse).
 *  4) Em caso de match, marca a cotação como `tipo_entrada='inclusao'`
 *     e grava metadados em dados_extras.auto_inclusao.
 * Sempre responde 200 — `{ match: boolean, motivo?: string }`.
 *
 * Público (verify_jwt = false). Apenas leitura/escrita de cotações em status
 * pré-contrato; não realiza nenhuma ação destrutiva.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function onlyDigits(s: string | null | undefined): string {
  return (s || '').replace(/\D/g, '')
}

function maskCpf(d11: string): string {
  return `${d11.slice(0, 3)}.${d11.slice(3, 6)}.${d11.slice(6, 9)}-${d11.slice(9)}`
}

function validateCpf(cpfRaw: string): boolean {
  const c = onlyDigits(cpfRaw)
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(c[i]) * (10 - i)
  let d1 = (sum * 10) % 11
  if (d1 === 10) d1 = 0
  if (d1 !== parseInt(c[9])) return false
  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(c[i]) * (11 - i)
  let d2 = (sum * 10) % 11
  if (d2 === 10) d2 = 0
  return d2 === parseInt(c[10])
}

function normalizeNome(s: string | null | undefined): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Heurística simples de "mesmo nome": primeiro+último iguais OU igualdade total normalizada. */
function nomesBatem(a: string | null | undefined, b: string | null | undefined): boolean {
  const A = normalizeNome(a)
  const B = normalizeNome(b)
  if (!A || !B) return false
  if (A === B) return true
  const pa = A.split(' ')
  const pb = B.split(' ')
  if (pa.length < 2 || pb.length < 2) return false
  return pa[0] === pb[0] && pa[pa.length - 1] === pb[pb.length - 1]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const body = await req.json().catch(() => ({}))
    const cotacao_id: string | undefined = body?.cotacao_id
    const cpfRaw: string | undefined = body?.cpf

    if (!cotacao_id || !cpfRaw) {
      return json(200, { match: false, motivo: 'parametros_invalidos' })
    }
    const cpf11 = onlyDigits(cpfRaw)
    if (!validateCpf(cpf11)) {
      return json(200, { match: false, motivo: 'cpf_invalido' })
    }

    // 1) Cotação
    const { data: cot } = await supabase
      .from('cotacoes')
      .select('id, nome_solicitante, tipo_entrada, dados_extras, status')
      .eq('id', cotacao_id)
      .maybeSingle()
    if (!cot) return json(200, { match: false, motivo: 'cotacao_nao_encontrada' })

    // Já marcada — no-op silencioso
    const tipoAtual = (cot as any).tipo_entrada
    if (tipoAtual === 'inclusao' || tipoAtual === 'inclusao_veiculo') {
      return json(200, { match: true, motivo: 'ja_marcada' })
    }

    // 2) Tenta local
    const cpfMascarado = maskCpf(cpf11)
    let { data: assoc } = await supabase
      .from('associados')
      .select('id, nome, telefone, email, cpf, codigo_hinova')
      .or(`cpf.eq.${cpf11},cpf.eq.${cpfMascarado}`)
      .maybeSingle()

    let sgaCodigoAssociado: string | number | null = null

    // 3) Se não achou, tenta SGA
    if (!assoc) {
      try {
        const r = await fetch(`${supabaseUrl}/functions/v1/sga-buscar-associado-completo`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ cpf: cpf11 }),
        })
        if (r.ok) {
          const sgaData = await r.json().catch(() => null) as any
          if (sgaData && sgaData.codigo_associado) {
            sgaCodigoAssociado = sgaData.codigo_associado
            // Importa para criar o associado local
            const imp = await fetch(`${supabaseUrl}/functions/v1/importar-associado-sga`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({ cpf: cpf11 }),
            })
            if (imp.ok) {
              const impData = await imp.json().catch(() => null) as any
              const localId = impData?.associado_id
              if (localId) {
                const { data: a2 } = await supabase
                  .from('associados')
                  .select('id, nome, telefone, email, cpf, codigo_hinova')
                  .eq('id', localId)
                  .maybeSingle()
                assoc = a2 ?? null
              }
            }
          }
        }
      } catch (e) {
        console.warn('[detectar-associado-por-cpf] erro SGA:', e)
      }
    }

    if (!assoc) return json(200, { match: false, motivo: 'nao_encontrado' })

    // 4) Guarda anti-sequestro pelo nome
    const nomeSolicitante = (cot as any).nome_solicitante as string | null
    if (nomeSolicitante && !nomesBatem(assoc.nome, nomeSolicitante)) {
      return json(200, { match: false, motivo: 'nome_divergente' })
    }

    // 5) Marca a cotação como inclusão (não bloqueia se update falhar)
    const dadosExtrasAtuais = ((cot as any).dados_extras || {}) as Record<string, any>
    const novosDadosExtras = {
      ...dadosExtrasAtuais,
      auto_inclusao: {
        detectado_em: new Date().toISOString(),
        origem: 'ocr_cnh',
        associado_id: assoc.id,
        sga_codigo_associado: sgaCodigoAssociado ?? assoc.codigo_hinova ?? null,
      },
    }

    const { error: updErr } = await supabase
      .from('cotacoes')
      .update({
        tipo_entrada: 'inclusao',
        dados_extras: novosDadosExtras,
      })
      .eq('id', cotacao_id)
    if (updErr) console.warn('[detectar-associado-por-cpf] update cotacao falhou:', updErr)

    return json(200, {
      match: true,
      associado_id: assoc.id,
      nome: assoc.nome,
      sga_codigo_associado: sgaCodigoAssociado ?? assoc.codigo_hinova ?? null,
    })
  } catch (e) {
    console.error('[detectar-associado-por-cpf] erro:', e)
    return json(200, { match: false, motivo: 'erro_interno' })
  }
})
