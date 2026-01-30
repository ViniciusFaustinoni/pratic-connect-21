
# Plano: Corrigir Sincronização Bidirecional Servicos ↔ Instalações

## Problema Identificado

A atribuição automática de tarefas está funcionando corretamente na tabela `servicos`, mas a sincronização de volta para a tabela `instalacoes` está incompleta.

**Evidência:**
- Tabela `servicos`: `profissional_id = 68f4857b...` (correto)
- Tabela `instalacoes`: `instalador_id = null` (incorreto)

O trigger atual `sync_servico_to_instalacao` só sincroniza quando o status muda para `concluida`, ignorando:
- Atribuição de profissional
- Status `em_rota` e `em_andamento`

## Alteração Necessária

### Migração SQL

```sql
-- Atualizar função de sincronização servicos → instalacoes
CREATE OR REPLACE FUNCTION public.sync_servico_to_instalacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    IF NEW.status IN ('em_rota', 'em_andamento') 
       AND OLD.status IS DISTINCT FROM NEW.status THEN
      UPDATE instalacoes
      SET 
        status = NEW.status::status_instalacao,
        updated_at = NOW()
      WHERE id = NEW.instalacao_origem_id;
    END IF;
    
    -- Sincronizar conclusão (lógica existente)
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
$$;
```

### Correção de Dados Existentes

```sql
-- Corrigir instalações que não têm instalador_id mas o serviço tem
UPDATE instalacoes i
SET instalador_id = s.profissional_id
FROM servicos s
WHERE s.instalacao_origem_id = i.id
  AND s.profissional_id IS NOT NULL
  AND i.instalador_id IS NULL;
```

## Impacto

- **Positivo**: Garante consistência total entre `servicos` e `instalacoes`
- **Relatórios**: Consultas diretas em `instalacoes` refletirão o estado real
- **Baixo risco**: Apenas adiciona sincronização, não remove funcionalidade

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| Nova migração SQL | Atualizar função `sync_servico_to_instalacao` |
| (opcional) Script de correção | Sincronizar dados existentes |

## Validação

Após aplicar:
1. Verificar que `instalacoes.instalador_id` = `servicos.profissional_id`
2. Verificar que status intermediários (`em_rota`, `em_andamento`) estão sincronizados
3. Testar novo agendamento e verificar sincronização bidirecional
