

## Diagnóstico — Scroll cortado no Safari iOS

### Causa raiz

O modal `CotacaoFormDialog` (e o `DialogContent` base do shadcn) usa `max-h-[90vh]`. No **Safari iOS**, a unidade `vh` é calculada com base no **viewport máximo** (sem barra de URL e sem barra inferior de navegação). Quando essas barras estão visíveis, `90vh` é **maior que a área realmente visível**, fazendo com que:

1. O rodapé sticky com o botão "Criar Cotação" fica **escondido atrás da barra inferior do Safari**.
2. Mesmo rolando até o fim, os últimos campos (Data de Vencimento, botão de submit) ficam cortados.
3. O comportamento NÃO ocorre em Chrome desktop, Android, ou após a barra do Safari recolher — por isso parece intermitente.

A screenshot enviada confirma: o card "Data de Vencimento" está sendo cortado pela barra inferior do Safari (ícones de voltar/avançar/compartilhar).

### Solução — usar `dvh` (dynamic viewport height) com fallback

`dvh` (dynamic viewport height) é a unidade CSS criada exatamente para resolver esse caso: ela se ajusta dinamicamente quando as barras do Safari aparecem/recolhem. Suportada no iOS Safari 15.4+ (cobre 99% dos iPhones em uso).

**Estratégia**: aplicar `dvh` apenas quando suportado, mantendo `vh` como fallback para navegadores antigos. Isso **não afeta Chrome/Firefox/Edge desktop nem Android**, que já tratam `vh` corretamente — eles simplesmente também passam a usar `dvh` sem nenhuma mudança visual.

### Mudanças propostas (mínimas e cirúrgicas)

**1. `src/components/ui/dialog.tsx`** — `DialogContent` base:
- Trocar `max-h-[90vh]` por `max-h-[90dvh]` com fallback via classe arbitrária Tailwind: `max-h-[90vh] max-h-[90dvh]` (a segunda regra sobrescreve quando suportada).

**2. `src/components/cotacoes/CotacaoFormDialog.tsx`** — `DialogContent` específico (linha 1352):
- Trocar `max-h-[90vh]` por `max-h-[90dvh]` com fallback.
- Adicionar `[&]:max-h-[100dvh]` em telas mobile (`max-sm:`) para usar quase toda a altura disponível em telas pequenas, dando mais espaço para scroll.

**3. Footer sticky (linha 2492)** — garantir que fica **acima** da área inferior do iOS:
- Adicionar `pb-[env(safe-area-inset-bottom)]` no rodapé sticky usando arbitrary value: `pb-[max(0.75rem,env(safe-area-inset-bottom))]`. Isso reserva espaço para a barra inferior em iPhones com notch.

**4. Scroll suave no iOS** — no container `overflow-y-auto` (linha 1365):
- Adicionar `[-webkit-overflow-scrolling:touch]` para garantir scroll com momentum no iOS (já é padrão em Safari moderno, mas reforça consistência).
- Adicionar `overscroll-contain` para evitar que o scroll do modal "vaze" para a página de fundo.

### Por que isso não afeta outros dispositivos

- `dvh` em desktop (Chrome/Firefox/Edge/Safari macOS) = idêntico a `vh` (não há barras dinâmicas).
- `env(safe-area-inset-bottom)` em telas sem notch = `0px` (zero efeito).
- `overscroll-contain` é não destrutivo — apenas previne scroll-chaining indesejado.
- `-webkit-overflow-scrolling: touch` é uma propriedade vendor-prefix ignorada por outros navegadores.

### Arquivos tocados

| Arquivo | Mudança |
|---------|---------|
| `src/components/ui/dialog.tsx` | `max-h-[90vh]` → `max-h-[90vh] max-h-[90dvh]` |
| `src/components/cotacoes/CotacaoFormDialog.tsx` | DialogContent: `max-h-[90dvh]` + safe-area no footer + `overscroll-contain` no scroll |

**Nenhuma alteração em lógica, hooks, dados ou outros componentes.**

### Verificação pós-correção

Pelo Safari no iPhone, abrir uma cotação no painel ou cotador público (`app.praticcar.org`) e confirmar:
- Botão "Criar Cotação" sempre visível acima da barra inferior do Safari.
- Scroll chega até o fim sem cortar "Data de Vencimento".
- Em Chrome desktop e Android, comportamento idêntico ao atual (sem regressão).

