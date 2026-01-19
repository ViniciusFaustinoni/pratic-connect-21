/**
 * Normaliza o nome de um bairro para comparação
 * Remove acentos, converte para minúsculas e remove espaços extras
 */
export function normalizarNomeBairro(nome: string): string {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/\s+/g, " ") // Normaliza espaços
    .trim();
}

/**
 * Mapeamento manual para casos onde o nome do banco difere do GeoJSON
 * Chave: nome normalizado do banco -> Valor: nome no GeoJSON
 */
const MAPEAMENTO_BAIRROS: Record<string, string> = {
  // Adicione mapeamentos conforme necessário
  // "nome_banco_normalizado": "Nome no GeoJSON",
};

/**
 * Obtém o nome do bairro compatível com o GeoJSON
 */
export function getNomeBairroGeoJSON(nomeBanco: string): string {
  const normalizado = normalizarNomeBairro(nomeBanco);
  return MAPEAMENTO_BAIRROS[normalizado] || nomeBanco;
}

/**
 * Verifica se dois nomes de bairro são equivalentes
 */
export function bairrosEquivalentes(nome1: string, nome2: string): boolean {
  return normalizarNomeBairro(nome1) === normalizarNomeBairro(nome2);
}
