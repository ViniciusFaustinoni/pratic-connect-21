## Causa raiz

A trigger `trigger_audit_veiculos_delete` chama `audit_delete_critico()`, que insere em `logs_auditoria.usuario_id` o valor de `auth.uid()`. Mas a FK `logs_auditoria_usuario_id_fkey` aponta para `profiles.id` (não para `auth.users.id`). Como `auth.uid()` ≠ `profiles.id`, o INSERT viola a FK e a exclusão inteira aborta — daí o erro "violates foreign key constraint logs_auditoria_usuario_id_fkey" mostrado no toast ao excluir LTB4J74.

A função irmã `fn_auditoria_generica()` já faz o certo: resolve `v_profile_id` via `profiles.user_id = auth.uid()` e grava o profile.id. `audit_delete_critico` ficou desatualizada.

## Correção (migration única)

Atualizar `public.audit_delete_critico()` para:
1. Resolver `v_profile_id` a partir de `profiles.user_id = auth.uid()` (igual `fn_auditoria_generica`).
2. Inserir em `logs_auditoria.usuario_id` o `v_profile_id` (pode ser NULL → FK aceita por ser `ON DELETE SET NULL`/nullable).
3. Manter `usuario_nome` com fallback `'[SISTEMA/SQL DIRETO]'` quando não houver profile.

Sem alterações no front-end e sem alterar a lógica de cascata existente — a "cascata" já funciona via FKs `ON DELETE CASCADE`/`SET NULL` das tabelas dependentes; o que estava bloqueando era apenas a auditoria gravando um id inválido.

## SQL

```sql
CREATE OR REPLACE FUNCTION public.audit_delete_critico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','auth'
AS $$
DECLARE
  v_user_id uuid;
  v_profile_id uuid;
  v_user_nome text;
  v_dados jsonb;
  v_descricao text;
BEGIN
  BEGIN v_user_id := auth.uid(); EXCEPTION WHEN OTHERS THEN v_user_id := NULL; END;

  IF v_user_id IS NOT NULL THEN
    SELECT id, COALESCE(nome, email)
      INTO v_profile_id, v_user_nome
      FROM public.profiles
     WHERE user_id = v_user_id
     LIMIT 1;
  END IF;

  -- (mesmos blocos IF TG_TABLE_NAME para contratos/associados/veiculos
  --  montando v_dados e v_descricao — inalterados)

  INSERT INTO public.logs_auditoria (
    usuario_id, usuario_nome, acao, modulo, tabela, registro_id, dados_anteriores, descricao
  ) VALUES (
    v_profile_id,                                  -- <<< era v_user_id (auth.uid)
    COALESCE(v_user_nome, '[SISTEMA/SQL DIRETO]'),
    'excluir',
    TG_TABLE_NAME, TG_TABLE_NAME, OLD.id, v_dados, v_descricao
  );

  RETURN OLD;
END; $$;
```

## Validação

Após a migration, excluir LTB4J74 como Diretor deve:
- remover o veículo,
- gravar 1 linha em `logs_auditoria` com `usuario_id` = profile do diretor,
- não estourar erro de FK.

Se aparecer outra FK (ex.: `contratos.veiculo_id`, `servicos.veiculo_id`) bloqueando, trato em seguida — mas pela inspeção atual a única violação é a de auditoria.