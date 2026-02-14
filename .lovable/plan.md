

# Pagina Publica Pos-Aprovacao: Assinatura do Termo + Pagamento da Cota

## Resumo

Criar a pagina publica que o associado acessa pelo novo link gerado apos a aprovacao do analista. A pagina tem 2 etapas: (1) assinatura do Termo de Entrada de Evento e (2) pagamento da cota de coparticipacao via PIX ou cartao de credito, integrado ao ASAAS.

---

## 1. Banco de Dados

### Adicionar campos na tabela `sinistro_evento_links`

O novo link gerado pela aprovacao (via `analisar-evento`) ja cria um registro com `etapa_atual = 0`. Precisamos adicionar campos para rastrear as etapas pos-aprovacao:

- `assinatura_url` (text) -- URL da imagem da assinatura no Storage
- `assinatura_ip` (text) -- IP do associado no momento da assinatura
- `assinatura_em` (timestamptz) -- data/hora da assinatura
- `pagamento_confirmado_em` (timestamptz) -- data/hora da confirmacao do pagamento

### Adicionar status `pagamento_confirmado` ao enum `status_sinistro`

O enum ja tem `aguardando_cota` e `aguardando_termo`. Adicionar `pagamento_confirmado` para quando o pagamento for efetivado.

---

## 2. Edge Function: `processar-termo-evento`

Nova edge function publica (verify_jwt = false) que centraliza as acoes do associado no link pos-aprovacao:

**Acao "validar":**
- Valida token (ativo, nao expirado)
- Busca dados do sinistro com associado, veiculo, plano
- Calcula valor da cota no backend: `MAX(valor_fipe * cota_participacao / 100, cota_minima)`
- Retorna: dados do sinistro, associado, veiculo, valor da cota calculado, status do link (ja assinou? ja pagou?)

**Acao "assinar":**
- Recebe: token, imagem da assinatura (base64), IP do cliente
- Faz upload da assinatura para Storage `sinistro-eventos/{sinistro_id}/termo-assinatura.png`
- Atualiza `sinistro_evento_links`: assinatura_url, assinatura_ip, assinatura_em, etapa_atual = 1
- Atualiza `sinistros`: termo_anuencia_assinado = true, termo_anuencia_url, termo_anuencia_assinado_em
- Retorna confirmacao

**Acao "gerar_cobranca_pix":**
- Recebe: token
- Valida que ja assinou o termo
- Calcula valor da cota (novamente, no backend)
- Sincroniza/busca cliente no ASAAS (reutiliza logica existente)
- Cria cobranca PIX no ASAAS com descricao "Cota de Coparticipacao - Evento {protocolo}"
- Salva cobranca em `asaas_cobrancas` com tipo = 'cota_participacao'
- Atualiza `sinistros.cobranca_cota_id`
- Retorna: QR Code PIX, codigo copia-e-cola, ID da cobranca

**Acao "gerar_cobranca_cartao":**
- Recebe: token, dados do cartao (numero, nome, validade, cvv), parcelas
- Valida que ja assinou o termo
- Calcula valor da cota
- Cria cobranca no ASAAS com billingType = 'CREDIT_CARD' e creditCard + creditCardHolderInfo
- Se aprovado: atualiza status do sinistro, notifica via WhatsApp
- Se recusado: retorna erro para o frontend

**Acao "verificar_pagamento":**
- Recebe: token, cobranca_id
- Verifica status da cobranca no ASAAS (polling do frontend)
- Se confirmado: atualiza sinistro.status para `pagamento_confirmado`, cota_paga = true, cota_paga_em, notifica WhatsApp
- Retorna status atual

---

## 3. Nova Pagina Publica: `EventoPosAprovacao.tsx`

Pagina em `/evento-aprovado/:token` que reutiliza a mesma estetica da pagina `EventoColisao.tsx`.

### Header
- Logo Pratic Car
- Protocolo do evento
- Dados resumidos (associado, veiculo)

### Logica de estado
- Se link invalido/expirado: mensagem amigavel com contato
- Se nao assinou: mostra Etapa "Assinatura do Termo"
- Se assinou mas nao pagou: mostra Etapa "Pagamento da Cota"
- Se ja pagou: mostra tela de sucesso

