

## Trilha de auditoria para alterações de `veiculo_id` em rastreadores

### Objetivo

Registrar automaticamente toda mudança de `veiculo_id` em `rastreadores` (vínculo, desvínculo, troca) — capturando usuário, valor anterior, valor novo, status anterior, status novo e contexto — para diagnosticar incidentes do tipo "esse rastreador estava no veículo X, por que não está mais?".

### Diagnóstico

Hoje:
- `useAuditLog.ts` existe e grava em `logs_auditoria`, mas **só é chamado manualmente** em poucos pontos. Nenhum dos hooks que mexem em `rastreador.veiculo_id` (`useUpdateRastreadorStatus`, `useSubstituirEquipamento`, `useVistoriaManutencao`, `useVenderVeiculo`, `useDeleteBaseAntiga`, edge functions `concluir-retirada`, `delete-associado`, `delete-ativacao`, `rede-veiculos-desvincular-cliente`) registra log.
- Resultado: quando um rastreador "some" de um veículo, não há como saber quem/quando/por qual fluxo.

### O que vai mudar

**1. Nova tabela `rastreadores_vinculo_historico`** (migration)

```sql
CREATE TABLE public.rastreadores_vinculo_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rastreador_id UUID NOT NULL REFERENCES rastreadores(id) ON DELETE CASCADE,
  veiculo_id_anterior UUID,           -- pode ser null
  veiculo_id_novo UUID,               -- pode ser null
  status_anterior TEXT,
  status_novo TEXT,
  placa_anterior TEXT,                -- snapshot, sobrevive a delete do veículo
  placa_nova TEXT,
  alterado_por UUID,                  -- auth.uid()
  alterado_por_nome TEXT,             -- snapshot do nome
  origem TEXT,                        -- 'trigger_db', 'edge_function:xxx'
  contexto JSONB,                     -- payload livre (motivo, vistoria_id, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rast_vinc_hist_rastreador ON rastreadores_vinculo_historico(rastreador_id, created_at DESC);
CREATE INDEX idx_rast_vinc_hist_veiculo_ant ON rastreadores_vinculo_historico(veiculo_id_anterior);
CREATE INDEX idx_rast_vinc_hist_veiculo_novo ON rastreadores_vinculo_historico(veiculo_id_novo);
```

RLS:
- SELECT: papéis com permissão de monitoramento/rastreadores (`has_role` admin/coordenador_monitoramento/operador_monitoramento/diretoria).
- INSERT: somente via trigger/security-definer (sem policy de insert para clientes).

**2. Trigger no Postgres em `rastreadores`**

```sql
CREATE OR REPLACE FUNCTION public.log_rastreador_vinculo_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_nome text;
  v_placa_ant text;
  v_placa_nova text;
BEGIN
  -- só registra quando veiculo_id OU status mudaram
  IF (OLD.veiculo_id IS NOT DISTINCT FROM NEW.veiculo_id)
     AND (OLD.status IS NOT DISTINCT FROM NEW.status) THEN
    RETURN NEW;
  END IF;

  SELECT nome INTO v_nome FROM profiles WHERE user_id = v_uid LIMIT 1;
  IF OLD.veiculo_id IS NOT NULL THEN SELECT placa INTO v_placa_ant FROM veiculos WHERE id = OLD.veiculo_id; END IF;
  IF NEW.veiculo_id IS NOT NULL THEN SELECT placa INTO v_placa_nova FROM veiculos WHERE id = NEW.veiculo_id; END IF;

  INSERT INTO rastreadores_vinculo_historico (
    rastreador_id, veiculo_id_anterior, veiculo_id_novo,
    status_anterior, status_novo, placa_anterior, placa_nova,
    alterado_por, alterado_por_nome, origem
  ) VALUES (
    NEW.id, OLD.veiculo_id, NEW.veiculo_id,
    OLD.status::text, NEW.status::text, v_placa_ant, v_placa_nova,
    v_uid, COALESCE(v_nome, 'Sistema'),
    COALESCE(current_setting('app.audit_origem', true), 'trigger_db')
  );
  RETURN NEW;
END $$;

CREATE TRIGGER trg_rastreador_vinculo_audit
AFTER UPDATE OF veiculo_id, status ON rastreadores
FOR EACH ROW EXECUTE FUNCTION public.log_rastreador_vinculo_change();
```

