

# Mover Migrações para dentro de Processos Operacionais

## O que muda

A aba "Migrações" deixa de ser um item separado no sidebar e na rota, passando a ser a 4ª aba dentro da página "Processos Operacionais" (`/cadastro/processos`), junto com Titularidade, Reativação e Substituições.

## Alterações

| Arquivo | Mudança |
|---------|---------|
| `src/pages/cadastro/ProcessosOperacionais.tsx` | Importar `SolicitacoesMigracao` como componente. Adicionar 4º summary card (migrações pendentes), 4ª tab "Migrações", ajustar grid de 3→4 colunas |
| `src/pages/cadastro/SolicitacoesMigracao.tsx` | Exportar também como componente reutilizável (named export `MigracoesTab`) sem o wrapper de página (sem h1/header), mantendo o `default export` para compatibilidade |
| `src/components/layout/AppSidebar.tsx` | Remover item "Migrações" (`/cadastro/migracoes`) do menu lateral do módulo Cadastro |
| `src/App.tsx` | Remover rota `/cadastro/migracoes` (ou redirecionar para `/cadastro/processos`) |
| `src/components/layout/GlobalBreadcrumb.tsx` | Remover entrada `/cadastro/migracoes` |

A contagem de migrações pendentes será adicionada ao hook `useProcessosCounts` existente, consultando `solicitacoes_migracao` com `status = 'pendente'`.

