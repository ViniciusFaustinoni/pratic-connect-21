## Objetivo

Permitir que **consultores (vendedor / vendedor externo / agência)** acessem `/cadastro/processos` para acompanhar **somente as próprias solicitações** (titularidade, substituições, migrações e inclusões que eles originaram).

## 1. Sidebar — adicionar item para consultor

`src/components/layout/AppSidebar.tsx`, dentro do `useMemo` `visibleGroups` (após o bloco `isVendedorOnly` em ~640):

- Quando `permissions.isVendedorOnly` (ou seja, vendedor sem outros papéis privilegiados), e o grupo `cadastro` foi removido pelo filtro de `canManageCadastro`, **injetar um grupo `cadastro` reduzido** contendo apenas `{ title: 'Processos', url: '/cadastro/processos', icon: ClipboardList }`.
- Se o grupo `cadastro` já existe (analista de cadastro etc.), apenas garantir que o item Processos está presente — nenhuma mudança necessária.

Isto evita conceder `canManageCadastro` para vendedores (que abriria o módulo inteiro).

## 2. Página — escopo por usuário

`src/pages/cadastro/ProcessosOperacionais.tsx`:

Adicionar `useAuth()` + `usePermissions()`. Calcular `scopeToSelf = permissions.isVendedorOnly` (e variantes externo/agência). Quando true:

- Banner discreto no topo: "Mostrando apenas suas solicitações."
- Aplicar filtros por usuário em **todas** as 4 fontes:

| Tabela | Coluna | Tipo de FK |
|---|---|---|
| `solicitacoes_troca_titularidade` | `criado_por` | profiles.id |
| `substituicoes_veiculo` | `criado_por` | auth.users.id |
| `solicitacoes_migracao` | `consultor_id` | profiles.id |
| `cotacoes` (inclusões) | `vendedor_id` | auth.users.id |

Como `criado_por`/`consultor_id` referenciam `profiles.id`, e `vendedor_id`/`substituicoes.criado_por` referenciam `auth.users.id`, precisamos de:
- `authUserId = user.id`
- `profileId = profile?.id` (já vem do `useAuth`)

Aplicar nos 5 pontos:
1. `useProcessosCounts()` (linha 491–522): adicionar `.eq('criado_por', profileId)` em titularidade; `.eq('criado_por', authUserId)` em substituições; `.eq('consultor_id', profileId)` em migrações; `.eq('vendedor_id', authUserId)` em inclusões — **somente quando `scopeToSelf`**.
2. `useSolicitacoesTroca` (em `src/hooks/useSolicitacoesTroca.ts`): adicionar parâmetro opcional `criadoPorProfileId` que aplica `.eq('criado_por', criadoPorProfileId)` quando informado. Passar do componente `TrocaTitularidadeTab`.
3. `SubstituicoesTab`: filtrar `substituicoes` em memória por `criado_por === authUserId` (o hook `useSubstituicoes()` já traz tudo; filtramos client-side para evitar nova assinatura).
4. `MigracoesTab` (em `src/pages/cadastro/SolicitacoesMigracao.tsx`): adicionar prop `consultorIdScope?: string` ou filtrar via contexto. Mais simples: passar via `useAuth` dentro do próprio componente quando `scopeToSelf` (vamos checar a estrutura).
5. `InclusoesTab` (linhas 314–484): adicionar `.eq('vendedor_id', authUserId)` na query `cotacoes` quando `scopeToSelf`.

## 3. Sem ajuste de RLS

As tabelas já permitem SELECT autenticado (RLS atuais retornam `true` para `authenticated`), e o filtro client-side é apenas UX. Não há vazamento porque a UI não expõe ações destrutivas — só leitura. Mantemos o comportamento existente para perfis com `canManageCadastro` (veem tudo).

## 4. Validação

- Logar como diretor: vê tudo (sem alterações).
- Logar como consultor (vendedor sem privilégios): vê item "Processos" no menu Cadastro (apenas esse), abre `/cadastro/processos` com banner "Mostrando apenas suas solicitações", contadores e listas filtradas pelas 4 fontes.