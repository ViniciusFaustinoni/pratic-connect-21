

# Dashboard de Venda Externa + Fluxo de Antecipação (Fase 3)

## Resumo

Transformar a tela `/financeiro/venda-externa` de uma gestão individual (selecionar vendedor) em um **dashboard completo** com cards de resumo global, lista de todos os vendedores externos, modais de antecipação e pagamento em lote, e exportação PDF.

## Arquivos a Criar

### 1. `src/pages/financeiro/DashboardVendaExterna.tsx`
Página principal do dashboard com:
- **4 cards de resumo** (A pagar este mês / Antecipações em aberto / Débitos pendentes / Total pago no mês) — queries agregadas na `cc_vendedor_lancamentos`
- **Tabela de vendedores** com saldo, a pagar, antecipações, débitos, próxima parcela e ações (Ver extrato, Pagar, Antecipar)
- **Filtros**: busca por nome + filtro de situação (com saldo a pagar, devedor, antecipação, zerado)
- **Botão "Exportar relatório"** abrindo modal de exportação

### 2. `src/components/financeiro/AnteciparParcelasModal.tsx`
Modal de antecipação:
- Lista parcelas `pendente` do vendedor com checkboxes
- Mostra descrição, data prevista, valor, aviso de abatimento quando aplicável
- Rodapé com resumo (X parcelas, total R$)
- Ao confirmar: muda status de `pendente` → `antecipado`, lança crédito no extrato

### 3. `src/components/financeiro/PagamentoLoteModal.tsx`
Modal de pagamento em lote:
- Lista parcelas `a_pagar` do vendedor com checkboxes e "Selecionar todas"
- Exibe valor bruto, abatimento e valor líquido por parcela
- Campos: data do pagamento (date picker), observação
- Ao confirmar: muda status para `pago`, registra data/observação

### 4. `src/components/financeiro/ExportarRelatorioVendaExternaModal.tsx`
Modal de exportação PDF:
- Filtros: período (date picker), vendedor (todos ou específico)
- Gera PDF com jsPDF/autoTable: cabeçalho, resumo dos 4 cards no período, detalhamento por vendedor

## Arquivos a Modificar

### `src/hooks/useContaCorrenteVendedor.ts`
Adicionar:
- **`useDashboardVendaExterna()`** — novo hook ou queries extras:
  - Query agregada dos 4 cards globais (soma de todos vendedores)
  - Query da lista de vendedores com métricas individuais
- **Mutation `anteciparParcelas`**: recebe array de IDs, muda status para `antecipado`, gera créditos
- **Mutation `registrarPagamentoLote`**: recebe array de IDs + data + observação, muda para `pago`

### `src/App.tsx`
- Alterar rota `/financeiro/venda-externa` para apontar para `DashboardVendaExterna`
- Manter `/financeiro/venda-externa/:vendedorId` apontando para `GestaoContaVendedor`

### `src/components/layout/GlobalBreadcrumb.tsx`
- Atualizar breadcrumb para a nova página

## Lógica de Antecipação

Ao confirmar antecipação:
1. Para cada parcela selecionada, atualizar status de `pendente` → `antecipado`
2. O valor_liquido permanece o mesmo (crédito já existe como lançamento)
3. Quando o associado pagar a fatura correspondente (via `confirmarParcelaRecorrente`):
   - Status muda de `antecipado` → `pago`
   - Gera débito de liquidação de mesmo valor (saldo líquido zero)

## Lógica dos 4 Cards Globais

Queries diretas na `cc_vendedor_lancamentos`:
- **A pagar**: `SUM(valor_liquido) WHERE status='a_pagar' AND tipo='credito' AND mês corrente`
- **Antecipações**: `SUM(valor_liquido) WHERE status='antecipado' AND tipo='credito'`
- **Débitos pendentes**: `SUM(valor_liquido) WHERE categoria IN ('volante','estorno') AND status NOT IN ('pago','cancelado')`
- **Total pago**: `SUM(valor_liquido) WHERE status='pago' AND tipo='credito' AND mês corrente`

## Exportação PDF

Usa `jsPDF` + `autoTable` (já no projeto). Gera:
- Cabeçalho com período e data de geração
- Resumo geral (4 cards)
- Por vendedor: saldo inicial, lançamentos detalhados, saldo final, total pago

