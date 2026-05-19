## Relembrando o fluxo canônico da Troca de Titularidade

Esta é a regra acordada (e já documentada em `mem://logic/sales/troca-titularidade-cotacao-on-demand` + `mem://logic/operations/troca-titularidade-promocao-cadastro-canonica`):

```text
1. Consultor monta a cotação on-demand (independente do termo)
   └─ cotacoes.origem_troca_titularidade=true,
      dados_extras.solicitacao_troca_id=<id da solicitação>
2. Termo de cancelamento é enviado ao titular ANTIGO (Autentique, biometria facial)
3. Titular antigo assina o termo
   └─ autentique-webhook:
        • solicitacoes_troca_titularidade.status = 'cotacao_em_andamento'
        • solicitacoes_troca_titularidade.termo_cancelamento_assinado_em = NOW
        • veículo recebe em_troca_titularidade=true e cobertura suspensa
   └─ Só nesse momento o LINK PÚBLICO do novo titular é liberado para avançar
      (Plano → Documentos → Contrato → Vistoria → Pagamento)
4. Novo titular completa o link público
5. Cadastro analisa manualmente (sem auto-aprovação)
6. Monitoramento decide vistoria/manutenção e aprova
7. efetivar-troca-titularidade transfere o veículo
```

A cotação NUNCA fica bloqueada pelo termo. O que é bloqueado é apenas o **avanço do novo titular dentro do link público** até `termo_cancelamento_assinado_em` ficar preenchido.

---

## Diagnóstico do caso reportado (COT-20260519-181838041-120)

O estado no banco está correto:

| Campo | Valor |
|---|---|
| `solicitacoes_troca_titularidade.status` | `cotacao_em_andamento` |
| `termo_cancelamento_assinado_em` | `2026-05-19 21:38:55+00` ✓ |
| `cotacao.dados_extras.solicitacao_troca_id` | vinculado ✓ |
| `cotacao.status_contratacao` | `aguardando` (esperando o novo titular escolher o plano) |

Apesar disso, a tela pública continua exibindo o card genérico **"Aguardando análise"** (com timeline indicando "Documentos do novo titular" como passo atual). Isso vem do fallback default em `TelaAnaliseTrocaTitularidade.tsx`, acionado quando `status='cotacao_em_andamento'` **com** `termo_cancelamento_assinado_em` preenchido — combinação que nenhum dos branches cobre hoje, então cai no texto genérico.

Há também dois pontos de fragilidade que somam ao problema:

1. **Gate em `CotacaoContratacao.tsx`** (linha 642) usa `!solicitacaoTroca.termo_cancelamento_assinado_em`. Está correto, mas o hook público (`useSolicitacaoTrocaPublica`) só revalida a cada **15s** e depende do realtime — se o realtime perdeu o evento na hora da assinatura, o titular pode ficar travado vendo a tela antiga até atualizar a página.
2. **Webhook `autentique-webhook`** registra a assinatura mas não dispara nenhuma notificação ao novo titular avisando que o link foi liberado. Hoje ele depende de o cliente reabrir o link por conta própria.

---

## Plano de correção

### 1. UI — desfazer o fallback enganoso em `TelaAnaliseTrocaTitularidade.tsx`

Adicionar branch explícito para `status === 'cotacao_em_andamento' && termoAssinadoEm`:

- Ícone `CheckCircle2` verde
- Título: **"Link liberado — continue sua contratação"**
- Descrição curta confirmando que o termo foi assinado e mostrando que o próximo passo é Escolher o Plano / completar Documentos
- Botão CTA **"Continuar"** que recarrega a página (`window.location.reload()`) — força o `CotacaoContratacao` a re-avaliar o gate e renderizar o stepper.

Isso elimina o "Aguardando análise" mostrado mesmo após a liberação.

### 2. Hook público — reagir mais rápido à assinatura

Em `useSolicitacaoTrocaPublica.ts`:

- Reduzir `refetchInterval` de 15s para **5s** apenas enquanto `termo_cancelamento_assinado_em` ainda for nulo (after-sign volta para 15s).
- Adicionar `refetchOnWindowFocus: true` para capturar o caso em que o cliente recebe a notificação e volta para a aba.

Sem mudar RLS nem schema.

### 3. Webhook — notificar o novo titular ao assinar o termo

Em `supabase/functions/autentique-webhook/index.ts`, dentro do bloco que marca `termo_cancelamento_assinado_em` (linhas 314-364):

- Após o update, enfileirar uma mensagem WhatsApp para o telefone do **novo titular** (vindo de `cotacoes.telefone1_solicitante` da cotação canônica vinculada), usando template existente ou texto livre via Evolution:
  > "Olá {{nome}}, o titular anterior do veículo {{placa}} assinou o termo de cancelamento. Continue sua contratação aqui: {{link_publico}}"
- Não-bloqueante (try/catch), respeitando `mem://infrastructure/whatsapp/messaging-safety-and-idempotency`.

### 4. Defesa em profundidade no webhook

Após o `UPDATE` em `solicitacoes_troca_titularidade`, conferir `rowCount`. Se 0, logar `[autentique-webhook][ALERTA] update da troca não afetou linhas` com `documentId` + `solicId` para facilitar diagnóstico futuro.

### 5. (Opcional) Cron de reconciliação

Criar/usar cron existente para varrer a cada 5 min solicitações onde o documento Autentique aparece como `signature.accepted` mas `termo_cancelamento_assinado_em` continua NULL, e reaplicar o efeito do webhook. Marcar como Opcional — só executar se a etapa 4 mostrar discrepâncias recorrentes.

---

## Escopo / Não escopo

- **No escopo:** UI da tela de espera, hook público de polling, webhook (notificação + log), nada de business rule nova.
- **Fora do escopo:** mudar regras de aprovação (Cadastro segue manual), mexer em `efetivar-troca-titularidade`, mexer em RLS, mexer no fluxo de cotação on-demand.
- **Sem migrações de banco.**

---

## Arquivos previstos

- `src/components/troca-titularidade/TelaAnaliseTrocaTitularidade.tsx` — novo branch + CTA
- `src/hooks/useSolicitacaoTrocaPublica.ts` — refetchInterval condicional + focus
- `supabase/functions/autentique-webhook/index.ts` — WhatsApp ao novo titular + log de alerta

## Verificação após implementação

1. Reabrir o link público da `COT-20260519-181838041-120` → deve renderizar o stepper na etapa "Escolha do Plano" imediatamente (gate liberado).
2. Simular novo termo assinado em outra cotação de troca: confirmar que o WhatsApp é disparado e que a UI sai do "Aguardando…" sem precisar de F5 manual em até 5s.
3. Conferir logs do `autentique-webhook` para garantir que o `rowCount` é 1 e o WhatsApp foi enfileirado.
