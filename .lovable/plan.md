

# Corrigir Status de Pre-Analise: Remover `em_analise`

## Problema

O status `em_analise` foi incluido na lista de pre-analise, mas ele so deve existir APOS a conclusao da vistoria do regulador. Os status corretos de pre-vistoria sao apenas:

- `comunicado`
- `documentacao_pendente`
- `aguardando_vistoria`

## Alteracoes

### Arquivo 1: `src/pages/eventos/EventosPreAnalise.tsx`

- Remover `em_analise` do array `STATUS_PRE_ANALISE`
- Remover entrada `em_analise` de `STATUS_LABELS`
- Remover entrada `em_analise` de `STATUS_COLORS`

Array corrigido:
```
['comunicado', 'documentacao_pendente', 'aguardando_vistoria']
```

### Arquivo 2: `src/hooks/useEventosAnalise.ts`

- Na query `pendentesVistoria` (linha 60), remover `em_analise` do array de status:
```
.in('status', ['comunicado', 'documentacao_pendente', 'aguardando_vistoria'])
```

| Arquivo | Alteracao |
|---|---|
| `src/pages/eventos/EventosPreAnalise.tsx` | Remover `em_analise` dos arrays de status, labels e cores |
| `src/hooks/useEventosAnalise.ts` | Remover `em_analise` da query do contador `pendentesVistoria` |

