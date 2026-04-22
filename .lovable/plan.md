

## Diagnóstico: Por que o PYN0C82 (Montana) não foi sincronizado no SGA

### Causa raiz (encontrada nos logs)

A sincronização SGA do **CLEBER** rodou **uma única vez em 20/04/2026 18:51** e teve este comportamento:

| Etapa | Resultado |
|---|---|
| `autenticar` na Hinova | ✅ sucesso |
| `cadastrar_veiculo` para **KXS2259** (Kombi) | ❌ erro 406 — *"Já existe um veículo com a placa KXS2259 cadastrado no sistema"* |
| Recuperação por placa (KXS2259) | ✅ pegou `codigo_veiculo=24137` e marcou como sincronizado |
| **PYN0C82** (Montana) | ⚠️ **nunca foi processado** — não existe nenhum log para esse veículo |

Ou seja: **o sync rodou só para a Kombi**. O Montana ficou de fora porque, no momento em que a função foi disparada, a Montana ainda não estava elegível (provavelmente estava em outro status / sem cobertura ativa / sem proposta aprovada). Como a função `sga-hinova-sync` é **disparada por veículo** (não em lote por associado), o Montana precisa de um trigger próprio — e esse trigger nunca aconteceu.

Hoje o Montana está:
- `status = instalacao_pendente`
- `status_sga = pendente`
- `codigo_hinova = null`
- `sincronizado_hinova = false`
- Zero logs em `sga_sync_logs`
- Zero jobs em `sga_sync_financeiro_jobs` (só o `backfill_inicial` global de hoje, ainda `pendente`)

**Não é bug da função** — ela funciona (provou isso na Kombi). É **falta de disparo**: nada no fluxo de aprovação do Montana chamou `sga-hinova-sync` para esse veículo.

### O que vou fazer

**Operação pontual** (não é build de feature). Disparar manualmente o sync para o PYN0C82 e corrigir o status local — exatamente como acordamos no plano anterior, mas agora com a causa explicada.

**1. Invocar `sga-hinova-sync`** com:
```json
{ "veiculo_id": "a0136944-7d40-422d-94f2-da6f5c5c65b4",
  "associado_id": "51ec89d2-57c9-44a7-8e93-1cf521196184" }
```
A função vai tentar criar o veículo na Hinova → como provavelmente a placa já existe lá (assim como aconteceu com a Kombi), ela cai na **Estratégia 1** (`GET /veiculo/consultar/placa/PYN0C82`), recupera o `codigo_veiculo` e grava localmente.

**2. Verificar resultado** consultando `sga_sync_logs` do veículo. Se `sync_completo` = `success`, prosseguir.

**3. Ativar localmente** (ambos os veículos, já que ambos estão presos em `instalacao_pendente` apesar de já estarem no SGA):
- `UPDATE veiculos SET status='ativo' WHERE id IN ('a0136944-…', 'f5bd7c0f-…')`

**4. Cancelar serviço de instalação obsoleto** do Montana (`e36f0ffb-…`, status `agendada`):
- `UPDATE servicos SET status='cancelada', observacoes='Cancelada — veículo já cadastrado no SGA, sincronizado manualmente em <data>'`

**5. Registrar histórico** no associado documentando a sync manual e a causa (sync original em 20/04 só processou a Kombi).

### Cenários alternativos
- **Se Hinova retornar 404 para PYN0C82**: a placa não existe lá. Eu paro, te aviso, e você decide se quer cadastrar de fato (a função tentará criar) ou se a placa está em outro CPF no SGA.
- **Se o `codigo_veiculo` retornado pertencer a outro CPF no Hinova**: a função grava mesmo assim (não valida cruzamento). Posso adicionar essa validação se quiser — me avisa.

### Fora do escopo
- Não vou alterar a função `sga-hinova-sync` (funciona).
- **Investigação adicional recomendada (separada)**: descobrir *por que* o trigger de sync não foi disparado para o Montana quando ele virou Roubo/Furto. Provavelmente é um gap no fluxo de aprovação que precisa ser auditado em outra task.

