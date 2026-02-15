

# Badges de Status e Botoes de Reenvio no Evento

## Problema
O analista de eventos nao tem visibilidade clara do status de assinatura e pagamento no evento. Precisa de:
1. Badge "Assinatura Pendente" quando o link de assinatura foi enviado mas nao assinado
2. Badge "Pendente de Pagamento" quando assinou mas nao pagou
3. Botao "Reenviar Assinatura" no menu de acoes
4. Botao "Reenviar Link de Pagamento" no menu de acoes
5. O envio deve ser feito pela IA com mensagem amigavel via WhatsApp

## Alteracoes

### Arquivo: `src/pages/eventos/SinistroAnalise.tsx`

**1. Badges no header (apos o badge de status, linha ~494)**

Adicionar dois badges condicionais:
- **Assinatura Pendente** (amber): quando `sinistro.autentique_documento_id` existe e `sinistro.termo_anuencia_assinado` e falso
- **Pendente de Pagamento** (orange): quando `sinistro.termo_anuencia_assinado` e true, `sinistro.cota_paga` e false

**2. Botoes no menu de Acoes (dentro do CardContent)**

No bloco onde `aguardandoAssinatura` e true (linha ~1313), ao inves de apenas mostrar um texto informativo:
- Manter o texto informativo
- Adicionar botao "Reenviar Assinatura" que chama a edge function `whatsapp-send-text` com mensagem amigavel contendo o link de assinatura

No bloco de status "aprovado" (linha ~1281), quando `sinistro.termo_anuencia_assinado === true` e `sinistro.cota_paga !== true`:
- Adicionar info badge "Pendente de Pagamento da Cota"
- Adicionar botao "Reenviar Link de Pagamento" que busca a cobranca em `asaas_cobrancas` pelo `sinistro.cobranca_cota_id` e envia o link via WhatsApp

**3. Estados de loading**

Adicionar dois novos estados:
- `reenviandoAssinatura` (boolean)
- `reenviandoPagamento` (boolean)

**4. Funcoes de reenvio**

- `handleReenviarAssinatura`: busca o `autentique_documento_id` do sinistro, monta mensagem amigavel com link de assinatura e envia via `whatsapp-send-text`
- `handleReenviarPagamento`: busca a cobranca pelo `cobranca_cota_id` na tabela `asaas_cobrancas`, monta mensagem amigavel com link de pagamento (`https://www.asaas.com/c/{asaas_id}`) e envia via `whatsapp-send-text`

## Mensagens WhatsApp (tom amigavel, enviadas pela IA)

**Reenvio de Assinatura:**
```
Ola {nome}! Tudo bem?

Notamos que o Termo de Entrada do seu evento {protocolo} ainda nao foi assinado.

Para darmos continuidade ao processo, precisamos da sua assinatura digital. E bem rapido e simples!

Acesse o link do email enviado por "Autentique" para assinar.

Qualquer duvida, estamos aqui para ajudar!

ABP PraticCar
```

**Reenvio de Link de Pagamento:**
```
Ola {nome}! Tudo bem?

O Termo de Entrada do evento {protocolo} ja foi assinado com sucesso!

Para que seu veiculo seja encaminhado a oficina, falta apenas o pagamento da cota de coparticipacao:

Valor: R$ {valor}
Link de pagamento: https://www.asaas.com/c/{asaas_id}

Apos a confirmacao do pagamento, seu evento sera encaminhado para reparo.

Estamos a disposicao!

ABP PraticCar
```

## Detalhes Tecnicos

| Local | Alteracao |
|---|---|
| Header badges (linha ~494) | 2 badges condicionais: "Assinatura Pendente" (amber) e "Pag. Cota Pendente" (orange) |
| Menu Acoes - aguardando assinatura (linha ~1313) | Botao "Reenviar Assinatura" com envio via whatsapp-send-text |
| Menu Acoes - aprovado (linha ~1281) | Condicional: se termo assinado mas cota nao paga, mostrar botao "Reenviar Link de Pagamento" |
| Estados (linha ~229) | `reenviandoAssinatura`, `reenviandoPagamento` |
| Funcoes handler (apos linha ~448) | `handleReenviarAssinatura`, `handleReenviarPagamento` |

