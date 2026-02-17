

# Corrigir Sinistros Nao Aparecendo para o Analista de Eventos

## Causa Raiz

Os logs do banco mostram o erro:
```
invalid input value for enum status_sinistro: "pecas_em_cotacao"
```

No arquivo `SinistrosList.tsx`, as queries do analista de eventos incluem status inexistentes no enum `status_sinistro`:
- `pecas_em_cotacao` (nao existe)
- `pronto_para_oficina` (nao existe)
- `pagamento_confirmado` (nao existe)

Como o filtro `.in()` recebe valores invalidos, o Supabase retorna erro e **nenhum sinistro e exibido** -- mesmo os que possuem status validos como `aguardando_analise`.

## Correcao

### Arquivo: `src/pages/eventos/SinistrosList.tsx`

Remover os 3 status invalidos das duas listas de filtro do analista (query principal na linha 137 e contadores na linha 170):

**Antes:**
```typescript
query = query.in('status', [
  'aguardando_analise', 'aprovado', 'negado', 'reprovado',
  'em_reparo', 'em_recuperacao', 'aguardando_pagamento',
  'pago', 'encerrado', 'cancelado',
  'em_sindicancia', 'aguardando_diretoria',
  'pecas_em_cotacao', 'pronto_para_oficina', 'pagamento_confirmado'
]);
```

**Depois:**
```typescript
query = query.in('status', [
  'aguardando_analise', 'aprovado', 'negado', 'reprovado',
  'em_reparo', 'em_recuperacao', 'aguardando_pagamento',
  'pago', 'encerrado', 'cancelado'
]);
```

Essa mesma correcao sera aplicada nos dois locais do arquivo (query principal e query de contadores).

