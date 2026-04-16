
Em `MapaVistoriasContent.tsx`, o clique no marker da base abre o `CalendarioDiaModal` independentemente de haver agendamentos. Preciso condicionar a abertura.

## Plano

### Mudança única em `src/components/mapa/MapaVistoriasContent.tsx`

- No handler de clique do marker da base (e também no item correspondente da legenda, se houver), verificar a contagem de pendentes daquela base (`pendentesPorBase[oficina_id] || 0`).
- Se contagem `=== 0`: não abrir o modal. Em vez disso, exibir um `toast.info("Nenhuma vistoria agendada para esta base")`.
- Se contagem `> 0`: manter comportamento atual (abrir `CalendarioDiaModal` com `abaInicial="base"`).
- Visualmente o ícone já fica acinzentado/sem pulse quando não há pendentes — manter.

Nada mais será alterado.
