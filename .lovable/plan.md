
## Diagnóstico definitivo — RIR1B37 (ERICO) vinculada a TOVAR

### O que está certo
- **Contratos**: os dois termos de filiação carregam o snapshot do cliente correto, foram assinados via Autentique e estão `status='assinado'`.
  - `CTR-...9C3GBF` — cliente TOVAR (CPF 092.154.167-81), placa TCU6B84
  - `CTR-...FVR9KA` — cliente ERICO (CPF 130.709.487-23), placa RIR1B37
- **Cotações**: cada uma tem nome/CPF/email/telefone do titular real.

### O que está errado
- Os **dois contratos** apontam `associado_id = e8538d7a` (TOVAR).
- O **veículo RIR1B37** (`6aae322e`) também aponta para TOVAR.
- O **registro do associado e8538d7a** foi poluído: mantém `nome=TOVAR` e `cpf=09215416781`, mas teve `email` e `telefone` sobrescritos para os de ERICO (`ericodark91@gmail.com` / `21979213494`) durante a sincronização SGA das 19:20.
- **ERICO não existe como `associados`** — o CPF 13070948723 não tem registro próprio.

### Linha do tempo reconstruída (logs + DB)

```
16:08:34  TOVAR assina CTR-9C3GBF
          → cria associado e8538d7a (CPF 092..., email Tovar.rodrigueslima@...)
          → cria veículo TCU6B84 sob e8538d7a
16:22:45  veículo RIR1B37 é criado SOB e8538d7a (TOVAR)
16:22:51  autentique-create dispara (sucesso) — segundos depois
17:00:49  cotação de ERICO é criada (vendedor LEONARDO LOPES, mesma do TOVAR)
17:01:29  contrato de ERICO (CTR-FVR9KA) é gerado já amarrado a e8538d7a
17:10:43  ERICO assina o termo
17:47:01  associado vai a `aguardando_instalacao` (aprovação do analista)
19:20:06  SGA sync sobrescreve email/telefone do associado com os de ERICO
```

### Causa raiz

Combinação de **dois bugs** em `supabase/functions/contrato-gerar/index.ts` agindo em sequência:

**Bug 1 — Reuso indevido de veículo por placa, sem checar dono**
Linhas ~427-489 (branch CPF) e ~526-588 (branch email): quando a função encontra o veículo pela `placa`, **não valida** se `veiculo.associado_id == associadoId`. O trigger `fn_sync_veiculo_associado_from_contrato` então faz o "realinhamento" às avessas — mas aqui o problema é que o veículo já existia sob o dono errado e foi puxado de volta.

**Bug 2 — Lookup de associado tolerante demais**
Quando o CPF de ERICO (13070948723) não casou e o email também não, o fluxo deveria criar um novo associado (linha 592). Mas a evidência mostra que o contrato saiu com `associado_id = e8538d7a` mesmo assim. A hipótese mais consistente com a linha do tempo é que o vendedor (LEONARDO LOPES) **iniciou o fluxo de "incluir veículo" às 16:22 a partir do cadastro de TOVAR, escolhendo o veículo errado (RIR1B37 em vez do que era para ser de TOVAR)**, criando o vínculo cruzado já naquele momento; quando depois gerou a cotação correta para ERICO às 17:00, o `contrato-gerar` localizou o veículo pela placa e herdou o associado_id alheio.

**Bug 3 — Sync de PII sobrescreve dono errado**
Linhas ~380-387 e ~505-509: `update` em email/telefone do associado encontrado **sem comparar nome/CPF**. Foi assim que o cadastro de TOVAR ganhou os dados de contato de ERICO.

### Impacto operacional
- Cobrança, app do associado, WhatsApp e SGA/Hinova vão para a pessoa errada.
- ERICO nunca aparece como associado — todo histórico fica encaixado em TOVAR.
- TOVAR aparece com 2 contratos e 2 veículos no SGA.
- Risco de a próxima sync SGA do RIR1B37 falhar ou criar duplicidade no Hinova (CPF do contrato ≠ CPF do associado vinculado).

---

## Plano de correção

### Etapa 1 — Saneamento dos dados (migration)

