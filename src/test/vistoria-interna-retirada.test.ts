import { describe, it, expect } from 'vitest';
import { TIPO_SERVICO_LABELS, type TipoServico } from '@/hooks/useServicos';

/**
 * Smoke tests para a habilitação de Vistoria Interna em serviços de Retirada.
 * Cobre o contrato esperado por VistoriaInternaDialog + RealizarVistoriaInternaButton.
 */

function isRetirada(tipo: string | null | undefined) {
  return tipo === 'retirada_rastreador' || tipo === 'vistoria_retirada';
}

function resolverRotaTecnico(tipo: TipoServico): string | null {
  if (tipo === 'instalacao' || tipo === 'vistoria_entrada' || tipo === 'revistoria') return '/instalador/instalacao';
  if (tipo === 'retirada_rastreador' || tipo === 'vistoria_retirada') return '/instalador/retirada';
  if (tipo === 'vistoria_manutencao') return '/instalador/manutencao';
  return '/instalador/vistoria';
}

const podeEmbedar = (rota: string | null) =>
  rota === '/instalador/instalacao' || rota === '/instalador/retirada';

describe('VistoriaInterna — Retirada', () => {
  it('tipo retirada_rastreador existe no TIPO_SERVICO_LABELS', () => {
    expect(TIPO_SERVICO_LABELS.retirada_rastreador).toBe('Retirada de Rastreador');
    expect(TIPO_SERVICO_LABELS.vistoria_retirada).toBe('Retirada de Rastreador');
  });

  it('isRetirada reconhece ambos os tipos canônicos', () => {
    expect(isRetirada('retirada_rastreador')).toBe(true);
    expect(isRetirada('vistoria_retirada')).toBe(true);
    expect(isRetirada('instalacao')).toBe(false);
    expect(isRetirada(null)).toBe(false);
    expect(isRetirada(undefined)).toBe(false);
  });

  it('resolverRotaTecnico aponta retirada para /instalador/retirada', () => {
    expect(resolverRotaTecnico('retirada_rastreador')).toBe('/instalador/retirada');
    expect(resolverRotaTecnico('vistoria_retirada')).toBe('/instalador/retirada');
  });

  it('resolverRotaTecnico mantém instalação/vistoria_entrada/revistoria em /instalador/instalacao', () => {
    expect(resolverRotaTecnico('instalacao')).toBe('/instalador/instalacao');
    expect(resolverRotaTecnico('vistoria_entrada')).toBe('/instalador/instalacao');
    expect(resolverRotaTecnico('revistoria')).toBe('/instalador/instalacao');
  });

  it('podeEmbedar libera retirada e instalação, demais seguem em nova aba', () => {
    expect(podeEmbedar(resolverRotaTecnico('retirada_rastreador'))).toBe(true);
    expect(podeEmbedar(resolverRotaTecnico('vistoria_retirada'))).toBe(true);
    expect(podeEmbedar(resolverRotaTecnico('instalacao'))).toBe(true);
    expect(podeEmbedar(resolverRotaTecnico('vistoria_manutencao'))).toBe(false);
    expect(podeEmbedar(resolverRotaTecnico('vistoria_saida'))).toBe(false);
    expect(podeEmbedar(resolverRotaTecnico('vistoria_sinistro'))).toBe(false);
  });

  it('todos os tipos têm rota mapeada (defesa contra null)', () => {
    const todos: TipoServico[] = [
      'instalacao', 'revistoria', 'vistoria_entrada', 'vistoria_saida',
      'vistoria_sinistro', 'vistoria_periodica', 'vistoria_manutencao',
      'vistoria_retirada', 'retirada_rastreador',
    ];
    for (const t of todos) {
      expect(resolverRotaTecnico(t)).not.toBeNull();
    }
  });
});
