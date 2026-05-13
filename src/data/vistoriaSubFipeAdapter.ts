// Adapter: converte VistoriaFotoConfig (config completa 31/15 do instalador)
// em FotoAutovistoria (consumido pelo AutovistoriaCotacao do link público).
// Usado no fluxo sub-FIPE (sem rastreador) onde o associado executa a vistoria
// completa ele mesmo.

import { getFotosByTipoVeiculo, type TipoVeiculo as TipoVeiculoCompleto, type VistoriaFotoConfig } from './vistoriaConfigCompleta';
import type { FotoAutovistoria } from './autovistoriaConfig';
import type { TipoVeiculo as TipoVeiculoAuto } from './autovistoriaConfig';

function tipoToCompleto(t: TipoVeiculoAuto): TipoVeiculoCompleto {
  return t === 'moto' ? 'moto' : 'automovel';
}

function adapt(foto: VistoriaFotoConfig): FotoAutovistoria {
  return {
    id: foto.id,
    label: foto.nome,
    descricao: foto.descricao,
    ordem: foto.ordem,
    instrucoes: foto.instrucoes ?? [],
    evitar: foto.evitar ?? [],
    dicaExtra: foto.dicaExtra,
  };
}

/**
 * Retorna a lista de fotos para autovistoria sub-FIPE, no shape consumido por
 * AutovistoriaCotacao. Exclui fotos exclusivas de instalação de rastreador
 * (categoria === 'instalacao' / 'rastreador' / id local_rastreador|codigo_rastreador|teste_comunicacao)
 * pois não há rastreador a fotografar.
 */
export function getFotosVistoriaSubFipe(tipo: TipoVeiculoAuto): FotoAutovistoria[] {
  const todas = getFotosByTipoVeiculo(tipoToCompleto(tipo));
  const idsExcluir = new Set(['local_rastreador', 'codigo_rastreador', 'teste_comunicacao']);
  return todas
    .filter((f) => f.categoria !== 'instalacao' && f.categoria !== 'rastreador' && !idsExcluir.has(f.id))
    .filter((f) => f.visivelCliente !== false)
    .sort((a, b) => a.ordem - b.ordem)
    .map(adapt);
}
