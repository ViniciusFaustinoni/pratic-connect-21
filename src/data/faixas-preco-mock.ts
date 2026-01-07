/**
 * Função mock para consulta FIPE
 * Será substituída por Edge Function com API real
 */
export function consultarFipeMock(marca: string, modelo: string, ano: number): number {
  let valor = 30000;

  const ajusteMarca: Record<string, number> = {
    Toyota: 1.3,
    Honda: 1.25,
    Hyundai: 1.15,
    Volkswagen: 1.1,
    Chevrolet: 1.05,
    Fiat: 1.0,
    Renault: 0.95,
    Nissan: 1.1,
    Jeep: 1.4,
    Ford: 1.0,
  };

  valor *= ajusteMarca[marca] || 1.0;

  const anoAtual = new Date().getFullYear();
  const idadeVeiculo = anoAtual - ano;
  valor *= Math.max(0.5, 1 - idadeVeiculo * 0.07);

  return Math.round(valor / 100) * 100;
}
