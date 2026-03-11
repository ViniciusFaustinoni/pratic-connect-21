

# Fix: Planos perderam conexão com condição do veículo

## Causa raiz

Linha 298 de `CotacaoFormDialog.tsx`:

```typescript
categoria: usoVeiculo === 'aplicativo' ? 'aplicativo' : (categoria || undefined),
```

Quando o uso é "aplicativo", o código **sobrescreve** a categoria real do veículo (ex: `chassi_remarcado`, `leilao`) com a string `'aplicativo'`. Isso faz com que:

1. O filtro `blocked_categories` no `usePlanosCotacao` nunca veja a condição real — planos que deveriam ser bloqueados para chassi remarcado continuam aparecendo
2. As exclusões de benefícios (`benefitExclusions`) não são aplicadas corretamente — coberturas que deveriam ser removidas continuam visíveis
3. O alerta de restrição de categoria não aparece

O campo `usoApp: usoVeiculo === 'aplicativo'` (linha 301) **já cuida** da filtragem por uso aplicativo separadamente. A categoria não precisa ser sobrescrita.

A página Cotador (`Cotador.tsx` linha 304) faz corretamente: passa `categoriaVeiculo` independente de `usoApp`.

## Correção

**Arquivo:** `src/components/cotacoes/CotacaoFormDialog.tsx`

**Linha 298** — Substituir:
```typescript
categoria: usoVeiculo === 'aplicativo' ? 'aplicativo' : (categoria || undefined),
```
Por:
```typescript
categoria: categoria && categoria !== 'nenhuma' ? categoria : undefined,
```

Isso garante que a condição real do veículo (chassi remarcado, leilão, etc.) seja sempre passada ao hook, independente do tipo de uso. O filtro de uso aplicativo continua funcionando via `usoApp` na linha 301.

Uma linha alterada, um arquivo afetado.

