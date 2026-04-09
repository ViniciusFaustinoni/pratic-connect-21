/**
 * Gera alertas dinâmicos de categoria baseados nas regras reais de elegibilidade.
 * Substitui textos hardcoded vindos de `configuracoes.observacoes_categoria`.
 */

import type { EligibilityRule } from '@/hooks/useEntityEligibilityRules';

const CATEGORIA_LABELS: Record<string, string> = {
  leilao: 'Veículo de leilão',
  chassi_remarcado: 'Chassi remarcado',
  ressarcimento_integral: 'Ressarcimento integral',
  veiculo_que_ja_teve_ressarcimento_integral: 'Ressarcimento integral',
  taxi: 'Táxi',
  ex_taxi: 'Ex-Táxi',
  placa_vermelha: 'Placa vermelha',
  aplicativo: 'Uso para aplicativo',
};

/**
 * Extrai o nome "base" de uma cobertura, removendo o sufixo " - Plano" 
 * para agrupar variantes (ex: "Incêndio - Select" → "Incêndio").
 */
function nomeBase(nome: string): string {
  return nome.replace(/\s*-\s.*$/, '').trim();
}

/**
 * Dado uma categoria de veículo e as regras de elegibilidade,
 * retorna os nomes únicos (base) de coberturas/benefícios
 * que seriam removidos para aquela categoria.
 */
export function getItensInelegiveisPorCategoria(
  categoria: string,
  rules: EligibilityRule[],
  coberturas: Array<{ id: string; nome: string }>,
  beneficios: Array<{ id: string; name: string }>
): string[] {
  if (!categoria || categoria === 'nenhuma' || categoria === 'normal') return [];

  // Regras tipo_placa ativas (mode=include → values lista categorias permitidas)
  const tipoPlacaRules = rules.filter(
    r => r.rule_type === 'tipo_placa' && r.is_active
  );

  if (tipoPlacaRules.length === 0) return [];

  // Map entity_id → nome
  const coberturaMap = new Map(coberturas.map(c => [c.id, c.nome]));
  const beneficioMap = new Map(beneficios.map(b => [b.id, b.name]));

  const nomesExcluidos = new Set<string>();

  for (const rule of tipoPlacaRules) {
    const values: string[] = rule.rule_config?.values || [];
    const isInclude = rule.rule_mode === 'include';

    // include + categoria NÃO está nos values → inelegível
    // exclude + categoria ESTÁ nos values → inelegível
    const ineligible = isInclude
      ? !values.includes(categoria)
      : values.includes(categoria);

    if (!ineligible) continue;

    // Buscar nome do item
    let nome: string | undefined;
    if (rule.entity_type === 'cobertura') {
      nome = coberturaMap.get(rule.entity_id);
    } else if (rule.entity_type === 'beneficio') {
      nome = beneficioMap.get(rule.entity_id);
    }

    if (nome) {
      nomesExcluidos.add(nomeBase(nome));
    }
  }

  // Remover itens genéricos (taxas, FIPE %) que não são informativos para o alerta
  const filtrados = [...nomesExcluidos].filter(n => {
    const lower = n.toLowerCase();
    return !lower.includes('taxa administrativa') && !lower.includes('% fipe');
  });

  return filtrados.sort();
}

/**
 * Gera uma mensagem de alerta formatada para a categoria selecionada.
 * Retorna null se não houver exclusões relevantes.
 */
export function gerarAlertaCategoriaElegibilidade(
  categoria: string,
  rules: EligibilityRule[],
  coberturas: Array<{ id: string; nome: string }>,
  beneficios: Array<{ id: string; name: string }>
): { tipo: 'warning'; mensagem: string } | null {
  const itens = getItensInelegiveisPorCategoria(categoria, rules, coberturas, beneficios);
  if (itens.length === 0) return null;

  const label = CATEGORIA_LABELS[categoria] || 'Esta categoria';

  let lista: string;
  if (itens.length === 1) {
    lista = itens[0];
  } else {
    const ultimo = itens[itens.length - 1];
    lista = itens.slice(0, -1).join(', ') + ' e ' + ultimo;
  }

  return {
    tipo: 'warning',
    mensagem: `${label}: sem cobertura de ${lista}`,
  };
}
