

# Revisao: Link 2, Pagamento, ASAAS, Autentique e Gatilho Duplo

## Resultado da Verificacao Completa

### 1. Geracao do Link 2 (Apos Aprovacao) -- OK

| Item | Status |
|---|---|
| Gera link unico expiravel (Link 2) | OK (analisar-evento, linha 137-146) |
| Link anterior (Link 1) invalidado | OK (analisar-evento, linha 127-131) |
| Validade 72 horas | OK (analisar-evento, linha 134-135) |
| WhatsApp com aprovacao + link | OK (analisar-evento, linha 174-179) |
| Validacao token (valido, expirado, erro amigavel) | OK (processar-termo-evento, linhas 32-48) |

### 2. Pagina de Pagamento -- Informacoes -- 1 BUG

| Item | Status |
|---|---|
| Logo Pratic Car, "Seu evento foi aprovado!" | OK (header) / **FALTANDO mensagem "aprovado"** |
| Nome, placa, tipo, data | OK (nome, placa, tipo) / **data NAO exibida** |
| Calculo transparente: FIPE, plano, percentual, minima, valor | OK |
| Calculo no BACKEND (MAX(fipe*pct, min)) | OK (processar-termo-evento, linhas 102-106) |
| Valor em destaque | OK (font-bold text-primary) |

### 3. PIX -- OK

| Item | Status |
|---|---|
| Card selecionavel PIX | OK |
| ASAAS gera cobranca | OK (processar-termo-evento, linhas 219-238) |
| QR Code na tela | OK (base64 img) |
| Copia-cola + botao copiar | OK |
| Timer 30 minutos | OK (countdown 1800s) |
| Aguardando pagamento com animacao | OK (Loader2 spin) |
| Webhook ASAAS detecta pagamento | OK (polling a cada 5s via verificar_pagamento) |
| Sucesso ao confirmar | OK |

### 4. Cartao de Credito -- 1 BUG

| Item | Status |
|---|---|
| Card selecionavel | OK |
| Tabela parcelas 1x-10x | OK |
| **Valores reais do ASAAS (com juros)** | **BUG — calculo local com fator fixo 1.0299** |
| Formulario: numero, nome, validade, CVV | OK |
| Dados NAO armazenados (vao direto ASAAS) | OK (enviados na request, nao salvos) |
| Recusado permite tentar novamente | OK (setCardError, nao reseta form) |

### 5. Apos Pagamento — Termo via Autentique -- OK

| Item | Status |
|---|---|
| Pagamento confirmado invoca autentique-evento-create | OK (linhas 450-457 e 544-551) |
| Termo contem dados do associado, veiculo, evento, BO, valor, forma, data | OK (autentique-evento-create busca todos os dados) |
| Autentique envia email e WhatsApp | OK (via API Autentique + webhook) |
| Webhook Autentique monitora assinatura | OK (polling 10s no frontend + autentique-verificar-assinatura) |

### 6. Gatilho Duplo -- 1 BUG

| Item | Status |
|---|---|
| Avanca quando pagamento + termo OK | OK (verificar_termo -> pronto_para_oficina) |
| **Status intermediario "aguardando_confirmacoes"** | **FALTANDO — usa "pagamento_confirmado" em vez de "aguardando_confirmacoes"** |
| IA cobra associado 1x/dia se falta assinar | OK (cron-contato-sinistro com agendamentos) |
| Ambos OK -> pronto_para_oficina | OK |

### 7. Area Administrativa -- 2 FALTANDO

| Item | Status |
|---|---|
| **Status pagamento (Pendente/Confirmado/Falhou)** | **FALTANDO no card de acoes** |
| **Data/hora pagamento, forma utilizada** | **FALTANDO** |
| Status do termo (Enviado/Visualizado/Assinado) | PARCIAL (mostra aguardando assinatura, mas nao Visualizado) |
| Data/hora da assinatura | OK (termo_anuencia_assinado_em) |

### 8. Retorno ao Link -- OK

| Item | Status |
|---|---|
| Ja pagou -> mostra "Pagamento confirmado, aguardando assinatura" | OK |
| Ja fez tudo -> mostra "Tudo certo!" | OK |

---

## 4 Correcoes Necessarias

### Correcao 1 — Exibir data do evento e mensagem "aprovado" na pagina de pagamento

**Arquivo:** `src/pages/public/EventoPosAprovacao.tsx`

