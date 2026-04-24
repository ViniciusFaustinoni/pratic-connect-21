## Diagnóstico

A tela **Configurações → Usuários e Acessos** está listando associados como se fossem funcionários. Investigando:

### Causa raiz (duas camadas)

**1. Dados corrompidos no banco** — `profiles.tipo` está errado para a maioria dos associados:
```
funcionario: 9755 perfis
associado:     25 perfis  ← deveria ser ~9519
agencia:        2 perfis
```

Cruzando com a tabela `associados` + role `associado` + e-mail `@associado.pratic.com.br`:
- **9494 dos 9755 "funcionários" são, comprovadamente, associados** (têm registro na tabela `associados`, role `associado` e e-mail no domínio de associado).
- Restam ~261 funcionários reais.

Isso é resíduo de import em massa / trigger antiga que default-ou `tipo='funcionario'` em vez de `'associado'` na criação dos perfis.

**2. Filtro permissivo no front** — `useUsuarios` (`src/hooks/useUsuarios.ts`) e `UsuariosAcessos.tsx` aceitam o filtro `tipo='associado'` e **não excluem associados por padrão**. A tela tem inclusive um item "Associado legado" no select de tipo (linha 201). Mas ainda que os dados estivessem corretos, hoje qualquer associado com `tipo='associado'` apareceria na lista — o que vai contra a regra "somente usuários criados pelo diretor, funcionários, técnicos, equipe comercial".

### Impacto colateral
Várias RLS policies e funções SQL concedem acesso interno via `profiles.tipo = 'funcionario'` (ouvidoria, manifestações, jurídico, etc.). Significa que **9494 associados podem estar com permissões internas indevidas hoje**. Corrigir o `tipo` desses perfis é a coisa certa a fazer — vai restaurar a separação correta entre acesso interno e acesso de associado.

## O que vai mudar

### 1. Migration de correção de dados (`profiles.tipo`)
Reclassificar como `tipo='associado'` todo perfil que satisfaça **qualquer** dos critérios:
- Tem registro em `associados` vinculado pelo `user_id`, OU
- Tem role `associado` em `user_roles`, OU
- E-mail no domínio `@associado.pratic.com.br`

Com `WHERE tipo <> 'associado'` para não tocar nos já corretos. Estimado: ~9494 linhas.

Não vai mexer nos 261 perfis que **não** caem em nenhum critério (continuam como `funcionario` — a tela vai poder revisá-los caso a caso).

### 2. Hook `useUsuarios` — excluir associados por padrão
Em `src/hooks/useUsuarios.ts`, adicionar exclusão de `tipo='associado'` exceto quando o filtro explícito for `tipo='associado'`:

```ts
if (filters.tipo && filters.tipo !== 'todos') {
  query = query.eq('tipo', filters.tipo);
} else {
  query = query.neq('tipo', 'associado');
}
```

Também excluir do filtro server-side por `perfil`: se o filtro de perfil for `associado`, retornar vazio (essa tela não deve nem permitir consultar associados). Como `roleOptions` no front já filtra `role !== 'associado'` (linha 96 de `UsuariosAcessos.tsx`), isso já está alinhado.

### 3. UI `UsuariosAcessos.tsx` — remover opção "Associado legado" do filtro
Remover a `<SelectItem value="associado">Associado legado</SelectItem>` (linha 201) e ajustar o texto descritivo do card. A tela passa a listar apenas: funcionário, prestador, agência (e equivalentes vinculados às roles internas).

### 4. Texto/copy
Ajustar a `CardDescription` (linha 181-183) para refletir a nova regra: "Tela exclusiva para usuários internos: funcionários, prestadores, agências e equipe comercial. Associados são gerenciados em Associados."

## O que NÃO muda

- Nenhuma RLS policy é alterada — apenas os dados são corrigidos para o estado correto.
- Nenhum acesso legítimo de funcionário é afetado (os 261 perfis sem critério associado permanecem `funcionario`).
- A tela de Associados continua independente e exibindo os 9519 associados normalmente (a partir da tabela `associados`).
- A role `associado` em `user_roles` permanece intocada — é só o campo `profiles.tipo` que muda.

## Resultado esperado

- Tela Usuários e Acessos: mostra apenas usuários internos. Os ~9494 associados que apareciam "como funcionário" somem.
- Métricas no topo (Total/Ativos/Inativos/Perfis) refletem só usuários internos.
- Permissões internas atribuídas indevidamente via `profiles.tipo='funcionario'` aos associados deixam de existir — separação de acesso interno vs. associado fica íntegra.

## Pontos de atenção

- Após a migration, alguns associados podem ter perdido um acesso a tela interna que vinham usando indevidamente. Isso é correção, não regressão.
- Os 261 perfis que continuam como `funcionario` devem ser revisados manualmente pelo time se houver suspeita — a tela já permite filtrar e editar caso a caso.
