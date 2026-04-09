

## Plano: Corrigir responsividade iOS — safe area no topo

### Problema
No iOS com notch/Dynamic Island, o status bar (hora, sinal, bateria) sobrepoe o header do app porque:
- `viewport-fit=cover` esta configurado no `index.html`
- `apple-mobile-web-app-status-bar-style` e `black-translucent` (conteudo vai atras da status bar)
- Mas nenhum layout aplica `padding-top` com `env(safe-area-inset-top)` no header

### Alteracoes

**1. `src/index.css`** — Garantir que a classe `pt-safe` funciona tanto em PWA standalone quanto no browser:
- Atualizar `.pt-safe` para usar `env(safe-area-inset-top, 0px)` sem condicional de `display-mode`

**2. `src/components/layout/AppLayout.tsx`** (layout da diretoria/funcionarios)
- Adicionar `pt-safe` ao container raiz `div.flex.h-screen` para empurrar todo o conteudo abaixo da safe area

**3. `src/components/layout/AppHeader.tsx`** (header da diretoria)
- Alternativa: adicionar `pt-safe` diretamente no `<header>` sticky

**4. `src/layouts/AppAssociadoLayout.tsx`** (layout do app do associado)
- Adicionar `pt-safe` ao `<header>` sticky (linha 76)
- Adicionar `pb-safe` ao bottom nav (ja tem `h-safe-area-inset-bottom`, validar)

**5. `src/pages/instalador/InstaladorHome.tsx`** e layout do instalador
- Verificar e adicionar `pt-safe` ao header/container principal

**Abordagem escolhida**: Aplicar `pt-safe` nos headers sticky de cada layout. Isso e mais preciso do que no container raiz, pois o header e o elemento que fica no `top-0` e precisa do offset.

### Resultado
- O botao de menu e o header ficam abaixo da barra de status do iOS
- Funciona em iPhones com notch, Dynamic Island e modelos antigos (fallback 0px)
- Nao afeta Android ou desktop

### Arquivos
- `src/index.css`
- `src/components/layout/AppHeader.tsx`
- `src/layouts/AppAssociadoLayout.tsx`
- Verificar layout do instalador

