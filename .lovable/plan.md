

# Plano: Corrigir exibição de todos os planos na Gestão de Planos

## Problema identificado

Os planos **SELECT ONE** e **SELECT ONE APLICATIVO** estão com `product_line_id` apontando para "Linha Select" (`84a6db47`) em vez de "Linha Select One" (`db8f751d`). Por isso:
- A aba "Linha Select" mostra 6 planos (4 corretos + 2 Select One misturados)
- A aba "Linha Select One" mostra 0 planos (vazia)

O código da `PlanosTab.tsx` já filtra corretamente por `product_line_id` — o problema é **100% nos dados**.

## Estado atual do banco

| Plano | product_line_id atual | Deveria ser |
|---|---|---|
| SELECT ONE | `84a6db47` (Linha Select) | `db8f751d` (Linha Select One) |
| SELECT ONE APLICATIVO | `84a6db47` (Linha Select) | `db8f751d` (Linha Select One) |
| ESPECIAL PLUS | `d3b5675b` (Linha Especial) | OK — mantém sob Especial |
| Demais 12 planos | Corretos | Corretos |

## Correção

Uma única operação SQL (UPDATE de dados, não de schema):

```sql
UPDATE planos 
SET product_line_id = 'db8f751d-b75c-4efd-9c39-28803dbfd09e'
WHERE id IN (
  '20c3685f-2909-4ca3-be04-f0f116a7c0cd',
  'ba180738-4b11-4d7e-8ed0-7f73df3e5155'
);
```

## Resultado esperado

Após a correção, cada aba da Gestão de Planos mostrará:
- **Linha Select**: 4 planos (BASIC, EXCLUSIVE, EXCLUSIVE APLICATIVO, PREMIUM)
- **Linha Select One**: 2 planos (SELECT ONE, SELECT ONE APLICATIVO)
- **Linha Especial**: 2 planos (ESPECIAL, ESPECIAL PLUS)
- **Linha Lançamento**: 4 planos (BASIC, EXCLUSIVE, EXCLUSIVE APLICATIVO, PREMIUM)
- **Linha Advanced**: 2 planos (ADVANCED, ADVANCED+)

**Total: 14 planos ativos visíveis, cada um na linha correta.**

Nenhuma alteração de código é necessária.

