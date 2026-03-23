

# Plano: Busca por Associado + CSV por Beneficiário

## Arquivos a modificar

| Arquivo | Alteração |
|---|---|
| `src/pages/financeiro/GestaoContaVendedor.tsx` | Coluna "Associado" + campo de busca |
| `src/components/financeiro/ExportarRelatorioVendaExternaModal.tsx` | Botão "Exportar CSV" na aba beneficiário |

## Parte 1 — Busca por Associado

### Coluna "Associado"

Adicionar `<TableHead>Associado</TableHead>` após "Descrição" (linha 181). Na row, exibir `l.associado_nome || '—'`. Atualizar `colSpan` de 9 para 10 nas linhas de loading/empty.

### Campo de busca

Adicionar estado `buscaAssociado` e um `Input` com placeholder "Buscar por associado..." na barra de filtros (após o Select de status, linha 168).

Filtrar `lancamentos` no frontend antes de renderizar:

```ts
const lancamentosFiltrados = lancamentos.filter(l =>
  !buscaAssociado || (l.associado_nome || '').toLowerCase().includes(buscaAssociado.toLowerCase())
);
```

Usar `lancamentosFiltrados` no `.map()` da tabela em vez de `lancamentos`.

### Dado já disponível

O hook `useContaCorrenteVendedor` já faz join e retorna `associado_nome` no `CCLancamento` — nenhuma alteração no hook.

## Parte 2 — CSV por Beneficiário

### Função `handleExportarBeneficiarioCSV`

Reutilizar a mesma query já feita em `handleExportarBeneficiario` (linhas 72-100) para buscar lançamentos e vendedores.

Gerar CSV com:
- Header: `Vendedor;Data;Descrição;Tipo;Bruto;Abatimento;Líquido;Status`
- Uma linha por lançamento, agrupado por vendedor
- Linha de totais ao final
- BOM + separador `;`
- Arquivo: `comissoes-beneficiario-{dataInicio}-a-{dataFim}.csv`

### Botão

Na aba "Por beneficiário" (linha 510-516), adicionar botão "Exportar CSV" com ícone `FileSpreadsheet`, antes do botão PDF existente. Ambos compartilham o estado `loading`.

