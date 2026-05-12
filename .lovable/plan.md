## Diagnóstico

Caso **MARCUS VINICIUS FAUSTINONI (LTB4J74)**:

| Tabela | Registro | Estado |
|---|---|---|
| `instalacoes` `c7803d08…` | local_vistoria=base, instalador=Wallace | **concluida** 12/05 11:40 |
| `servicos` `0fdde65d…` (tipo=instalacao) | mesma origem | **concluida** 12/05 11:40 |
| `vistorias` `16fc185f…` | local=cliente | em_analise (autovistoria) |
| **`agendamentos_base` `0efe28b2…`** | horário 08:00, instalacao_id apontando para a concluída | **status='agendado', atendido_por=NULL** ❌ |

A aba *Atribuição Manual › Serviços Pendentes* lê direto de `agendamentos_base` filtrando `atendido_por IS NULL AND status IN ('agendado','pendente')` (`useAtribuicaoManual.ts` linha 84-92). Como o agendamento da base nunca foi fechado, ele continua aparecendo mesmo depois da instalação/vistoria ter sido concluída pelo Wallace.

## Causa raiz

O trigger `trg_sync_agendamento_base_on_servico_terminal` (em `servicos`) só fecha o agendamento quando o serviço vai para `cancelada`, `reagendada` ou `nao_compareceu`. **Os estados terminais positivos (`concluida`, `aprovada`, `reprovada`) não são tratados** — e também não existe trigger equivalente disparando a partir de `instalacoes` quando a instalação base é finalizada.

Resultado: toda instalação base concluída deixa o `agendamentos_base` órfão em status `agendado`, e a fila de Atribuição Manual exibe um "Vistoria Base" fantasma para o mesmo cliente.

## Plano de correção

### 1. Migration — estender o trigger

Atualizar `sync_agendamento_base_on_servico_terminal()` para também tratar `concluida`/`aprovada`/`reprovada`, marcando o agendamento como `realizado` (status já usado na tabela) e preenchendo `atendido_por` com o profissional do serviço. Resolução por correspondência via `cotacao_id`, `instalacao_origem_id` ou `vistoria_origem_id` (lógica atual).

### 2. Migration — novo trigger em `instalacoes`

Criar `trg_sync_agendamento_base_on_instalacao_terminal` AFTER UPDATE OF status em `instalacoes`, fechando `agendamentos_base` cujo `instalacao_id = NEW.id` quando `NEW.status='concluida'` (ou `cancelada`). Necessário porque o caso do Marcus mostra que o vínculo direto é via `instalacao_id`, não pelo `cotacao_id` apenas.

### 3. Backfill (data migration)

Fechar todos os `agendamentos_base` órfãos:
```sql
UPDATE agendamentos_base ab
   SET status='realizado', updated_at=now()
 WHERE ab.status IN ('agendado','pendente','confirmado')
   AND EXISTS (
     SELECT 1 FROM instalacoes i
      WHERE i.id = ab.instalacao_id
        AND i.status IN ('concluida','cancelada')
   );
```
E variante análoga para `vistoria_id` quando a vistoria base já estiver concluída/aprovada/reprovada.

### 4. Memória

Atualizar `mem://logic/operations/dedupe-agendamentos-rule` documentando que terminais positivos (concluida/aprovada/reprovada) também encerram o `agendamentos_base`, e que o vínculo `instalacao_id` é resolvido por trigger próprio.

### Escopo NÃO incluído

- Sem mudanças de UI (a fila já filtra corretamente quando o status estiver fechado).
- Sem alteração no fluxo de aprovação da vistoria/autovistoria.
- Sem mexer em `useAtribuicaoManual` — a query atual está correta.
