// Gera o template .xlsx para importação de cobranças.
// Replica o formato exato do export Hinova/SGA "Inadimplentes" (incluindo a
// coluna `2ª Via Boleto` com tag <a href> HTML — o parser extrai a URL).
import * as XLSX from 'xlsx';

const HEADER = [
  'Data Cadastro Associado',
  'Matrícula',
  'Nome',
  'Telefone Celular',
  'Placas',
  'Data Vencimento',
  'Situação Pagamento',
  'Valor',
  'Codigo de Barras',
  '2ª Via Boleto',
];

const EXEMPLO = [
  '05/02/2026',
  '28838',
  'JOAO DA SILVA',
  '(11)9320-39812',
  'FWI5A35',
  '02/04/2026',
  'Não pago',
  'R$ 199,98',
  '34191.09743 49885.860939 75008.900005 3 14040000019998',
  '<a href="https://short.hinova.com.br/v2/HGt5C0NF.pdf" target="_blank">LINK</a>',
];

const INSTRUCOES: string[][] = [
  ['Como preencher o template (formato Hinova/SGA)'],
  [''],
  ['Obrigatórias: Nome, Matrícula.'],
  ['Demais colunas são opcionais — deixe em branco se não tiver.'],
  [''],
  ['Valor: aceita "R$ 199,98" ou "199,98". Sobrescreve o valor extraído da linha digitável.'],
  ['Codigo de Barras: linha digitável (47 dígitos) ou código de barras (44 dígitos).'],
  ['2ª Via Boleto: aceita URL crua (https://short.hinova.com.br/v2/XXXX.pdf) OU a tag HTML completa <a href="...">LINK</a> exatamente como vem do export Hinova.'],
  ['Telefone Celular: apenas celulares BR com 9º dígito são considerados para WhatsApp.'],
  ['Placas: pode conter várias placas separadas por quebra de linha (parser pega a 1ª válida).'],
  [''],
  ['O sistema agrupa boletos por Matrícula. Várias linhas com a mesma matrícula viram 1 disparo.'],
  ['O link da 2ª via é enviado no botão dinâmico do template Meta WhatsApp (template v2 quando habilitado).'],
];

export function baixarTemplateCobrancasXlsx(filename = 'template-cobrancas-hinova.xlsx') {
  const wb = XLSX.utils.book_new();

  const ws = XLSX.utils.aoa_to_sheet([HEADER, EXEMPLO]);
  ws['!cols'] = [
    { wch: 22 }, { wch: 12 }, { wch: 28 }, { wch: 18 }, { wch: 14 },
    { wch: 14 }, { wch: 18 }, { wch: 12 }, { wch: 48 }, { wch: 70 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Cobrancas');

  const wsInfo = XLSX.utils.aoa_to_sheet(INSTRUCOES);
  wsInfo['!cols'] = [{ wch: 110 }];
  XLSX.utils.book_append_sheet(wb, wsInfo, 'Instruções');

  XLSX.writeFile(wb, filename);
}
