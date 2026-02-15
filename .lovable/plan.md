
# Enviar Link de Pagamento Asaas Apos Assinatura do Termo

## Contexto

Atualmente, quando o Termo de Entrada de Evento e assinado via Autentique (webhook), o sistema:
1. Marca `termo_anuencia_assinado = true`
2. Salva o PDF assinado
3. Notifica o analista

Porem, **nao gera a cobranca Asaas nem envia o link de pagamento ao associado via WhatsApp**.

O associado SIN-20250215-0004 (MARCUS VINICIUS) ja assinou o termo mas nao recebeu link de pagamento - caso retroativo.

---

## Alteracoes

### 1. Autentique Webhook - Gerar cobranca e enviar link apos assinatura

**Arquivo:** `supabase/functions/autentique-webhook/index.ts`

No bloco onde o termo de evento e processado como assinado (apos linha ~458), adicionar:

1. Verificar se o sinistro ja possui `cobranca_cota_id` (ja tem cobranca) ou `cota_paga = true` (ja pagou)
2. Se NAO possui cobranca:
   - Buscar/criar cliente Asaas para o associado
   - Criar cobranca PIX no Asaas com valor da `valor_cota_participacao` do sinistro
   - Gerar QR Code PIX
   - Salvar cobranca na tabela `asaas_cobrancas`
   - Atualizar `sinistros.cobranca_cota_id`
   - Gerar link de pagamento: `https://www.asaas.com/c/{asaas_id}`
   - Enviar via WhatsApp ao associado com mensagem contendo o link de pagamento e o QR Code PIX
3. Se JA possui cobranca mas nao pagou:
   - Buscar dados da cobranca existente
   - Enviar/reenviar link de pagamento via WhatsApp

### 2. Correcao retroativa

**Arquivo:** Nova edge function `supabase/functions/retroativo-pagamento-termo/index.ts`

Edge function que sera executada uma vez para corrigir os sinistros que ja tiveram o termo assinado mas nao receberam o link de pagamento:

1. Buscar todos os sinistros com `termo_anuencia_assinado = true` e `cota_paga = false` e `cobranca_cota_id IS NULL`
2. Para cada um:
   - Criar cobranca PIX no Asaas
   - Salvar na `asaas_cobrancas`
   - Atualizar `sinistros.cobranca_cota_id`
   - Enviar link de pagamento via WhatsApp ao associado

---

## Detalhes Tecnicos

### Mensagem WhatsApp enviada ao associado

```
💳 *PRATIC - Pagamento da Cota de Coparticipacao*

Ola {nome},

O Termo de Entrada do evento {protocolo} foi assinado com sucesso!

Agora, efetue o pagamento da cota de coparticipacao:

💰 Valor: R$ {valor}
📋 Link de pagamento: https://www.asaas.com/c/{asaas_id}

Apos o pagamento, seu evento sera encaminhado para a oficina.
```

### Fluxo completo apos alteracao

```text
Termo Assinado (Autentique Webhook)
  |
  ├─ Marca termo_anuencia_assinado = true
  ├─ Salva PDF assinado
  ├─ Notifica analista
  └─ [NOVO] Gera cobranca Asaas + Envia link WhatsApp
       |
       └─ Associado paga
            |
            └─ Asaas webhook confirma pagamento
                 |
                 └─ Status -> pronto_para_oficina
```

### Arquivos afetados

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/autentique-webhook/index.ts` | Adicionar logica de geracao de cobranca Asaas e envio de link de pagamento via WhatsApp apos assinatura do termo de evento |
| `supabase/functions/retroativo-pagamento-termo/index.ts` | Nova edge function para correcao retroativa dos sinistros com termo assinado sem cobranca |
