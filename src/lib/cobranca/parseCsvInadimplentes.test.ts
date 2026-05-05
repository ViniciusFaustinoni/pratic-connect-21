import { describe, it, expect } from 'vitest';
import { parseCsvInadimplentes, classificarTelefone, montarBlocoBoletos } from './parseCsvInadimplentes';

describe('classificarTelefone', () => {
  it('aceita celular válido com 11 dígitos', () => {
    const r = classificarTelefone('(21)9644-26828');
    expect(r.valido).toBe(true);
    expect(r.formatado).toBe('5521964426828');
  });
  it('descarta fixo', () => {
    const r = classificarTelefone('(21)2643-3957');
    expect(r.valido).toBe(false);
  });
  it('descarta placeholder zerado', () => {
    expect(classificarTelefone('(00)0000-00000').valido).toBe(false);
  });
  it('descarta vazio', () => {
    expect(classificarTelefone('').valido).toBe(false);
  });
});

describe('parseCsvInadimplentes', () => {
  const csv = `Nome,Matrícula,Placas,Telefone Celular,Telefone,Data Vencimento,Data Vencimento Original,Codigo de Barras
JOAO SILVA,1001,ABC1234|9999,(21)98888-7777,(21)2222-3333,10/04/2024,10/04/2024,34191.09123 32079.130939 75008.900005 6 96820000018670
JOAO SILVA,1001,XYZ5678|9999,(21)98888-7777,(00)0000-00000,10/05/2024,10/05/2024,34191.09124 32079.130939 75008.900005 6 96820000018671
MARIA SOUZA,1002,DEF9876|8888,(11)97777-6666,(11)96666-5555,15/03/2024,15/03/2024,34191.09125 32079.130939 75008.900005 6 96820000018672`;

  it('agrupa boletos por matrícula', () => {
    const r = parseCsvInadimplentes(csv);
    expect(r.total_associados).toBe(2);
    expect(r.total_boletos).toBe(3);
    const joao = r.destinatarios.find((d) => d.matricula === '1001')!;
    expect(joao.boletos.length).toBe(2);
    expect(joao.telefones_validos).toEqual(['5521988887777']);
  });

  it('detecta dois celulares distintos', () => {
    const r = parseCsvInadimplentes(csv);
    const maria = r.destinatarios.find((d) => d.matricula === '1002')!;
    expect(maria.telefones_validos.length).toBe(2);
  });

  it('falha com cabeçalho inválido', () => {
    const r = parseCsvInadimplentes('foo,bar\n1,2');
    expect(r.erros.length).toBeGreaterThan(0);
  });
});

describe('montarBlocoBoletos', () => {
  it('formata lista', () => {
    const txt = montarBlocoBoletos([
      { placa: 'ABC1234', vencimento: '10/04/2024', linha_digitavel: '34191.09123', valor: 0 },
      { placa: 'XYZ5678', vencimento: '10/05/2024', linha_digitavel: '34191.09124', valor: 0 },
    ]);
    expect(txt).toContain('Placa ABC1234');
    expect(txt).toContain('venc. 10/04/2024');
    expect(txt.split('\n\n').length).toBe(2);
  });
});
