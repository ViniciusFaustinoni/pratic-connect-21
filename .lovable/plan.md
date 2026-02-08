
# Plano de Correção: Dados Desincronizados entre Tabelas

## Diagnóstico Completo

### Problema 1: Vistoria VIS-2026-56262 na fila
- **ID**: `c84dc7ed-bc5c-4d21-9513-531021456262`
- **Tabela**: `servicos` (NÃO existe em `vistorias`)
- **Tipo**: `vistoria_manutencao` 
- **Status atual**: `pendente`
- **Causa**: O registro foi criado diretamente na tabela `servicos` e nunca foi excluído. Se você deseja removê-lo, é necessário excluir da tabela `servicos`.

### Problema 2: Instalação em andamento não aparece no menu do instalador
- **ID Instalação**: `1d381d93-6254-4838-80b6-62c416cfaf0f`
- **ID Serviço correspondente**: `ff578a8f-6640-4e65-b578-54afe90798c7`
- **Status em `instalacoes`**: `em_andamento` ✓
- **Status em `servicos`**: `em_analise` ✗ (DEVERIA SER `em_andamento`)
- **Causa**: O trigger de sincronização não propagou corretamente o status, ou algo atualizou o `servicos` diretamente sem passar pelo `instalacoes`.

**Por que não aparece no menu?**  
A RPC `buscar_tarefa_atual_profissional` filtra apenas por:
```sql
WHERE s.status IN ('em_rota', 'em_andamento', 'agendada')
```
O status `em_analise` NÃO está nessa lista, então a tarefa fica invisível para o instalador.

---

## Soluções

### Correção Imediata (SQL)

**Executar manualmente via SQL Editor do Supabase:**

```sql
-- 1. Corrigir status do serviço para voltar a aparecer no menu do instalador
UPDATE servicos 
SET status = 'em_andamento', 
    updated_at = NOW()
WHERE id = 'ff578a8f-6640-4e65-b578-54afe90798c7';

-- 2. Se deseja EXCLUIR a vistoria VIS-2026-56262 (manutenção pendente)
DELETE FROM servicos 
WHERE id = 'c84dc7ed-bc5c-4d21-9513-531021456262';
```

### Correção Estrutural (Prevenir problemas futuros)

O ideal é corrigir o sistema para evitar que isso aconteça novamente. Há duas abordagens:

**Opção A**: Atualizar a RPC para incluir `em_analise` como status ativo (se for um status válido para serviços em campo):

```sql
-- Adicionar em_analise à lista de status ativos
WHERE s.status IN ('em_rota', 'em_andamento', 'agendada', 'em_analise')
```

**Opção B**: Garantir que o trigger de sincronização sempre mantenha paridade. Criar um trigger reverso que propaga mudanças de `servicos` para `instalacoes`:

```sql
CREATE OR REPLACE FUNCTION sync_servicos_to_instalacao()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.instalacao_origem_id IS NOT NULL THEN
    UPDATE instalacoes
    SET 
      status = (NEW.status::text)::status_instalacao,
      updated_at = NOW()
    WHERE id = NEW.instalacao_origem_id
      AND status <> (NEW.status::text)::status_instalacao;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_sync_servicos_to_instalacao
AFTER UPDATE ON servicos
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION sync_servicos_to_instalacao();
```

---

## Resumo das Ações

| Ação | Tipo | Descrição |
|------|------|-----------|
| Corrigir servico status | SQL imediato | Alterar status de `em_analise` para `em_andamento` |
| Excluir vistoria pendente | SQL imediato | Deletar registro da tabela `servicos` |
| (Opcional) Atualizar RPC | Migração | Adicionar `em_analise` à lista de status ativos |
| (Opcional) Trigger bidirecional | Migração | Sincronizar `servicos` → `instalacoes` |

---

## Recomendação

Para resolver agora, execute os comandos SQL de correção imediata no SQL Editor do Supabase:

1. Acesse o SQL Editor do Supabase
2. Execute a query de correção do status
3. Execute a query de exclusão da vistoria (se desejado)

Após isso, a instalação em andamento voltará a aparecer no menu do instalador imediatamente.

Deseja que eu implemente a correção estrutural (trigger bidirecional) para prevenir problemas futuros?
