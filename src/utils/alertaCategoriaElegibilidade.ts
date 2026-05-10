/**
 * Gera alertas dinâmicos de categoria baseados nas regras reais de elegibilidade.
 *
 * Regra de negócio:
 *   Um item só aparece como "exclusão" para a categoria X se:
 *     1) A categoria X NÃO tem acesso a nenhuma variante daquele conceito
 *        (ex.: "Carro Reserva", "Cobertura FIPE", "Danos a Terceiros"...).
 *     2) A categoria padrão "nenhuma" (perfil sem restrição) TEM acesso a
 *        alguma variante daquele conceito.
 *
 * Assim evitamos listar coberturas que pertencem a outras linhas de produto
 * (ex.: linha "Deságio 70%" é exclusiva de Leilão/Chassi Remarcado/Ressarcimento
 * Integral; não faz sentido aparecer como "exclusão" para Placa Vermelha que
 * usa a linha "Deságio 75%").
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

/** Categoria "default" que representa um perfil sem restrição. */
const CATEGORIA_PADRAO = 'nenhuma';

/**
 * Normaliza o nome de um item em um "conceito" agrupador.
 * - Remove sufixos de plano/região/deságio (tudo após o primeiro " - " ou " -").
 * - Colapsa whitespace.
 * - Agrupa variantes conhecidas (% FIPE, Carro Reserva R$X, Danos a Terceiros R$X,
 *   Kit Gás R$X, Assistência 24h XXXkm, Taxa Administrativa).
 * Retorna null para itens que devem ser ignorados (taxas, % FIPE).
 */
function conceitoBase(nomeOriginal: string): string | null {
  const limpo = nomeOriginal
    .replace(/\s*[-–]\s.*$/, '') // tudo após " - " ou " – "
    .replace(/\s+/g, ' ')
    .trim();

  const lower = limpo.toLowerCase();

  // Itens "estruturais" — não são informativos para o usuário final.
  if (lower.includes('taxa administrativa')) return null;
  if (/^\d+\s*%\s*fipe/.test(lower)) return null; // 70% FIPE, 75% FIPE, 80% Fipe...
  if (/%\s*fipe$/.test(lower)) return null;

  // Agrupamentos por conceito.
  if (/^carro\s+reserva/.test(lower)) return 'Carro Reserva';
  if (/^danos\s+a\s+terceiros/.test(lower)) return 'Danos a Terceiros';
  if (/^kit\s+g[aá]s/.test(lower)) return 'Kit Gás';
  if (/^assist[eê]ncia\s+24h/.test(lower)) return 'Assistência 24h';
  if (/^rastreador/.test(lower)) return 'Rastreador/Monitoramento';
  if (/^clube\s+g[aá]s/.test(lower)) return 'Clube Gás';
  if (/^chuva\s+de\s+granizo/.test(lower)) return 'Chuva de Granizo';
  if (/^alagamento/.test(lower)) return 'Alagamento';
  if (/^col[ií]s[aã]o/.test(lower)) return 'Colisão';
  if (/^inc[eê]ndio/.test(lower)) return 'Incêndio';
  if (/^roubo/.test(lower)) return 'Roubo';
  if (/^furto/.test(lower)) return 'Furto';
  if (/^perda\s+total/.test(lower)) return 'Perda Total';
  if (/^vidros?/.test(lower)) return 'Vidros';
  if (/^vandalismo/.test(lower)) return 'Vandalismo';

  // Caso geral: usa o nome limpo como conceito (capitalizado).
  return limpo;
}

/**
 * Indica se uma regra `tipo_placa` (mode + values) concede acesso a uma categoria.
 */
function regraPermite(
  ruleMode: string,
  values: string[],
  categoria: string,
): boolean {
  if (ruleMode === 'include') return values.includes(categoria);
  if (ruleMode === 'exclude') return !values.includes(categoria);
  return true;
}

/**
 * Constrói, para cada conceito, o conjunto de categorias que conseguem
 * acessar pelo menos UMA variante daquele conceito.
 *
 * Importante: a tabela `entity_eligibility_rules` só carrega regras para itens
 * que possuem alguma restrição. Itens sem regras = aceitam todas as categorias
 * — esses não vão aparecer no alerta de qualquer forma porque não estão
 * indexados aqui.
 */
function mapearAcessosPorConceito(
  rules: EligibilityRule[],
  coberturas: Array<{ id: string; nome: string }>,
  beneficios: Array<{ id: string; name: string }>,
): Map<string, Set<string>> {
  const coberturaMap = new Map(coberturas.map((c) => [c.id, c.nome]));
  const beneficioMap = new Map(beneficios.map((b) => [b.id, b.name]));

  // conceito -> Set de categorias que têm acesso a alguma variante
  const acessos = new Map<string, Set<string>>();

  // Universo de categorias relevantes (todas mencionadas em qualquer regra +
  // a categoria padrão).
  const universoCategorias = new Set<string>([CATEGORIA_PADRAO]);
  for (const r of rules) {
    if (r.rule_type !== 'tipo_placa' || !r.is_active) continue;
    const values: string[] = r.rule_config?.values || [];
    values.forEach((v) => universoCategorias.add(v));
  }
  // Adiciona as categorias conhecidas do app.
  Object.keys(CATEGORIA_LABELS).forEach((c) => universoCategorias.add(c));

  // Para cada regra, descobre conceito e categorias permitidas.
  for (const r of rules) {
    if (r.rule_type !== 'tipo_placa' || !r.is_active) continue;

    let nome: string | undefined;
    if (r.entity_type === 'cobertura') nome = coberturaMap.get(r.entity_id);
    else if (r.entity_type === 'beneficio') nome = beneficioMap.get(r.entity_id);
    if (!nome) continue;

    const conceito = conceitoBase(nome);
    if (!conceito) continue;

    const values: string[] = r.rule_config?.values || [];
    const set = acessos.get(conceito) ?? new Set<string>();

    for (const cat of universoCategorias) {
      if (regraPermite(r.rule_mode, values, cat)) {
        set.add(cat);
      }
    }

    acessos.set(conceito, set);
  }

  return acessos;
}

/**
 * Retorna os conceitos (nomes únicos) que constituem exclusões REAIS
 * para a categoria informada.
 */
export function getItensInelegiveisPorCategoria(
  categoria: string,
  rules: EligibilityRule[],
  coberturas: Array<{ id: string; nome: string }>,
  beneficios: Array<{ id: string; name: string }>,
): string[] {
  if (!categoria || categoria === 'nenhuma' || categoria === 'normal') return [];

  const acessos = mapearAcessosPorConceito(rules, coberturas, beneficios);
  const exclusoesReais: string[] = [];

  for (const [conceito, categoriasComAcesso] of acessos) {
    const padraoTemAcesso = categoriasComAcesso.has(CATEGORIA_PADRAO);
    const categoriaTemAcesso = categoriasComAcesso.has(categoria);

    // Só é exclusão REAL se: o perfil padrão tem acesso e a categoria não.
    if (padraoTemAcesso && !categoriaTemAcesso) {
      exclusoesReais.push(conceito);
    }
  }

  return exclusoesReais.sort();
}

/**
 * Gera uma mensagem de alerta formatada para a categoria selecionada.
 * Retorna null se não houver exclusões relevantes.
 */
export function gerarAlertaCategoriaElegibilidade(
  categoria: string,
  rules: EligibilityRule[],
  coberturas: Array<{ id: string; nome: string }>,
  beneficios: Array<{ id: string; name: string }>,
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
