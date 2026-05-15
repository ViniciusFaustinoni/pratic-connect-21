## Diagnóstico

Hoje, depois que o link público termina (cliente assina contrato + agenda + paga + a vistoria/instalação é executada), o serviço é encerrado por `aplicar-conclusao-vistoria` (rota técnico) ou `concluir-instalacao-prestador` setando `servicos.status = 'concluida'`. A fila do Monitoramento (`useInstalacoesAguardandoAprovacao`) lê **direto** `servicos.status='concluida'` — **sem checar se o Cadastro aprovou** (`contratos.cadastro_aprovado=true`).

Pior ainda: a fila do Cadastro (`usePropostasPendentes`) tira o item da lista assim que `instalacaoConcluida` ou `vistoriaBaseRealizada` ficam true. Resultado: a proposta nunca aparece para o Cadastro e cai direto no Monitoramento — exatamente o que o associado MARCUS VINICIUS reportou.

## Fluxo correto (linear)

```text
Link público (assina → agenda → paga → vistoria/instalação executada)
        ↓
[CADASTRO aprova manualmente]   ← gate novo
        ↓
[MONITORAMENTO aprova]          ← com ou sem R/F
        ↓
ativar-associado
```

## Mudanças (2 arquivos, sem migração)

### 1. `src/hooks/useAprovacaoMonitoramento.ts`
Filtrar a fila do Monitoramento para mostrar **só** serviços cujo contrato tenha `cadastro_aprovado=true`:
- Em `useInstalacoesAguardandoAprovacao`: além de `tipo IN (instalacao, vistoria_entrada)` e `status='concluida'`, também buscar `instalacao_origem_id → instalacoes.contrato_id → contratos.cadastro_aprovado`. Excluir os que não têm aprovação do Cadastro.
- Em `useAprovacaoMonitoramentoStats`: aplicar o mesmo filtro no contador `aguardando`.
- Manter o filtro atual de `cobertura_total !== true`.

### 2. `src/hooks/usePropostasPendentes.ts`
Ajustar a regra de saída para que o item permaneça na fila do Cadastro até aprovação manual:
- Remover `vistoriaBaseRealizada` e `instalacaoConcluida` da composição de `propostaJaConcluida`.
- Manter saída apenas por: `cadastro_aprovado=true` (autovistoria já tinha; agora vale para todos), `veiculo.status='ativo'`, ou contrato cancelado.
- Para não-autovistoria com instalação/vistoria já realizada, exibir badge **"Aguardando aprovação do Cadastro — vistoria realizada"** (substituindo o "Pendente Vistoria Inicial" quando aplicável).

## Por que essa abordagem

- **Não muda o link público nem a edge `aprovar-proposta`**: o cliente continua agendando/pagando/instalando como hoje.
- **Não cria status novo**: usa a flag existente `contratos.cadastro_aprovado` como gate.
- **Não toca em `aplicar-conclusao-vistoria` / `concluir-instalacao-prestador`**: eles continuam encerrando o serviço — a fila do Monitoramento é que passa a respeitar o gate.
- **Compatível com o fluxo Sub-FIPE / autovistoria** (já passa pelo Cadastro hoje).
- **Compatível com troca de titularidade** (Cadastro já é manual lá).
- Casos legados que JÁ chegaram na fila do Monitoramento sem aprovação do Cadastro precisam ser aprovados pelo Cadastro primeiro (basta abrir Propostas Pendentes — voltarão a aparecer).

## Aceite

- Cliente conclui link público com rastreador instalado: proposta aparece em **Cadastro › Propostas Pendentes** com instalação concluída + botão Aprovar.
- Enquanto Cadastro não aprova, **NÃO** aparece em Monitoramento › Aprovações.
- Após Cadastro aprovar (`cadastro_aprovado=true`): item some de Propostas Pendentes e aparece em Monitoramento › Aprovações.
- Monitoramento aprova → fluxo segue para `ativar-associado` como hoje.
- Sub-FIPE e troca de titularidade continuam funcionando exatamente como antes.