1. **Restaurar PII de TOVAR** no associado e8538d7a:
   - `email = 'Tovar.rodrigueslima@gmail.com'`
   - `telefone = '21997785858'`
2. **Criar associado novo para ERICO** copiando os campos da cotação `295bb91f-...` (nome, CPF 13070948723, email, telefone, endereço, RG, CNH, data_nascimento, plano_id, dia_vencimento, status `aguardando_instalacao`, data_adesao = `2026-04-29`).
3. **Reapontar**:
   - `veiculos.id = 6aae322e` → novo `associado_id`
   - `contratos.id = 7d758a1d` → novo `associado_id`
4. **Limpar SGA**:
   - Apagar entradas em `sga_sync_queue` que façam o par errado.
   - Inserir nova entrada para o veículo RIR1B37 + ERICO com `status='pendente'`, sem `codigo_associado_hinova` herdado.
5. **Auditoria**: registrar em `logs_auditoria` a correção manual com `dados_anteriores`/`dados_novos`.

### Etapa 2 — Corrigir a raiz em `contrato-gerar`

Em `supabase/functions/contrato-gerar/index.ts`:

**A) Validar dono do veículo encontrado por placa**
Nos três pontos onde se faz `select id from veiculos where placa = X` (linhas ~427, ~526):
- Trazer também `associado_id`.
- Se `veiculo.associado_id IS NOT NULL && veiculo.associado_id !== associadoId`, **abortar** com `409`: "Placa XXX já está vinculada a outro associado. Use o fluxo de Substituição/Troca de Titularidade."

**B) Bloquear sobrescrita de PII em titular divergente**
Antes de `update` em email/telefone do associado existente (linhas ~380-388, ~505-509):
- Comparar `normalize(associadoExistente.nome)` com `normalize(nomeFinal)`. Se diferentes (Levenshtein > 3 ou tokens distintos), **não sincronizar** e logar `[ALERTA-COLISÃO] CPF=X associado_id=Y nome_db=Z nome_cot=W`.

**C) Garantir criação de novo associado quando CPF não casa**
Reverificar antes do `INSERT` (linha 593) com `SELECT ... WHERE cpf = $1` em transação curta para evitar race; se já existir, falhar com mensagem clara em vez de seguir.

**D) Telemetria estruturada**
Logar no início e fim do handler: `cotacao_id / cpf_normalizado / associado_resolvido_id / veiculo_resolvido_id / branch_tomado` para que incidentes futuros sejam diagnosticáveis em segundos via `edge_functions_logs`.

### Etapa 3 — Auditar fluxo de "Incluir Veículo"

Como a falha começou às 16:22 (antes da cotação de ERICO existir), verificar o componente/edge function que monta a inclusão de veículo a partir de um associado já existente:
- Confirmar que ele **exige** que o nome/CPF do titular do novo veículo bata com o do associado base, ou ofereça opção explícita de "novo titular" que cria associado novo.
- Adicionar confirmação visual com nome+CPF antes de gravar.

### Etapa 4 — Memória de projeto

Criar `mem://constraints/contracts/no-cross-owner-vehicle-reuse`:
> Contratos jamais reutilizam `veiculo.associado_id` de terceiros. Se a placa já existe sob outro dono, o fluxo correto é Troca de Titularidade. PII (email/telefone) só pode ser sincronizada quando o nome do solicitante bater com o nome do associado existente.

### Validação após deploy
1. Tela de Acompanhamento: ERICO deve aparecer como associado próprio com seu contrato e veículo.
2. TOVAR deve voltar a ter apenas TCU6B84 e seus dados de contato originais.
3. Re-rodar SGA sync de RIR1B37 e confirmar cadastro com CPF 13070948723.
4. Tentar gerar um contrato de teste reutilizando uma placa de outro dono → deve ser bloqueado com mensagem clara.

---

### Apêndice técnico
Arquivos tocados:
- `supabase/functions/contrato-gerar/index.ts` — itens A, B, C, D da Etapa 2.
- Migration nova com `UPDATE`/`INSERT` direcionados (Etapa 1).
- `mem://constraints/contracts/no-cross-owner-vehicle-reuse.md` (Etapa 4).
- (Possivelmente) componente da UI de inclusão de veículo (Etapa 3) — a confirmar quando entrar em build mode.
