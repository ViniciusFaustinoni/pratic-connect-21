

# Plano: Renomear "Rotas" para "Vistorias e Instalações" na Diretoria

## O que muda

### 1. Menu lateral (`AppSidebar.tsx`)
- Renomear item de `'Rotas'` para `'Vistorias e Instalações'` (linha 405)
- Alterar URL de `/diretoria/rotas` para `/diretoria/vistorias-instalacoes`
- Trocar ícone de `Route` para `ClipboardList` (mais representativo)

### 2. Página principal (`Rotas.tsx`)
- Alterar titulo de "Rotas" para "Vistorias e Instalações"
- Alterar subtitulo para "Acompanhe vistorias, instalações e movimentações em tempo real"
- Adicionar novas abas:
  - **"Tempo Real"** -- painel com posição dos instaladores em campo (usa `useEquipeHoje` que ja existe, mostrando status atual de cada profissional: em deslocamento, em atendimento, parado, etc.)
  - **"Movimentações"** -- historico de todas as movimentações: serviços concluídos, reagendados, cancelados, encaixes realizados (query em `servicos` + `instalacoes` com filtros de data)

### 3. Rotas no `App.tsx`
- Alterar path de `/diretoria/rotas` para `/diretoria/vistorias-instalacoes`
- Alterar path de `/diretoria/gestao-rotas` para `/diretoria/gestao-vistorias-instalacoes`
- Adicionar redirect de `/diretoria/rotas` → `/diretoria/vistorias-instalacoes`
- Atualizar redirect existente de `/monitoramento/rotas`

### 4. Referências internas
- `GlobalBreadcrumb.tsx`: atualizar label e path
- `DashboardCoordenador.tsx`: atualizar link "Gestão de Rotas"
- `useDashboardCoordenador.ts`: atualizar link nos alertas

## Arquivos afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/layout/AppSidebar.tsx` | Renomear menu item + URL |
| `src/pages/monitoramento/Rotas.tsx` | Renomear titulo + adicionar abas Tempo Real e Movimentações |
| `src/App.tsx` | Atualizar paths + redirects |
| `src/components/layout/GlobalBreadcrumb.tsx` | Atualizar path e label |
| `src/pages/monitoramento/DashboardCoordenador.tsx` | Atualizar link |
| `src/hooks/useDashboardCoordenador.ts` | Atualizar link |

