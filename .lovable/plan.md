## Diagnóstico — caso VINICIUS DE ANDRADE BARROS SANTOS (HOA1B39)

### Estado atual no banco
| Entidade | Status | Atualizado | Observação |
|---|---|---|---|
| `associados` (id `5955e32d…`) | **cancelado** | 26/05 18:50 | `motivo_bloqueio='cancelamento '`, `data_cancelamento=18:50` |
| `contratos` (`CTR-20260428144839-0VKRQO`) | **ativo** | 26/05 13:37 | `cadastro_aprovado=true` |
| `veiculos` (HOA1B39) | **ativo** | 22/05 08:31 | `codigo_hinova=35885` |

### Cronologia (logs_auditoria)
1. **26/05 13:36** — Hotfix anterior (loop de rebobinamento) restaurou associado: `em_analise → aguardando_instalacao` (HOA1B39 / VINICIUS).
2. **26/05 13:37** — Sistema executou `ativar-associado` → contrato e associado viraram **ativos**.
3. **26/05 18:50** — Usuário **"Teste"** (`37beadcf-284b-4a2c-88a0-6efa8cae60d9`) clicou em "Cancelar associado" no painel → SÓ o associado virou `cancelado`. Contrato e veículo seguem ativos.

Não há solicitação de troca de titularidade nem substituição relacionada — foi cancelamento direto via UI.

### Causa raiz (código)

**Arquivo: `src/hooks/useAssociados.ts`, função `cancelarAssociado` (linhas 703–768)**

Esse hook faz, nessa ordem:
1. Inativa cliente na Rede Veículos via orquestrador `rede-veiculos-inativar-cliente-completo`.
2. Desassocia rastreadores Softruck e zera `veiculo_id` / `status='estoque'` em `rastreadores`.
3. `UPDATE associados SET status='cancelado', motivo_bloqueio=motivo`.

**Não há `UPDATE` em `contratos` nem em `veiculos`.** Por isso o contrato/veículo seguem `ativo` após o cancelamento.

### Cascata em triggers DB — também não cobre

Triggers em `associados`:
- `trigger_estorno_cancelamento` (BEFORE UPDATE quando `status='cancelado'`) → só faz estorno/dedução de **comissão** de adesão; não toca em contrato nem veículo.
- `trg_sync_contrato_status_assoc` → só dispara quando `new.status='ativo'`, não no caminho de cancelamento.
- Demais triggers só fazem auditoria/histórico/recompute de cotação.

### Por que isso é um problema geral, não só do VINICIUS

- Esse hook é a única função `cancelarAssociado` do sistema; usada em `ContratoDetalhe.tsx`, `InstalacoesList.tsx`, `InstalacaoDetalhe.tsx`.
- Qualquer operador que clicar "Cancelar associado" deixa contrato + veículo + cobertura ativos no banco — desalinhando do canônico de cancelamento (ver `mem://features/billing/cancellation-workflow-constraints`).
- Vai bater nos guards `trg_guard_cotacao_ativo_exige_caminho_canonico` e em qualquer auditoria que cruze status do trio.

---

## Plano

### Etapa 1 — Saneamento pontual do VINICIUS (sem migration de schema)

Decidir, com você, qual o estado canônico esperado:

**A.** Reverter o cancelamento (`associados.status='ativo'`, limpar `data_cancelamento` e `motivo_bloqueio`) — caso o cancelamento de 18:50 tenha sido equívoco do operador "Teste".

**B.** Manter o cancelamento e propagar a cascata: `contratos.status='cancelado'` (com `cancelado_em`, `motivo_cancelamento`), `veiculos.status='cancelado'`/`inativo`, desativar coberturas R/F, encerrar `instalacoes` ativas, baixar `cobrancas` futuras, registrar `cancelamentos_contrato` se a tabela existir.

Cada opção registra `logs_auditoria` explícito citando a reconciliação.

### Etapa 2 — Fix do hook `cancelarAssociado` (corrige reincidência)

Em `src/hooks/useAssociados.ts`, dentro da `mutationFn`, após o passo Softruck e ANTES (ou depois, com ordem garantida) do `UPDATE` do associado:

1. Buscar contratos ativos do associado.
2. `UPDATE contratos SET status='cancelado', motivo_cancelamento=motivo, cancelado_em=now()` para cada contrato ativo.
3. Para cada veículo vinculado a esses contratos: `UPDATE veiculos SET status='cancelado'` (ou status canônico equivalente — confirmar enum `status_veiculo`).
4. Desativar coberturas: `cobertura_total=false`, `cobertura_r_f=false` no veículo, e cancelar registros relacionados em `coberturas_suspensoes` se houver pendência.

Toda a operação envolta em validação: se houver troca de titularidade em andamento (`solicitacoes_troca_titularidade` com `status` não terminal), o cancelamento direto é bloqueado com toast explicativo, porque o fluxo canônico é a troca, não o cancelamento.

### Etapa 3 — Guard DB (defesa em profundidade)

Adicionar trigger AFTER UPDATE em `associados`:
- Quando `OLD.status != 'cancelado'` e `NEW.status='cancelado'`:
  - Cancelar em cascata `contratos` ativos do associado (`status='cancelado'`, `cancelado_em=now()`, `motivo_cancelamento=COALESCE(NEW.motivo_bloqueio,'cancelamento_associado')`).
  - Cancelar em cascata `veiculos` (`status='cancelado'`).
  - Limpar `cobertura_total/cobertura_r_f` nos veículos.

Isso garante consistência mesmo se algum caminho legado (importação, script ad-hoc) atualizar `associados.status='cancelado'` direto, sem passar pelo hook.

Trigger é SECURITY DEFINER, faz só os UPDATEs acima e registra um log via `insertAuditLog`-equivalente em SQL (INSERT em `logs_auditoria` com `acao='cancelar'`, `tabela='contratos'`/`veiculos'`, descrição `[CASCATA_CANCELAMENTO_ASSOCIADO]`).

### Etapa 4 — Auditoria histórica

Listar todos os associados em status `cancelado` que ainda tenham contrato `ativo` ou veículo `ativo` — produto colateral da mesma falha. Apresentar a lista para você decidir saneamento em lote ou caso a caso (mesmo padrão do TUM3D59).

---

## Decisões necessárias antes de eu seguir

1. Reverter o cancelamento do VINICIUS (Etapa 1.A) ou aplicar cascata (Etapa 1.B)?
2. Aplicar o fix do hook + guard DB junto, ou só o saneamento pontual primeiro?
3. Etapa 4 (varredura histórica) faz parte deste mesmo loop ou vai pra próximo?

Sem essas respostas eu não toco em nada — todas envolvem decisão de negócio sobre o que conta como cancelamento canônico.
