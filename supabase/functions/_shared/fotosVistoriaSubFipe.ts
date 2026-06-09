// Fotos canônicas exigidas na autovistoria sub-FIPE (versão Deno do adapter
// `src/data/vistoriaSubFipeAdapter.ts`).
//
// Espelho dos arrays FOTOS_VISTORIA_COMPLETA_V2 (carro) e FOTOS_VISTORIA_MOTO_V2
// (moto) em `src/data/vistoriaConfigCompleta.ts`. Optionals separadas para o gate
// do servidor não bloquear quando o cliente legitimamente pular uma opcional.
//
// MANUTENÇÃO: se um id for adicionado/removido no front, atualizar aqui.
// O gate só roda para sub-FIPE (carro <30k / moto <9k, exceto Diesel).

export type TipoVeiculoSubFipe = 'carro' | 'moto';

const CARRO_OBRIGATORIAS = [
  'vistoriador_selfie',
  'chassi',
  'capo_aberto_placa',
  'motor',
  'bateria',
  'frente',
  'parabrisa',
  'frente_lateral_direita',
  'pneu_dianteiro_direito',
  'lateral_direita',
  'pneu_traseiro_direito',
  'traseira_lateral_direita',
  'traseira',
  'traseira_lateral_esquerda',
  'pneu_traseiro_esquerdo',
  'lateral_esquerda',
  'pneu_dianteiro_esquerdo',
  'frente_lateral_esquerda',
  'mala_aberta',
  'estepe',
  'chave_roda_macaco',
  'banco_motorista',
  'banco_passageiro',
  'banco_traseiro',
  'forracao_porta_dianteira_esquerda',
  'forracao_porta_traseira_esquerda',
  'forracao_porta_traseira_direita',
  'forracao_porta_dianteira_direita',
  'painel_completo',
  'odometro',
] as const;

const CARRO_OPCIONAIS = ['chave'] as const;

const MOTO_OBRIGATORIAS = [
  'vistoriador_selfie',
  'chassi',
  'frente',
  'farol',
  'lateral_direita',
  'motor_direito',
  'traseira',
  'lateral_esquerda',
  'motor_esquerdo',
  'painel_odometro_ligado',
] as const;

const MOTO_OPCIONAIS = [
  'chave',
  'sola_pneu_dianteiro',
  'sola_pneu_traseiro',
  'banco',
  'bateria_validade',
  'avarias',
] as const;

const VIDEO_TIPO = 'video_360';

// Via 2 (Roubo & Furto pelo celular) — autovistoria enxuta:
// chassi + motor + vídeo 360°. Mesma exigência da autovistoria opcional
// acima-FIPE (ver `EtapaVistoria.tsx` quando viaSubFipe='rf_celular'
// chama `AutovistoriaCotacao` SEM `fotosOverride`).
const RF_OBRIGATORIAS_CARRO = ['chassi', 'motor'] as const;
const RF_OBRIGATORIAS_MOTO = ['chassi', 'motor_direito'] as const;

export interface AutovistoriaCompletudeInput {
  tipo: TipoVeiculoSubFipe;
  fotosEnviadas: string[]; // lista de `tipo` em cotacoes_vistoria_fotos
}

export interface AutovistoriaCompletudeResultado {
  ok: boolean;
  obrigatoriasFaltantes: string[];
  videoFaltante: boolean;
  esperadasMin: number; // só obrigatórias + vídeo
  recebidas: number;
}

export function obrigatoriasParaTipo(tipo: TipoVeiculoSubFipe): readonly string[] {
  return tipo === 'moto' ? MOTO_OBRIGATORIAS : CARRO_OBRIGATORIAS;
}

export function obrigatoriasParaTipoRF(tipo: TipoVeiculoSubFipe): readonly string[] {
  return tipo === 'moto' ? RF_OBRIGATORIAS_MOTO : RF_OBRIGATORIAS_CARRO;
}

export function checarCompletudeAutovistoriaSubFipe(
  input: AutovistoriaCompletudeInput,
): AutovistoriaCompletudeResultado {
  const enviadas = new Set(input.fotosEnviadas);
  const obrig = obrigatoriasParaTipo(input.tipo);
  const obrigatoriasFaltantes = obrig.filter((id) => !enviadas.has(id));
  // Vídeo aceita 'video_360' OU 'video' (legado em finalizar-autovistoria).
  const videoFaltante = !enviadas.has(VIDEO_TIPO) && !enviadas.has('video');
  return {
    ok: obrigatoriasFaltantes.length === 0 && !videoFaltante,
    obrigatoriasFaltantes,
    videoFaltante,
    esperadasMin: obrig.length + 1,
    recebidas: input.fotosEnviadas.length,
  };
}

// Via 2 (R&F pelo celular): apenas chassi + motor + vídeo 360°.
export function checarCompletudeAutovistoriaSubFipeRF(
  input: AutovistoriaCompletudeInput,
): AutovistoriaCompletudeResultado {
  const enviadas = new Set(input.fotosEnviadas);
  const obrig = obrigatoriasParaTipoRF(input.tipo);
  const obrigatoriasFaltantes = obrig.filter((id) => !enviadas.has(id));
  const videoFaltante = !enviadas.has(VIDEO_TIPO) && !enviadas.has('video');
  return {
    ok: obrigatoriasFaltantes.length === 0 && !videoFaltante,
    obrigatoriasFaltantes,
    videoFaltante,
    esperadasMin: obrig.length + 1,
    recebidas: input.fotosEnviadas.length,
  };
}