### Etapa Assinatura (`EventoTermoAssinatura.tsx`)
- Logo Pratic Car
- Dados do associado (nome, CPF) e veiculo (placa, marca/modelo)
- Dados do evento (tipo, data, B.O.)
- Valor da cota (exibido)
- Texto do termo (placeholder legal extenso com clausulas)
- O texto deve ter scroll (o associado precisa rolar ate o final)
- Componente `SignaturePad` reutilizado (ja existe em `src/components/instalador/SignaturePad.tsx`)
- Botao "Limpar Assinatura" e "Assinar e Prosseguir"
- Ao assinar: chama edge function acao "assinar", avanca para pagamento

### Etapa Pagamento (`EventoPagamentoCota.tsx`)
- Titulo "Pagamento da Cota de Coparticipacao"
- Resumo do calculo transparente: valor FIPE, percentual, cota minima, valor final
- Tabs ou radio para selecionar metodo: PIX ou Cartao

**PIX:**
- Ao selecionar, chama "gerar_cobranca_pix"
- Mostra QR Code (imagem base64)
- Mostra codigo copia-e-cola com botao copiar
- Cronometro de 30 minutos
- Polling a cada 5 segundos via "verificar_pagamento"
- Quando confirmado: avanca para tela de sucesso

**Cartao:**
- Formulario: numero, nome, validade, CVV
- Seletor de parcelas (1x a 10x)
- Simulacao de parcelas (chamar ASAAS para obter valores com juros)
- Botao "Pagar"
- Se aprovado: avanca para sucesso
- Se recusado: mostra erro, permite tentar novamente

### Tela de Sucesso
- Icone de check verde
- "Pagamento confirmado!"
- "O reparo do seu veiculo sera agendado em breve. Voce recebera atualizacoes pelo WhatsApp."
- Dados do pagamento (valor, metodo, data)

---

## 4. Integracao com ASAAS Webhook

O webhook do ASAAS (`asaas-webhook`) ja existe e processa `PAYMENT_CONFIRMED`. Precisamos adicionar logica para:
- Quando uma cobranca do tipo `cota_participacao` for confirmada:
  - Atualizar `sinistros.cota_paga = true, cota_paga_em = now()`
  - Atualizar `sinistros.status = 'pagamento_confirmado'`
  - Atualizar `sinistro_evento_links.pagamento_confirmado_em = now()`
  - Enviar WhatsApp ao associado confirmando pagamento

---

## 5. Arquivos a Criar

| Arquivo | Descricao |
|---|---|
| Migration SQL | Campos no `sinistro_evento_links`, status `pagamento_confirmado` no enum |
| `supabase/functions/processar-termo-evento/index.ts` | Validar, assinar, gerar cobranca, verificar pagamento |
| `src/pages/public/EventoPosAprovacao.tsx` | Pagina principal pos-aprovacao |
| `src/components/evento/EventoTermoAssinatura.tsx` | Componente da assinatura do termo |
| `src/components/evento/EventoPagamentoCota.tsx` | Componente de pagamento (PIX + Cartao) |

## 6. Arquivos a Modificar

| Arquivo | Mudanca |
|---|---|
| `src/App.tsx` | Rota `/evento-aprovado/:token` |
| `supabase/config.toml` | `verify_jwt = false` para `processar-termo-evento` |
| `supabase/functions/asaas-webhook/index.ts` | Tratar cobrancas tipo `cota_participacao` |

---

## 7. Calculo da Cota (Backend)

```text
// Buscar plano do associado via contrato ativo
plano = associado -> contratos (ativo) -> plano_id -> planos

valor_fipe = veiculo.valor_fipe
percentual = plano.cota_participacao (ex: 6)
cota_minima = plano.cota_minima (ex: 1200)

valor_calculado = valor_fipe * percentual / 100
valor_cota = MAX(valor_calculado, cota_minima)
```

O calculo e feito APENAS no backend (edge function). O frontend apenas exibe o resultado.

---

## 8. Seguranca

- Dados do cartao NUNCA sao armazenados -- enviados direto para ASAAS via edge function
- O calculo da cota e feito no backend para evitar manipulacao
- O link e validado a cada acao (token + status ativo + nao expirado)
- A assinatura captura IP e timestamp para auditoria
- O pagamento via PIX e verificado tanto por polling quanto por webhook (dupla verificacao)

