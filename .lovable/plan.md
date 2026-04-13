
## Plano: Adicionar página "Aprovações" no menu Diretoria

### Objetivo
Criar uma nova rota `/diretoria/aprovacoes` que exibe o painel de aprovações da diretoria (`PainelAprovacoesDiretoria`), com um resumo visual de status e detalhamento de quais diretores já responderam por cotação. Adicionar o item no menu lateral da Diretoria.

### Alterações

**1. Nova página `src/pages/diretoria/AprovacoesDiretoria.tsx`**
- Página simples com título "Aprovações da Diretoria" e descrição
- Renderiza o componente `PainelAprovacoesDiretoria` já existente
- Adiciona um painel de resumo no topo com cards: total pendentes, total aprovados, total recusados

**2. Melhorar `PainelAprovacoesDiretoria.tsx` — Agrupar por cotação e mostrar diretores**
- Atualmente mostra um card por voto individual (1 card = 1 diretor + 1 cotação)
- Agrupar os itens por `cotacao_id` para exibir um card por cotação
- Dentro de cada card, listar todos os diretores envolvidos com seus respectivos status (pendente/aprovado/recusado) e data de resposta
- Mostrar progresso visual: "2/3 diretores responderam"

**3. Atualizar hook `useAprovacoesDiretoria.ts`**
- Retornar também a lista completa de votos por cotação (todos os diretores) para permitir o agrupamento no componente

**4. Registrar rota em `App.tsx`**
- Adicionar `<Route path="/diretoria/aprovacoes" element={<AprovacoesDiretoria />} />`

**5. Adicionar item no menu em `AppSidebar.tsx`**
- Inserir `{ title: 'Aprovações', url: '/diretoria/aprovacoes', icon: CheckCircle2 }` no grupo Diretoria

### Escopo
- 1 arquivo novo (página)
- 3 arquivos editados (PainelAprovacoesDiretoria, App.tsx, AppSidebar.tsx)
- 1 hook editado (useAprovacoesDiretoria)
