import { describe, it, expect } from 'vitest';
import { shouldBypassPlateGuards } from './plateGuardBypass';

describe('shouldBypassPlateGuards (travas placa duplicada / SGA / base local)', () => {
  it('BYPASSA as três travas quando origemTroca está presente (objeto)', () => {
    expect(shouldBypassPlateGuards({ solicitacaoId: 'abc', placa: 'KOU6D37' })).toBe(true);
  });

  it('BYPASSA quando origemTroca é uma string truthy', () => {
    expect(shouldBypassPlateGuards('troca-123')).toBe(true);
  });

  it('NÃO bypassa em fluxo de cotação normal (origemTroca undefined)', () => {
    expect(shouldBypassPlateGuards(undefined)).toBe(false);
  });

  it('NÃO bypassa em fluxo de cotação normal (origemTroca null)', () => {
    expect(shouldBypassPlateGuards(null)).toBe(false);
  });

  it('NÃO bypassa quando origemTroca é falso explicitamente', () => {
    expect(shouldBypassPlateGuards(false)).toBe(false);
  });

  it('NÃO bypassa em fluxos paralelos (inclusão, substituição) — qualquer valor falsy', () => {
    // Inclusão de veículo / substituição NÃO setam origemTroca,
    // portanto o cotador recebe undefined e as travas continuam ativas.
    expect(shouldBypassPlateGuards(0)).toBe(false);
    expect(shouldBypassPlateGuards('')).toBe(false);
  });
});
