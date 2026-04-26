import { useBuscaSGA } from './useBuscaSGA';

export interface VeiculoAtivoCpfResult {
  /** codigo_associado SGA (numérico). Mantido como string para compat. */
  associado_id: string;
  associado_nome: string;
  /** codigo_veiculo SGA (numérico). Mantido como string para compat. */
  veiculo_id: string;
  veiculo_placa: string;
  veiculo_modelo: string;
  veiculo_marca: string;
  /** Indica que a origem é o SGA (Hinova) e não a base local */
  origem_sga: true;
}

/**
 * Verifica via API SGA (Hinova) se um CPF já possui veículo na base.
 * Usado pela etapa de cotação para detectar inclusão/substituição/troca.
 */
export function useVerificarVeiculoAtivoCpf(cpf: string | undefined) {
  const cpfLimpo = (cpf || '').replace(/\D/g, '');
  const sga = useBuscaSGA({ cpf: cpfLimpo, enabled: cpfLimpo.length === 11 });

  let result: VeiculoAtivoCpfResult | null = null;
  if (sga.data?.encontrado && sga.data.veiculos.length > 0) {
    const v = sga.data.veiculos[0];
    result = {
      associado_id: String(sga.data.codigo_associado),
      associado_nome: sga.data.associado?.nome || '',
      veiculo_id: String(v.codigo_veiculo),
      veiculo_placa: v.placa || '',
      veiculo_modelo: v.modelo || '',
      veiculo_marca: v.marca || '',
      origem_sga: true,
    };
  }

  return {
    ...sga,
    data: result,
    /** Acesso ao payload completo (boletos, saldo) */
    sga: sga.data,
  };
}
