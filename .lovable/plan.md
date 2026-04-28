# Plano: histórico do associado não mostra a Aprovação do Monitoramento

## Causa raiz

Investiguei a tela `Monitoramento > Aprovação de Associados` (`AcionamentosRouboFurto.tsx`) e o hook `useAprovacaoMonitoramento`. Quando o analista aprova/reprova, a mutation grava em `associados_historico` com `tipo`:

- `protecao_360_aprovada_monitoramento`
- `protecao_360_reprovada_monitoramento`

A INSERT funciona (RLS exige `is_funcionario(auth.uid())` e o usuário Kleytonn é funcionário válido). O problema está na **leitura/renderização** no detalhe do associado:

1. `src/hooks/useAssociadoHistoricoCompleto.ts` mantém um mapa fixo `tipoDbParaTimeline`. Os dois tipos acima **não estão nesse mapa** → caem no fallback `'observacao_adicionada'` (vira uma observação genérica e perde a identidade).
2. `src/components/cadastro/TimelineHistorico.tsx` define `TipoEvento` (union), `eventoConfig` (ícone/cor/label) e `filterCategories`. Nenhum dos três contém os tipos da aprovação do monitoramento.

Resultado: mesmo quando o registro existe na tabela, ele aparece como "Observação adicionada" sem ícone próprio, sem rótulo correto e sem categoria de filtro — dando a sensação de que "não está aparecendo no histórico".

Como confirmação adicional: hoje há **0 registros** com esses dois tipos em `associados_historico` (todas as instalações que entram na fila ainda não foram processadas pelo Monitoramento — KPIs `0/0/0` na imagem). Mas, assim que forem, continuariam invisíveis pelo motivo acima.

## Correções

### 1. `src/components/cadastro/TimelineHistorico.tsx`
- Adicionar à union `TipoEvento`:
  - `'protecao_360_aprovada_monitoramento'`
  - `'protecao_360_reprovada_monitoramento'`
- Adicionar entradas em `eventoConfig` com ícone `ShieldCheck`/`ShieldOff` (ou `CheckCircle`/`XCircle`), cor verde/vermelha e labels `"Proteção 360 ativada"` / `"Proteção 360 reprovada"`.
- Incluir os dois novos tipos na categoria de filtro `instalacoes` (já agrupa o ciclo de vida da instalação).

### 2. `src/hooks/useAssociadoHistoricoCompleto.ts`
- Adicionar duas linhas ao mapa `tipoDbParaTimeline`:
  - `'protecao_360_aprovada_monitoramento': 'protecao_360_aprovada_monitoramento'`
  - `'protecao_360_reprovada_monitoramento': 'protecao_360_reprovada_monitoramento'`

### 3. (Opcional, recomendado) `src/pages/monitoramento/AprovacaoInstalacaoDetalhe.tsx`
- Mostrar uma seção "Última decisão do monitoramento" lendo o registro mais recente de `associados_historico` com esses dois tipos para o associado, para o analista ver decisões anteriores no próprio detalhe da aprovação. (Apenas se o usuário quiser; do contrário fica fora do escopo.)

## Validação

Após o deploy, fazer uma aprovação de teste pela tela `Monitoramento > Aprovação de Associados`:
- O detalhe do associado deve passar a exibir o evento "Proteção 360 ativada" com ícone próprio e cor verde, no topo da timeline.
- O filtro "Instalações" deve incluir o novo evento.
- Os KPIs "Aprovados Hoje" / "Reprovados Hoje" continuam funcionando (já leem `associados_historico` por esses tipos).

## Fora de escopo

- Não alterar o esquema do banco — o tipo é `varchar` livre, não há CHECK/enum a atualizar.
- Não alterar as RLS — INSERT e SELECT já permitem o fluxo (funcionário insere, funcionário lê; associado lê o próprio).
