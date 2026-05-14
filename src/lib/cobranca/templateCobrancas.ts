// Gera o template .xlsx para importação de cobranças.
// Ordem das colunas reflete o que o parser aceita (parseCsvInadimplentes).
import * as XLSX from 'xlsx';

const HEADER = [
  'Nome',
  'Matrícula',
  'CPF',
  'Placas',
  'Telefone Celular',
  'Telefone',
  'Data Vencimento',
  'Codigo de Barras',
  'Valor',
  'Link',
  'Tipo',
  'Status',
];

const EXEMPLO = [
  'JOAO DA SILVA',
  '12345',
  '123.456.789-00',
  'ABC1D23',
  '(21) 99999-9999',
  '(21) 3333-4444',
  '10/06/2026',
  '34191.09008 12345.678901 23456.789012 3 98760000018990',
  '189,90',
  'https://hinova.com.br/fatura/abcdef',
  'mensalidade',
  'inadimplente',
];

const INSTRUCOES: string[][] = [
  ['Como preencher o template'],
  [''],
  ['Obrigatórias: Nome, Matrícula.'],
  ['Demais colunas são opcionais — deixe em branco se não tiver.'],
  [''],
  ['Valor: aceita formato pt-BR ("189,90"). Se vier preenchido, sobrescreve o valor extraído da linha digitável.'],
  ['Link: URL da 2ª via Hinova (ex.: https://...). Será disponibilizada no disparo Meta.'],
  ['Codigo de Barras: linha digitável (47 dígitos) ou código de barras (44 dígitos).'],
  ['Telefone Celular: apenas celulares com DDI/DDD válidos são considerados para WhatsApp.'],
  ['Tipo: mensalidade | taxa | adesao | outros (livre).'],
  ['Status: adimplente | inadimplente | pago | pendente (livre, apenas registro).'],
  [''],
  ['O sistema agrupa boletos por Matrícula. Várias linhas com a mesma matrícula viram 1 disparo.'],
];

export function baixarTemplateCobrancasXlsx(filename = 'template-cobrancas.xlsx') {
  const wb = XLSX.utils.book_new();

  const ws = XLSX.utils.aoa_to_sheet([HEADER, EXEMPLO]);
  // Larguras razoáveis
  ws['!cols'] = [
    { wch: 28 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 16 },
    { wch: 14 }, { wch: 48 }, { wch: 12 }, { wch: 38 }, { wch: 14 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Cobrancas');

  const wsInfo = XLSX.utils.aoa_to_sheet(INSTRUCOES);
  wsInfo['!cols'] = [{ wch: 100 }];
  XLSX.utils.book_append_sheet(wb, wsInfo, 'Instruções');

  XLSX.writeFile(wb, filename);
}
