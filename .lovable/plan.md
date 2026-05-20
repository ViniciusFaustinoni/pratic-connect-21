## Diagnóstico

A cotação **COT-20260520-135559488-186** não foi promovida canonicamente para Cadastro no backend.

### Evidências da cotação
- **cotação** `1366694f-5baa-4b2c-b306-28af6e80eeac`
- **solicitação de troca** `637e3fea-7622-400a-b3da-a178e61e33e8`
- `cotacoes.numero = COT-20260520-135559488-186`
- `cotacoes.status = enviada`
- `cotacoes.status_contratacao = aguardando`
- `cotacoes.origem_troca_titularidade = true`
- `solicitacoes_troca_titularidade.status = cotacao_em_andamento`
- `solicitacoes_troca_titularidade.termo_cancelamento_assinado_em = 2026-05-20 15:26:45+00`
- `solicitacoes_troca_titularidade.aprovado_cadastro_em = null`
- `solicitacoes_troca_titularidade.aprovado_monitoramento_em = null`
- `solicitacoes_troca_titularidade.autovistoria_concluida_em = null`

## Conclusão

O fluxo canônico **não quebrou no gatilho de promoção**. O problema é que a **UI de Cadastro está incluindo `cotacao_em_andamento` na fila “Aguardando Cadastro”**, mesmo quando a solicitação ainda não atingiu o ponto canônico.

### Por que isso prova que não foi promoção indevida
A promoção canônica da troca para Cadastro depende do trigger:
- `fn_troca_promove_cadastro_via_cotacao`
- trigger `trg_troca_promove_cadastro_via_cotacao`

Esse trigger só muda a solicitação para `aguardando_cadastro` quando:
- `cotacoes.status_contratacao` vira `aguardando_aprovacao_cadastro`
- e a cotação é `origem_troca_titularidade = true`

Nesta cotação, o status atual é:
- `status_contratacao = aguardando`

Ou seja: **o trigger nunca disparou** para este caso.

## Gap encontrado

### 1) Fila de Cadastro com filtro errado
A tela de processos de Cadastro está tratando estes status como pendentes:
- `aguardando_termo_cancelamento`
- `aguardando_cadastro`
- `cotacao_em_andamento`

Locais encontrados:
- `src/pages/cadastro/ProcessosOperacionais.tsx`
- `src/hooks/useProcessosOperacionaisCount.ts`

Na prática, isso faz a troca aparecer em uma aba rotulada como **Aguardando Cadastro** antes da hora, embora o registro continue corretamente em `cotacao_em_andamento`.

### 2) Mensagem do modal está desatualizada
Em `src/components/troca-titularidade/ModalDetalhesTroca.tsx`, o texto ainda diz que o botão Aprovar aparece quando o titular antigo assina o termo e a solicitação muda para **Aguardando Cadastro**.

Isso está desalinhado com a regra atual, porque após a assinatura do termo a solicitação fica em:
- `cotacao_em_andamento`

E só deve ir para:
- `aguardando_cadastro`

quando a cotação atingir `aguardando_aprovacao_cadastro`.

## O que não encontrei
- Não há evidência de caminho duplicado promovendo esse caso para `aguardando_cadastro`
- Não há evidência de chamada de `aprovar-troca-cadastro`
- Não há evidência de `status_contratacao` avançando para `aguardando_aprovacao_cadastro`
- Os logs consultados não mostram promoção indevida; o estado persistido continua `cotacao_em_andamento`

## Plano de correção

1. **Remover `cotacao_em_andamento` da fila/contadores de “Aguardando Cadastro”**
   - ajustar filtros da tela e badges para que só `aguardando_cadastro` represente fila real do Cadastro

2. **Criar separação visual correta para trocas “em andamento”**
   - manter visibilidade operacional do caso, mas fora da fila de aprovação do Cadastro
   - rotular como etapa pré-cadastro / link público em andamento

3. **Corrigir textos explicativos do modal**
   - alinhar mensagens ao fluxo canônico atual
   - deixar explícito que termo assinado não manda mais para Cadastro automaticamente

4. **Validar com esta cotação como caso real**
   - confirmar que **COT-20260520-135559488-186** deixa de aparecer como “Aguardando Cadastro”
   - confirmar que só aparecerá nessa fila quando `status_contratacao` virar `aguardando_aprovacao_cadastro`

## Detalhes técnicos

```text
Fluxo canônico atual da troca:
termo assinado -> solicitacao.status = cotacao_em_andamento
novo titular conclui link público
cotacao.status_contratacao = aguardando_aprovacao_cadastro
trigger trg_troca_promove_cadastro_via_cotacao
solicitacao.status = aguardando_cadastro
cadastro aprova manualmente
solicitacao.status = aguardando_monitoramento
```

Se você aprovar, eu implemento o ajuste dos filtros e da comunicação da UI para eliminar esse falso positivo.