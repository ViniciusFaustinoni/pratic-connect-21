## Objetivo
Entender por que o fluxo do Riquelme não se completou corretamente após o agendamento, corrigir o caso dele e eliminar a recorrência para outros contratos no mesmo cenário.

## Causa raiz validada
O problema não é só visual nem só de fila.

### 1) O agendamento público de rota salva, mas não materializa a operação
- A edge `supabase/functions/agendar-vistoria-completa/index.ts` **apenas grava** `cotacoes.vistoria_completa_*`.
- Ela **não cria** `instalacoes`, `servicos` ou `vistorias` e também **não chama** `criar-instalacao-pos-pagamento` depois do save.
- Para o Riquelme, isso aconteceu exatamente assim:
  - `cotacoes.vistoria_completa_data_agendada = 2026-05-13`
  - `contratos.cadastro_aprovado = false`
  - **nenhum** registro em `servicos`, `instalacoes` ou `vistorias`

### 2) Após o bloqueio anti-limbo, o fluxo ficou sem “retomada”
- O guard de `aprovar-proposta` foi correto: ao não encontrar agendamento operacional, ele reverteu `cadastro_aprovado=false`.
- Porém, depois que o cliente finalmente agenda, **não existe etapa automática** que reexecute a materialização operacional para contratos já devolvidos a Propostas Pendentes.
- Resultado: o cliente vê “agendado”, mas o backoffice continua sem instalação/serviço real.

### 3) A fila de Propostas Pendentes ainda ignora esse tipo de agendamento
- Em `src/hooks/usePropostasPendentes.ts`, a listagem em lote só lê `vistoria_data_agendada`.
- Ela **não reconhece** `vistoria_completa_data_agendada` na consulta principal.
- Por isso, mesmo com agendamento salvo na cotação, `temQualquerEtapa` fica falso e a proposta some da lista.
- A inconsistência é confirmada porque a busca unitária do mesmo hook já trata `vistoria_completa_*` corretamente.

## Conclusão do diagnóstico
O limbo atual é a combinação de **duas falhas em sequência**:

```text
cliente agenda no link público
→ agendar-vistoria-completa salva só em cotacoes.vistoria_completa_*
→ não cria instalação/serviço
→ contrato permanece com cadastro_aprovado=false
→ Propostas Pendentes não enxerga vistoria_completa_*
→ item some da fila e também não entra no Monitoramento
```

## Plano de correção
### 1) Corrigir a retomada operacional após agendamento público
**Arquivo:** `supabase/functions/agendar-vistoria-completa/index.ts`

Após salvar `vistoria_completa_*`, adicionar retomada idempotente do fluxo:
- localizar o contrato vinculado
- se o contrato estiver `assinado`
- e **não houver** `instalacoes` / `servicos` / `vistorias` reais para a cotação/contrato
- chamar `criar-instalacao-pos-pagamento` com `skipPaymentCheck: true`

Objetivo:
- quando o cliente agenda depois de um `sem_agendamento`, o sistema materializa a operação automaticamente
- sem depender de nova aprovação manual só para “reativar” o backend

### 2) Garantir idempotência e proteção contra duplicatas
**Arquivos:**
- `supabase/functions/agendar-vistoria-completa/index.ts`
- `supabase/functions/criar-instalacao-pos-pagamento/index.ts`

Validar e preservar:
- não criar duplicata se já existir instalação ativa para a cotação/contrato
- não duplicar serviço se a instalação já tiver sido materializada por outro caminho
- reaproveitar a lógica já existente em `criar-instalacao-pos-pagamento`

### 3) Corrigir a fila de Propostas Pendentes
**Arquivo:** `src/hooks/usePropostasPendentes.ts`

Na listagem principal:
- incluir `vistoria_completa_data_agendada`
- incluir `vistoria_completa_horario_agendado`
- incluir `vistoria_completa_periodo`
- montar `instalacaoAgendada` usando:
  - primeiro `vistoria_completa_*`
  - depois `vistoria_*`
  - depois sobrescrita por instalação real, se existir

Objetivo:
- contratos devolvidos ao Cadastro continuarem visíveis enquanto aguardam materialização/execução
- alinhar a listagem com a lógica já usada no detalhe

### 4) Ajustar o caso do Riquelme
Aplicar a correção sistêmica e validar com o contrato do Riquelme:
- cotação `COT-20260509-184816784-883`
- contrato `3d4ce412-7680-489b-ad5a-72fde1628773`

Resultado esperado:
- materialização da instalação/serviço sem duplicidade
- reaparição correta em **Propostas Pendentes** enquanto ainda estiver no escopo do Cadastro
- saída para Monitoramento somente quando houver registro operacional real

### 5) Validar outros casos já contaminados
Fazer uma varredura por contratos com este padrão:
- `contratos.status = 'assinado'`
- `cadastro_aprovado = false` ou revertido recentemente
- `cotacoes.vistoria_completa_data_agendada IS NOT NULL`
- sem `instalacoes`, `servicos`, `vistorias` e sem `agendamentos_base`

Objetivo:
- identificar todos os contratos que já sofreram o mesmo limbo
- usar a mesma correção sistêmica para recuperar os casos compatíveis

## Resultado esperado
- O motivo do erro fica resolvido na origem, não só mascarado na lista.
- O Riquelme sai do limbo.
- Novos agendamentos públicos de rota deixam de parar no meio do fluxo.
- Propostas Pendentes volta a refletir corretamente os contratos devolvidos ao Cadastro.

## Arquivos previstos
- `supabase/functions/agendar-vistoria-completa/index.ts`
- `supabase/functions/criar-instalacao-pos-pagamento/index.ts` (se precisar reforço de idempotência)
- `src/hooks/usePropostasPendentes.ts`
- possivelmente ponto de UI relacionado apenas para validação visual, sem mudar regra de negócio