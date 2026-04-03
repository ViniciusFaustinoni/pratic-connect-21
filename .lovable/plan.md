

# Fix: Veículo via API mostra "Associado Desconhecido"

## Causa Raiz

O problema **não é na API** — o veículo é vinculado corretamente ao associado pelo CPF. O problema está na **página de listagem de veículos** (`Veiculos.tsx`).

A página usa `useAssociados()` para montar um mapa de nomes, mas esse hook:
1. **Filtra por `origem_cadastro = 'interno'`** (linha 107) — associados criados via API têm `origem_cadastro = 'api_externa'`, então são excluídos
2. **Pagina com limite de 20** — mesmo se o filtro fosse removido, não traria todos

Resultado: `associadoMap.get(veiculo.associado_id)` retorna `undefined` → exibe "Desconhecido" (linha 446).

## Solução

Substituir a abordagem de carregar todos os associados separadamente. Em vez disso, fazer o join direto na query de veículos.

### 1. `src/hooks/useVeiculos.ts` — Incluir nome do associado na query

Na função `useVeiculos()`, alterar o `.select('*')` para incluir o join com associados:

```typescript
.select('*, associado:associados(id, nome, cpf)')
```

Isso retorna o nome do associado diretamente em cada veículo, sem depender de uma segunda query.

### 2. `src/pages/cadastro/Veiculos.tsx` — Usar dados do join

- Remover a importação e uso de `useAssociados` (não mais necessário para esta página)
- Remover a construção do `associadoMap`
- Na coluna "Associado" (linha 446), usar:
  ```
  veiculo.associado?.nome || 'Sem associado'
  ```
- Atualizar o filtro de busca para usar `veiculo.associado?.nome` em vez de `associadoMap.get()`

## Impacto
- 2 arquivos alterados
- 0 migrations
- Resolve o problema para associados de qualquer origem (interna, API, base antiga)
- Remove dependência desnecessária de `useAssociados` na página de veículos

