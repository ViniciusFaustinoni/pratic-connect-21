## Objetivo

Adicionar uma **etapa zero "Situação Financeira (SGA)"** no fluxo de aprovação do Cadastro (proposta comum **e** troca de titularidade). Ela é disparada automaticamente ao abrir os detalhes da solicitação, persiste o resultado e **bloqueia o avanço para a etapa de Documentos** enquanto o associado estiver inadimplente no SGA.

## Resumo da regra de negócio

- Quando: o Cadastro abre `/cadastro/propostas/:id` (proposta comum) **ou** o `ModalDetalhesTroca` no status `aguardando_cadastro` (troca).
- Pré-condição: existir CPF do solicitante (já garantido em ambos os fluxos — proposta comum tem `cliente_cpf`/`associado.cpf`; troca tem `associado_antigo.cpf` e `codigo_hinova`).
- Disparo: `useEffect` ao montar a tela. Status do gate fica em cache no React Query e em uma tabela de auditoria nova `sga_situacao_check` (assim qualquer aprovador subsequente vê o último resultado sem refazer a chamada).
- Resultado:
  - **Adimplente** (sem boletos abertos vencidos / saldo devedor = 0) → libera as etapas seguintes (comportamento atual preservado).
  - **Inadimplente** → o stepper fica travado na Etapa 0; mostra cartão "Pendência financeira no SGA" com lista resumida de boletos abertos e botão "Consultar SGA novamente".
- Reverificação: o botão chama o mesmo edge `sga-listar-boletos-associado` com `force` (bypass de cache) e atualiza a auditoria.
- Quem ignora: ninguém. Bypass só pelo Diretor — adicionar permissão `cadastro.bypass_inadimplencia_sga` no `app_roles_config` (default só para `diretor`); quando presente, a UI renderiza um botão "Prosseguir mesmo assim (auditado)" que grava `bypass_motivo` na auditoria e libera o avanço. Sem essa permissão, o avanço fica bloqueado.

## Reúso (não recriar)

Já existe a infraestrutura básica:

- Edge function `sga-listar-boletos-associado` — usa `codigo_associado` + `cpf` e retorna `{tem_debito, saldo_devedor_total, veiculos[].boletos_abertos[]}`. **Reaproveitada** integralmente.
- Hook `useBoletosSgaPorAssociado` (já consome essa edge) — base para o novo `useSituacaoFinanceiraCadastro`.
- Hook `useAnalisePreviaSGA` (`analisar-novo-titular-troca`) — já faz check parecido para o **novo titular**. Não confundir: o gate proposto é sobre o **associado existente** (proposta comum) ou o **titular antigo** (troca). Vou complementar, não substituir.

## Mudanças

### 1. Banco — auditoria do check (migração)

Tabela `sga_situacao_check`:

```text
id uuid pk
contrato_id uuid null
solicitacao_troca_id uuid null
associado_id uuid null
cpf text not null
codigo_hinova int null
verificado_em timestamptz default now()
verificado_por uuid null            -- auth user
tem_debito bool not null
saldo_devedor numeric(12,2) not null default 0
qtd_boletos_abertos int not null default 0
payload jsonb                       -- snapshot do retorno do SGA
bypass bool default false
bypass_motivo text null
bypass_por uuid null
```

RLS: só funcionários internos (mesmo padrão das demais tabelas SGA) leem; insert via edge.

Índices: `(contrato_id, verificado_em desc)`, `(solicitacao_troca_id, verificado_em desc)`.

Permissão nova: linha em `app_roles_config` com chave `cadastro.bypass_inadimplencia_sga` (default `['diretor']`).

### 2. Edge function nova: `verificar-situacao-financeira-cadastro`

- Input: `{ contrato_id?, solicitacao_troca_id?, force?: boolean, bypass?: { motivo: string } }`.
- Resolve `cpf` + `codigo_hinova` a partir do `contrato.associado_id` (proposta) ou `solicitacao.associado_antigo_id` (troca).
- Lê última linha de `sga_situacao_check` para esse contexto; se `force=false` e `verificado_em` < 10 min → devolve cache (evita rajada).
- Senão chama internamente `sga-listar-boletos-associado` (reuso) e grava nova linha.
- Se `bypass` preenchido: valida que o usuário tem `cadastro.bypass_inadimplencia_sga`; grava com `bypass=true`.
- Output normalizado: `{ check, sga_payload }`.

