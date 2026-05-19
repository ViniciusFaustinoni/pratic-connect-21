// deno-lint-ignore-file no-explicit-any
/**
 * consultar-nome-por-cpf
 * -----------------------
 * Endpoint público (verify_jwt=false) que recebe um CPF e devolve o nome
 * canônico do associado quando existe — usado pelo OcrDadosEditor para
 * sugerir "Cadastro existente: NOME — usar este" quando o OCR da CNH
 * preencheu o nome com erro tipográfico (ex: LOPWS em vez de LOPES).
 *
 * READ-ONLY. Não muta nada. Não vaza dados além de { nome, fonte }.
 * Se não achar local nem no SGA, devolve { encontrado: false }.
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
    const cpfRaw: string | undefined = body?.cpf
    if (!cpfRaw) return json(200, { encontrado: false, motivo: 'cpf_ausente' })

    const cpf11 = onlyDigits(cpfRaw)
    if (!validateCpf(cpf11)) {
      return json(200, { encontrado: false, motivo: 'cpf_invalido' })
    }

    // 1) Local
    const cpfMascarado = maskCpf(cpf11)
    const { data: assocLocal } = await supabase
      .from('associados')
      .select('nome')
      .or(`cpf.eq.${cpf11},cpf.eq.${cpfMascarado}`)
      .limit(1)
      .maybeSingle()

    if (assocLocal?.nome) {
      return json(200, {
        encontrado: true,
        nome: assocLocal.nome,
        fonte: 'associado_local',
      })
    }

    // 2) SGA (não bloqueante)
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
        const nomeSGA = sgaData?.nome || sgaData?.associado?.nome
        if (nomeSGA) {
          return json(200, {
            encontrado: true,
            nome: String(nomeSGA),
            fonte: 'sga',
          })
        }
      }
    } catch (e) {
      console.warn('[consultar-nome-por-cpf] erro SGA:', e)
    }

    return json(200, { encontrado: false, motivo: 'nao_encontrado' })
  } catch (e) {
    console.error('[consultar-nome-por-cpf] erro:', e)
    return json(200, { encontrado: false, motivo: 'erro_interno' })
  }
})
