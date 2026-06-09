import { describe, expect, it } from 'vitest';
import { findModelEligibility, type VehicleContext } from '../useEntityEligibilityRules';

function makeRule(modelos: Array<{ marca?: string; modelo: string; status: string; cobertura_fipe?: number; ano_min?: number; ano_max?: number }>) {
  return { rule_config: { modelos } };
}

function ctx(partial: Partial<VehicleContext>): VehicleContext {
  return {
    valorFipe: 50000,
    anoVeiculo: 2020,
    ...partial,
  };
}

describe('findModelEligibility — tokenização canônica de marca/modelo', () => {
  it('casa T-CROSS (cadastro) com T-CROSS HIGHLINE (FIPE)', () => {
    const rule = makeRule([{ marca: 'VW', modelo: 'T-CROSS', status: 'aceito' }]);
    const result = findModelEligibility(rule, ctx({ marca: 'VW', modelo: 'T-CROSS HIGHLINE AE 2020' }));
    expect(result?.status).toBe('aceito');
  });

  it('casa T-CROSS com forma sem hífen "T CROSS"', () => {
    const rule = makeRule([{ marca: 'VW', modelo: 'T-CROSS', status: 'aceito' }]);
    const result = findModelEligibility(rule, ctx({ marca: 'VW', modelo: 'T CROSS COMFORT' }));
    expect(result?.status).toBe('aceito');
  });

  it('casa CRV (cadastro compacto) com CR-V (FIPE)', () => {
    const rule = makeRule([{ marca: 'HONDA', modelo: 'CRV', status: 'aceito' }]);
    const result = findModelEligibility(rule, ctx({ marca: 'HONDA', modelo: 'CR-V EXL 4WD' }));
    expect(result?.status).toBe('aceito');
  });

  it('casa HR-V (cadastro) com HRV (forma compacta)', () => {
    const rule = makeRule([{ marca: 'HONDA', modelo: 'HR-V', status: 'aceito' }]);
    const result = findModelEligibility(rule, ctx({ marca: 'HONDA', modelo: 'HRV EX' }));
    expect(result?.status).toBe('aceito');
  });

  it('casa C3 (cadastro) com C 3 PICASSO (FIPE)', () => {
    const rule = makeRule([{ marca: 'CITROEN', modelo: 'C3', status: 'aceito' }]);
    const result = findModelEligibility(rule, ctx({ marca: 'CITROEN', modelo: 'C 3 PICASSO 1.6' }));
    expect(result?.status).toBe('aceito');
  });

  it('casa HB20 (cadastro) com HB 20 1.0 (FIPE)', () => {
    const rule = makeRule([{ marca: 'HYUNDAI', modelo: 'HB20', status: 'aceito' }]);
    const result = findModelEligibility(rule, ctx({ marca: 'HYUNDAI', modelo: 'HB 20 1.0 COMFORT' }));
    expect(result?.status).toBe('aceito');
  });

  it('NÃO casa 208 com 2008 (preserva precisão por token)', () => {
    const rule = makeRule([{ marca: 'PEUGEOT', modelo: '208', status: 'aceito' }]);
    const result = findModelEligibility(rule, ctx({ marca: 'PEUGEOT', modelo: '2008 GRIFFE 1.6' }));
    expect(result).toBeNull();
  });

  it('NÃO casa GOL com GOLF', () => {
    const rule = makeRule([{ marca: 'VW', modelo: 'GOL', status: 'aceito' }]);
    const result = findModelEligibility(rule, ctx({ marca: 'VW', modelo: 'GOLF GTI' }));
    expect(result).toBeNull();
  });

  it('respeita modelos com pontuação ("1.6 16V") sem afrouxar', () => {
    const rule = makeRule([{ marca: 'VW', modelo: 'GOL 1.6', status: 'aceito' }]);
    const ok = findModelEligibility(rule, ctx({ marca: 'VW', modelo: 'GOL 1.6 TRENDLINE' }));
    const ko = findModelEligibility(rule, ctx({ marca: 'VW', modelo: 'GOL 1.0 TRENDLINE' }));
    expect(ok?.status).toBe('aceito');
    expect(ko).toBeNull();
  });

  it('wildcard TODOS casa com qualquer modelo (score 0)', () => {
    const rule = makeRule([{ marca: 'FIAT', modelo: 'TODOS', status: 'limitado' }]);
    const result = findModelEligibility(rule, ctx({ marca: 'FIAT', modelo: 'UNO MILLE' }));
    expect(result?.status).toBe('limitado');
  });

  it('entry mais específica ganha (score por nº de tokens)', () => {
    const rule = makeRule([
      { marca: 'VW', modelo: 'TODOS', status: 'limitado' },
      { marca: 'VW', modelo: 'T-CROSS HIGHLINE', status: 'aceito' },
    ]);
    const result = findModelEligibility(rule, ctx({ marca: 'VW', modelo: 'T-CROSS HIGHLINE AE 2020' }));
    expect(result?.status).toBe('aceito');
  });

  it('filtro de ano elimina entry mesmo casando modelo', () => {
    const rule = makeRule([{ marca: 'VW', modelo: 'GOL', status: 'aceito', ano_min: 2015 }]);
    const result = findModelEligibility(rule, ctx({ marca: 'VW', modelo: 'GOL TRENDLINE', anoVeiculo: 2010 }));
    expect(result).toBeNull();
  });
});
