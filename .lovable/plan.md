

# Auditoria: Integração ASAAS — Diagnóstico e Plano de Correção

## Inventário de Edge Functions ASAAS

| Função | Responsabilidade | Status |
|--------|-----------------|--------|
| `asaas-clientes` | CRUD de clientes (criar, buscar, atualizar, sincronizar) | OK |
| `asaas-cobrancas` | CRUD de cobranças (criar, buscar, cancelar, segunda via) | OK |
| `asaas-cobranca-adesao` | Gerar cobrança de adesão com anti-duplicidade | OK |
| `asaas-webhook` | Receber callbacks do ASAAS e atualizar banco | OK |
| `asaas-verificar-pagamento` | Polling ativo de status de pagamento de adesão | **BUG CRÍTICO** |
| `asaas-verificar-cota-sinistro` | Verificar pagamento de cota de participação | **BUG CRÍTICO** |
| `emitir-boleto-individual` | Emitir boleto unitário no ASAAS (usado no lote) | OK |
| `gerar-cobrancas-mensais` | Gerar cobranças mensais para todos associados ativos | OK |
| `buscar-boletos-associado` | App do associado: listar boletos direto da API ASAAS | **BUG** |
| `detalhe-boleto` | App do associado: detalhe de um boleto específico | **BUG** |
| `disparar-boletos-lote` | Notificar associados via WhatsApp/email após emissão | OK |
| `enviar-lembretes-vencimento` | Régua de lembretes (D-5, D-3, D-1, D0, D+1, D+3, D+5) | OK |
| `executar-regua-cobranca` | Régua de cobrança com etapas configuráveis | **BUG** |

---

## Problemas Encontrados

### 1. CRÍTICO: Detecção de Sandbox Invertida (2 funções)

As funções `asaas-verificar-pagamento` e `asaas-verificar-cota-sinistro` usam esta lógica:

```javascript
const IS_SANDBOX = ASAAS_API_KEY.startsWith('$aact_');
```

Isso está **invertido**. Chaves ASAAS de produção começam com `$aact_`. Essa lógica faz com que chaves de produção enviem requests para `sandbox.asaas.com`, que retorna 401/404.

**Impacto**: Em produção, a verificação de pagamento de adesão e a verificação de cota de sinistro **não funcionam**. O polling do fluxo público de contratação falha silenciosamente.

**Funções corretas** (para referência): `asaas-cobrancas`, `asaas-clientes` usam `includes('_hmlg_')` — correto.

### 2. Conflito de Status: App vs ASAAS (2 funções)

As funções `buscar-boletos-associado` e `detalhe-boleto` atualizam o campo `status` da tabela `asaas_cobrancas` com valores traduzidos para o app (`'pendente'`, `'pago'`, `'vencido'`):

```javascript
updateData.status = STATUS_MAP[payment.status]; // 'PENDING' → 'pendente'
```

Mas o `asaas-webhook`, `emitir-boleto-individual` e `gerar-cobrancas-mensais` usam os status nativos do ASAAS (`'PENDING'`, `'RECEIVED'`, `'OVERDUE'`).

**Impacto**: Quando o associado abre o app e consulta seus boletos, a função `buscar-boletos-associado` sobrescreve o status para `'pendente'`. Depois, o cron `enviar-lembretes-vencimento` que filtra por `.in('status', ['PENDING', 'OVERDUE'])` não encontra mais essas cobranças — os lembretes param de funcionar para quem abriu o app.

### 3. Régua de Cobrança Desconectada (executar-regua-cobranca)

A função `executar-regua-cobranca` consulta a tabela `cobrancas` (linhas 57-63):

```javascript
.from('cobrancas')
.select('id, associado_id, valor_final, data_vencimento')
.in('status', ['aguardando_pagamento', 'vencido'])
```

Mas o sistema de cobranças real usa a tabela `asaas_cobrancas`. A tabela `cobrancas` provavelmente é legada ou nunca foi populada. A régua processa zero registros.

**Impacto**: A régua de cobrança (suspensão, negativação, exclusão por inadimplência) nunca executa.

---

## Plano de Correção

### Fase 1: Corrigir detecção de sandbox (CRÍTICO)

**Arquivos**: `asaas-verificar-pagamento/index.ts`, `asaas-verificar-cota-sinistro/index.ts`

Substituir:
```javascript
const IS_SANDBOX = Deno.env.get('ASAAS_SANDBOX') === 'true' || ASAAS_API_KEY.startsWith('$aact_');
```
Por:
```javascript
const IS_SANDBOX = Deno.env.get('ASAAS_SANDBOX') === 'true' || ASAAS_API_KEY.includes('_hmlg_');
```

### Fase 2: Corrigir conflito de status no cache local

**Arquivos**: `buscar-boletos-associado/index.ts`, `detalhe-boleto/index.ts`

As funções devem gravar o status ASAAS nativo (PENDING, RECEIVED, etc.) no `asaas_cobrancas.status`, não o status traduzido do app. Remover o `STATUS_MAP` do update do banco — usá-lo apenas para a resposta ao frontend.

Mudar de:
```javascript
const updateData: any = { status: statusApp, ... };
```
Para:
```javascript
const updateData: any = { status: payment.status, ... };
```

A tradução `STATUS_MAP` continua sendo usada na resposta JSON ao app, mas o banco mantém consistência com os demais processos.

### Fase 3: Corrigir régua de cobrança

**Arquivo**: `executar-regua-cobranca/index.ts`

Alterar a query de `cobrancas` para `asaas_cobrancas`:

```javascript
// DE:
.from('cobrancas')
.select('id, associado_id, valor_final, data_vencimento')
.in('status', ['aguardando_pagamento', 'vencido'])

// PARA:
.from('asaas_cobrancas')
.select('id, associado_id, valor, data_vencimento')
.in('status', ['PENDING', 'OVERDUE'])
.not('asaas_id', 'like', 'LOCAL-%')
```

E ajustar `valor_final` → `valor` (nome correto da coluna em `asaas_cobrancas`).

---

## Resumo

| Correção | Arquivos | Risco |
|----------|----------|-------|
| Sandbox invertido | 2 edge functions | CRÍTICO — produção quebrada |
| Status conflitante | 2 edge functions | ALTO — lembretes param |
| Régua desconectada | 1 edge function | MÉDIO — inadimplência sem ação |

Todas as correções são cirúrgicas (poucas linhas cada). Após editar, as 5 funções precisam ser redeployadas.

