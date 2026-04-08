import { supabase } from '@/integrations/supabase/client';

/**
 * Calcula a carência residual para uma substituição de veículo.
 * 
 * Regra:
 * - Itens que existiam no plano anterior → herdam carência residual (dias restantes)
 * - Itens novos (não existiam antes) → carência padrão configurada no catálogo
 * 
 * @param veiculoAntigoId ID do veículo sendo substituído
 * @param planoNovoId ID do novo plano selecionado
 * @returns Mapa de cobertura/benefício ID → dias de carência
 */
export async function calcularCarenciaResidual(
  veiculoAntigoId: string,
  planoNovoId: string
): Promise<{
  carenciasPorItem: Record<string, { dias: number; tipo: 'residual' | 'padrao'; nome: string }>;
  dataCarenciaGeral: string | null;
}> {
  // 1. Buscar contrato ativo do veículo antigo
  const { data: contratoAntigo } = await supabase
    .from('contratos')
    .select('id, plano_id, data_carencia_inicio, data_carencia_fim')
    .eq('veiculo_id', veiculoAntigoId)
    .eq('status', 'ativo')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // 2. Buscar coberturas e benefícios do plano anterior
  let itensPlanoAnterior: Set<string> = new Set();
  if (contratoAntigo?.plano_id) {
    const [{ data: cobAntigas }, { data: benAntigas }] = await Promise.all([
      supabase
        .from('planos_coberturas')
        .select('cobertura_id')
        .eq('plano_id', contratoAntigo.plano_id),
      supabase
        .from('planos_beneficios')
        .select('benefit_id')
        .eq('plano_id', contratoAntigo.plano_id),
    ]);
    (cobAntigas || []).forEach(c => itensPlanoAnterior.add(`cob_${c.cobertura_id}`));
    (benAntigas || []).forEach(b => itensPlanoAnterior.add(`ben_${b.benefit_id}`));
  }

  // 3. Buscar coberturas e benefícios do plano novo
  const [{ data: cobNovas }, { data: benNovas }] = await Promise.all([
    supabase
      .from('planos_coberturas')
      .select('cobertura_id, coberturas(id, nome, carencia_dias, carencia_ativa)')
      .eq('plano_id', planoNovoId),
    supabase
      .from('planos_beneficios')
      .select('benefit_id, benefits(id, titulo)')
      .eq('plano_id', planoNovoId),
  ]);

  // 4. Calcular dias restantes de carência do contrato anterior
  let diasRestantes = 0;
  if (contratoAntigo?.data_carencia_fim) {
    const fimCarencia = new Date(contratoAntigo.data_carencia_fim);
    const hoje = new Date();
    diasRestantes = Math.max(0, Math.ceil((fimCarencia.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)));
  }

  // 5. Montar mapa de carências
  const carenciasPorItem: Record<string, { dias: number; tipo: 'residual' | 'padrao'; nome: string }> = {};

  // Coberturas
  (cobNovas || []).forEach((item: any) => {
    const key = `cob_${item.cobertura_id}`;
    const cobertura = item.coberturas;
    const nome = cobertura?.nome || 'Cobertura';
    const carenciaPadrao = cobertura?.carencia_ativa ? (cobertura?.carencia_dias || 120) : 0;

    if (itensPlanoAnterior.has(key)) {
      // Item existia no plano anterior → carência residual
      carenciasPorItem[item.cobertura_id] = {
        dias: diasRestantes,
        tipo: 'residual',
        nome,
      };
    } else {
      // Item novo → carência padrão
      carenciasPorItem[item.cobertura_id] = {
        dias: carenciaPadrao,
        tipo: 'padrao',
        nome,
      };
    }
  });

  // Benefícios
  (benNovas || []).forEach((item: any) => {
    const key = `ben_${item.benefit_id}`;
    const nome = item.benefits?.titulo || 'Benefício';

    if (itensPlanoAnterior.has(key)) {
      carenciasPorItem[item.benefit_id] = {
        dias: diasRestantes,
        tipo: 'residual',
        nome,
      };
    } else {
      carenciasPorItem[item.benefit_id] = {
        dias: 0,
        tipo: 'padrao',
        nome,
      };
    }
  });

  // Data de carência geral = max(dias residuais, dias novos)
  const maxDias = Math.max(...Object.values(carenciasPorItem).map(c => c.dias), 0);
  const dataCarenciaGeral = maxDias > 0
    ? new Date(Date.now() + maxDias * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    : null;

  return { carenciasPorItem, dataCarenciaGeral };
}
