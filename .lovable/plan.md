

## Plano: Corrigir overflow do dropdown no modal do calendário

### Problema

O `SelectContent` do Radix UI abre como um popover posicionado dentro do `DialogContent`, que tem `overflow-y: auto`. Isso causa o dropdown ser cortado ou transbordar visualmente.

### Correção

**Arquivo: `src/components/monitoramento/CalendarioDiaModal.tsx`** — linha 336

Adicionar `position="popper"` e `sideOffset` ao `SelectContent`, e usar o portal para renderizar fora do modal:

```tsx
<SelectContent position="popper" className="z-[1200]" sideOffset={4}>
```

O `z-[1200]` garante que fique acima do Dialog (z-[1100]). O `position="popper"` faz o Radix usar posicionamento de popover em vez de tentar alinhar inline, evitando o clipping pelo `overflow-y: auto` do modal.

