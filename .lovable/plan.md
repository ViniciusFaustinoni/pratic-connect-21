

## Plano: Garantir consistência dos filtros em todos os motores de cotação

### Análise — Quem busca preços de `tabelas_preco_mensalidade`

Existem **5 motores de cotação** que buscam preços. Analisei cada um:

| Motor | Arquivo | Usado por | Status |
|---|---|---|---|
| `usePlanosCotacao` | `src/hooks/usePlanosCotacao.ts` | Cotador, CotacaoFormDialog, Cotacao.tsx | ✅ Correto |
| `useCalcularCotacao` (público) | `src/hooks/useCalcularCotacao.ts` | CotacaoPublica, StepFinanceiro, StepBeneficios | ⚠️ 2 problemas |
| `useCalcularCotacao` (interno) | `src/hooks/useCotacao.ts` | useCriarCotacao | ✅ Correto |
| `usePlanosParaCotacao` | `src/hooks/useCotacaoAvancada.ts` | QuoteCalculatorModal | ⚠️ 2 problemas |
| `CalculadoraPreco` | `src/components/planos/CalculadoraPreco.tsx` | Calculadora pública | ✅ Correto |

### Problemas encontrados

#### 1. `useCalcularCotacao.ts` (público) — linhas 55-58 e 126

**a) Não filtra `visivel_gestao=true`**: A query busca TODOS os planos ativos, incluindo variantes internas (ex: "SELECT EXCLUSIVE APLICATIVO") que não deveriam aparecer.

**b) `isMotoLine` hardcoded**: Linha 126 usa `linhaPlano === 'advanced'` para detectar motos. Isso não cobre linhas futuras e pode causar conflito com a lógica de exclusão de aplicativos.

**Correções**:
- Adicionar `.eq('visivel_gestao', true)` na query de planos (linha 57)
- Substituir a detecção de moto por `mapping.tipo_uso !== 'particular' && mapping.tipo_uso !== 'aplicativo'` (já existe na linha 143, mas o filtro da 126/129 usa lógica diferente)

#### 2. `useCotacaoAvancada.ts` — linhas 92-93 e 158-161

**a) Não filtra `visivel_gestao=true`**: Mesma query sem filtro.

**b) Filtro de app/passeio obsoleto**: Linhas 158-161 filtram por `p.categoria === 'aplicativo' || p.codigo?.includes('aplicativo')`, que é o padrão antigo. Deveria usar `visivel_gestao=true` (que já exclui variantes internas) e deixar o motor de pricing resolver o preço app.

**Correções**:
- Adicionar `.eq('visivel_gestao', true)` na query (linha 93)
- Remover o filtro de app das linhas 158-161 — com `visivel_gestao=true`, só chegam planos principais; o preço app já é resolvido pelo motor `resolverPrecoApp`

### Arquivos a alterar

1. **`src/hooks/useCalcularCotacao.ts`**
   - Linha 57: adicionar `.eq('visivel_gestao', true)` na query de planos
   - Linhas 125-129: remover `isMotoLine` hardcoded e unificar com a lógica `isLinhaTipoUsoProprio` que já existe na linha 143

2. **`src/hooks/useCotacaoAvancada.ts`**
   - Linha 93: adicionar `.eq('visivel_gestao', true)` na query de planos
   - Linhas 158-161: remover filtro `isApp` obsoleto — com `visivel_gestao`, variantes internas já são excluídas; o filtro correto é deixar todos os planos visíveis passarem e o motor de pricing resolver o preço (app ou particular) com base no `mapping.tipo_uso`

### Resultado esperado

Todos os 5 motores de cotação passarão a:
1. Buscar apenas planos com `visivel_gestao=true` (sem variantes internas)
2. Usar `plano_preco_map.tipo_uso` para filtrar a faixa correta em `tabelas_preco_mensalidade`
3. Advanced mostra R$113,70 e Advanced+ mostra R$133,70 em todos os contextos
4. Especial Plus e Select Exclusive mostram seus preços corretos (migration já aplicada)