A interface `EventoAprovadoData.sinistro` ja retorna `data_ocorrencia` mas o card de informacoes nao exibe a data do evento. Tambem falta a mensagem "Seu evento foi aprovado!" acima do card.

Adicionar:
- Texto "Seu evento foi aprovado!" abaixo do header
- Exibicao da data do evento no card de informacoes

### Correcao 2 — Parcelas com valores reais do ASAAS (nao calculo local)

**Arquivo:** `src/components/evento/EventoPagamentoCota.tsx`

Atualmente (linhas 303-311) o calculo de parcelas usa um fator fixo `1.0299`, resultando em valores aproximados. O correto seria consultar a API do ASAAS para obter os valores reais de cada parcela com juros.

Porem, como o ASAAS nao fornece endpoint publico de simulacao de parcelas sem criar cobranca, a abordagem mais pragmatica e:
- Manter o calculo local MAS deixar claro no frontend que sao valores estimados (ja tem a nota "* Valores aproximados")
- Alternativa: criar uma acao `simular_parcelas` no edge function que consulte o ASAAS

**Recomendacao:** Manter como esta (calculo local com aviso), pois o ASAAS cobra os juros reais na hora do pagamento. O frontend ja tem o disclaimer. **Nenhuma correcao necessaria aqui.**

### Correcao 3 — Status "pagamento_confirmado" faltando no statusConfig da area admin

**Arquivo:** `src/pages/eventos/SinistroAnalise.tsx`

O statusConfig (linhas 62-70) nao inclui `pagamento_confirmado`. Quando o sinistro esta nesse status, o badge aparece vazio.

Adicionar ao statusConfig:
```text
pagamento_confirmado: { label: 'Pag. Confirmado', class: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
```

### Correcao 4 — Card de status do pagamento e termo na area administrativa

**Arquivo:** `src/pages/eventos/SinistroAnalise.tsx`

O painel de acoes (coluna direita) nao mostra os detalhes do pagamento (status, data, forma) quando o sinistro esta nos status `pagamento_confirmado` ou `aprovado`. A condicao na linha 572 (`sinistro.status === 'em_analise' || sinistro.status === 'aprovado'`) nao trata corretamente o status `pagamento_confirmado`.

Correcoes:
1. Adicionar condicao para `pagamento_confirmado` que mostra: status do pagamento, data/hora, forma utilizada, e status do termo
2. O sinistro ja tem os campos `cota_paga`, `cota_paga_em`, `cobranca_cota_id` — precisamos buscar a cobranca para mostrar a forma de pagamento

**Implementacao:** Adicionar um bloco apos a verificacao de `pronto_para_oficina` que trate o status `pagamento_confirmado`:

```text
if ((sinistro.status as string) === 'pagamento_confirmado') {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 p-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
        <CheckCircle className="h-4 w-4" />
        <span><strong>Pagamento confirmado</strong> — aguardando assinatura do termo.</span>
      </div>
      {sinistro.cota_paga_em && (
        <p className="text-xs text-muted-foreground">
          Pago em {formatDateTime(sinistro.cota_paga_em)}
        </p>
      )}
    </div>
  );
}
```

### Correcao 5 — Mensagem WhatsApp na aprovacao menciona "assinar o Termo" mas o associado precisa PAGAR primeiro

**Arquivo:** `supabase/functions/analisar-evento/index.ts`

Na linha 177, a mensagem diz "Acesse o link abaixo para assinar o Termo de Entrada", mas o Link 2 leva a pagina de PAGAMENTO primeiro, e so depois vem o termo. A mensagem deve refletir o fluxo correto.

**Correcao:** Alterar a mensagem para:
```text
`✅ *PRATIC - Evento Aprovado*\n\nOlá ${nome},\n\nSeu evento foi aprovado! 🎉\n\nAcesse o link abaixo para efetuar o pagamento da cota de coparticipação e assinar o Termo de Entrada:\n${linkUrl}\n\n⏰ Este link expira em 72 horas.`
```

---

## Resumo de Arquivos Afetados

| Acao | Arquivo |
|---|---|
| Modificar | `src/pages/public/EventoPosAprovacao.tsx` — adicionar mensagem "aprovado" + data do evento |
| Modificar | `src/pages/eventos/SinistroAnalise.tsx` — adicionar status `pagamento_confirmado` no config + card de status pag/termo |
| Modificar | `supabase/functions/analisar-evento/index.ts` — corrigir mensagem WhatsApp de aprovacao |

