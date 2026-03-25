

# Corrigir erros de enum e RLS para coordenador de monitoramento

## Problemas identificados

1. **Erro de enum**: `invalid input value for enum app_role: "analista_monitoramento"` — o valor nunca foi adicionado ao tipo `app_role`. A migration anterior inseriu em `app_roles_config` (tabela com coluna text), mas a tabela `user_roles` usa a coluna `role` do tipo `app_role` (enum). Ao tentar atribuir o role, falha.

2. **RLS em `user_module_visibility`**: Apenas `diretor` e `desenvolvedor` podem gerenciar essa tabela. O coordenador de monitoramento (com `canCreateUser`) não consegue salvar os acessos a módulos dos membros da equipe.

## Solução — 1 migration SQL

### 1. Adicionar valor ao enum
```sql
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'analista_monitoramento';
```

### 2. Nova política RLS em `user_module_visibility`
Reutilizar a função `can_manage_users` (já criada) para permitir que coordenadores gerenciem visibilidade de módulos:

```sql
CREATE POLICY "Team managers can manage user visibility"
  ON public.user_module_visibility FOR ALL TO authenticated
  USING (public.can_manage_users(auth.uid()))
  WITH CHECK (public.can_manage_users(auth.uid()));
```

### 3. Nova política RLS em `user_module_item_visibility` (mesma lógica)
```sql
CREATE POLICY "Team managers can manage user item visibility"
  ON public.user_module_item_visibility FOR ALL TO authenticated
  USING (public.can_manage_users(auth.uid()))
  WITH CHECK (public.can_manage_users(auth.uid()));
```

## Arquivos
- 1 migration SQL (enum + 2 políticas RLS)
- Zero alterações no frontend

