

# Correcao do Fluxo Pos-Aprovacao: Pagamento PRIMEIRO, Termo DEPOIS

## Diagnostico

O sistema atual esta com a **ordem invertida**. Atualmente: Termo (assinatura manual no celular) -> Pagamento. O correto e: **Pagamento -> Termo (via Autentique)**.

Alem disso, o Autentique ja e invocado no momento da aprovacao (`analisar-evento` linha 162), quando deveria ser invocado **somente apos confirmacao do pagamento**.

---

## Problemas Identificados

| # | Problema | Impacto |
|---|---------|---------|
| 1 | Ordem invertida: Termo antes do Pagamento | CRITICO - fluxo errado |
| 2 | Termo usa SignaturePad manual em vez de Autentique | CRITICO - deveria ser assinatura digital via Autentique |
| 3 | Autentique e chamado na aprovacao, deveria ser chamado apos pagamento | CRITICO - timing errado |
| 4 | Cobranca ASAAS nao e criada automaticamente na aprovacao | MEDIO - usuario precisa clicar para gerar |
| 5 | Nao existe status "pronto_para_oficina" | MEDIO - falta gatilho final |
| 6 | Pagina nao mostra estado "aguardando assinatura do termo" | MEDIO - UX incompleta |
| 7 | Nao ha lembrete diario automatico | MENOR - pode ser feito depois |

---

## Plano de Correcao

### Etapa 1 — Alterar `analisar-evento` (Edge Function)

Quando o analista aprova:

1. Calcular valor da cota de coparticipacao no backend (MAX(fipe * percentual, minima))
2. Criar cobranca automatica no ASAAS (billingType: UNDEFINED para permitir PIX ou cartao)
3. Gerar link unico expiravel (72h) — ja faz isso
4. **REMOVER** a chamada ao `autentique-evento-create` — nao deve mais ser chamado aqui
5. Enviar WhatsApp com link para pagamento (ja faz)
6. Salvar `cobranca_cota_id` no sinistro

### Etapa 2 — Alterar `processar-termo-evento` (Edge Function)

Reestruturar as acoes:

- **`validar`**: Retornar estado atual: `ja_pagou`, `ja_assinou_termo` (via Autentique), e os dados do sinistro/cota. Remover `ja_assinou` que se referia a assinatura manual.

- **`gerar_cobranca_pix`**: Remover a validacao "assine o termo primeiro" (linhas 232-237). PIX e a primeira acao agora, nao precisa de assinatura previa.

- **`gerar_cobranca_cartao`**: Idem — remover validacao de assinatura previa (linhas 379-384).

- **`verificar_pagamento`**: Quando pagamento confirmado, alem do que ja faz, **invocar `autentique-evento-create`** para gerar o Termo de Entrada via Autentique. Status muda para `aguardando_termo`.

- **Remover** a acao `assinar` (que usa SignaturePad) — a assinatura agora e 100% via Autentique.

- **Nova acao `verificar_termo`**: Consulta o status do documento Autentique vinculado ao sinistro. Se assinado, atualiza status para `pronto_para_oficina`.

### Etapa 3 — Alterar `EventoPosAprovacao.tsx` (Pagina Publica)

Reorganizar as etapas visuais:

```text
Etapa 1: Pagamento (PIX ou Cartao)
Etapa 2: Assinatura do Termo (via Autentique - link externo)
Sucesso: "Tudo certo!"
```

Estados da pagina:
- `pagamento` — mostra detalhamento da cota + opcoes PIX/Cartao (componente `EventoPagamentoCota`)
- `aguardando_termo` — mostra mensagem "Pagamento confirmado! Enviamos o Termo de Entrada para seu e-mail/WhatsApp via Autentique. Assine digitalmente para continuar." + polling para verificar assinatura
- `sucesso` — mostra "Tudo certo! Pagamento confirmado e Termo assinado."

Logica de estado inicial baseada na resposta do `validar`:
- Se `ja_pagou` e `ja_assinou_termo` -> `sucesso`
- Se `ja_pagou` e NAO `ja_assinou_termo` -> `aguardando_termo`
- Se NAO `ja_pagou` -> `pagamento`

### Etapa 4 — Remover `EventoTermoAssinatura.tsx`

Este componente usa SignaturePad para assinatura manual. Sera substituido por uma tela informativa que indica que o Termo foi enviado via Autentique e mostra o status (pendente/assinado).

Criar novo componente `EventoAguardandoTermo.tsx`:
- Icone de documento
- "Pagamento Confirmado!"
- "Enviamos o Termo de Entrada para assinatura digital."
- "Verifique seu e-mail e WhatsApp para assinar."
- Link direto para o documento Autentique (se disponivel)
- Polling a cada 10s para verificar se o termo ja foi assinado
- Quando assinado, transiciona automaticamente para tela de sucesso

### Etapa 5 — Atualizar logica de status do sinistro

Sequencia correta de status apos aprovacao:
```text
aprovado -> aguardando_cota -> pagamento_confirmado -> aguardando_termo -> pronto_para_oficina
```

O gatilho para `pronto_para_oficina` ocorre quando AMBOS:
1. `cota_paga = true`
2. Documento Autentique com status `signed`

---

## Arquivos Afetados

| Acao | Arquivo |
|---|---|
| Modificar | `supabase/functions/analisar-evento/index.ts` — adicionar criacao automatica de cobranca ASAAS e remover chamada Autentique |
| Modificar | `supabase/functions/processar-termo-evento/index.ts` — inverter ordem, remover acao "assinar", adicionar acao "verificar_termo", mover Autentique para pos-pagamento |
| Modificar | `src/pages/public/EventoPosAprovacao.tsx` — reorganizar etapas (pagamento primeiro, termo depois) |
| Modificar | `src/components/evento/EventoPagamentoCota.tsx` — remover dependencia de assinatura previa |
| Criar | `src/components/evento/EventoAguardandoTermo.tsx` — nova tela de aguardando assinatura Autentique |
| Remover logica de | `src/components/evento/EventoTermoAssinatura.tsx` — nao sera mais usado neste fluxo |

---

## Resumo Visual do Novo Fluxo

```text
Analista aprova evento
  |
  v
Sistema automaticamente:
  - Calcula cota
  - Cria cobranca ASAAS
  - Gera link 72h
  - Envia WhatsApp
  |
  v
Associado acessa link
  |
  v
[ETAPA 1] Pagamento (PIX ou Cartao)
  |
  v
Pagamento confirmado (webhook ASAAS ou polling)
  |
  v
Sistema cria Termo via Autentique
  |
  v
[ETAPA 2] Aguardar assinatura digital
  |
  v
Termo assinado (webhook Autentique ou polling)
  |
  v
Status: pronto_para_oficina
```

