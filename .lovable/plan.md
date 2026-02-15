

# Mover Solicitacoes IA para rota propria do modulo Eventos

## Problema

O Analista de Eventos acessa a pagina de Solicitacoes IA pela rota `/diretoria/solicitacoes-ia`, que:
1. Mostra o breadcrumb "Diretoria > Solicitacoes-ia" -- um caminho exclusivo de diretores
2. Da a impressao de que o analista esta numa area que nao lhe pertence

Alem disso, a pagina ja funciona (RLS corrigido anteriormente), so precisa de rota e navegacao corretas.

## Solucao

### 1. Criar rota duplicada em `/eventos/solicitacoes-ia` (App.tsx)

Adicionar uma nova rota que renderiza o mesmo componente `SolicitacoesIA`, mas dentro do grupo de rotas de Eventos:

```
/eventos/solicitacoes-ia  -->  <SolicitacoesIA />
```

A rota antiga `/diretoria/solicitacoes-ia` permanece para diretores.

### 2. Alterar a navegacao do botao "Revisar Solicitacoes" (SinistrosList.tsx)

Mudar o `navigate('/diretoria/solicitacoes-ia')` para `navigate('/eventos/solicitacoes-ia')` -- assim todos os usuarios do modulo Eventos vao para a rota correta, com breadcrumb "Eventos > Solicitacoes-ia".

### 3. Adicionar item no menu sidebar de Eventos (AppSidebar.tsx)

Incluir "Solicitacoes IA" como subitem do grupo Eventos no sidebar, visivel para analista de eventos e diretores:

```
{ title: 'Solicitacoes IA', url: '/eventos/solicitacoes-ia', icon: Bot }
```

### 4. Atualizar rotas permitidas no useRouteGuard (useRouteGuard.ts)

A rota `/eventos/solicitacoes-ia` ja esta coberta pelo allowedPath `/eventos`, entao nenhuma mudanca e necessaria nesse arquivo -- mas trocar `/diretoria/solicitacoes-ia` por `/eventos/solicitacoes-ia` na lista de `allowedPaths` para manter consistencia e remover o acesso a rota de diretoria.

## Arquivos a modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/App.tsx` | Adicionar rota `/eventos/solicitacoes-ia` apontando para `SolicitacoesIA` |
| `src/pages/eventos/SinistrosList.tsx` | Mudar navegacao de `/diretoria/solicitacoes-ia` para `/eventos/solicitacoes-ia` |
| `src/components/layout/AppSidebar.tsx` | Adicionar "Solicitacoes IA" no grupo Eventos do sidebar |
| `src/hooks/useRouteGuard.ts` | Trocar `/diretoria/solicitacoes-ia` por `/eventos/solicitacoes-ia` no allowedPaths do analista de eventos |

