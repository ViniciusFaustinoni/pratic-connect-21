# Plano para corrigir a raiz do fluxo de troca de titularidade

## Objetivo

Fazer a troca seguir o fluxo canônico definido:  
Plano → Documentos → Assinatura do novo contrato → (sem autovistoria por padrão; vistoria só se Monitoramento pedir) → Pagamento ( quando houver) → Cadastro → Monitoramento → Efetivação.

## Raiz do problema

Hoje o erro não está em um único ponto. Há uma divergência estrutural entre dois eixos de estado:

1. `solicitacoes_troca_titularidade.status`
2. `cotacoes.status_contratacao`

A tela pública usa os dois para decidir o que renderizar, mas eles não evoluem com a mesma regra.
Além disso, há múltiplos pontos escrevendo status no fluxo público, o que permite regressão visual ou promoção indevida.

## O que será corrigido

### Etapa 1 — Definir a fonte canônica por fase

Separar claramente qual entidade manda em cada momento:

- **Antes do novo titular concluir o link**: manda `solicitacoes_troca_titularidade.status`
- **Durante a contratação pública**: manda `cotacoes.status_contratacao`
- **Depois que a cotação chegar em `aguardando_aprovacao_cadastro**`: a solicitação pode ser promovida para `aguardando_cadastro`

Resultado esperado:

- termo antigo assinado não significa “ir para Cadastro”
- solicitação em `cotacao_em_andamento` não pode derrubar a UI para “Em análise” se a cotação ainda está em docs/contrato

### Etapa 2 — Corrigir a busca e leitura da solicitação pública

Ajustar `useSolicitacaoTrocaPublicaPorCotacao` para:

- usar apenas status válidos do enum
- localizar a solicitação ativa de forma determinística
- priorizar o vínculo explícito por `dados_extras.solicitacao_troca_id`
- usar `cotacao_id` só como fallback real
- evitar falso negativo que faz a UI cair no estado órfão ou no fallback de análise

Resultado esperado:

- a tela sempre encontra a solicitação correta da troca atual
- não mistura solicitações antigas/canceladas com a vigente

### Etapa 3 — Remover a mistura indevida de sinais na tela pública

Refatorar `CotacaoContratacao.tsx` para que a decisão de renderização siga regras explícitas:

- `TelaAnaliseTrocaTitularidade` só aparece em 3 situações:
  - antes da assinatura do termo do titular antigo
  - após a cotação atingir `aguardando_aprovacao_cadastro` e a solicitação já estar em `aguardando_cadastro` ou além
  - quando a troca estiver reprovada/cancelada/expirada
- nas etapas de documentos, contrato e pagamento, a tela não pode usar `solicitacao.status` para esconder o stepper enquanto a cotação ainda estiver em contratação
- a progressão visual deve depender de `cotacoes.status_contratacao` durante o fluxo do novo titular

Resultado esperado:

- após envio de documentos, a etapa seguinte será assinatura do contrato
- após assinatura, segue o fluxo contratado, sem salto visual para Cadastro

### Etapa 4 — Corrigir o contrato/assinatura para não haver escritores concorrentes

Consolidar a lógica de `EtapaAssinaturaContrato.tsx`, que hoje tem vários caminhos alterando `status_contratacao`:

- reduzir atualizações duplicadas para `documentos_ok` e `contrato_assinado`
- impedir que realtime, polling e inicialização escrevam estados diferentes para a mesma cotação sem critério
- garantir que essa etapa apenas reflita:
  - contrato inexistente → gerar
  - contrato com link → aguardar assinatura
  - contrato assinado → `contrato_assinado`

Resultado esperado:

- a cotação não entra em estado inconsistente entre contrato, UI e webhook

### Etapa 5 — Corrigir respostas enganosas das edge functions

Ajustar `vincular-cotacao-troca` para não retornar um status semântico errado (`aguardando_cadastro`) quando a regra real é apenas “vinculada / pronta para continuar”.

Também vou revisar se mais alguma edge function da troca devolve payload que contradiz o banco e pode ser usado pela UI.

Resultado esperado:

- frontend não recebe um “estado narrativo” incorreto
- payload das edges passa a espelhar o estado real

### Etapa 6 — Blindar a promoção para Cadastro

Manter a promoção para `aguardando_cadastro` exclusivamente quando a cotação realmente concluir a fase pública correta.

Vou validar se o gatilho atual está coerente com o fluxo de troca sem autovistoria obrigatória e, se necessário, ajustar a condição de promoção para refletir a etapa correta da troca.

Resultado esperado:

- Cadastro só recebe o caso quando o novo titular tiver realmente concluído o link público combinado

### Etapa 7 — Validação ponta a ponta

Executar validação controlada do fluxo:

1. criar nova troca
2. assinar termo do titular antigo
3. abrir link público do novo titular
4. enviar documentos
5. confirmar que a próxima etapa é assinatura do contrato
6. assinar contrato
7. confirmar que não cai em “Aguardando Cadastro” antes da hora
8. concluir pagamento
9. confirmar promoção correta para Cadastro
10. aprovar no Cadastro e seguir para Monitoramento

## Detalhes técnicos

### Arquivos que devem entrar na correção

- `src/hooks/useSolicitacaoTrocaPublica.ts`
- `src/pages/public/CotacaoContratacao.tsx`
- `src/components/cotacao-publica/EtapaAssinaturaContrato.tsx`
- `supabase/functions/vincular-cotacao-troca/index.ts`
- possivelmente a trigger/migração da promoção de troca para cadastro, se a regra precisar ser refinada

### Estratégia de implementação

- primeiro alinhar a leitura de estado
- depois remover decisões de UI baseadas em sinal errado
- por fim consolidar quem pode escrever cada status

## Critério de sucesso

O problema estará resolvido quando:

- documentos não levarem mais direto para Cadastro
- contrato assinado não provocar fallback visual incorreto
- a tela pública continuar no stepper até a conclusão real da fase pública
- Cadastro só entrar no fluxo quando a cotação alcançar a etapa canônica definida

## Fora de escopo

- redesenhar o fluxo completo de Monitoramento
- refazer o processo comercial da criação da troca
- mexer em efetivação final, exceto se a validação mostrar dependência direta com esta raiz