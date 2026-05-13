## Diagnóstico — KOU6D37

Rastreando a placa no banco:

- **Cotação nova de troca:** `3f0408b9-939d-47c9-890a-0dc1d98bd43c`
  - `tipo_entrada = 'troca_titularidade'`
  - `status_contratacao = 'vistoria_agendada'`
  - `contrato_gerado_id = NULL` ← causa direta do erro "Contrato não encontrado"
- **Solicitação de troca:** `52cc74c1-910d-4ac7-b854-84cd28db7a0d`
  - `status = 'liberada_para_assinatura'`
  - `termo_cancelamento_assinado_em` ✅
  - `aprovado_cadastro_em` ✅
  - **`cotacao_id = NULL`** ← raiz do problema

A edge function `vincular-cotacao-troca` **nunca foi invocada** (sem logs). Resultado: a cotação nova ficou órfã da solicitação. Como `useSolicitacaoTrocaPublicaPorCotacao` filtra por `cotacao_id`, ela retorna `null`, `trocaLiberada` fica `false`, **a etapa Contrato nunca dispara `contrato-gerar`**, e ao chegar em Pagamento o `EtapaPagamentoCotacao.buscarContrato()` lança `"Contrato não encontrado…"`.

A toast em `CotacaoFormDialog` (linha 1729) já avisa quando a vinculação falha, mas o fluxo **continua salvando a cotação e navegando**, deixando o cliente avançar pelo link público até travar no fim.

## Correção em 3 frentes

### 1. Data fix imediato (KOU6D37)
Vincular a solicitação à cotação existente:
```sql
UPDATE solicitacoes_troca_titularidade
   SET cotacao_id = '3f0408b9-939d-47c9-890a-0dc1d98bd43c'
 WHERE id = '52cc74c1-910d-4ac7-b854-84cd28db7a0d'
   AND cotacao_id IS NULL;
```
Após isso, o link público volta a enxergar `liberada_para_assinatura`, mostra a etapa Contrato corretamente, e o `contrato-gerar` é chamado normalmente — destravando a Pagamento.

### 2. Hardening na criação da cotação (`src/components/cotacoes/CotacaoFormDialog.tsx`)
Quando `origemTroca` truthy:
- Mover `vincular-cotacao-troca` para **antes** de `toast.success` e `navigate`.
- Se a edge falhar, **fazer rollback** da cotação criada (`DELETE FROM cotacoes WHERE id = novaCotacao.id`) ou marcar `status='falha_vinculacao'`, exibir toast de erro **bloqueante** e impedir navegação.
- Garante que nunca exista cotação `tipo_entrada=troca_titularidade` órfã.

### 3. Guard defensivo no link público (`src/pages/public/CotacaoContratacao.tsx`)
Após `useSolicitacaoTrocaPublicaPorCotacao` carregar:
- Se `isTrocaTitularidade && !solicitacaoTroca && !isLoadingTroca` → renderizar tela de erro clara ("Solicitação de troca não vinculada — contate o suporte"), em vez de deixar o usuário navegar até Pagamento e ver erro técnico de contrato.

### 4. Reconciliação retroativa (opcional, baixa prioridade)
Script único para varrer cotações com `tipo_entrada='troca_titularidade'` + `dados_extras->>'solicitacao_troca_id'` preenchido + solicitação correspondente sem `cotacao_id`, e vincular as remanescentes. Evita que outros casos como KOU6D37 estejam silenciosamente quebrados.

## Fora de escopo
- Mudar fluxo de aprovação de cadastro/monitoramento.
- Tocar em `contrato-gerar`, geração Autentique ou cobrança Asaas.
- Alterar a regra de carências/cenários isentos.

## Validação
1. Rodar o data fix → recarregar o link público da cotação `3f0408b9` → confirmar que a etapa Contrato aparece com `TelaAnaliseTrocaTitularidade` (caso ainda não liberada) ou aciona `contrato-gerar` (já liberada) → seguir para Pagamento sem erro.
2. Criar nova troca de teste, simular falha em `vincular-cotacao-troca` (revogar permissão temporariamente) → confirmar que a cotação **não é persistida** e a UI mostra erro bloqueante.
3. Tentar abrir link público de cotação órfã → confirmar tela de erro nova em vez do erro técnico de "Contrato não encontrado".
