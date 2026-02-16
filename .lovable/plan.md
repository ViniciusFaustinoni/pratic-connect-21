
# Fluxo Pos-Aprovacao Completo: Cotacao, Pecas e Oficina

## Visao Geral do Fluxo Desejado

```text
1. Aprovacao -> WhatsApp + Termo no email (ja funciona)
2. Assinatura do Termo -> Gerar cobranca + enviar link pagamento (ja funciona)
3. Pagamento confirmado -> Status "pecas_em_cotacao" + notificar associado
4. Analista marca "pecas chegaram" no orcamento -> notificar associado
5. Somente apos pecas chegarem -> botao "Enviar para Oficina" aparece
6. Envio para oficina -> atribui veiculo + notifica associado + regulador acompanha
```

## O que ja funciona

- Etapa 1: `aprovar-sinistro` envia WhatsApp e cria termo Autentique
- Etapa 2: `autentique-webhook` detecta assinatura, gera cobranca Asaas e envia link via WhatsApp
- Etapa 3 parcial: `asaas-webhook` detecta pagamento, atualiza `cota_paga=true` e muda status para `pagamento_confirmado`

## O que precisa mudar

### 1. Novo status "pecas_em_cotacao" + mensagem ao associado

**Arquivo:** `src/types/sinistros.ts`
- Adicionar `'pecas_em_cotacao'` ao tipo `StatusSinistro`
- Adicionar label: `'Pecas em Cotacao'`
- Adicionar cor: `'bg-amber-100 text-amber-800'`
- Adicionar ao workflow: `pagamento_confirmado: ['pecas_em_cotacao']`

**Arquivo:** `src/types/app-associado.ts`
- Adicionar `'pecas_em_cotacao'` ao tipo `StatusSinistro` e seus labels/cores

**Arquivo:** `src/pages/eventos/SinistroAnalise.tsx`
- Adicionar `pecas_em_cotacao` ao `statusConfig`

**Arquivo:** `supabase/functions/asaas-webhook/index.ts`
- Na secao de cota_participacao (linha ~674), mudar status de `pagamento_confirmado` para `pecas_em_cotacao`
- Alterar mensagem WhatsApp para informar que as pecas estao sendo cotadas

### 2. Novo campo "pecas_chegaram" no sinistro

**Migracao SQL:**
```sql
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS pecas_chegaram boolean DEFAULT false;
ALTER TABLE sinistros ADD COLUMN IF NOT EXISTS pecas_chegaram_em timestamptz;
```

### 3. Botao "Pecas Chegaram" na tela do Analista

**Arquivo:** `src/pages/eventos/SinistroAnalise.tsx`

Na secao de acoes, quando `sinistro.status === 'pecas_em_cotacao'`:
- Exibir banner informativo "Pecas em processo de cotacao"
- Exibir botao "Marcar Pecas como Recebidas"
- Ao clicar, atualizar `sinistro.pecas_chegaram = true`, `pecas_chegaram_em = now()` e status para `pronto_para_oficina`
- Enviar WhatsApp ao associado informando que as pecas chegaram e o veiculo sera encaminhado para a oficina
- Registrar historico

### 4. Condicao do botao "Enviar para Oficina"

**Arquivo:** `src/pages/eventos/SinistroAnalise.tsx`

Alterar a condicao de exibicao do botao "Enviar para Oficina":
- Atualmente: `sinistro.status === 'aprovado' && sinistro.cota_paga`
- Novo: `sinistro.status === 'pronto_para_oficina'` (que so acontece apos pecas chegarem)

O bloco de `pronto_para_oficina` ja existe (linhas 1322-1340), ele mostra "Atribuir Fornecedores". Vamos ajustar para mostrar "Enviar para Oficina" com selecao de oficina.

### 5. Notificacao WhatsApp ao enviar para oficina

**Arquivo:** `src/components/sinistros/EnviarParaOficinaDialog.tsx`

Apos criar a OS e atualizar o sinistro para `em_reparo`:
- Enviar WhatsApp ao associado informando que o veiculo foi encaminhado para a oficina
- Incluir nome da oficina na mensagem

### 6. Mensagem WhatsApp no pagamento (asaas-webhook)

**Arquivo:** `supabase/functions/asaas-webhook/index.ts`

Alterar a mensagem atual (linha ~710) de "O reparo sera agendado em breve" para:
"As pecas do seu veiculo estao sendo cotadas junto aos nossos fornecedores. Voce sera notificado sobre cada etapa!"

## Detalhes Tecnicos

### Fluxo de Status Atualizado

```text
aprovado -> (assinatura termo) -> (pagamento cota) -> pecas_em_cotacao -> pronto_para_oficina -> em_reparo
```

### Resumo de Arquivos

| Arquivo | Alteracao |
|---|---|
| `src/types/sinistros.ts` | Adicionar status `pecas_em_cotacao`, labels, cores e workflow |
| `src/types/app-associado.ts` | Adicionar status `pecas_em_cotacao` |
| `src/pages/eventos/SinistroAnalise.tsx` | Adicionar status no config, bloco de acoes para `pecas_em_cotacao` com botao "Pecas Chegaram", ajustar condicao do botao "Enviar para Oficina" |
| `supabase/functions/asaas-webhook/index.ts` | Mudar status pos-pagamento para `pecas_em_cotacao` + nova mensagem WhatsApp |
| `src/components/sinistros/EnviarParaOficinaDialog.tsx` | Enviar WhatsApp ao associado apos criar OS |
| Migracao SQL | Adicionar colunas `pecas_chegaram` e `pecas_chegaram_em` na tabela `sinistros` |
| `src/hooks/useEventosDashboard.ts` | Incluir `pecas_em_cotacao` no grupo de funil adequado |
