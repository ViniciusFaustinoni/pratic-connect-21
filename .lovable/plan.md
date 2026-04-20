

## Corrigir acesso de Vistoriadores Base ao App do Técnico

### Diagnóstico

O `InstaladorGuard` (`src/components/instalador/InstaladorGuard.tsx`, linha 76) bloqueia o acesso com:

```ts
if (!hasRole('instalador_vistoriador')) { ...Acesso Negado... }
```

Porém o role `vistoriador_base`:

- está marcado como **operacional** no `app_roles_config` com `redirect_path = '/instalador'` (migration `20260309202753`);
- é tratado pelo `AuthContext.computeRedirectPath` como destino `/instalador` (linha 544);
- aparece no formulário de usuário e na importação como perfil válido para o app do instalador.

Ou seja, o sistema redireciona o `vistoriador_base` para `/instalador`, e em seguida o próprio guard nega o acesso. Usuários como **Kleytonn [teste]** (apenas "Vistoriador Base") e os demais com esse perfil ficam presos na tela "Acesso Negado".

A migration `20260228170621` chegou a tentar consolidar tudo em `instalador_vistoriador` e remover `vistoriador_base`, mas migrations posteriores (`20260309162002`, `20260309194615`, `20260309202753`) **reintroduziram** `vistoriador_base` como role operacional ativo. Portanto a regra atual é: **ambos roles devem ter acesso ao app**.

### O que será implementado

#### 1. Liberar `vistoriador_base` no `InstaladorGuard`
Atualizar a verificação de acesso para aceitar qualquer um dos dois roles operacionais do app do técnico:

```ts
const podeAcessar = hasRole('instalador_vistoriador') || hasRole('vistoriador_base');
if (!podeAcessar) { ...Acesso Negado... }
```

Sem mudar mais nada da UI da tela de bloqueio — apenas a condição.

#### 2. Garantir paridade nos hooks já existentes
Verificar rapidamente que os hooks usados dentro do app (`useTarefaAtual`, `useServicos`, `useIniciarServico`, etc.) não filtram por role no client. Eles dependem da RPC `buscar_tarefa_atual_profissional` e RLS, que já consideram o `user_id`, então o `vistoriador_base` passa a operar normalmente sem mudanças adicionais.

Caso algum componente do layout (`InstaladorLayout`) esconda menus por role, ajustar para tratar `vistoriador_base` equivalente a `instalador_vistoriador` para itens compatíveis (Tarefas, Mapa, Vistorias). Sem expor itens exclusivos de instalação caso existam.

#### 3. Sem mudanças no banco
- `app_roles_config` já marca `vistoriador_base` como operacional com `redirect_path='/instalador'`.
- Permissões via `has_permission` continuam respeitadas.
- Nenhuma migration necessária.

### Arquivos editados

- `src/components/instalador/InstaladorGuard.tsx` — liberar `vistoriador_base` no check de acesso.
- `src/components/instalador/InstaladorLayout.tsx` — apenas se houver gating por role específica que esconda navegação relevante para vistoriador.

### Validação

1. Login como **Kleytonn [teste]** (apenas `vistoriador_base`) → entra em `/instalador` sem ver "Acesso Negado".
2. Login como **Rafael / Wallace** (têm os dois roles) → continua entrando normalmente.
3. Funcionário sem nenhum desses roles → continua bloqueado com a mesma mensagem.
4. Tarefa Atual carrega normalmente para o `vistoriador_base` (RPC + RLS já habilitam).
5. Sem regressão no redirect pós-login (`AuthContext` já mandava para `/instalador`).

