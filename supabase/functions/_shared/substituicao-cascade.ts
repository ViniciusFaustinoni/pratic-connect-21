// supabase/functions/_shared/substituicao-cascade.ts
//
// Helper canônico para popular templateData.substituicao a partir das fontes
// em cascata (substituicoes_veiculo → cotacoes.dados_extras →
// solicitacoes_substituicao_placa → veiculos).
//
// Compartilhado por:
//  - autentique-create
//  - autentique-create-by-token
//  - retificar-termo-filiacao
//
// Necessário porque `substituicoes_veiculo` só é materializada no
// efetivar-substituicao (pós retirada+instalação), e o termo nasce muito antes.

export interface ContratoMin {
  associado_id?: string | null;
  veiculo_id?: string | null;
  cotacao_id?: string | null;
  tipo_entrada?: string | null;
}

export interface SubstituicaoTemplateData {
  placa_anterior: string;
  modelo_anterior: string;
  fipe_anterior: number;
}

export interface CascadeResult {
  ok: boolean;
  fonte: string | null;
  data: SubstituicaoTemplateData | null;
}

export function isContratoSubstituicao(contrato: ContratoMin | null | undefined): boolean {
  if (!contrato) return false;
  return contrato.tipo_entrada === 'substituicao_placa' || contrato.tipo_entrada === 'substituicao';
}

export async function resolverSubstituicaoCascade(
  supabase: any,
  contrato: ContratoMin,
  logPrefix = '[substituicao-cascade]',
): Promise<CascadeResult> {
  if (!isContratoSubstituicao(contrato) || !contrato.associado_id) {
    return { ok: false, fonte: null, data: null };
  }

  let placaAnterior = '';
  let modeloAnterior = '';
  let fipeAnterior = 0;
  let fonte: string | null = null;

  // 1) substituicoes_veiculo (materializada pelo efetivar-substituicao)
  if (contrato.veiculo_id) {
    const { data: subst } = await supabase
      .from('substituicoes_veiculo')
      .select('veiculo_antigo_placa, veiculo_antigo_modelo, veiculo_antigo_fipe')
      .eq('associado_id', contrato.associado_id)
      .eq('veiculo_novo_id', contrato.veiculo_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (subst?.veiculo_antigo_placa) {
      placaAnterior = subst.veiculo_antigo_placa;
      modeloAnterior = subst.veiculo_antigo_modelo || '';
      fipeAnterior = Number(subst.veiculo_antigo_fipe || 0);
      fonte = 'substituicoes_veiculo';
    }
  }

  // 2) cotacoes.dados_extras (gravado na criação da cotação de substituição)
  let dadosExtras: any = {};
  if (contrato.cotacao_id) {
    const { data: cot } = await supabase
      .from('cotacoes')
      .select('dados_extras')
      .eq('id', contrato.cotacao_id)
      .maybeSingle();
    dadosExtras = (cot as any)?.dados_extras || {};
  }
  if (!placaAnterior && dadosExtras.veiculo_antigo_placa) {
    placaAnterior = dadosExtras.veiculo_antigo_placa;
    modeloAnterior = dadosExtras.veiculo_antigo_modelo || modeloAnterior;
    fipeAnterior = Number(dadosExtras.veiculo_antigo_fipe || fipeAnterior || 0);
    fonte = 'cotacoes.dados_extras';
  }
  // Mesmo se placa já veio de (1), preencher campos faltantes a partir de dados_extras
  if (placaAnterior && (!modeloAnterior || !fipeAnterior)) {
    if (!modeloAnterior && dadosExtras.veiculo_antigo_modelo) modeloAnterior = dadosExtras.veiculo_antigo_modelo;
    if (!fipeAnterior && dadosExtras.veiculo_antigo_fipe) fipeAnterior = Number(dadosExtras.veiculo_antigo_fipe);
  }

  // 3) solicitacoes_substituicao_placa
  if (!placaAnterior || !modeloAnterior || !fipeAnterior) {
    const solId = dadosExtras.solicitacao_substituicao_id;
    const q = supabase
      .from('solicitacoes_substituicao_placa')
      .select('veiculo_antigo_placa, veiculo_antigo_snapshot, veiculo_antigo_id')
      .order('created_at', { ascending: false })
      .limit(1);
    const { data: sol } = solId
      ? await q.eq('id', solId).maybeSingle()
      : (contrato.cotacao_id ? await q.eq('cotacao_id', contrato.cotacao_id).maybeSingle() : { data: null } as any);
    if (sol) {
      if (!placaAnterior) placaAnterior = (sol as any).veiculo_antigo_placa || '';
      const snap = (sol as any).veiculo_antigo_snapshot || {};
      if (!modeloAnterior) modeloAnterior = snap.modelo || '';
      if (!fipeAnterior) fipeAnterior = Number(snap.valor_fipe || snap.fipe || 0);
      if (!fonte) fonte = 'solicitacoes_substituicao_placa';

      // 4) veiculos (best-effort para completar modelo/fipe)
      if ((!modeloAnterior || !fipeAnterior) && (sol as any).veiculo_antigo_id) {
        const { data: vAnt } = await supabase
          .from('veiculos')
          .select('marca, modelo, valor_fipe')
          .eq('id', (sol as any).veiculo_antigo_id)
          .maybeSingle();
        if (vAnt) {
          if (!modeloAnterior) modeloAnterior = [vAnt.marca, vAnt.modelo].filter(Boolean).join(' ');
          if (!fipeAnterior) fipeAnterior = Number(vAnt.valor_fipe || 0);
          if (!fonte) fonte = 'veiculos';
        }
      }
    }
  }

  if (!placaAnterior) {
    console.warn(`${logPrefix} Contrato de substituição SEM placa anterior resolvida — tokens cairão para "—"`);
    return { ok: false, fonte: null, data: null };
  }

  console.log(`${logPrefix} Dados de substituição via ${fonte}:`, placaAnterior, modeloAnterior || '(sem modelo)', fipeAnterior || '(sem fipe)');
  return {
    ok: true,
    fonte,
    data: {
      placa_anterior: placaAnterior,
      modelo_anterior: modeloAnterior,
      fipe_anterior: fipeAnterior,
    },
  };
}

/**
 * Aplica o resultado do cascade no `templateData`.
 * No-op quando contrato não é de substituição ou cascade não resolveu.
 */
export async function aplicarSubstituicaoNoTemplateData(
  supabase: any,
  contrato: ContratoMin,
  templateData: any,
  logPrefix?: string,
): Promise<void> {
  const result = await resolverSubstituicaoCascade(supabase, contrato, logPrefix);
  if (result.ok && result.data) {
    templateData.substituicao = result.data;
  }
}
