

# Plano: Atribuição de Grade de Comissão a Usuários

## Problema

As grades de comissão são cadastradas mas não podem ser atribuídas a ninguém. Não existe coluna nem tabela de vínculo entre grades e usuários (consultores/agências). Sem isso, também é impossível testar o bloqueio de exclusão de grade em uso.

## Solução

### 1. Migration — Criar tabela de vínculo

```sql
CREATE TABLE public.usuario_grade_comissao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  grade_id UUID NOT NULL REFERENCES public.grades_comissao(id) ON DELETE RESTRICT,
  atribuido_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.usuario_grade_comissao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar vínculos de grade"
ON public.usuario_grade_comissao FOR ALL TO authenticated
USING (public.has_permission(auth.uid(), 'manage_users'))
WITH CHECK (public.has_permission(auth.uid(), 'manage_users'));

CREATE POLICY "Usuário vê própria grade"
ON public.usuario_grade_comissao FOR SELECT TO authenticated
USING (user_id = auth.uid());
```

O `ON DELETE RESTRICT` na FK de `grade_id` impede exclusão de grade em uso diretamente no banco.

### 2. Tela de Grades — Botão "Atribuir" e bloqueio de exclusão

**Arquivo**: `src/pages/configuracoes/GradesComissao.tsx`

- Ao tentar excluir, verificar se existem registros em `usuario_grade_comissao` com aquele `grade_id`. Se sim, exibir toast: "Esta grade está atribuída a X usuário(s) e não pode ser excluída."
- Adicionar coluna "Usuários" na listagem mostrando quantos estão vinculados.

### 3. Tela de Usuários — Campo de grade no formulário

**Arquivo**: `src/pages/configuracoes/UsuarioForm.tsx`

- Para usuários com roles operacionais de vendas (`consultor_interno`, `consultor_externo`, `agencia`), exibir um select de "Grade de Comissão" carregando as grades ativas de `grades_comissao`.
- Ao salvar, inserir/atualizar o registro em `usuario_grade_comissao`.

### 4. Arquivos afetados

| Arquivo | Alteração |
|---|---|
| Migration SQL | Criar tabela `usuario_grade_comissao` com RLS |
| `GradesComissao.tsx` | Contagem de usuários, bloqueio de exclusão |
| `UsuarioForm.tsx` | Select de grade para consultores/agências |

