

# Fix: Planos de Passeio Aparecendo para Uso Aplicativo

## Problema Identificado

Quando o consultor marca "Uso para Aplicativo", **todos os planos** continuam aparecendo — incluindo ESPECIAL e ESPECIAL PLUS, que são exclusivamente para uso particular (passeio). Isso acontece porque:

1. O filtro em `usePlanosCotacao.ts` (linha 244) remove apenas variantes internas com `tipo_uso = 'aplicativo'` (ex: "SELECT EXCLUSIVE APLICATIVO")
2. **Não existe nenhum filtro que verifique se um plano/linha suporta uso de aplicativo** quando `usoApp = true`
3. A linha `especial` não tem `blocked_categories` configuradas e o código na linha 265 **pula** a verificação para `categoria === 'aplicativo'`
4. O `resolverPrecoApp` simplesmente retorna o valor de "particular" para linhas sem suporte app (especial, eletrico), fazendo o plano aparecer com preço errado

### Linhas que suportam App (têm precificação diferenciada):
- `select` (RJ/Lagos: particular + adicional_app)
- `select-one` (coluna própria na tabela de preços)
- `lancamento` (RJ/Lagos: particular + adicional_app)

### Linhas que NÃO suportam App:
- `especial` / `especial-plus` — apenas passeio
- `eletrico` — apenas passeio
- `advanced` / `advanced-plus` — motos (já filtradas por vehicle_type)

## Solução

### 1. Adicionar coluna `supports_app` na tabela `product_lines`

Coluna booleana indicando se a linha aceita uso de aplicativo. Valores:
- `true`: select, select-one, lancamento
- `false`: especial, eletrico, advanced

### 2. Filtrar no hook `usePlanosCotacao.ts`

Após os filtros existentes (linha ~268), adicionar:

```typescript
// Filtrar linhas que não suportam uso de aplicativo
if (params.usoApp && plProductLine?.supports_app === false) {
  continue;
}
```

### 3. Carregar o novo campo na query

Adicionar `supports_app` ao select da query de `product_lines` (linha 104).

## Arquivos alterados

- **Migration SQL**: Adicionar coluna `supports_app` boolean default `false` + UPDATE para setar `true` em select, select-one, lancamento
- **`src/hooks/usePlanosCotacao.ts`**: Adicionar `supports_app` ao select e filtro no loop de planos

