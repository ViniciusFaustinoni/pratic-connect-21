

# Auditoria PARTE 2 — Benefícios Adicionais: Estado Atual vs Requisitos

## O que JÁ funciona

| Requisito | Status | Detalhes |
|-----------|--------|---------|
| CRUD de benefícios adicionais pelo Diretor | **OK** | `BeneficiosAdicionaisConfig.tsx` — nome, código, descrição, preço, categoria, ativo, ordem |
| Linhas de plano permitidas por benefício | **OK** | Campo `linhas_permitidas` (array de slugs) no banco e no form |
| Filtragem por linha na cotação pública (substituição) | **OK** | `useBeneficiosSeparados(productLineSlug)` filtra corretamente |
| Preço por região (diferenciado) | **OK** | Tabela `beneficios_regioes` com `preco_regional` |
| Contagem de associados por benefício | **OK** | Query na config page conta `associados_beneficios_adicionais` ativos |
| Alerta de impacto ao editar preço | **OK** | "Alteração vale apenas para novos contratos" |
| Inclusão de adicionais na fatura mensal | **OK** | `gerar-faturas-mensais` busca `associados_beneficios_adicionais` e soma ao total |

## Gaps identificados

### GAP 1 (CRÍTICO) — Formato incompatível entre cotação e contrato

A cotação salva `adicionais_selecionados` como **array de strings** (apenas IDs):
```text
// QuoteCalculatorModal.tsx → useCotacaoAvancada → salvarCotacao
adicionaisSelecionados: ["uuid-1", "uuid-2"]  // string[]
```

Mas `contrato-gerar` espera **array de objetos** com `id` e `preco`:
```text
// contrato-gerar/index.ts linha 649-653
beneficio_adicional_id: adicional.id || adicional.beneficio_id  // undefined em string
valor_contratado: adicional.preco || adicional.valor || 0       // undefined → 0
```

**Resultado**: Quando um contrato é gerado a partir de uma cotação com adicionais selecionados, os registros em `associados_beneficios_adicionais` são criados com `beneficio_adicional_id = null` (filtrado pelo `.filter`) ou `valor_contratado = 0`. Na prática, **nenhum adicional é propagado ao associado**. Confirmado: a tabela `associados_beneficios_adicionais` tem **0 registros**.

### GAP 2 — Adicionais não filtrados por linha na cotação do consultor

`useAdicionaisDisponiveis()` (usado no `QuoteCalculatorModal`) busca TODOS os adicionais ativos sem filtrar por `linhas_permitidas`. O consultor vê adicionais que não são compatíveis com o plano selecionado.

Em contraste, `useBeneficiosSeparados(productLineSlug)` (usado na substituição) **já filtra** corretamente.

### GAP 3 — Preço regional não utilizado na cotação

O sistema suporta preços regionais (`beneficios_regioes`), mas nem `useAdicionaisDisponiveis` nem `calcularCotacaoDinamica` consultam a região do cliente para usar o `preco_regional` em vez do `preco` base.

## Proposta de implementação

### Correção 1 — Formato dos adicionais na cotação (prioridade crítica)

Alterar `useCotacaoAvancada.ts` para salvar `adicionais_selecionados` como array de objetos:
```typescript
// Antes: adicionaisSelecionados: ["uuid-1", "uuid-2"]
// Depois:
adicionaisSelecionados: [
  { id: "uuid-1", codigo: "VIDROS_FAROIS", nome: "Vidros e Faróis", preco: 9.90 },
  { id: "uuid-2", codigo: "KIT_GAS", nome: "Kit Gás", preco: 9.90 }
]
```

Atualizar `QuoteCalculatorModal.tsx` para montar os objetos completos antes de passar ao hook. Isso garante que `contrato-gerar` recebe os dados no formato esperado.

### Correção 2 — Filtrar adicionais por linha do plano (prioridade alta)

Alterar `useAdicionaisDisponiveis()` para aceitar um parâmetro `linhaSlug` e filtrar por `linhas_permitidas` (mesma lógica de `useBeneficiosSeparados`). Atualizar `QuoteCalculatorModal` para passar o slug da linha do plano selecionado.

### Correção 3 — Preço regional na cotação (prioridade média)

Alterar `useAdicionaisDisponiveis` para incluir `beneficios_regioes` no select. Na `calcularCotacaoDinamica`, usar `preco_regional` quando a região do cliente tiver preço diferenciado.

### Arquivos modificados

- `src/hooks/useCotacaoAvancada.ts` — formato do campo `adicionaisSelecionados` (objetos em vez de IDs)
- `src/components/vendas/QuoteCalculatorModal.tsx` — montar objetos completos + passar `linhaSlug` ao hook
- `src/hooks/useCotacaoAvancada.ts` (`useAdicionaisDisponiveis`) — filtrar por `linhas_permitidas`

