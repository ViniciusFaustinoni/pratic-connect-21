

# Fix: Erro ao abrir aba "Historico" nos detalhes do rastreador

## Problema

Ao clicar na aba "Historico" no drawer de detalhes do rastreador, a pagina quebra com o erro:

```
checklistItems.filter is not a function
```

O campo `checklist_manutencao` vem do banco como string JSON (nao como array), entao `.filter()` falha. O mesmo pode ocorrer com `fotos_manutencao`.

## Solucao

No componente `HistoricoCompletoRastreador.tsx`, na funcao `ManutencaoCampoItem`, garantir parsing seguro dos campos JSON:

**Arquivo:** `src/components/rastreadores/HistoricoCompletoRastreador.tsx`

Alterar as linhas 388-391:

```typescript
// ANTES
const checklistItems = data.checklist_manutencao || [];
const checklistOk = checklistItems.filter((i) => i.status === 'ok').length;
const fotos: FotoManutencao[] = data.fotos_manutencao || [];

// DEPOIS
const rawChecklist = data.checklist_manutencao;
const checklistItems: ChecklistItem[] = Array.isArray(rawChecklist)
  ? rawChecklist
  : typeof rawChecklist === 'string'
    ? (() => { try { const p = JSON.parse(rawChecklist); return Array.isArray(p) ? p : []; } catch { return []; } })()
    : [];
const checklistOk = checklistItems.filter((i) => i.status === 'ok').length;

const rawFotos = data.fotos_manutencao;
const fotos: FotoManutencao[] = Array.isArray(rawFotos)
  ? rawFotos
  : typeof rawFotos === 'string'
    ? (() => { try { const p = JSON.parse(rawFotos); return Array.isArray(p) ? p : []; } catch { return []; } })()
    : [];
```

## Arquivos

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/rastreadores/HistoricoCompletoRastreador.tsx` | Parsing seguro de `checklist_manutencao` e `fotos_manutencao` |

