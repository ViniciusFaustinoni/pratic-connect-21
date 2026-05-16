## Objetivo
Restaurar o fluxo canônico da cotação para que nenhum caso entre em Monitoramento antes da etapa correta de Cadastro, eliminar duplicidades na fila de Aprovação de Associados e corrigir o caso do Caio Herculano Gomes da Silva.

## Diagnóstico confirmado

### 1) O Caio aparece 3 vezes por mistura de duas filas diferentes na mesma tela
Na rota `Monitoramento > Aprovação de Associados`, a tela junta:
- **fila de análise** (`useInstalacoesAguardandoAprovacao`) baseada em `servicos` concluídos
- **fila de ativação** (`useInstalacoesAguardandoAtivacao`) baseada em `instalacoes` concluídas

Para o Caio existem exatamente estes 3 registros operacionais:
- `servico` `5c63c4fe-84bd-4c20-bfa4-9d84be8be705` — `vistoria_entrada`, `concluida`
- `servico` `ce188250-c53b-4403-8b6e-2e708054c617` — `instalacao`, `concluida`
- `instalacao` `39ca3173-0baf-4235-b9b5-aa67cade299e` — `concluida`

A query consolidada da fila mostra que o problema não é isolado:
- **Caio**: 3 itens
- **Romario Rocha Soares**: 3 itens
- **Felipe Campanha Soares**: 2 itens
- **Icaro de Carvalho Omari Rubim**: 2 itens

### 2) O serviço foi pulado porque a instalação nasceu concluída, sem atribuição
No caso do Caio, a instalação foi criada assim:
- `instalacao 39ca...`
- `status = concluida`
- `instalador_id = null`
- `instalador_responsavel_id = null`
- `rota_id = null`
- `prestador_atribuido_em = null`
- `dispensa_rastreador = true`

Ou seja: o registro já entrou como se o trabalho de campo estivesse terminado, sem técnico, sem rota e sem atribuição. Isso quebra exatamente a etapa 5 do fluxo que você definiu.

### 3) A regra “Cadastro antes de Monitoramento” foi quebrada no banco
Existe uma migration já aplicada que cria promoção automática do Cadastro para o Monitoramento:
- `supabase/migrations/20260515140337_4e90b04d-68e2-411c-aa5b-73a77380c492.sql`

Ela cria a função `fn_auto_promover_cadastro_pos_operacao` e triggers em:
- `servicos`
- `agendamentos_base`
- `instalacoes`

Essa lógica faz `contratos.cadastro_aprovado = true` automaticamente quando há avanço operacional. Isso contradiz sua regra de negócio, porque o processo passa a depender do operacional em vez da aprovação manual do Cadastro.

Há evidência real dessa quebra em auditoria, com contratos marcados como:
- `Cadastro auto-aprovado por avanço operacional (origem=backfill:reconciliacao)`

### 4) O backend atual também materializa instalação cedo demais para casos sem rastreador
No `aprovar-proposta`, quando o veículo não precisa de rastreador, o código ainda cria instalação com:
- `dispensa_rastreador: true`

E no fluxo do Caio isso se combinou com registros concluídos, o que empurrou o caso para Monitoramento sem passar pela atribuição correta.

### 5) O caso do Caio é moto 0km e está sendo tratado como se pudesse encerrar o operacional
Dados confirmados:
- Associado: `CAIO HERCULANO GOMES DA SILVA`
- Veículo: `0KM0B9C8`
- Status do associado: `aguardando_instalacao`
- Contrato: `ea20ff65-12c1-40a0-842d-4c58fc3387dd`
- `cadastro_aprovado = true`
- Instalação marcada como concluída sem técnico

Isso explica o bug maior: o sistema entendeu que já havia etapa operacional suficiente para expor o caso na fila de Monitoramento, mesmo sem a atribuição/ciclo de campo respeitado.

## Plano de correção

### 1) Remover a autoaprovação do Cadastro por avanço operacional
- Revogar a lógica de `fn_auto_promover_cadastro_pos_operacao`
- Remover os triggers que marcam `cadastro_aprovado=true` a partir de `servicos`, `instalacoes` e `agendamentos_base`
- Garantir que `cadastro_aprovado` só mude por ação explícita do fluxo de Cadastro

### 2) Corrigir a origem da fila de Aprovação de Associados
Separar o que hoje está misturado em uma mesma lista:
- **Análise do Monitoramento**: apenas o item canônico que realmente deve ser analisado
- **Ativação de rastreador**: somente quando for um caso próprio de ativação, sem duplicar o mesmo veículo que ainda está em análise

Regra de deduplicação:
- um veículo/contrato não pode aparecer ao mesmo tempo em `analise` e `ativacao`
- se existir `instalacao` concluída e `servico` concluído para a mesma origem, a UI deve mostrar apenas o estado canônico

### 3) Corrigir a materialização para sub-FIPE / dispensa de rastreador
No backend:
- impedir que instalação seja criada já como concluída sem técnico
- impedir que serviço de campo terminal apareça sem ter passado por atribuição
- revisar a criação para casos com `dispensa_rastreador=true`, principalmente moto 0km e fluxos abaixo da FIPE

### 4) Ajustar `aprovar-proposta` para respeitar estritamente o fluxo canônico
Ao aprovar no Cadastro:
- marcar somente a aprovação cadastral
- criar o operacional correto em estado não terminal
- nunca jogar direto na fila de Monitoramento por efeito colateral de instalação/serviço concluído
- para casos sem rastreador, o Monitoramento só deve receber quando o caminho previsto realmente estiver satisfeito

### 5) Backfill corretivo dos casos já contaminados
Executar correção de dados para:
- Caio Herculano Gomes da Silva
- demais contratos autoaprovados por `backfill:reconciliacao` ou por trigger operacional
- remover itens duplicados ou terminalizados indevidamente
- recolocar cada caso na fila correta: Cadastro ou Monitoramento, conforme o estágio real

## Arquivos e áreas a ajustar
- `src/pages/monitoramento/AcionamentosRouboFurto.tsx`
- `src/hooks/useAprovacaoMonitoramento.ts`
- `src/hooks/useVistoriaCompletaAnalise.ts`
- `supabase/functions/aprovar-proposta/index.ts`
- `supabase/functions/criar-instalacao-pos-pagamento/index.ts`
- nova migration para remover os triggers/função de autoaprovação e fazer o backfill corretivo

## Validação após a correção
- O Caio deve aparecer **uma vez só** na fila correta
- Nenhum caso deve entrar em Monitoramento com `cadastro_aprovado=false`
- Nenhuma instalação/serviço deve nascer `concluida` sem atribuição real
- Contratos hoje autoaprovados por trigger devem voltar ao estágio correto
- A fila de Monitoramento deve refletir apenas casos que realmente já passaram pelo Cadastro

## Resultado esperado
Depois da implementação:
- o processo volta a obedecer seu fluxo oficial
- o Cadastro deixa de ser pulado
- a atribuição do serviço volta a ser obrigatória antes da conclusão operacional
- a fila de Aprovação de Associados deixa de mostrar duplicidades e estados falsos