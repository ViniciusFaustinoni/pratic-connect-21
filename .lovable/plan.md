

## Plano: Mostrar serviços com encaixe no mapa independente da data

### Problema
O filtro do mapa (linha 219 de `MapaVistoriasContent.tsx`) só mostra serviços de hoje ou atrasados. Serviços com `permite_encaixe = true` agendados para amanhã ou datas futuras não aparecem, mesmo precisando de atribuição manual imediata.

### Mudança (1 arquivo)

**`src/components/mapa/MapaVistoriasContent.tsx`** — linha 219

Alterar a condição de filtro para também incluir serviços com `permite_encaixe = true`:

```typescript
// Antes:
if (!isHoje && !isAtrasada) return false;

// Depois:
const isEncaixe = v.permite_encaixe === true;
if (!isHoje && !isAtrasada && !isEncaixe) return false;
```

Isso garante que qualquer serviço marcado como encaixe apareça imediatamente no mapa de atribuição manual, independente da data agendada.

### Detalhes técnicos
- O campo `permite_encaixe` já existe na interface `VistoriaMapa` e é retornado pela `view_vistorias_mapa`
- O serviço do Marcus (LTB4J74) tem `permite_encaixe: true` e `data_agendada: 2026-04-11`, portanto passará no filtro após esta mudança
- Nenhuma outra alteração necessária — o pin já renderiza corretamente serviços de encaixe (cor vermelha)

