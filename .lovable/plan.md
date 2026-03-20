

# Plano: Otimização iPhone — Responsividade e Safe Areas

## Diagnóstico

Analisei todo o sistema e encontrei os seguintes problemas específicos de iPhone:

### Problemas Encontrados

**1. Textarea causa zoom automático no iPhone**
- `textarea.tsx` usa `text-sm` (14px) — no iOS Safari, inputs com font-size < 16px disparam zoom automático ao focar
- O `input.tsx` já está correto (`text-base md:text-sm`), mas o textarea e o select trigger não

**2. Uso de `100vh` em vez de `100dvh`**
- 11 arquivos usam `calc(100vh - ...)` ou `h-screen` — no iPhone, `100vh` inclui a barra de endereço do Safari, causando overflow e conteúdo cortado atrás da bottom bar
- Exemplos: `AppChat.tsx`, `AppRastreamento.tsx`, `EventosChatIA.tsx`, `Mapa.tsx`, `PosVenda.tsx`, `LeadKanban.tsx`
- O `InstaladorLayout` já usa `100dvh` corretamente; os demais não

**3. ReguladorLayout e AnalistaEventosLayout sem `100dvh`**
- Usam `min-h-screen` em vez de `h-[100dvh]`, causando overflow no Safari iPhone
- Bottom nav do ReguladorLayout usa `fixed` sem controle de safe-area do container pai

**4. AppAssociadoLayout — bottom nav sem dvh**
- Usa `min-h-screen` e `pb-20` fixo para compensar a nav, mas no iPhone com barra de endereço dinâmica, o conteúdo pode ser empurrado ou cortado

**5. Falta `-webkit-tap-highlight-color: transparent`**
- Nenhum reset global — no iPhone, todos os botões/links mostram o flash cinza/azul ao tocar

**6. `AppBottomNav.tsx` sem safe-area consistente**
- Usa `pb-safe` mas altura fixa `h-[56px]` — no iPhone com notch, a barra pode ficar pequena demais ou o conteúdo ser coberto pela home indicator

**7. Páginas do app associado com `h-screen` hardcoded**
- `AppRastreamento.tsx` usa `h-screen` (4 ocorrências) — no iPhone, corta o mapa atrás da barra do Safari
- `AppChat.tsx` usa `calc(100vh-8rem)` — mesma issue

**8. NovoSinistro footer posição fixa sem safe-area**
- Footer fixo em `bottom-16` sem considerar safe-area-inset-bottom no iPhone

---

## Plano de Implementação

### Etapa 1 — CSS Global (index.css)
- Adicionar `-webkit-tap-highlight-color: transparent` no body/html
- Adicionar classe utilitária `h-dvh` como alias para `height: 100dvh`
- Adicionar regra global para prevenir bounce no iOS: `html { overscroll-behavior: none; }`

### Etapa 2 — Textarea e Select (prevenir zoom no iPhone)
- `textarea.tsx`: mudar `text-sm` para `text-base md:text-sm` (mesmo padrão do input)
- `select.tsx` (SelectTrigger): mudar `text-sm` para `text-base md:text-sm`

### Etapa 3 — Layouts mobile → 100dvh
- `AppAssociadoLayout.tsx`: trocar `min-h-screen` por `h-[100dvh]` com flex column e overflow controlado
- `ReguladorLayout.tsx`: trocar `min-h-screen` por `h-[100dvh]`, mesma estrutura do InstaladorLayout
- `AnalistaEventosLayout.tsx`: mesma correção

### Etapa 4 — Páginas com 100vh → dvh
- `AppRastreamento.tsx`: trocar `h-screen` por `h-dvh`
- `AppChat.tsx`: trocar `calc(100vh-8rem)` por `calc(100dvh-8rem)`
- `EventosChatIA.tsx`: idem
- `Mapa.tsx`: idem
- `PosVenda.tsx`: idem
- `LeadKanban.tsx`: idem
- `AlertasMonitoramento.tsx`, `RotaDetailDrawer.tsx`, `ConsultorDrawer.tsx`, `LeadsTable.tsx`: idem

### Etapa 5 — Bottom nav safe-area refinamento
- `AppBottomNav.tsx`: substituir `h-[56px]` por altura auto com padding safe-area
- `NovoSinistro.tsx`: adicionar `pb-safe` no footer fixo
- `InstaladorChecklist.tsx`: trocar `safe-area-pb` (classe inexistente) por `pb-safe`

### Etapa 6 — Touch targets
- Verificar e garantir `min-h-[44px]` nos botões da bottom nav do `ReguladorLayout` e `AnalistaEventosLayout` (atualmente usam `py-2` que pode resultar em < 44px)

---

## Resultado Esperado
- Zero zoom automático em inputs no iPhone
- Nenhum conteúdo cortado pela barra do Safari ou home indicator
- Touch targets mínimos de 44px em toda navegação mobile
- Sem flash de toque azul/cinza ao interagir
- Scroll suave sem bounce indesejado
- Consistência entre os 4 layouts mobile (Associado, Instalador, Regulador, Analista)

