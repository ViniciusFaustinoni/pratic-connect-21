

# Correção: Erro de Cast na Trigger que Impede Atribuição de Tarefas

## Diagnóstico Confirmado

Após investigação completa, identifiquei a **causa raiz** do problema de atribuição de tarefas:

### O que acontece

1. O serviço do cliente **MARCOS VINICIUS DATIVO MACHADO** existe na tabela `servicos` com:
   - `status = 'agendada'`
   - `profissional_id = NULL` (não atribuído)
   - `permite_encaixe = true`

2. A Edge Function `atribuir-proxima-tarefa` encontra o serviço e tenta atribuir executando:
   ```sql
   UPDATE servicos SET profissional_id = '...', status = 'em_rota' WHERE id = '...'
   ```

3. A trigger `sync_servico_to_instalacao` dispara para sincronizar com a tabela `instalacoes`

4. **A trigger falha** com erro:
   ```
   cannot cast type status_servico to status_instalacao
   ```

5. A transação é abortada, o serviço permanece sem atribuição

6. A Edge Function interpreta o erro como "já atribuído a outro" (código incorreto)

### Evidência dos logs do PostgreSQL

```
ERROR: cannot cast type status_servico to status_instalacao
```
(Mais de 20 ocorrências nos últimos minutos)

## Código Problemático

Na função `sync_servico_to_instalacao`:

```sql
-- PROBLEMA: Cast direto entre enums não é permitido no PostgreSQL
UPDATE instalacoes
SET status = NEW.status::status_instalacao  -- ❌ ERRO AQUI
WHERE id = NEW.instalacao_origem_id;
```

## Solução

### Parte 1: Corrigir a Trigger SQL

Alterar o cast para passar por `text` primeiro:

```sql
-- ANTES (errado)
status = NEW.status::status_instalacao

-- DEPOIS (correto)
status = (NEW.status::text)::status_instalacao
```

### Parte 2: Melhorar Logs na Edge Function

Atualizar a Edge Function para logar o erro real do banco, em vez de assumir "já atribuído a outro".

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| Nova migração SQL | Corrigir função `sync_servico_to_instalacao` |
| `supabase/functions/atribuir-proxima-tarefa/index.ts` | Melhorar log de erro |

## Migração SQL

```sql
-- Corrigir função de sincronização servicos -> instalacoes
CREATE OR REPLACE FUNCTION public.sync_servico_to_instalacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Só sincronizar para serviços do tipo instalação
  IF NEW.tipo = 'instalacao' AND NEW.instalacao_origem_id IS NOT NULL THEN
    
    -- Sincronizar profissional quando atribuído
    IF NEW.profissional_id IS DISTINCT FROM OLD.profissional_id THEN
      UPDATE instalacoes
      SET 
        instalador_id = NEW.profissional_id,
        updated_at = NOW()
      WHERE id = NEW.instalacao_origem_id;
    END IF;
    
    -- Sincronizar status quando muda para em_rota ou em_andamento
    -- CORREÇÃO: Cast através de TEXT para evitar erro de tipo
    IF NEW.status IN ('em_rota', 'em_andamento') 
       AND OLD.status IS DISTINCT FROM NEW.status THEN
      UPDATE instalacoes
      SET 
        status = (NEW.status::text)::status_instalacao,  -- CORRIGIDO
        updated_at = NOW()
      WHERE id = NEW.instalacao_origem_id;
    END IF;
    
    -- Sincronizar conclusão
    IF NEW.status = 'concluida' AND OLD.status IS DISTINCT FROM NEW.status THEN
      UPDATE instalacoes
      SET 
        status = 'concluida',
        concluida_em = COALESCE(NEW.concluida_em, NOW()),
        instalador_responsavel_id = COALESCE(NEW.profissional_id, instalador_responsavel_id),
        rastreador_id = COALESCE(NEW.rastreador_id, rastreador_id),
        updated_at = NOW()
      WHERE id = NEW.instalacao_origem_id;
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$function$;
```

## Resultado Esperado

Após a correção:
1. O serviço será atribuído ao vistoriador automaticamente
2. A tarefa aparecerá no app do vistoriador
3. O status será sincronizado corretamente entre `servicos` e `instalacoes`
4. Logs terão informações mais detalhadas em caso de erro

## Validação Pós-Correção

1. Verificar nos logs do Postgres que não há mais erros de cast
2. Confirmar que o serviço do cliente foi atribuído (`profissional_id` preenchido)
3. Testar no app do vistoriador que a tarefa aparece

