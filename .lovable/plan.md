## O que aconteceu quando você clicou em "Aprovar"

Solicitação testada: `06037fb8-84bb-4856-a723-2b2baea55c5d` — veículo `2315cece…`, novo associado `988dbfa9…`, cotação `9db388ed…`.

A edge `aprovar-troca-monitoramento` executou nesta ordem:

1. ✅ Atualizou `solicitacoes_troca_titularidade.status` → **`liberada_para_assinatura`** (por isso veio o toast "Liberado para assinatura" e o card sumiu da aba "Pendentes" e foi para "Aprovadas").
2. ✅ Disparou `ativar-associado` para o novo titular (ativação do contrato novo).
3. ❌ Disparou `efetivar-troca-titularidade` que retornou **404 "Solicitação não encontrada"** (log às 21:51:51Z) — nada foi efetivado de fato.

Estado real no banco depois do clique: `status=liberada_para_assinatura`, `sga_status=pendente`, `sga_codigo_associado_novo=NULL`, `sga_codigo_veiculo_novo=NULL`, `aprovado_monitoramento_em` preenchido — ou seja, **a troca NÃO foi concluída**: veículo não migrou de titular, contrato antigo não foi cancelado, SGA não foi sincronizado e a solicitação não chegou a `efetivada`.

## Por que falhou (causa-raiz)

`supabase/functions/efetivar-troca-titularidade/index.ts` linha 184–188 ainda lê da tabela legada **`chat_solicitacoes_ia`**:

```ts
const { data: solicitacao, error: solError } = await supabase
  .from("chat_solicitacoes_ia")        // ← tabela errada
  .select("*")
  .eq("id", solicitacao_id)
  .single();
```

Mas o fluxo novo usa **`solicitacoes_troca_titularidade`** (com colunas `novo_titular_dados`, `veiculo_id`, `novo_associado_id`, `cotacao_id`, `associado_antigo_id`). Como o ID da solicitação nova não existe em `chat_solicitacoes_ia`, o `.single()` devolve `PGRST116` e a função aborta antes de qualquer escrita real. Toda a lógica seguinte (cenário A/B, cancelar contrato antigo, criar contrato novo, mover veículo, sincronizar SGA, atualizar status para `efetivada`) nunca roda.

## Comportamento correto esperado (regra do fluxo)

Pelas regras do projeto (Troca de Titularidade) o passo 7 é:

> Após a vistoria (ou direto, quando dispensada), Monitoramento aprova → **troca é efetivada**: contrato anterior é cancelado, veículo é transferido, contrato novo entra em vigor, associado/veículo são enviados ao SGA, e a solicitação some das filas indo para `efetivada`.

Não existe etapa de "assinatura" depois do Monitoramento — o termo de filiação do novo titular já foi assinado lá no início do link público. Portanto o status `liberada_para_assinatura` aqui é semanticamente errado para esse caminho: o aprovar do Monitoramento deveria levar direto para `efetivada` (ou `aguardando_sga` se Hinova falhar, com retry).

## Plano de correção

### 1. Corrigir `efetivar-troca-titularidade` para ler da tabela nova
Substituir o bloco que lê `chat_solicitacoes_ia` por uma leitura em `solicitacoes_troca_titularidade` e mapear os campos:

- `solicitacao.associado_id` → `solicitacao.associado_antigo_id`
- `solicitacao.dados_novo_titular` → `solicitacao.novo_titular_dados`
- `dados.veiculo_id` → `solicitacao.veiculo_id` (já presente em coluna própria)
- `dados.resultado_protocolo` / `solicitacao.resultado_protocolo` → manter `cenario_override` vindo do caller (que já passa `'B'`); para legado, deixar fallback `'B'`.
- Manter compatibilidade: tentar `solicitacoes_troca_titularidade` primeiro; só cair em `chat_solicitacoes_ia` se `cenario_override` não vier (legado puro).

### 2. Atualizar status final na própria efetivação
No final do fluxo de sucesso (perto da linha 829, junto com o update de `sga_*`), gravar também:

```ts
status: 'efetivada',
efetivada_em: new Date().toISOString(),
```

Assim o card sai de "Aprovadas" e vai para o estado terminal correto.

### 3. Ajustar `aprovar-troca-monitoramento` para refletir o status certo no caminho feliz
- Trocar o update intermediário de `liberada_para_assinatura` por um marcador de transição (ex.: manter `aguardando_monitoramento` até `efetivar` retornar) **ou** mudar para `'efetivada'` **somente após** a edge `efetivar-troca-titularidade` responder `success: true`. Em caso de falha, registrar `sga_status='falha'` e manter um status que ainda apareça em "Pendentes" do Monitoramento para reprocesso.
- Trocar a label do toast no front (`useSolicitacoesTroca.ts` linha 240) para "Troca efetivada" no caminho de sucesso.

### 4. Reprocessar a solicitação que ficou travada
Para `06037fb8-84bb-4856-a723-2b2baea55c5d`: depois do fix, chamar manualmente `efetivar-troca-titularidade` com `{ solicitacao_id, cenario_override: 'B' }` para concluir a transferência (veículo + cancelamento do contrato antigo + SGA). Confirmar que `sga_status` vai a `sincronizado` e `status` a `efetivada`.

### 5. Verificações pós-fix
- Edge logs de `efetivar-troca-titularidade` sem `PGRST116`.
- `solicitacoes_troca_titularidade` com `status='efetivada'`, `sga_status='sincronizado'`, `sga_codigo_associado_novo` e `sga_codigo_veiculo_novo` preenchidos.
- `veiculos.associado_id` migrou para o novo titular; contrato antigo `cancelado`; novo contrato `ativo`.
- Card sai da fila de Monitoramento.

## Arquivos que serão tocados

- `supabase/functions/efetivar-troca-titularidade/index.ts` (leitura da tabela + update final de status)
- `supabase/functions/aprovar-troca-monitoramento/index.ts` (ordem do update de status + tratamento do retorno de efetivação)
- `src/hooks/useSolicitacoesTroca.ts` (label do toast no caminho de sucesso)

Sem migração de schema necessária — `solicitacoes_troca_titularidade` já tem todas as colunas usadas.
