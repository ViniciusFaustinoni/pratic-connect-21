## Problema
Os badges numéricos do sidebar (ex.: "Propostas Pendentes 2…") aparecem truncados com reticências porque o `<span>` do badge está dentro do `NavLink/SidebarMenuButton` que aplica `truncate`/`overflow-hidden` no conteúdo inteiro. Quando o título é longo, o badge entra no fluxo do texto e é cortado pelo ellipsis.

## Correção (apenas frontend/visual)
Em `src/components/layout/AppSidebar.tsx`, nos 3 pontos onde o badge é renderizado (linhas ~904, ~1048, ~1112):

1. Adicionar ao `<span>` do badge as classes:
   - `shrink-0` — impede que o badge seja comprimido
   - `whitespace-nowrap` — impede quebra/ellipsis dentro do número
   - `tabular-nums` — alinhamento numérico consistente

2. Garantir que apenas o título truncar: envolver `{item.title}` em `<span className="truncate">` quando ainda não estiver, para que o ellipsis recaia no texto e não no badge.

Resultado: o número aparece inteiro (ex.: "2", "12", "147"), e o título é que ganha "…" se faltar espaço.

## Escopo
- Arquivo único: `src/components/layout/AppSidebar.tsx`
- Sem mudança de lógica, hooks ou contagem.