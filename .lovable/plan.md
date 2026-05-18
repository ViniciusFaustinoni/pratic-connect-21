## Contexto

Duas correções convergem na mesma migração:

1. **Lote A** — 5 contratos órfãos promovidos a `ativo` entre 15–17/05 por bug do trigger antigo (autovistoria do cliente disparando `cadastro_aprovado` + ativação sem rastreador).
2. **WENDEL / RENAVAM 0KM** — `fn_validar_campos_ativacao` exige `renavam ≥ 9 dígitos` SEM exceção para 0KM. Veículo do Wendel (chassi `9C6RG9910T0073366`, placa placeholder `ZZZ3366`, `aguardando_placa_definitiva=true`, renavam `001187` — 6 dígitos) bate na trava e o Monitoramento não consegue aprovar.

A regra canônica (memória core) já diz: **RENAVAM é OPCIONAL para 0KM** (`placa LIKE '0KM%'` OU `aguardando_placa_definitiva=true`). Hoje só `sga-hinova-sync` respeita isso — o validador de ativação ficou de fora.

---

## Mudanças

### 1. Migration — corrigir `fn_validar_campos_ativacao`

Atualizar a função para:

- Carregar também `v.aguardando_placa_definitiva` e detectar 0KM por:
  - `aguardando_placa_definitiva = true`, OU
  - `placa ILIKE '0KM%'` OU `placa ILIKE 'ZZZ%'` (placeholders correntes)
- **Pular validação de placa** (`length < 7`) quando 0KM (placeholder é aceito)
- **Pular validação de renavam** quando 0KM
- Normalizar renavam só-zeros como ausente (consistente com `sga-hinova-sync`)
- Manter `chassi ≥ 17` obrigatório sempre (0KM exige chassi)

### 2. Migration — saneamento Lote A (5 contratos)

Os 5 contratos identificados na varredura anterior (autovistoria do cliente + contrato ativo + veículo sem rastreador, 15–17/05):

```text
TTX4J73   (Yamaha XTZ 250 Lander  — Francisco)
+ 4 outros listados na varredura
```

Para cada um (em transação, com log em `associado_status_log` / auditoria):

```text
- veiculos.status         → 'instalacao_pendente'
- contratos.status        → 'assinado'
- contratos.cadastro_aprovado → false  (com bypass do trg_protege_cadastro_aprovado via SET LOCAL)
- contratos.aprovado_por  → NULL
- associados.status       → reverter para 'aguardando_aprovacao_cadastro' (ou estado equivalente pré-promoção)
- Materializar registro em `instalacoes` (status='agendada') quando sub-FIPE não-aplicável, para cair na fila padrão de Cadastro/Monitoramento
- Re-sync SGA: alterarSituacaoAssociadoHinova(PENDENTE=3) + alterarSituacaoParaVeiculoHinova(3) — disparado via integration_retry_queue
- Inserir registro em auditoria com motivo: 'saneamento_orfao_pre_fix_20260518_autovistoria_promove_cadastro'
```

> Ressalva: a UI do Monitoramento já tem o modal "Corrigir dados antes de aprovar". Com o fix do validador, o caso WENDEL deixa de aparecer no modal automaticamente após a aprovação re-tentada (sem precisar preencher RENAVAM falso).

### 3. Verificação pós-migração

- Rodar `fn_validar_campos_ativacao('<associado WENDEL>')` e confirmar `{valido: true}`.
- Conferir os 5 contratos do Lote A: `status='assinado'`, `cadastro_aprovado=false`, veículo `instalacao_pendente`, fila Cadastro repovoada.
- Sem mudanças de frontend nesta etapa — toda a correção é em DB.

---

## Detalhes técnicos

- Função afetada: `public.fn_validar_campos_ativacao(uuid)` (migration `20260428211320`).
- Trigger relacionado: `trg_protege_cadastro_aprovado` — usar `SET LOCAL session_replication_role = replica` apenas no bloco DO de saneamento, ou função `SECURITY DEFINER` específica de saneamento.
- Memória relevante: `mem://logic/operations/sga-renavam-opcional-zero-km` (estender para validador de ativação).
- Sem alterações em código de aplicação / edge functions — `ativar-associado` já consome o validador, então o fix propaga automaticamente.

---

## Confirmação antes de executar

Confirma 3 pontos:

1. **Fix RENAVAM 0KM no validador** — OK aplicar agora? (destrava WENDEL e qualquer 0KM futuro)
2. **Lote A — saneamento dos 5 órfãos** — confirma executar em lote único?
3. **Lista do Lote A** — quer que eu re-rode a varredura e cole os 5 IDs/placas exatos no plano antes de você aprovar, ou pode autorizar pela varredura anterior?