A trigger captura **toda** alteração — independente de vir do app, edge function, SQL manual ou job. O setting `app.audit_origem` é opcional: edge functions podem fazer `SET LOCAL app.audit_origem = 'concluir-retirada'` antes do UPDATE para enriquecer a origem.

**3. UI — aba "Histórico de Vínculo" no detalhe do rastreador**

- Novo componente `RastreadorHistoricoVinculo.tsx` em `src/components/monitoramento/estoque/`.
- Hook `useRastreadorHistoricoVinculo(rastreadorId)` em `src/hooks/useRastreadores.ts`.
- Adicionar nova aba no modal/drawer de detalhe do rastreador (`DetalhesRastreadorDialog` ou equivalente) listando:
  - Data/hora · Usuário · `placa_anterior → placa_nova` · `status_anterior → status_novo` · Origem.
- Filtrar por placa também acessível na tela de detalhe do veículo (aba "Histórico de rastreadores").

**4. Enriquecimento opcional de origem em edge functions críticas**

Em `supabase/functions/concluir-retirada/index.ts`, `delete-associado/index.ts`, `delete-ativacao/index.ts`, `rede-veiculos-desvincular-cliente/index.ts`, executar antes do UPDATE:

```ts
await supabase.rpc('set_audit_origem', { origem: 'concluir-retirada' });
```

Criar a RPC auxiliar:
```sql
CREATE OR REPLACE FUNCTION public.set_audit_origem(origem text)
RETURNS void LANGUAGE sql AS $$ SELECT set_config('app.audit_origem', origem, true) $$;
```

Sem isso, a origem fica como `'trigger_db'` (ainda funciona — só perde granularidade).

### O que NÃO muda

- Tabela `logs_auditoria` continua existindo para o módulo Diretoria (não é substituída).
- Hooks de mutação não precisam adicionar `registrarLog` manualmente — a trigger cobre 100%.
- Lógica de quando desvincular (whitelist `STATUS_DESVINCULA_VEICULO`) — sem alteração.

### Arquivos editados

- Migration nova — tabela `rastreadores_vinculo_historico`, RLS, trigger `trg_rastreador_vinculo_audit`, RPC `set_audit_origem`.
- `src/hooks/useRastreadores.ts` — novo hook `useRastreadorHistoricoVinculo`.
- `src/components/monitoramento/estoque/RastreadorHistoricoVinculo.tsx` (novo) — listagem.
- Componente de detalhe do rastreador (a localizar — provavelmente `DetalhesRastreadorDialog.tsx` ou `RastreadorDetalhesDialog.tsx`) — adicionar aba "Histórico".
- `supabase/functions/concluir-retirada/index.ts`, `delete-associado/index.ts`, `delete-ativacao/index.ts`, `rede-veiculos-desvincular-cliente/index.ts` — chamada `set_audit_origem` antes do UPDATE.
- `mem://logic/operations/rastreador-vinculo-preservacao.md` — adicionar nota sobre a trilha de auditoria.

### Riscos

- Volume: ~1 linha por mudança de status/veículo. Em 1 ano com 10k rastreadores e ~5 mudanças/ano cada = 50k linhas/ano. Negligenciável; índices cobrem queries por rastreador e por veículo.
- `auth.uid()` retorna `null` quando o UPDATE vem da service role (edge function com service-role-key). Nesse caso, `alterado_por` fica null e `alterado_por_nome` = `'Sistema'` — comportamento aceitável e identificável (origem fica `concluir-retirada`, etc.).