### 3. Frontend — gate na proposta comum

Em `src/pages/cadastro/PropostaAnalise.tsx`:

- Novo hook `useSituacaoFinanceiraCadastro({ contratoId })` → invoca a edge nova; expõe `data, isLoading, refetch, bypass`.
- Componente novo `SituacaoFinanceiraGate.tsx` que:
  - Renderiza um cartão antes do `PropostaApprovalStepper`;
  - Em loading: skeleton "Consultando SGA…";
  - Em erro transitório: banner âmbar com retry;
  - Em adimplente: badge verde "Situação OK no SGA — verificado em hh:mm" e libera o stepper;
  - Em inadimplente: cartão vermelho com saldo total, lista de boletos abertos (data/valor/situação) e dois botões: **Consultar novamente** + (apenas se `permission`) **Prosseguir mesmo assim**.
- Em `PropostaAnalise`, condicionar a renderização do `PropostaApprovalStepper` a `gate.liberado === true`. O cartão do stepper continua visível em readonly quando bloqueado, com etapas em opacidade reduzida (mensagem "Aguardando regularização").

### 4. Frontend — gate na troca de titularidade

Em `src/components/troca-titularidade/ModalDetalhesTroca.tsx`:

- Quando `solicitacao.status === 'aguardando_cadastro'`, renderizar o mesmo `SituacaoFinanceiraGate` (com `solicitacaoTrocaId`) acima dos botões "Aprovar pelo Cadastro / Reprovar".
- O botão "Aprovar pelo Cadastro" fica `disabled` enquanto `gate.liberado !== true`.

### 5. Backend hardening

Em `aprovar-proposta` e `aprovar-troca-cadastro` (edge functions): consultar a última `sga_situacao_check` do contexto e bloquear (HTTP 409 `inadimplencia_sga_pendente`) se não houver linha "liberadora" (adimplente OU bypass) nas últimas 24h. Isso garante que mesmo um cliente forçando a chamada não passa.

### 6. Telemetria

`sga_sync_logs` recebe nova `action='check_situacao_cadastro'` para correlacionar com o resto do diagnóstico SGA.

## Casos cobertos / não-quebra de regras existentes

- **Proposta nova sem associado prévio (`associado_id IS NULL`)**: edge resolve via `cliente_cpf` do contrato; se o SGA não encontra associado → trata como **adimplente** (não há débito) e libera. Documenta no payload `motivo='associado_inexistente_sga'`.
- **Erro transitório do SGA**: gate **não bloqueia** — exibe alerta âmbar e habilita o avanço (mantém UX e não trava operação durante incidente). Backend `aprovar-proposta` aceita check com `motivo='transitorio'` desde que `verificado_em` ≤ 30 min.
- **Inclusão de veículo / substituição**: já passam por `aprovar-proposta`; ganham o gate automaticamente.
- **Autovistoria / vistoria base**: o gate é só na entrada da tela de aprovação do Cadastro; nada muda no fluxo de execução do técnico.
- **Bypass do Diretor**: registrado em `sga_situacao_check.bypass_motivo` + `bypass_por`; aparece na timeline.

## Bloqueio ao final do passo anterior

A correção do termo de filiação (passo 1 do plano anterior) ficou pendente do código `tipo_foto` da Hinova para `contrato_assinado`. Esta nova feature **não depende** dessa pendência — pode ser implementada em paralelo.

---

## Detalhes técnicos para revisão

- **Endpoint Hinova usado**: `POST /listar/boleto-associado-veiculo` (já abstraído em `_shared/hinova-client.ts` via `listarBoletosVeiculo`); não é necessário criar novo cliente.
- **Janela mínima exigida pela API**: 90 dias. Edge envia `data_vencimento_inicial = hoje - 90d`, `data_vencimento_final = hoje`. Suficiente para detectar inadimplência ativa (boletos abertos vencidos).
- **Critério de inadimplência**: qualquer boleto com `codigo_situacao_boleto` em `{vencido, aguardando_pagamento}` e `data_vencimento < hoje`. `saldo_devedor_total > 0` apenas com vencidos abertos. Boletos a vencer no futuro não bloqueiam.
- **Idempotência**: gate sempre escreve nova linha (auditoria histórica). UI consome a mais recente por contexto.
