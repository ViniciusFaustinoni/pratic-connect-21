

## Plano: Legenda colapsável no mapa de atribuições

### Alteração

**`src/components/mapa/MapaVistoriasContent.tsx`** — `renderLegenda()`

- Adicionar estado `const [legendaAberta, setLegendaAberta] = useState(true)`
- O header "Legenda" vira um botão toggle com ícone `ChevronDown`/`ChevronUp`
- Quando fechada, mostrar apenas o botão compacto "Legenda" (ou ícone) para reabrir
- Quando aberta, mostrar o conteúdo atual completo
- Usar `Collapsible` do radix (já existe em `src/components/ui/collapsible.tsx`) ou simplesmente condicional com animação CSS

### Resultado
O card de legenda pode ser colapsado clicando no header, liberando a visão do mapa. Um clique no header reexpande.

