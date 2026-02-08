
# Plano de Correção: Erro de Enum "reagendar" ao Concluir Instalação

## Diagnóstico Completo

### Causa Raiz Identificada
A migration recente (`20260208023823...`) criou a função `sync_servicos_to_instalacao` com dois erros críticos:

1. **Valor de enum incorreto**: Usa `'reagendar'` (não existe) em vez de `'reagendada'`
2. **Valor inválido para instalacao**: Usa `'pendente'` que não existe em `status_instalacao`

### Fluxo do Erro
```text
1. Código chama aprovarVeiculoMutation
2. Tenta atualizar servicos.status = 'concluida'
3. Trigger sync_servicos_to_instalacao dispara
4. UPDATE instalacoes tenta aplicar CASE com valores inválidos
5. Trigger sync_instalacao_update_to_servicos dispara (loop)
6. Tenta fazer: (NEW.status::text)::status_servico
7. Se qualquer conversão falhar → ERRO "invalid input value for enum"
```

### Logs Confirmando
```
ERROR: invalid input value for enum status_servico: "reagendar"
(múltiplas ocorrências)
```

---

## Solução

### Migração de Correção
Corrigir a função `sync_servicos_to_instalacao` com:

1. **Status corretos**: Trocar `'reagendar'` por `'reagendada'`
2. **Remover `'pendente'`**: Não existe em `status_instalacao`
3. **Adicionar proteção contra loops**: Evitar que triggers disparem em cascata infinitamente

```sql
CREATE OR REPLACE FUNCTION sync_servicos_to_instalacao()
RETURNS TRIGGER AS $$
BEGIN
  -- Só sincroniza se tiver instalacao_origem_id definido
  IF NEW.instalacao_origem_id IS NOT NULL THEN
    -- CORREÇÃO: Lista de status válidos para status_instalacao
    -- status_instalacao = {agendada, em_rota, em_andamento, concluida, reagendada, cancelada}
    UPDATE instalacoes
    SET 
      status = CASE 
        WHEN NEW.status::text IN ('agendada', 'em_rota', 'em_andamento', 'concluida', 'reagendada', 'cancelada') 
        THEN (NEW.status::text)::status_instalacao
        ELSE status -- Mantém o status atual se não for mapeável
      END,
      updated_at = NOW()
    WHERE id = NEW.instalacao_origem_id
      AND status::text IS DISTINCT FROM NEW.status::text;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

### Possíveis Problemas Adicionais

Também verificar se o hook `useAprovarVeiculoServico` está preparado para casos onde:
- `imeiRastreador` é `undefined` (veículo não precisa de rastreador)
- O rastreador não é encontrado

O hook atualmente falha se não encontrar rastreador, mas o veículo pode dispensar rastreador.

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| Nova migração SQL | Corrigir função `sync_servicos_to_instalacao` |
| `src/hooks/useServicos.ts` | Verificar se `imeiRastreador` é opcional |

---

## Validação

1. Aplicar a migração de correção
2. Tentar concluir a instalação `ff578a8f-...` novamente
3. Verificar nos logs que não há mais erro de enum
4. Confirmar que o status mudou para `concluida` em ambas as tabelas
