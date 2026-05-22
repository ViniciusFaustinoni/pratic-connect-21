## Diagnóstico

A seção **"Acesso a Módulos"** do formulário Editar Usuário (Configurações › Usuários e Acessos) tem dois bugs encadeados, confirmados por inspeção do código e por consulta direta ao banco.

### Bug 1 — chave errada gravada

`UsuarioForm.tsx` (ModuleAccessCard) grava em `user_module_visibility.user_id` o valor do `id` vindo de `useParams()`, que é o **`profiles.id`**. Confirmado em banco: todas as linhas existentes apontam para `profiles.id`, não para `profiles.user_id`.

Já o hook `useModuleVisibility` (consumido pelo `AppSidebar` e pelo `useRouteGuard`) consulta a tabela pela chave do usuário logado vinda de `useAuth().user.id`, que é o **`auth.users.id`**.

Resultado: o toast diz "salvo", mas nenhum acesso chega ao usuário em runtime.

### Bug 2 — semântica invertida (substitui em vez de somar)

No `AppSidebar.tsx` (linha 646) e no `useRouteGuard.ts` (linha 43):

```
if (visibleModules.length > 0) {
  baseGroups = baseGroups.filter(g => visibleModules.includes(g.id));
}
```

Assim que **qualquer** linha existe para o usuário em `user_module_visibility`, o sidebar passa a mostrar **somente** esses módulos — apagando o que o perfil já concedia. O comportamento correto é overlay aditivo: o card adiciona módulos por cima do que o perfil garante, sem nunca remover nada do perfil.

---

## Plano de correção

### Passo 1 — Corrigir a chave gravada (`UsuarioForm.tsx`)

No `ModuleAccessCard`:

- Receber também o `authUserId` (o `usuario.user_id` já carregado pelo `useQuery` do formulário pai), além do `profileId`.
- Trocar o `upsert` para usar `user_id: authUserId`.
- Trocar a query interna (`useQuery` do card) para filtrar por `authUserId`.
- Manter `onConflict: 'user_id,module_id'` (já existe constraint).
- Mostrar o card como "carregando" enquanto o `authUserId` ainda não chegou (evita upsert com `undefined`).

### Passo 2 — Migração de dados (preserva o que já foi marcado)

Migração que converte todas as linhas atuais de `user_module_visibility` cujo `user_id` corresponde a um `profiles.id` para o `profiles.user_id` (auth.users.id) correspondente.

- Idempotente: faz `UPDATE ... FROM profiles WHERE user_module_visibility.user_id = profiles.id`.
- Trata conflito `(user_id, module_id)` mantendo a versão mais recente (`updated_at` maior vence; demais são deletadas antes do update).
- Linhas que já estão coerentes (já apontam para `profiles.user_id`) ficam intactas.

Assim, todos os acessos marcados antes da correção passam a funcionar imediatamente — sem precisar remarcar nada.

### Passo 3 — Tornar o overlay aditivo

Em `src/hooks/useModuleVisibility.ts`, renomear semanticamente o retorno para `additionalModules` (manter `visibleModules` como alias depreciado durante a transição interna, se necessário, mas idealmente trocar de uma vez todos os consumidores).

Ajustar os dois pontos de consumo para usar **união** com o que o perfil já concede:

- **`src/components/layout/AppSidebar.tsx`** (linha 646):
  - Remover o filtro restritivo.
  - Em vez disso, quando um grupo NÃO passa pelo filtro de permissões do perfil mas o seu `g.id` está em `additionalModules`, incluí-lo mesmo assim. Para os itens internos desse grupo extra, assumir acesso de leitura (badge "Acesso adicional" opcional, ou simplesmente listar todos os itens do grupo).
  - Mesma lógica em `visibleMainItems` (Dashboard) e em `showConfigModule` (Configurações): a presença do módulo em `additionalModules` libera, mas a ausência **não** restringe quem já tinha pelo perfil.

- **`src/hooks/useRouteGuard.ts`** (linha 43):
  - Em vez de redirecionar quando a rota não está em `visibleModules`, montar a união (rotas cobertas pelo perfil + rotas em `additionalModules`) e só redirecionar quando a rota não estiver em nenhum dos dois conjuntos.
  - Manter rotas `ALWAYS_ALLOWED` e a rota de perfis operacionais como hoje.

Resultado: o card volta a ser uma ferramenta de "conceder acessos extras a um usuário específico sem precisar trocar o perfil dele".

### Passo 4 — UX do card (texto + estado "Já incluso no perfil")

Em `ModuleAccessCard`:

- Atualizar `CardDescription` para:
  > "Conceda módulos adicionais a este usuário, além dos já liberados pelo perfil de acesso. Desmarcar aqui não remove acessos concedidos pelo perfil — para isso, ajuste o perfil acima."

- Para cada módulo da lista, calcular se ele já é concedido pelos `formData.perfis` atuais do usuário (cruzando com `app_roles_config.permissions` via `getPermissionsForRoles` de `useAppRoles`, mapeando permissão → `module_id`).
- Quando o módulo já vem do perfil:
  - Mostrar um badge "Já incluso no perfil" ao lado do nome.
  - Desabilitar o `Switch` (mantendo-o visualmente "ligado", já que o usuário enxerga o módulo).
  - Esconder o toggle de "pode editar" (irrelevante quando o acesso vem do perfil).
- Quando o módulo NÃO vem do perfil, comportamento normal (toggle ativo, salva extras).

### Passo 5 — Validação manual

- Logar como **admin@teste.com**, editar um Analista de Monitoramento, marcar "Cadastro" no card → salvar.
- Logar como esse analista → confirmar que vê Monitoramento (perfil) **e** Cadastro (extra), e que `/cadastro/*` não redireciona.
- Voltar como admin, desmarcar "Cadastro" → salvar.
- Re-logar como o analista → confirmar que volta a ver só Monitoramento.
- Conferir um usuário pré-existente que já tinha extras configurados antes da correção → confirmar que continua com o acesso após a migração (sem precisar remarcar).

---

## Arquivos impactados

- `src/pages/configuracoes/UsuarioForm.tsx` — passa `authUserId` ao card, texto novo, estado "já incluso no perfil"
- `src/hooks/useModuleVisibility.ts` — semântica aditiva (`additionalModules`)
- `src/components/layout/AppSidebar.tsx` — união com permissões do perfil
- `src/hooks/useRouteGuard.ts` — união com permissões do perfil
- Migração SQL — backfill de `user_id` em `user_module_visibility` (de `profiles.id` para `profiles.user_id`), com deduplicação por `(user_id, module_id)`