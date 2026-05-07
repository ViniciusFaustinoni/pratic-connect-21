## Causa-raiz

A fila **Monitoramento › Aprovações › Aprovação de Associados** usa o filtro `veiculos.cobertura_total !== true` (`src/hooks/useAprovacaoMonitoramento.ts` linhas 39–42 e 69–70). Hoje, dois triggers de banco já promovem o veículo automaticamente ao concluir a instalação, fazendo com que o item nunca apareça na fila e o ciclo "pule" o monitoramento.

Triggers culpados (confirmados via `pg_trigger`):

1. `trg_reativar_cobertura_pos_instalacao_inst` em `instalacoes` → `fn_reativar_cobertura_pos_instalacao_v2`
   - Caso B: ao concluir qualquer instalação, faz `cobertura_total=true, cobertura_roubo_furto=true` no veículo, mesmo sem decisão do monitoramento.
   - Também promove `veiculos.status` para `ativo` em pré-ativação.
2. `trg_reativar_cobertura_pos_instalacao` em `servicos` → `fn_reativar_cobertura_pos_instalacao`
   - Mesma lógica para `servicos.status='concluida'` do tipo `instalacao`.
3. `fn_reconciliar_status_pos_instalacao` (cron de reconciliação) faz a mesma coisa em lote.

Confirmado em produção: instalação `local_vistoria='base'` placa `QXV0H02` concluída em 20/04 ficou direto com `cobertura_total=true` e `status=ativo`, sem passar por aprovação. Mesma situação em todas as últimas instalações da semana — a fila do monitoramento sempre fica vazia para esses casos.

Isso viola a regra de negócio (memória `mem://architecture/activation/single-source-activation`): a ativação do veículo/cobertura deve passar **exclusivamente** pela edge function `ativar-associado`, que é chamada pelo hook `useAprovarInstalacaoMonitoramento` quando o operador clica "Aprovar" na tela de Aprovações.

## O que faremos (raiz, não cosmética)

### 1. Migration — corrigir os 3 pontos que contornam o monitoramento

- **`fn_reativar_cobertura_pos_instalacao_v2`** (trigger em `instalacoes`):
  - Manter o **Caso A** (cobertura_suspensa por timeout 48h → religa, pois é reativação operacional, não ativação inicial).
  - **Remover o Caso B** (que ativava `cobertura_total=true` na conclusão normal).
  - **Remover** a promoção de `veiculos.status` para `'ativo'`. Em pré-ativação ela passa a ir para um estado neutro `aguardando_aprovacao_monitoramento` (ou mantém `instalacao_pendente`/`em_analise` — a aprovação do monitoramento via `ativar-associado` é quem promove para `ativo`).

- **`fn_reativar_cobertura_pos_instalacao`** (trigger em `servicos`): mesma poda. Mantém só o caso de reativação após `cobertura_suspensa=true`.

- **`fn_reconciliar_status_pos_instalacao`** (cron): remove o `cobertura_total=true / cobertura_roubo_furto=true / status='ativo'`. O cron continua existindo, mas só corrige inconsistências reais de status quando o monitoramento já aprovou (ex.: ficou em `instalacao_pendente` apesar de `associados.status='ativo'`).

### 2. Garantir que a fila pegue tudo

Hoje `useInstalacoesAguardandoAprovacao` filtra `servicos.tipo='instalacao' AND status='concluida' AND veiculo.cobertura_total != true`. Após a poda dos triggers, **toda** instalação concluída (Base, Rota, Autovistoria, Prestador) cai automaticamente na fila — incluindo `aplicar-conclusao-vistoria`, `concluir-vistoria-prestador`, `concluir-instalacao-prestador` e o checklist do instalador na Base, que já marcam `servicos.status='concluida'` e `instalacoes.status='concluida'` mas NÃO devem mais ativar cobertura.

Adicionar duas defesas extras:
- No filtro do hook: aceitar também itens cujo `associado.status` ainda não esteja em `ativo` (defesa para fluxos legados).
- Na fila, mostrar badge da origem (`Base`, `Rota`, `Autovistoria`, `Prestador`) lendo `instalacoes.local_vistoria` + presença de fotos de autovistoria — só visual.

### 3. Backfill controlado (opcional, recomendo executar)

Reverter automaticamente itens concluídos nas últimas 7 dias que **ainda não foram aprovados manualmente**. Critério seguro:

```sql
UPDATE veiculos v
   SET cobertura_total = false, status = 'em_analise'
  FROM servicos s
 WHERE s.veiculo_id = v.id
   AND s.tipo='instalacao' AND s.status='concluida'
   AND s.concluida_em > now() - interval '7 days'
   AND NOT EXISTS (
     SELECT 1 FROM associados_historico h
      WHERE h.associado_id = v.associado_id
        AND h.tipo='protecao_360_aprovada_monitoramento'
        AND h.created_at >= s.concluida_em
   )
   AND v.cobertura_total = true;
```

Resultado esperado: as instalações da Base que "passaram batido" voltam para a fila e o monitoramento decide. Isso é destrutivo — vou pedir confirmação antes de aplicar.

### 4. Validação em ambiente real

- Logar como `admin@teste.com` e abrir `/monitoramento/aprovacoes-monitoramento`.
- Snapshot antes/depois de uma instalação Base de teste:
  - Conclusão pelo instalador na Base → `servicos.status=concluida`, `instalacoes.status=concluida`, `veiculo.cobertura_total=false`, item aparece na fila.
  - Aprovar pelo monitoramento → `ativar-associado` roda, vira `ativo`, sai da fila, entra na fila do SGA (`enqueue_integration sga/hinova_sync`).
- Testar reprovação (já existente) continua funcionando.
- Testar fluxo Autovistoria + Rota + Prestador, checando que todos passam pela fila.

## Diagrama do fluxo após a correção

```text
Instalação concluída (Base | Rota | Autovistoria | Prestador)
        │
        ▼
servicos.status=concluida + instalacoes.status=concluida
veiculo.status=em_analise  (cobertura_total continua false)
        │
        ▼
Fila Monitoramento › Aprovações › Aprovação de Associados
        │
        ├── Aprovar → ativar-associado → cobertura_total=true, status=ativo → enfileira SGA
        └── Reprovar → veiculo/associado=recusado, contrato cancelado, fila SGA recebe 'cancelado'
```

## Riscos & mitigação

- **Risco:** veículos cujo SGA já foi sincronizado por outro caminho podem ficar dessincronizados. Mitigação: o cron `cron-sga-retry` já reenfileira; e o backfill exclui casos já aprovados manualmente.
- **Risco:** triggers de cobertura suspensa. Preservados (caso A).
- **Risco:** memória `mem://logic/operations/sincronizacao-status-pos-instalacao` afirma que esses triggers garantem que o veículo nunca fique preso em `instalacao_pendente`. Atualizarei a memória para refletir que a promoção para `ativo` agora é responsabilidade exclusiva da aprovação do monitoramento.

## Arquivos / objetos alterados

- `supabase/migrations/<nova>.sql` — redefine `fn_reativar_cobertura_pos_instalacao`, `fn_reativar_cobertura_pos_instalacao_v2`, `fn_reconciliar_status_pos_instalacao`.
- `src/hooks/useAprovacaoMonitoramento.ts` — filtro mais permissivo + label de origem.
- `src/pages/monitoramento/AcionamentosRouboFurto.tsx` — coluna/badge de origem.
- `mem://logic/operations/sincronizacao-status-pos-instalacao` e `mem://core` — atualizar regras.

Aprovação para seguir? Quer que eu já inclua o backfill da etapa 3 ou prefere rodá-lo separadamente após validar?