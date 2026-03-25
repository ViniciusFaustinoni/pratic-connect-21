

# Redesign da Página Equipe de Monitoramento

## Problemas Identificados
- Nomes longos ficam cortados (truncate sem tooltip)
- Cards muito grandes com muita informação vertical
- Calendário de plantões ocupa espaço excessivo no topo, empurrando a lista
- Filtros em desktop usam larguras fixas que quebram em mobile
- Select triggers com larguras fixas (140px, 170px, 150px) não se adaptam
- Métricas em grid de 6 colunas colapsam mal em mobile
- Dropdown do card só aparece no hover (impossível em touch/mobile)
- Sem tabs para organizar o conteúdo (lista vs calendário)

## Solução

### 1. Reorganizar layout com Tabs (Lista / Plantões)
Substituir a apresentação linear (calendário + lista) por tabs. A tab "Equipe" mostra métricas, filtros e cards. A tab "Plantões" mostra o calendário. Isso libera espaço e dá foco.

### 2. Redesign do EquipeCard -- compacto e responsivo
- Reduzir padding e espaçamento vertical
- Nome com `break-words` em vez de `truncate` para nomes longos ficarem visíveis
- Mover botão de menu (3 dots) para sempre visível em mobile (sem depender de hover)
- Stats grid mais compacto: linha única com dados inline
- Remover barra de progresso (ocupa espaço sem valor claro)
- Email truncado com tooltip nativo (title attribute)
- Badges de status em linha única, mais compactos
- Card grid: `grid-cols-1` em mobile, `md:grid-cols-2`, `xl:grid-cols-3`

### 3. Redesign do EquipeFilters -- mobile-first
- Search ocupa 100% em mobile
- Selects usam `w-full` em mobile, largura fixa em desktop
- Layout: `flex-col` em mobile, `flex-row` em desktop
- Selects em grid de 3 colunas em mobile (`grid grid-cols-3 gap-2`)

### 4. Redesign do EquipeMetrics -- responsivo
- Mobile: grid de 2 colunas com cards menores (padding reduzido)
- Texto do valor com `text-xl` em mobile, `text-2xl` em desktop
- Labels com truncate para não quebrar layout

### 5. Calendário responsivo
- Em mobile: células menores, ocultar texto "Todos disponíveis"
- Font sizes menores em mobile para caber

### 6. Header com ícone estilizado (padrão do LeadsHeader)
- Adicionar ícone com gradiente no header como nas outras páginas
- Botão "Novo Profissional" compacto em mobile

## Arquivos Editados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/monitoramento/Equipe.tsx` | Tabs (Equipe / Plantões), header redesenhado |
| `src/components/equipe/EquipeCard.tsx` | Card compacto, nomes sem corte, menu sempre visível em mobile, menos espaçamento |
| `src/components/equipe/EquipeFilters.tsx` | Layout mobile-first, selects responsivos |
| `src/components/equipe/EquipeMetrics.tsx` | Grid e tamanhos responsivos |
| `src/components/equipe/PlantoesCalendario.tsx` | Células menores em mobile, textos adaptativos |

