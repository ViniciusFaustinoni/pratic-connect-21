

## Plano: Mover "Alto Valor" e "Diretoria" para o menu Diretoria

### Contexto
As abas "Alto Valor" e "Diretoria" na pagina de Aprovacoes em Vendas (`/vendas/aprovacoes-fipe`) tratam de aprovacoes que sao responsabilidade exclusiva de diretores. Devem ser movidas para a pagina de Aprovacoes da Diretoria (`/diretoria/aprovacoes`).

### Alteracoes

**1. Expandir `/diretoria/aprovacoes` (AprovacoesDiretoria.tsx)**
- Adicionar sistema de abas com 3 secoes: "Alto Valor", "Elegibilidade" (se pertinente) e "Diretoria" (dupla aprovacao)
- A aba "Alto Valor" reutiliza os hooks `useAprovacoesFipeLimite`, `useAprovarFipeLimite`, `useRecusarFipeLimite` e renderiza os cards de aprovacao/recusa (copiar logica de renderizacao do AprovacoesFipeMenor.tsx)
- A aba "Diretoria" ja usa `PainelAprovacoesDiretoria` — manter como esta
- KPIs no topo (pendentes, aprovados, recusados) devem considerar ambas as fontes

**2. Limpar `/vendas/aprovacoes-fipe` (AprovacoesFipeMenor.tsx)**
- Remover as abas "Alto Valor" e "Diretoria"
- Manter apenas "FIPE Menor" e "Elegibilidade"
- Atualizar o type `SectionTab` para `'fipe_menor' | 'elegibilidade'`
- Remover imports e hooks de `useAprovacoesFipeLimite` e `PainelAprovacoesDiretoria`
- Atualizar subtitulo da pagina

**3. Breadcrumb (GlobalBreadcrumb.tsx)**
- Adicionar entrada `/diretoria/aprovacoes: { label: 'Aprovacoes' }`

**4. Sidebar (AppSidebar.tsx)**
- Ja possui o item "Aprovacoes" em `/diretoria/aprovacoes` — nenhuma alteracao necessaria

### Arquivos editados
- `src/pages/diretoria/AprovacoesDiretoria.tsx` — expandir com abas Alto Valor + Diretoria
- `src/pages/vendas/AprovacoesFipeMenor.tsx` — remover abas Alto Valor e Diretoria
- `src/components/layout/GlobalBreadcrumb.tsx` — adicionar breadcrumb da diretoria

