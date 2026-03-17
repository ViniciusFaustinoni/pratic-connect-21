

## Plan: Central de Processos Operacionais no Cadastro

### Situacao Atual

- **Substituicao de Veiculo**: ja tem pagina dedicada em `/cadastro/substituicoes` — OK
- **Troca de Titularidade**: so existe como dialog dentro da ficha do associado, sem fila de gestao
- **Reativacao**: so existe como wizard dentro da ficha do associado, sem fila de gestao
- **Substituicao de Placa**: tem taxa configurada mas nao tem pagina nem fluxo operacional
- As solicitacoes de troca de titularidade caem na tabela `chat_solicitacoes_ia` e sao geridas pela pagina SolicitacoesIA (sob Eventos) — errado, deveria ser Cadastro

### O que sera feito

Criar uma pagina **"Processos"** no Cadastro que centraliza a fila operacional de todos esses processos, com abas por tipo.

#### 1. Nova pagina: `src/pages/cadastro/ProcessosOperacionais.tsx`

Pagina com tabs:
- **Troca de Titularidade** — lista solicitacoes da `chat_solicitacoes_ia` filtradas por `tipo = 'troca_titularidade'`, com acoes de aprovar/rejeitar e link para a ficha do associado
- **Reativacoes** — lista associados com status `cancelado` ou `suspenso` que tem solicitacao de reativacao pendente (ou que foram reativados recentemente), baseado em `associados_historico` com tipo `reativacao`
- **Substituicao de Placa** — lista solicitacoes pendentes de troca de placa (usando `chat_solicitacoes_ia` com tipo ou nova coluna)
- **Substituicao de Veiculo** — redireciona para `/cadastro/substituicoes` (ja existente) ou embed inline

Cada aba mostra: cards com dados do associado, status da solicitacao, data, e botoes de acao.

#### 2. Sidebar update: `AppSidebar.tsx`

Adicionar item **"Processos"** ao grupo Cadastro (entre Substituicoes e Recusas):
```
{ title: 'Processos', url: '/cadastro/processos', icon: ClipboardList }
```

Remover o item "Substituicoes" separado (sera uma aba dentro de Processos) ou mante-lo como atalho — depende da preferencia. Manterei ambos por agora para nao quebrar fluxos existentes.

#### 3. Rota: `App.tsx`

Adicionar rota `/cadastro/processos` apontando para `ProcessosOperacionais`.

#### 4. Mover logica de aprovacao de troca de titularidade

A pagina SolicitacoesIA continuara tratando sinistros e assistencias, mas as solicitacoes de `troca_titularidade` serao primariamente geridas pela nova pagina em Cadastro. Nao precisa remover de SolicitacoesIA — apenas adicionar a gestao no Cadastro.

### Arquivos alterados

1. **Novo**: `src/pages/cadastro/ProcessosOperacionais.tsx` — pagina central com 3-4 abas
2. `src/components/layout/AppSidebar.tsx` — adicionar "Processos" ao menu Cadastro
3. `src/App.tsx` — adicionar rota
4. `src/components/layout/GlobalBreadcrumb.tsx` — adicionar breadcrumb

