

# Plano: Corrigir navegação de Substituição no módulo de Vendas

## Problema

Em `src/components/vendas/OutrasEntradasMenu.tsx` (linha 244), ao clicar em "Substituição de Placa", o sistema navega para:

```
/cadastro/associados/:id/substituicao
```

Isso leva o vendedor para a área de Cadastro, onde ele pode não ter permissão. A rota correta para o contexto de vendas já existe: `/vendas/substituicao/:associadoId`.

## Correção

**Arquivo**: `src/components/vendas/OutrasEntradasMenu.tsx`

Linha 244 — trocar:
```ts
navigate(`/cadastro/associados/${selectedAssociadoId}/substituicao`);
```
por:
```ts
navigate(`/vendas/substituicao/${selectedAssociadoId}`);
```

Uma única linha. Nenhum outro arquivo precisa ser alterado.

