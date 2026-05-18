## Objetivo

Permitir que o consultor crie a **cotação da Troca de Titularidade em paralelo** ao envio do termo de cancelamento (sem esperar a assinatura do antigo titular). A **liberação do link público** (acesso da página pública + envio do WhatsApp com o link ao novo titular) continua **bloqueada até a assinatura** do termo.

Justificativa de negócio: o novo titular não é obrigado a manter a proteção; o consultor adianta a montagem da cotação. Mas o novo titular só pode interagir com o link público após o antigo de fato cancelar.

---

## Mapa do fluxo — antes vs. depois

```text
ANTES (hoje):

[Criar Solicitação] ──► status=cotacao_em_andamento
                         envia termo de cancelamento (Autentique)
                                  │
                       ┌──────────┴─ aguarda assinatura ──────────┐
                       │                                          │
              Botão "Realizar Cotação"   ◄── BLOQUEADO até assinatura
                       │
              (após assinatura)
                       ▼
              Abre CotacaoFormDialog ──► cria cotação ──► vincular-cotacao-troca
                                                          (valida assinatura)
                                                                  │
                                                                  ▼
                                                       link público gerado e
                                                       enviado por WhatsApp
                                                                  │
                                                                  ▼
                                                       novo titular acessa
```

```text
DEPOIS (novo):

[Criar Solicitação] ──► status=cotacao_em_andamento
                         envia termo de cancelamento (Autentique)
                                  │
                ┌─────────────────┴──────────────────┐
                │                                    │
   Botão "Realizar Cotação" LIBERADO          Aguarda assinatura
   imediatamente após criar solicitação              │
                │                                    │
                ▼                                    │
   CotacaoFormDialog ──► cria cotação ──► vincular-cotacao-troca
   (sem exigir assinatura)                  (NÃO exige mais assinatura)
                │                                    │
                ▼                                    │
   Cotação fica em estado                            │
   "Aguardando liberação do link"                    │
   (sem WhatsApp, sem acesso público)                │
                │                                    │
                └────────────► AO assinar termo ◄────┘
                                       │
                                       ▼
                          Trigger no autentique-webhook:
                            - dispara WhatsApp com o link público
                            - libera acesso da página pública
                                       │
                                       ▼
                              novo titular acessa o link
                              → continua fluxo normal
                              (cadastro → monitoramento → efetivar)
```

---

## Pontos de mudança (detalhe técnico)

### 1. UI — `src/components/troca-titularidade/ModalDetalhesTroca.tsx`
- Remover trava do botão "Realizar Cotação": `podeGerar` passa a ser `true` enquanto status=`cotacao_em_andamento` (independente de `termo_cancelamento_assinado_em`).
- Atualizar o copy do card "Cotação" e do alerta "Próximo passo":
  - Sem assinatura ainda: "Você pode adiantar a cotação agora. O link público só será enviado/liberado após o titular antigo assinar o termo de cancelamento."
  - Após cotação criada e sem assinatura ainda: badge/aviso "Link público bloqueado — aguardando assinatura do termo".
- Remover o `handleRealizarCotacao` que mostra `toast.error('Aguardando assinatura...')`.

### 2. Edge — `supabase/functions/vincular-cotacao-troca/index.ts`
- Remover o gate `if (!sol.termo_cancelamento_assinado_em) return 409 TERMO_NAO_ASSINADO` (linhas 54-59).
- Manter todo o resto (idempotência, cross-check `dados_extras.solicitacao_troca_id`, atribuição vendedor, snapshot SGA).
- **Não** disparar WhatsApp do link público para o novo titular nessa edge se a assinatura ainda não aconteceu. Atualmente o WhatsApp pós-vinculação vai pro **vendedor** (notificando a atribuição) — esse mantém. O envio do link ao **novo titular** é tratado no item 4.

### 3. Página pública — `src/pages/public/CotacaoPublica*.tsx` (ou hook equivalente)
- Adicionar gate: se a cotação tem `tipo_entrada='troca_titularidade'` e a solicitação vinculada ainda não tem `termo_cancelamento_assinado_em`, renderizar tela bloqueada ("Aguardando o titular anterior assinar o termo de cancelamento. Você receberá um WhatsApp assim que o link for liberado.") em vez do fluxo da cotação.
- Carregar o estado da solicitação via `useSolicitacaoTrocaPublicaPorCotacao` (já existe) com refetch a cada 15s + realtime já configurado — atualiza automaticamente quando a assinatura cair.

### 4. Disparo do link público após assinatura — `supabase/functions/autentique-webhook/index.ts` (ou ponto onde `termo_cancelamento_assinado_em` é gravado)
- No mesmo update que grava `termo_cancelamento_assinado_em` e migra status para `aguardando_cadastro`, verificar se `cotacao_id` já existe na solicitação:
  - Se **sim**: disparar WhatsApp para o novo titular com o link público da cotação (template existente de envio de cotação) — usar `sendMetaTemplate` com `cotacao_link_publico` ou similar.
  - Se **não**: nada a fazer — o envio acontece naturalmente quando o consultor criar a cotação depois (item 5).

### 5. Edge `vincular-cotacao-troca` — envio condicional do link ao novo titular
- Após vincular a cotação, se `sol.termo_cancelamento_assinado_em` JÁ estiver preenchido (cenário "consultor criou cotação depois"), disparar WhatsApp do link público ao novo titular.
- Se ainda não estiver assinado, gravar apenas a cotação; o envio ocorre no item 4 quando a assinatura chegar.

### 6. Banco — nenhuma migration necessária
- `solicitacoes_troca_titularidade` já tem `cotacao_id` nullable e `termo_cancelamento_assinado_em`.
- `cotacoes.dados_extras.solicitacao_troca_id` já é a chave de cross-check.

---

## Não-objetivos

- Não alterar o fluxo de **criação** da solicitação (continua disparando o termo de cancelamento automaticamente).
- Não alterar o fluxo de Cadastro/Monitoramento — esses continuam acionados após a assinatura do termo.
- Não alterar o prazo "meia-noite" (cron `cron-expirar-trocas-titularidade`).
- Não mexer em `criar-solicitacao-troca-titularidade` (já está OK: cria com `cotacao_id=null` e dispara termo).

---

## Validação manual depois

1. Criar nova solicitação de troca → termo enviado, status `cotacao_em_andamento`, botão "Realizar Cotação" **já liberado**.
2. Clicar "Realizar Cotação" antes da assinatura → cotação criada e vinculada, badge "Link público bloqueado — aguardando assinatura".
3. Tentar abrir `/cotacao/p/:token` em janela anônima → tela de bloqueio "Aguardando assinatura do titular anterior".
4. Antigo titular assina o termo (Autentique facial) → WhatsApp com link público chega no novo titular automaticamente, página pública abre normalmente, status migra para `aguardando_cadastro`.
5. Cenário alternativo: assinar o termo **antes** de criar a cotação → ao clicar "Realizar Cotação" depois, WhatsApp do link público é enviado imediatamente (item 5).
