

## Plan: Reorganize Quotation Form Fields

### Current Order
1. Dados do Associado (Nome, Telefone, Email, Indicação)
2. Data de Vencimento
3. Região
4. Uso do Veículo
5. Tipo de Placa
6. Consultor Responsável
7. Veículo (Placa, Tipo, Marca, Modelo, Ano)
8. Valor FIPE
9. Combustível
10. Alerta categoria
11. Cenário Vendedor Externo
12. Taxa de Filiação + alertas
13. Selecione o Plano
14. Valor Adicional
15. Resumo

### New Order

**Bloco 1 — Dados do associado** (stays in place)
- Nome, Telefone, Email, Indicação

**Bloco 2 — Veículo** (move up, merge Combustível and FIPE into this block)
- Busca por placa
- Tipo / Marca / Modelo / Ano (manual selection)
- Combustível
- Valor FIPE (with alerts)

**Bloco 3 — Condições do veículo** (new grouping)
- Região
- Uso do Veículo
- Tipo de Placa
- Alerta de categoria

**Bloco 4 — Plano** (regroup)
- Selecione o Plano
- Valor Adicional
- Cenário Vendedor Externo (when applicable)
- Taxa de Filiação + alertas

**Bloco 5 — Dados comerciais** (move to end)
- Consultor Responsável
- Data de Vencimento

**Resumo** (stays at end, before submit button)

### File Modified
- `src/components/cotacoes/CotacaoFormDialog.tsx` — reorder JSX blocks only, no logic changes

### What stays the same
- All state, queries, hooks, calculations, and submit logic
- All field components and their props
- The conditional rendering rules (e.g., Consultor only for leadership, Combustível visibility)

