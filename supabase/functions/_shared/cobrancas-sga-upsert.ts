// ============================================================================
// Mirror de boletos Hinova → tabela `cobrancas`
// ----------------------------------------------------------------------------
// Reaproveitado por:
//   - sga-sync-financeiro-veiculo (1 veículo, boletos do veículo)
//   - executar-regua-cobranca (vários associados, boletos por período)
//
// Estratégia (alinhada à mem://logic/billing/reconciliacao-csv-cobrancas):
//   - Insere novas linhas, atualiza vencimento/status, baixa pagas.
//   - onConflict = (veiculo_id, data_vencimento, valor, tipo) — índice parcial
//     `cobrancas_sga_logica_uniq` cobre origem='sga_hinova'.
//   - Boletos sem associado_id local (codigo_hinova não encontrado) ou sem
//     veiculo_id local são pulados ("ignoradas") — mirror exige ambos.
// ============================================================================
import { mapStatusBoleto, parseDataHinova, toNumber } from './hinova-client.ts'

export interface MirrorResultado {
  inseridas: number          // upserts bem-sucedidos (insert + update)
  atualizadas: number        // mantido por compat — somado em `inseridas`
  baixadas: number           // boletos pagos refletidos
  ignoradas: number          // sem associado/veículo local
  erros: number
}

interface ResolverArgs {
  /** Mapa codigo_associado_hinova → { id, ... } */
  associadosPorCodigoHinova: Map<number, { id: string }>
  /** Mapa placa (UPPER) → { id, associado_id } */
  veiculosPorPlaca: Map<string, { id: string; associado_id: string | null }>
}

export async function mirrorBoletosEmCobrancas(
  supabase: any,
  boletos: any[],
  resolver: ResolverArgs,
): Promise<MirrorResultado> {
  const out: MirrorResultado = { inseridas: 0, atualizadas: 0, baixadas: 0, ignoradas: 0, erros: 0 }
  if (!boletos?.length) return out

  const hoje = new Date().toISOString().slice(0, 10)
  const nowIso = new Date().toISOString()
  const rows: Record<string, any>[] = []

  for (const b of boletos) {
    const nosso = String(b?.nosso_numero ?? b?.nossoNumero ?? '').trim()
    if (!nosso) { out.ignoradas++; continue }

    const codAssoc = Number(b?.codigo_associado || 0)
    const local = codAssoc ? resolver.associadosPorCodigoHinova.get(codAssoc) : undefined
    if (!local) { out.ignoradas++; continue }

    const v0 = (b?.veiculos || [])[0] || {}
    const placaUp = String(v0?.placa || '').toUpperCase().trim()
    const veicLocal = placaUp ? resolver.veiculosPorPlaca.get(placaUp) : undefined
    if (!veicLocal) { out.ignoradas++; continue }

    const status = mapStatusBoleto(b?.situacao_boleto ?? b?.situacao)
    const valor = toNumber(b?.valor_boleto ?? b?.valor)
    const valorFinal = toNumber(b?.valor_boleto_multa_mora ?? b?.valor_final ?? valor)
    const multa = toNumber(b?.valor_multa)
    const juros = toNumber(b?.valor_mora ?? b?.juros)
    const dataEmissao = parseDataHinova(b?.data_emissao) ?? hoje
    const dataVencimento = parseDataHinova(b?.data_vencimento) ?? hoje
    const dataVencOriginal = parseDataHinova(b?.data_vencimento_original)
    const dataPagamento = parseDataHinova(b?.data_pagamento)

    const mesRef = b?.mes_referente ? String(b.mes_referente) : null
    let refMes: number | null = null
    let refAno: number | null = null
    if (mesRef) {
      const match = mesRef.match(/(\d{1,2})\D+(\d{4})/) || mesRef.match(/(\d{4})\D+(\d{1,2})/)
      if (match) {
        const a = parseInt(match[1])
        const c = parseInt(match[2])
        if (a > 12) { refAno = a; refMes = c } else { refMes = a; refAno = c }
      }
    }

    const valorPago = status === 'pago'
      ? (() => {
          const raw = toNumber(b?.valor_pagamento ?? b?.valor_pago_boleto ?? b?.valor_recebido ?? b?.valor_pago ?? valorFinal)
          if (valorFinal > 0 && Math.round(raw) === Math.round(valorFinal * 100)) return raw / 100
          return raw
        })()
      : null

    rows.push({
      associado_id: local.id,
      veiculo_id: veicLocal.id,
      tipo: 'mensalidade',
      status,
      descricao: `Boleto Hinova ${b?.tipo_boleto || ''} ${mesRef || ''}`.trim(),
      referencia_mes: refMes,
      referencia_ano: refAno,
      valor,
      valor_final: valorFinal,
      valor_pago: valorPago,
      forma_pagamento: status === 'pago'
        ? (b?.forma_pagamento_boleto ?? b?.tipo_pagamento ?? b?.forma_pagamento ?? null)
        : null,
      multa: multa || null,
      juros: juros || null,
      data_emissao: dataEmissao,
      data_vencimento: dataVencimento,
      data_vencimento_original: dataVencOriginal,
      data_pagamento: dataPagamento,
      linha_digitavel: b?.linha_digitavel || null,
      codigo_barras: b?.codigo_barras || null,
      boleto_url: b?.url_boleto || b?.boleto_url || b?.link_boleto || null,
      nosso_numero: nosso,
      origem: 'sga_hinova',
      codigo_situacao_boleto_hinova: typeof b?.codigo_situacao_boleto === 'number' ? b.codigo_situacao_boleto : null,
      tipo_boleto_hinova: b?.tipo_boleto || null,
      dados_brutos_sga: b,
      sincronizado_sga_em: nowIso,
    })

    if (status === 'pago') out.baixadas++
  }

  if (rows.length === 0) return out

  const CHUNK = 500
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK)
    const { error: upErr } = await supabase
      .from('cobrancas')
      .upsert(slice, { onConflict: 'veiculo_id,data_vencimento,valor,tipo' })
    if (upErr) {
      console.error('[mirrorBoletos] upsert batch falhou:', upErr.message)
      // Fallback linha-a-linha
      for (const row of slice) {
        const { error } = await supabase
          .from('cobrancas')
          .upsert(row, { onConflict: 'veiculo_id,data_vencimento,valor,tipo' })
        if (error) out.erros++
        else out.inseridas++
      }
    } else {
      out.inseridas += slice.length
    }
  }

  return out
}
