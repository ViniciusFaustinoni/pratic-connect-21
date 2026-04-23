import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ReciboComissaoItem {
  id: string;
  pagamento_id?: string | null;
  data_pagamento?: string | null;
  destinatario_nome?: string | null;
  destinatario_email?: string | null;
  mes_referencia?: number | null;
  ano_referencia?: number | null;
  contrato?: string | null;
  cobranca?: string | null;
  plano?: string | null;
  grade?: string | null;
  parcela?: number | null;
  perfil?: string | null;
  valor_base?: number | null;
  tipo_calculo?: string | null;
  percentual_aplicado?: number | null;
  regra_valor?: number | null;
  valor_pago?: number | null;
}

const money = (value: number | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

const date = (value?: string | null) => (value ? new Date(value).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'));

const regra = (item: ReciboComissaoItem) => {
  if (item.tipo_calculo === 'valor_fixo') return money(item.regra_valor ?? item.valor_pago);
  return `${Number(item.percentual_aplicado || item.regra_valor || 0).toFixed(2)}%`;
};

export function baixarReciboComissao(item: ReciboComissaoItem) {
  const doc = new jsPDF();
  const pagamentoId = item.pagamento_id || item.id;
  const valorTotal = Number(item.valor_pago || 0);

  doc.setFontSize(16);
  doc.text('Recibo de Pagamento de Comissão', 14, 18);
  doc.setFontSize(10);
  doc.text(`Recibo: ${pagamentoId}`, 14, 28);
  doc.text(`Data do pagamento: ${date(item.data_pagamento)}`, 14, 34);

  autoTable(doc, {
    startY: 44,
    head: [['Campo', 'Informação']],
    body: [
      ['Destinatário', item.destinatario_nome || '—'],
      ['E-mail', item.destinatario_email || '—'],
      ['Período de referência', item.mes_referencia && item.ano_referencia ? `${item.mes_referencia}/${item.ano_referencia}` : '—'],
      ['Quantidade de comissões', '1'],
      ['Valor total pago', money(valorTotal)],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 41, 59] },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 10,
    head: [['Comissão', 'Contrato/Cobrança', 'Plano', 'Grade', 'Parcela', 'Perfil', 'Base', 'Regra', 'Valor pago']],
    body: [[
      item.id,
      item.contrato || item.cobranca || '—',
      item.plano || '—',
      item.grade || '—',
      item.parcela ? `${item.parcela}ª` : '—',
      item.perfil || '—',
      money(item.valor_base),
      regra(item),
      money(valorTotal),
    ]],
    styles: { fontSize: 8, cellWidth: 'wrap' },
    headStyles: { fillColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 24 },
      2: { cellWidth: 24 },
      3: { cellWidth: 24 },
      4: { cellWidth: 14 },
      5: { cellWidth: 22 },
      6: { cellWidth: 18 },
      7: { cellWidth: 16 },
      8: { cellWidth: 20 },
    },
  });

  doc.setFontSize(8);
  doc.text('Documento gerado eletronicamente pelo sistema PraticCar.', 14, 286);
  doc.save(`recibo-comissao-${pagamentoId}.pdf`);
}