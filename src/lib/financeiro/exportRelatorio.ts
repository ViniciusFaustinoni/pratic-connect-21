import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { RelatorioCustosReceitas } from '@/hooks/useRelatorioCustosReceitas';

const fmt = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function exportarCustosReceitasPDF(d: RelatorioCustosReceitas, periodo: string) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text('Relatório de Custos e Receitas', 14, 18);
  doc.setFontSize(11);
  doc.setTextColor(110);
  doc.text(`Período: ${periodo}`, 14, 25);
  doc.setTextColor(0);

  // Resumo
  autoTable(doc, {
    startY: 32,
    head: [['Indicador', 'Valor']],
    body: [
      ['Receita total', fmt(d.receita)],
      ['Despesas (sem sócios)', fmt(d.despesaSemSocios)],
      ['Lucro', fmt(d.lucro)],
      ['Retiradas de sócios', fmt(d.despesaSocios)],
      ['Caixa real (após sócios)', fmt(d.caixaReal)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [99, 102, 241] },
  });

  // Receita por categoria
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 8,
    head: [['Composição da receita', 'Valor']],
    body: d.receitaPorCategoria.map((r) => [r.nome, fmt(r.valor)]),
    theme: 'striped',
    headStyles: { fillColor: [22, 163, 74] },
  });

  // Despesas por grupo
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 8,
    head: [['Despesas por grupo', 'Valor', '%']],
    body: d.gruposDespesa.map((g) => [
      `${g.codigo !== '—' ? g.codigo + ' · ' : ''}${g.nome}`,
      fmt(g.valor),
      `${g.pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`,
    ]),
    theme: 'striped',
    headStyles: { fillColor: [220, 38, 38] },
  });

  if (d.sociosItens.length > 0) {
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      head: [['Retiradas de sócios (fora do custo)', 'Valor']],
      body: d.sociosItens.map((s) => [`${s.codigo} · ${s.nome}`, fmt(s.valor)]),
      theme: 'plain',
    });
  }

  doc.save(`custos-receitas-${periodo}.pdf`);
}

export function exportarCustosReceitasXlsx(d: RelatorioCustosReceitas, periodo: string) {
  const linhas: (string | number)[][] = [
    [`Relatório de Custos e Receitas — ${periodo}`],
    [],
    ['Indicador', 'Valor'],
    ['Receita total', d.receita],
    ['Despesas (sem sócios)', d.despesaSemSocios],
    ['Lucro', d.lucro],
    ['Retiradas de sócios', d.despesaSocios],
    ['Caixa real (após sócios)', d.caixaReal],
    [],
    ['Composição da receita', 'Valor'],
    ...d.receitaPorCategoria.map((r) => [r.nome, r.valor]),
    [],
    ['Despesas por grupo', 'Valor', '%'],
    ...d.gruposDespesa.map((g) => [
      `${g.codigo !== '—' ? g.codigo + ' · ' : ''}${g.nome}`, g.valor,
      Number(g.pct.toFixed(1)),
    ]),
    [],
    ['Retiradas de sócios (fora do custo)', 'Valor'],
    ...d.sociosItens.map((s) => [`${s.codigo} · ${s.nome}`, s.valor]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(linhas);
  ws['!cols'] = [{ wch: 40 }, { wch: 18 }, { wch: 10 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Custos e Receitas');
  XLSX.writeFile(wb, `custos-receitas-${periodo}.xlsx`);
}
