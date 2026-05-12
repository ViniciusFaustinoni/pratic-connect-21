# Bug: Instalação Base duplicada como Instalação Rota

## Diagnóstico (caso Carlos Roberto Alves / RJM3D69)

Linha do tempo no banco:

```text
12:05:15  agendamentos_base 7bf883da   status=confirmado
            vistoria_id   = a5dc8dda
            cotacao_id    = 6c6871ae...
12:13:03  vistorias  a5dc8dda          tipo=entrada  local=base
            + servicos 70bcf6c5         tipo=vistoria_entrada  status=em_andamento
              (Wallace — cobre vistoria + instalação na base)
12:14:29  instalacoes 93c2038b         local=base    status=agendada
            + servicos 74e0cec9         tipo=instalacao        status=agendada
              (sem técnico — DUPLICATA visível em "Serviços Pendentes")
```

A cotação tem `tipo_vistoria='agendada_base'` e `tipo_instalacao='base'`. O serviço `vistoria_entrada` que o Wallace executa JÁ inclui a instalação do rastreador na oficina. Mesmo assim, `criar-instalacao-pos-pagamento` rodou ~1 min depois e criou um `instalacoes` paralelo. O trigger `sync_instalacao_to_servicos` então materializou um `servicos` `instalacao` separado — a duplicata da imagem.

## Causa raiz

Em `supabase/functions/criar-instalacao-pos-pagamento/index.ts`, o bloco `if (tipoVistoria === 'agendada_base')` (linhas 218–285) lê o `agendamentos_base`, mas **não verifica** se o fluxo Base já materializou a vistoria. O guard de idempotência das linhas 508–519 só checa `instalacoes` da mesma cotação+veículo — não cobre o caso onde a operação foi materializada como `vistorias` (fluxo Base, sem `instalacoes`).

Caminhos que disparam a chamada redundante: `aprovar-proposta` (fallback ~linha 428), `agendar-vistoria-completa`, `asaas-webhook`.

## Correção

### 1. `supabase/functions/criar-instalacao-pos-pagamento/index.ts` — guard anti-duplicação no fluxo Base

Logo depois de carregar `agBase` (linhas 222–231), antes de qualquer endereço/insert, executar:

```text
SELECT id, status FROM vistorias
 WHERE cotacao_id  = :cotacaoId
   AND local_vistoria = 'base'
   AND status NOT IN ('cancelada','reprovada')
 LIMIT 1
```

Se encontrada → log + `return 200` com `{ success: true, skipped: 'base_vistoria_exists', vistoriaId }`. Não cria `instalacoes`, não dispara trigger, não gera `servicos` duplicado. Caso contrário, o fluxo segue como hoje.

Esse guard é específico para `tipo_vistoria === 'agendada_base'`. Os modos `agendada` (presencial cliente) e `autovistoria` continuam intactos — eles precisam materializar `instalacoes` por design.

### 2. Higiene one-shot do registro do Carlos Roberto Alves

Migração para zerar a duplicata atual sem mexer no atendimento do Wallace:

```text
- UPDATE servicos
    SET status='cancelada',
        observacoes = COALESCE(observacoes,'') ||
          E'\n[fix duplicata base/rota] Cancelado — coberto pela vistoria_entrada da base.'
  WHERE id = '74e0cec9-cf85-4ecb-ac3e-6f9e4d3df1d6';

- UPDATE instalacoes
    SET status='cancelada',
        observacoes = COALESCE(observacoes,'') ||
          E'\n[fix duplicata base/rota] Cancelada — duplicava vistoria base existente.'
  WHERE id = '93c2038b-755d-4354-8cdc-6ea1d8bc4a05';

- UPDATE agendamentos_base
    SET instalacao_id = NULL
  WHERE id = '7bf883da-ad69-46fb-8f0c-a78eb2b9ddee';
```

Resultado: o cartão "Instalação RJM3D69 — Hoje" some de Serviços Pendentes; o atendimento do Wallace permanece como está.

### 3. Memória nova

Após implementar:

```text
mem://logic/operations/base-nao-duplica-instalacao
"Quando tipo_vistoria='agendada_base' e a vistoria base já foi materializada
 (vistorias.local_vistoria='base'), criar-instalacao-pos-pagamento NÃO cria
 instalacoes — vistoria_entrada já cobre vistoria + instalação na oficina."
```

## Fora de escopo

- Não tocar nos modos `agendada` (cliente) e `autovistoria`.
- Não alterar triggers existentes (`sync_instalacao_to_servicos`, `dedupe_instalacoes_on_insert`) — eles funcionam corretamente quando o input não é redundante.

## Validação

- Repetir uma cotação `tipo_vistoria=agendada_base` ponta-a-ponta e confirmar no banco que existe **só** `vistorias` + `servicos.tipo='vistoria_entrada'` (zero registros novos em `instalacoes`/`servicos.tipo='instalacao'`).
- Mapa › Atribuição Manual deixa de listar RJM3D69 em Serviços Pendentes para o caso atual.
